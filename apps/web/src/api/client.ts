import { ApiError, Session, toApiError } from './session';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Se serializa como JSON (salvo FormData, que va tal cual). */
  body?: unknown;
  /** Para leer la respuesta sin parsear (audio, imágenes, 304). */
  raw?: boolean;
}

/**
 * Cliente de la API: pone el access token, y ante un 401 renueva la sesión una vez y
 * reintenta. Las rutas públicas funcionan igual sin sesión (sin cabecera Authorization).
 */
export class ApiClient {
  constructor(
    readonly session: Session,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(path, options);
    if (options.raw) return response as T;
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete(path: string) {
    return this.request<void>(path, { method: 'DELETE' });
  }

  /** La respuesta cruda si es 2xx o 304; si no, un ApiError con el code de la API. */
  async send(path: string, options: RequestOptions = {}): Promise<Response> {
    const token = await this.session.accessToken();
    let response = await this.#fetch(path, options, token);
    if (response.status === 401 && token) {
      // Venció entre medio (o el reloj del equipo va desfasado): una renovación y un reintento.
      if (await this.session.refresh()) {
        response = await this.#fetch(path, options, await this.session.accessToken());
      }
    }
    if (!response.ok && response.status !== 304) throw await toApiError(response);
    return response;
  }

  #fetch(path: string, { body, headers, ...init }: RequestOptions, token: string | null) {
    const merged = new Headers(headers);
    if (token) merged.set('Authorization', `Bearer ${token}`);
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      merged.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
    return this.fetcher(path, {
      ...init,
      headers: merged,
      body: payload,
      credentials: 'same-origin',
    });
  }
}

export { ApiError };
