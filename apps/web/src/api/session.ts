import type { components } from './schema';

type Schemas = components['schemas'];
export type SessionUser = Schemas['UserDto'];

/** Error de la API con su `code` estable (docs/lectio-arquitectura-api.md §2.7). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`;
  const message = typeof body.message === 'string' ? body.message : response.statusText;
  return new ApiError(response.status, code, message, body);
}

type Message =
  { type: 'token'; accessToken: string; expiresAt: number; user: SessionUser } | { type: 'logout' };

interface Channel {
  postMessage(message: Message): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<Message>) => void): void;
  close(): void;
}

interface Locks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export interface SessionDeps {
  fetch: typeof fetch;
  /** Web Locks: serializa el refresh entre pestañas. Sin él (tests, navegadores viejos), solo en esta. */
  locks?: Locks;
  channel?: Channel;
  /** Quién tenía la sesión en este navegador: sin red, la app sigue con esa cuenta. */
  remember?: RememberedUser;
  now?: () => number;
}

export interface RememberedUser {
  load(): SessionUser | null;
  save(user: SessionUser | null): void;
}

/** El último usuario en localStorage (solo su id y correo; nunca un token). */
export const rememberInBrowser: RememberedUser = {
  load() {
    try {
      const value = localStorage.getItem(USER_KEY);
      const user = value ? (JSON.parse(value) as SessionUser) : null;
      return user && typeof user.id === 'string' ? user : null;
    } catch {
      return null;
    }
  },
  save(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email }));
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* navegación privada: sin red, se abrirá como anónimo */
    }
  },
};

export type SessionState =
  | { status: 'unknown' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser }
  /** Había sesión y el refresh falló: el pergamino de login aparece encima, sin perder nada. */
  | { status: 'expired'; user: SessionUser };

/** Se renueva un poco antes de que venza, para no mandar un token que muere en el camino. */
const MARGIN_MS = 30_000;
const LOCK = 'lectio:refresh';
const USER_KEY = 'lectio:user';

/**
 * La sesión del navegador (docs/lectio-arquitectura-api.md §1.9). El access token vive
 * solo en memoria; el refresh token, en una cookie httpOnly que JavaScript no ve.
 *
 * El refresh rota el token: si dos pestañas lo usaran a la vez con la misma cookie, la API
 * vería una reutilización y revocaría toda la familia (cerraría la sesión en todas). Por
 * eso se serializa con Web Locks entre pestañas y, dentro del lock, primero se mira si
 * otra pestaña ya lo renovó (el token nuevo llega por BroadcastChannel).
 */
export class Session {
  #token: { value: string; expiresAt: number } | null = null;
  #state: SessionState = { status: 'unknown' };
  #refreshing: Promise<boolean> | null = null;
  /** El último refresh no llegó a la API (sin red), a diferencia de uno rechazado. */
  #unreachable = false;
  readonly #listeners = new Set<(state: SessionState) => void>();
  readonly #deps: Required<Omit<SessionDeps, 'locks' | 'channel' | 'remember'>> & SessionDeps;

  constructor(deps: SessionDeps) {
    this.#deps = { now: () => Date.now(), ...deps };
    deps.channel?.addEventListener('message', ({ data }) => {
      if (data.type === 'token') {
        this.#token = { value: data.accessToken, expiresAt: data.expiresAt };
        this.#set({ status: 'authenticated', user: data.user });
      } else {
        this.#token = null;
        this.#set({ status: 'anonymous' });
        this.#deps.remember?.save(null);
      }
    });
  }

