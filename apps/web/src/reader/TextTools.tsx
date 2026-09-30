import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../components/art';
import { Sound } from '../theme/sound';
import { MAX_SIZE, MIN_SIZE, useReaderPrefs, type ReadFont } from './prefs';

const FONTS: Array<{ id: ReadFont; name: string; hint: string }> = [
  { id: 'literata', name: 'Literata', hint: 'Serif de libro' },
  { id: 'atkinson', name: 'Atkinson', hint: 'Para baja visión' },
];

/** A−, A+, el menú "Aa" (tamaño y fuente) y el modo revisión, en la barra del lector. */
export function TextTools() {
  const prefs = useReaderPrefs();
  const [menu, setMenu] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  const step = (delta: number) => {
    Sound.play('select');
    prefs.set('size', prefs.size + delta);
  };

  return (
    <>
      <button
        type="button"
        className="tool size-step"
        aria-label="Achicar texto"
        title="Achicar texto"
        disabled={prefs.size <= MIN_SIZE}
        onClick={() => step(-2)}
      >
        A−
      </button>
      <button
        type="button"
        className="tool size-step"
        aria-label="Agrandar texto"
        title="Agrandar texto"
        disabled={prefs.size >= MAX_SIZE}
        onClick={() => step(2)}
      >
        A+
      </button>
      <button
        ref={anchor}
        type="button"
        className="tool text-toggle"
        aria-label="Tamaño y fuente del texto"
        title="Tamaño y fuente del texto"
        aria-haspopup="dialog"
        aria-expanded={menu}
        onClick={(event) => {
          event.stopPropagation();
          if (!menu) Sound.play('open');
          setMenu(!menu);
        }}
      >
        Aa
      </button>
      <button
        type="button"
        className="tool"
        aria-pressed={prefs.review}
        title="Tacha lo que no se narra (números de página, DOIs…)"
        onClick={() => {
          Sound.play('toggle');
          prefs.set('review', !prefs.review);
        }}
      >
        <Icon name="review" />
        <span className="label">Modo revisión</span>
      </button>
      {menu && <TextMenu anchor={anchor.current} onClose={() => setMenu(false)} />}
    </>
  );
}

function TextMenu({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const prefs = useReaderPrefs();
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>();

  useLayoutEffect(() => {
    const rect = anchor?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 10,
        right: Math.max(12, document.documentElement.clientWidth - rect.right),
      });
    }
    panel.current?.querySelector<HTMLElement>('input')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        anchor?.focus();
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={panel}
      className="speed-menu text-menu"
      role="dialog"
      aria-label="Tamaño y fuente del texto"
      style={position}
    >
      <div className="speed-head">
        <span>Tamaño</span>
        <strong className="speed-value">{prefs.size} px</strong>
      </div>
      <input
        type="range"
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={2}
        value={prefs.size}
        aria-label="Tamaño del texto"
        onChange={(event) => prefs.set('size', Number(event.target.value))}
      />
      <div className="speed-scale" aria-hidden="true">
        <span>A</span>
        <span style={{ fontSize: '1.1rem' }}>A</span>
      </div>
      <div className="speed-head">
        <span>Fuente</span>
      </div>
      <div className="speed-presets font-presets">
        {FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            data-font={font.id}
            aria-pressed={prefs.font === font.id}
            onClick={() => {
              Sound.play('select');
              prefs.set('font', font.id);
            }}
          >
            <strong>{font.name}</strong>
            <small>{font.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
