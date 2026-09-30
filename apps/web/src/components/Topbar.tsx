import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Sound } from '../theme/sound';
import { Icon } from './art';
import { ModeButton, SettingsButton } from './ThemeTools';

/** Barra superior de las salas: marca, portada, cuenta, día/noche y ajustes. */
export function Topbar({ subtitle, children }: { subtitle: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const { state, session } = useSession();
  const ask = useAuthPrompt((s) => s.ask);

  return (
    <header className="topbar">
      <div className="brand">
        Lectio<small>{subtitle}</small>
      </div>
      <div className="tools">
        {children}
        <button
          type="button"
          className="tool"
          title="Volver a la pantalla de título"
          onClick={() => {
            Sound.play('toggle');
            navigate('/');
          }}
        >
          <Icon name="home" />
          <span className="label">Portada</span>
        </button>
        {state.status === 'authenticated' ? (
          <button
            type="button"
            className="tool account"
            title={`Sesión de ${state.user.email} · salir`}
            aria-label="Salir"
            onClick={() => {
              Sound.play('toggle');
              void session.logout().then(() => navigate('/biblioteca'));
            }}
          >
            <Icon name="key" />
            <span className="label">Salir</span>
          </button>
        ) : (
          <button
            type="button"
            className="tool account"
            title="Entrar a tu cuenta"
            aria-label="Entrar"
            onClick={() => ask({ tab: 'login' })}
            disabled={state.status === 'unknown'}
          >
            <Icon name="key" />
            <span className="label">Entrar</span>
          </button>
        )}
        <ModeButton />
        <SettingsButton />
      </div>
    </header>
  );
}