  get state(): SessionState {
    return this.#state;
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Al abrir la app: si la cookie sigue viva, se recupera la sesión sin pedir la contraseña.
   * Sin red, se sigue con la cuenta que había en este navegador (las salas muestran lo
   * guardado): el token se pide al volver la conexión y, si la cookie venció, aparece el
   * pergamino como en cualquier sesión vencida.
   */
  async restore(): Promise<SessionState> {
    const ok = await this.refresh();
    if (!ok && this.#state.status === 'unknown') {
      const user = this.#unreachable ? (this.#deps.remember?.load() ?? null) : null;
      this.#set(user ? { status: 'authenticated', user } : { status: 'anonymous' });
    }
    return this.#state;
  }

  async login(email: string, password: string): Promise<SessionUser> {
    const response = await this.#deps.fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await toApiError(response);
    const body = (await response.json()) as Schemas['LoginResponseDto'];
    this.#accept(body.accessToken, body.expiresIn, body.user);
    return body.user;
  }

  async register(email: string, password: string): Promise<SessionUser> {
    const response = await this.#deps.fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await toApiError(response);
    return this.login(email, password);
  }

  async logout(): Promise<void> {
    await this.#deps
      .fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(() => undefined); // sin red, la sesión local se cierra igual
    this.#token = null;
    this.#set({ status: 'anonymous' });
    this.#deps.remember?.save(null);
    this.#deps.channel?.postMessage({ type: 'logout' });
  }

  /** Tras una sesión vencida, seguir como anónimo (sin llamar a la API: ya no hay sesión). */
  forget(): void {
    if (this.#state.status === 'expired') this.#set({ status: 'anonymous' });
  }

  /** Un access token válido, renovándolo si está por vencer; null si no hay sesión. */
  async accessToken(): Promise<string | null> {
    if (this.#token && this.#token.expiresAt - MARGIN_MS > this.#deps.now()) {
      return this.#token.value;
    }
    if (this.#state.status !== 'authenticated') return null;
    return (await this.refresh()) ? this.#token!.value : null;
  }

  /** Renueva el access token. Una sola vez aunque lo pidan varias peticiones a la vez. */
  refresh(): Promise<boolean> {
    this.#refreshing ??= this.#refreshAcrossTabs().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  async #refreshAcrossTabs(): Promise<boolean> {
    const stale = this.#token?.value;
    const run = async () => {
      // Mientras esperaba el lock, otra pestaña pudo renovarlo y avisar por el canal.
      if (this.#token && this.#token.value !== stale && this.#fresh()) return true;
      return this.#requestRefresh();
    };
    return this.#deps.locks ? this.#deps.locks.request(LOCK, run) : run();
  }

  async #requestRefresh(): Promise<boolean> {
    let response: Response;
    try {
      response = await this.#deps.fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      this.#unreachable = true;
      return false; // sin red: se reintenta en la próxima petición, sin cerrar la sesión
    }
    this.#unreachable = false;
    if (!response.ok) {
      this.#token = null;
      this.#deps.remember?.save(null);
      const previous = this.#state;
      this.#set(
        previous.status === 'authenticated' || previous.status === 'expired'
          ? { status: 'expired', user: previous.user }
          : { status: 'anonymous' },
      );
      return false;
    }
    const body = (await response.json()) as Schemas['AccessTokenDto'];
    this.#accept(body.accessToken, body.expiresIn, userFromToken(body.accessToken));
    return true;
  }

  #fresh(): boolean {
    return this.#token !== null && this.#token.expiresAt - MARGIN_MS > this.#deps.now();
  }

  #accept(accessToken: string, expiresIn: number, user: SessionUser): void {
    const expiresAt = this.#deps.now() + expiresIn * 1000;
    this.#token = { value: accessToken, expiresAt };
    this.#set({ status: 'authenticated', user });
    this.#deps.remember?.save(user);
    this.#deps.channel?.postMessage({ type: 'token', accessToken, expiresAt, user });
  }

  #set(state: SessionState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}

/** El JWT trae el id y el correo (sub, email): no hace falta otra petición tras un refresh. */
export function userFromToken(token: string): SessionUser {
  const payload = token.split('.')[1] ?? '';
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  const { sub, email } = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))),
  ) as { sub: string; email: string };
  return { id: sub, email };
}
