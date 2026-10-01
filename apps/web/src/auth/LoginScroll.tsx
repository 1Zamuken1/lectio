import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useSession } from '../app/context';
import { Sound } from '../theme/sound';

type Tab = 'login' | 'register';

/** Mensajes por `code` de la API (docs/lectio-arquitectura-api.md §2.7), no por su texto. */
function describe(error: unknown, tab: Tab): string {
  if (!(error instanceof ApiError))
    return 'No hay conexión con Lectio. Revisa tu red e inténtalo de nuevo.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'El correo o la contraseña no coinciden.';
    case 'EMAIL_TAKEN':
      return 'Ya hay una cuenta con ese correo. ¿Quieres entrar con ella?';
    case 'VALIDATION_FAILED': {
      const errors = (error.body.errors as Array<{ messages: string[] }> | undefined) ?? [];
      return errors.flatMap((e) => e.messages).join(' ') || error.message;
    }
    case 'HTTP_429':
    case 'TOO_MANY_REQUESTS':
      return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
    default:
      // 502/503: la API no contesta (caída o todavía arrancando); no es la contraseña.
      if (error.status >= 500)
        return 'Lectio no responde en este momento. Espera unos segundos e inténtalo de nuevo.';
      return tab === 'login'
        ? 'No se pudo entrar. Inténtalo de nuevo.'
        : 'No se pudo crear la cuenta.';
  }
}

/**
 * Pergamino de entrada (decisión de diseño de la fase 6): baja desenrollándose desde
 * arriba, con dos sellos de lacre como pestañas, "Entrar" y "Crear cuenta". Lo viste el
 * mundo activo; en Clásico es una tarjeta sobria. Si la sesión venció, aparece encima de
 * lo que se estaba haciendo, sin cortar el audio ni perder la posición.
 */
export function LoginScroll({
  initialTab = 'login',
  reason,
  onClose,
  onDone,
}: {
  initialTab?: Tab;
  /** Por qué aparece: "Tu sesión se cerró…", "Para subir libros…". */
  reason?: string;
  onClose?: () => void;
  onDone?: () => void;
}) {
  const { session, state } = useSession();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState(state.status === 'expired' ? state.user.email : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    Sound.play('open');
    // Con el correo ya puesto (sesión vencida), se va directo a la contraseña.
    (email ? passwordField : first).current?.focus();
  }, []); // solo al abrir

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'login') await session.login(email.trim(), password);
      else await session.register(email.trim(), password);
      Sound.play('confirm');
      onDone?.();
    } catch (failure) {
      setError(describe(failure, tab));
      Sound.play('toggle');
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (next: Tab) => {
    if (next === tab) return;
    Sound.play('page');
    setTab(next);
    setError(null);
  };

  return (
    <div
      className="scroll-veil"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <section
        className="login-scroll"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="scroll-rod scroll-rod-top" aria-hidden="true" />
        <div className="scroll-sheet">
          <div className="scroll-seals" role="tablist" aria-label="Cuenta">
            {(
              [
                ['login', 'Entrar'],
                ['register', 'Crear cuenta'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                className="seal"
                aria-selected={tab === value}
                aria-controls={`${id}-form`}
                onClick={() => switchTo(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <h2 id={`${id}-title`} className="scroll-title">
            {tab === 'login' ? 'Firma para entrar' : 'Abre tu estudio'}
          </h2>
          {reason && <p className="scroll-reason">{reason}</p>}

          <form id={`${id}-form`} className="scroll-form" onSubmit={submit}>
            <label>
              <span>Correo</span>
              <input
                ref={first}
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              <span>Contraseña</span>
              <span className="password-field">
                <input
                  ref={passwordField}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={tab === 'register' ? 8 : undefined}
                  maxLength={128}
                  aria-describedby={tab === 'register' ? `${id}-hint` : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="reveal"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>
            {tab === 'register' && (
              <p id={`${id}-hint`} className="scroll-hint">
                Al menos 8 caracteres. Una frase que recuerdes sirve mejor que una palabra rara.
              </p>
            )}
            <p className="scroll-error" role="alert" aria-live="assertive">
              {error}
            </p>
            <button type="submit" className="scroll-submit" disabled={busy}>
              {busy ? 'Un momento…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
          {onClose && (
            <button type="button" className="scroll-dismiss" onClick={onClose}>
              {state.status === 'expired' ? 'Seguir sin cuenta' : 'Ahora no'}
            </button>
          )}
        </div>
        <div className="scroll-rod scroll-rod-bottom" aria-hidden="true" />
      </section>
    </div>
  );
}
