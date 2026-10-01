import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sound } from '../theme/sound';
import { Theme, WORLDS, isSelectable, useTheme } from '../theme/theme';
import { Icon } from './art';

/** Botón día/noche de la barra superior. */
export function ModeButton() {
  const { night } = useTheme();
  return (
    <button
      type="button"
      className="tool mode-toggle"
      aria-label={night ? 'Cambiar a día' : 'Cambiar a noche'}
      title={night ? 'Noche · cambiar a día' : 'Día · cambiar a noche'}
      onClick={() => {
        Sound.play('toggle');
        Theme.set('mode', night ? 'day' : 'night');
      }}
    >
      <Icon name={night ? 'moon' : 'sun'} />
    </button>
  );
}

/** Botón que abre el panel de ajustes: mundo, sonido, música y compañero. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="tool settings-toggle"
        aria-label="Ajustes de apariencia y sonido"
        title="Mundo y sonido"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (!open) Sound.play('open');
          setOpen(!open);
        }}
      >
        <Icon name="settings" />
      </button>
      {open && <SettingsPanel anchor={anchor.current} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsPanel({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const theme = useTheme();
  const companion = WORLDS.find((w) => w.id === theme.world)?.companion;
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>();

  useLayoutEffect(() => {
    const rect = anchor?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(12, document.documentElement.clientWidth - rect.right),
      });
    }
    panel.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const option = (key: 'sfx' | 'music' | 'companion', label: string, hint: string) => (
    <label className="setting-row">
      <input
        type="checkbox"
        checked={theme[key]}
        onChange={(event) => {
          Theme.set(key, event.target.checked);
          // Después de guardar: al activar los efectos, este ya suena.
          Sound.play('toggle');
        }}
      />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );

  return (
    <div
      ref={panel}
      className="settings-panel"
      role="dialog"
      aria-label="Mundo y sonido"
      style={position}
    >
      <h2>Mundo</h2>
      <div className="world-options">
        {WORLDS.map((world) => (
          <button
            key={world.id}
            type="button"
            className="world-option"
            aria-pressed={theme.world === world.id}
            disabled={!isSelectable(world.id)}
            onClick={() => {
              Sound.play('select');
              Theme.set('world', world.id);
            }}
          >
            <strong>{world.name}</strong>
            <small>
              {world.ready
                ? world.tagline
                : isSelectable(world.id)
                  ? 'En desarrollo'
                  : 'Próximamente'}
            </small>
          </button>
        ))}
      </div>
      <h2>Sonido</h2>
      {option('sfx', 'Efectos de sonido', 'Al seleccionar y abrir')}
      {option('music', 'Música ambiente', 'Se pausa sola mientras suena el libro')}
      <label className="setting-row volume">
        <span>
          <strong>Volumen</strong>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={theme.volume}
          aria-label="Volumen de efectos y música"
          onChange={(event) => Theme.set('volume', Number(event.target.value))}
        />
      </label>
      {companion && (
        <>
          <h2>Compañía</h2>
          {option('companion', 'Mostrar compañero', companion)}
        </>
      )}
    </div>
  );
}
