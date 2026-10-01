import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { usePublicBooks } from '../api/queries';
import { useSession } from '../app/context';
import { PixelArt } from '../components/art';
import { ModeButton, SettingsButton } from '../components/ThemeTools';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { Theme, WORLDS, isSelectable, useTheme } from '../theme/theme';

const number = new Intl.NumberFormat('es');

/**
 * Pantalla de título (docs/lectio-temas.md §2): la escena del mundo, el logo y la
 * elección de mundo, como elegir partida. "Pulsa para comenzar" lleva a la biblioteca
 * pública: se puede leer y escuchar sin cuenta.
 */
export function TitleScreen() {
  const navigate = useNavigate();
  const { state } = useSession();
  const theme = useTheme();
  const books = usePublicBooks();
  const start = useRef<HTMLButtonElement>(null);
  const scene = useMemo(() => Pixel.scriptoriumScene({ desk: true }), []);

  useEffect(() => {
    // Primera visita: la portada muestra el Scriptorium; se cambia desde los mundos.
    if (!Theme.get().chosen) Theme.set('world', 'scriptorium');
    document.body.dataset.screen = 'title';
    start.current?.focus({ preventScroll: true });
  }, []);

  const count = books.data?.length;
  return (
    <main className="title-screen">
      <PixelArt className="scene" svg={scene} />
      <div className="title-banner">
        <h1 className="logo">Lectio</h1>
        <p className="tagline">Tu biblioteca, leída en voz alta</p>
      </div>
      <div className="title-card">
        <h2 className="slots-title">Elige tu mundo</h2>
        <div className="world-slots" role="group" aria-label="Mundo">
          {WORLDS.map((world, index) => (
            <button
              key={world.id}
              type="button"
              className="world-slot"
              aria-pressed={theme.world === world.id}
              disabled={!isSelectable(world.id)}
              onClick={() => {
                Sound.play('select');
                Theme.set('world', world.id);
              }}
            >
              <span className="slot-number" aria-hidden="true">
                0{index + 1}
              </span>
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
        <button
          ref={start}
          type="button"
          className="press-start"
          onClick={() => {
            Sound.play('start');
            // Con sesión, a tu estudio; sin ella, al catálogo público (se lee sin cuenta).
            navigate(state.status === 'authenticated' ? '/estudio' : '/biblioteca');
          }}
        >
          Pulsa para comenzar
        </button>
        <p className="title-footer">
          {count === undefined
            ? ' '
            : count === 1
              ? '1 libro en la biblioteca'
              : `${number.format(count)} libros en la biblioteca`}
        </p>
      </div>
      <div className="title-tools">
        <ModeButton />
        <SettingsButton />
      </div>
    </main>
  );
}
