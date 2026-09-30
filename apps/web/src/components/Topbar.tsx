import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { install, useInstall } from '../pwa/install';
import { useOnline } from '../pwa/online';
import { Sound } from '../theme/sound';
import { Icon } from './art';
import { ModeButton, SettingsButton } from './ThemeTools';

/**
 * Barra superior de las salas: marca, portada, cuenta, día/noche y ajustes. Sin conexión
 * lo dice, y "Entrar" espera a que vuelva la red. "Instalar" aparece solo cuando el
 * navegador lo ofrece (frontend §2.4).
 */
export function Topbar({ subtitle, children }: { subtitle: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const { state, session } = useSession();
  const ask = useAuthPrompt((s) => s.ask);
  const online = useOnline();
  const canInstall = useInstall((s) => s.offer !== null);

  return (
    <header className="topbar">
      <div className="brand">
        Lectio<small>{subtitle}</small>
      </div>
      {!online && (
        <span className="offline-chip" role="status">
          Sin conexión
        </span>
      )}
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
        {canInstall && (
          <button
            type="button"
            className="tool install"
            title="Instalar Lectio en este dispositivo"
            onClick={() => {
              Sound.play('toggle');
              void install();
            }}
          >
            <Icon name="install" />
            <span className="label">Instalar</span>
          </button>
        )}
        {state.status === 'authenticated' ? (
          <button
            type="button"
            className="tool account"
            title={
              online
                ? `Sesión de ${state.user.email} · salir`
                : 'Sin conexión: para salir hace falta internet'
            }
            aria-label="Salir"
            // Sin red, la cookie de la sesión seguiría viva en la API: al volver, entrarías solo.
            disabled={!online}
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
            title={online ? 'Entrar a tu cuenta' : 'Sin conexión: para entrar hace falta internet'}
            aria-label="Entrar"
            onClick={() => ask({ tab: 'login' })}
            disabled={state.status === 'unknown' || !online}
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
