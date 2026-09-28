/**
 * Cookie del refresh token (docs/lectio-arquitectura-api.md §1.9): httpOnly (JavaScript no
 * la lee), SameSite=Strict y limitada a /api/v1/auth, así viaja solo a estas rutas.
 */
export const REFRESH_COOKIE = 'lectio_refresh';
const PATH = '/api/v1/auth';

export interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
}

export interface CookieRequest {
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

export function setRefreshCookie(
  response: CookieResponse,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(response: CookieResponse, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure, sameSite: 'strict', path: PATH });
}

export function readRefreshCookie(request: CookieRequest): string | undefined {
  return request.cookies?.[REFRESH_COOKIE];
}

export function userAgentOf(request: CookieRequest): string | null {
  const agent = request.headers['user-agent'];
  return typeof agent === 'string' ? agent.slice(0, 300) : null;
}
