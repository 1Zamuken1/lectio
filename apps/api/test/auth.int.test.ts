import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});

beforeEach(async () => {
  await t.reset();
});

afterAll(async () => {
  await t.close();
});

const credentials = { email: 'lectora@example.com', password: 'una frase larga y segura' };

/** La cookie del refresh token tal como la manda el servidor, o undefined. */
function refreshCookie(response: { headers: Record<string, unknown> }): string | undefined {
  const cookies = (response.headers['set-cookie'] as string[] | undefined) ?? [];
  return cookies.find((c) => c.startsWith('lectio_refresh='));
}

/** Solo "nombre=valor", para reenviarla como lo haría el navegador. */
const asRequestCookie = (setCookie: string) => setCookie.split(';')[0]!;

async function registerAndLogin() {
  await t.http.post('/api/v1/auth/register').send(credentials).expect(201);
  const login = await t.http.post('/api/v1/auth/login').send(credentials).expect(200);
  return { login, cookie: asRequestCookie(refreshCookie(login)!) };
}

describe('registro', () => {
  it('crea la cuenta y no devuelve la contraseña ni su hash', async () => {
    const response = await t.http.post('/api/v1/auth/register').send(credentials).expect(201);
    expect(response.body).toEqual({ id: expect.any(String), email: credentials.email });
    const stored = await t.prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('normaliza el correo y rechaza el duplicado con 409 EMAIL_TAKEN', async () => {
    await t.http.post('/api/v1/auth/register').send(credentials).expect(201);
    const response = await t.http
      .post('/api/v1/auth/register')
      .send({ ...credentials, email: '  LECTORA@Example.com ' })
      .expect(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });

  it('valida los datos: 400 VALIDATION_FAILED con el campo y el motivo', async () => {
    const response = await t.http
      .post('/api/v1/auth/register')
      .send({ email: 'no-es-correo', password: 'corta', admin: true })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    const fields = response.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['admin', 'email', 'password']);
  });
});

describe('login', () => {
  it('entrega el access token y deja el refresh token en una cookie segura', async () => {
    const { login } = await registerAndLogin();
    expect(login.body).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
      user: { email: credentials.email },
    });
    const cookie = refreshCookie(login)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    // En la base solo queda el hash, nunca el token en claro.
    const token = cookie.split(';')[0]!.split('=')[1]!;
    const stored = await t.prisma.refreshToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
  });

  it('contraseña incorrecta y correo inexistente responden igual: 401 INVALID_CREDENTIALS', async () => {
    await t.http.post('/api/v1/auth/register').send(credentials).expect(201);
    const wrongPassword = await t.http
      .post('/api/v1/auth/login')
      .send({ ...credentials, password: 'otra frase distinta' })
      .expect(401);
    const unknownEmail = await t.http
      .post('/api/v1/auth/login')
      .send({ ...credentials, email: 'nadie@example.com' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('rutas protegidas', () => {
  it('sin token: 401 UNAUTHORIZED; con token: la cuenta', async () => {
    const anonymous = await t.http.get('/api/v1/users/me').expect(401);
    expect(anonymous.body.code).toBe('UNAUTHORIZED');

    const { login } = await registerAndLogin();
    const me = await t.http
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ id: login.body.user.id, email: credentials.email });
  });

  it('rechaza un token vencido y uno firmado con otro secreto', async () => {
    const { login } = await registerAndLogin();
    const payload = { sub: login.body.user.id, email: credentials.email };
    const expired = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync(payload, {
      expiresIn: -10,
      issuer: 'lectio',
    });
    const forged = await new JwtService({ secret: 'x'.repeat(48) }).signAsync(payload, {
      issuer: 'lectio',
    });
    for (const token of [expired, forged]) {
      const response = await t.http
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('refresh', () => {
  it('rota el refresh token y entrega un access token nuevo', async () => {
    const { cookie } = await registerAndLogin();
    const refreshed = await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(refreshed.body).toEqual({ accessToken: expect.any(String), expiresIn: 900 });
    const next = asRequestCookie(refreshCookie(refreshed)!);
    expect(next).not.toBe(cookie);

    await t.http
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
    // El nuevo sirve para volver a renovar.
    await t.http.post('/api/v1/auth/refresh').set('Cookie', next).expect(200);
  });

  it('reutilizar un token ya rotado revoca toda la familia (401 REFRESH_TOKEN_REUSED)', async () => {
    const { cookie: stolen } = await registerAndLogin();
    const legit = await t.http.post('/api/v1/auth/refresh').set('Cookie', stolen).expect(200);
    const legitCookie = asRequestCookie(refreshCookie(legit)!);

    // Alguien usa el token viejo (robado): se detecta y se cierra la sesión entera...
    const reuse = await t.http.post('/api/v1/auth/refresh').set('Cookie', stolen).expect(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
    expect(refreshCookie(reuse)).toMatch(/lectio_refresh=;/); // y se borra la cookie

    // ...también para el dueño legítimo, que debe volver a iniciar sesión.
    await t.http.post('/api/v1/auth/refresh').set('Cookie', legitCookie).expect(401);
    const active = await t.prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it('dos refresh simultáneos con el mismo token: solo uno gana', async () => {
    const { cookie } = await registerAndLogin();
    const results = await Promise.all([
      t.http.post('/api/v1/auth/refresh').set('Cookie', cookie),
      t.http.post('/api/v1/auth/refresh').set('Cookie', cookie),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);
  });

  it('sin cookie, con una inventada o vencida: 401 INVALID_REFRESH_TOKEN', async () => {
    const none = await t.http.post('/api/v1/auth/refresh').expect(401);
    expect(none.body.code).toBe('INVALID_REFRESH_TOKEN');
    await t.http.post('/api/v1/auth/refresh').set('Cookie', 'lectio_refresh=inventado').expect(401);

    const { cookie } = await registerAndLogin();
    await t.prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    expect(expired.body.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('logout', () => {
  it('revoca la sesión y borra la cookie; el refresh posterior falla', async () => {
    const { cookie } = await registerAndLogin();
    const logout = await t.http.post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    expect(refreshCookie(logout)).toMatch(/lectio_refresh=;/);

    const after = await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    expect(after.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('sin sesión también responde 204', async () => {
    await t.http.post('/api/v1/auth/logout').expect(204);
  });
});
