import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChapterSummary } from '../api/queries';
import { usePlayer, usePlayerState, useSession } from '../app/context';
import { Icon } from '../components/art';
import { Pixel } from '../theme/pixel';
import { formatNumber } from '../reader/text';
import { Sound } from '../theme/sound';
import {
  MAX_SPEED,
  MIN_SPEED,
  SPEED_PRESETS,
  VOLUME_PRESETS,
  resetDate,
  speedLabel,
  type PlayerBook,
  type Voice,
} from './controller';
import { formatTime, generationEta } from './sync';

/**
 * El reproductor de dos pisos del lector, portado del preview: arriba el progreso a todo
 * el ancho; abajo el capítulo, los controles (con ▶ grande), la velocidad y la voz. Sigue
 * al capítulo que se lee; si aún no tiene audio, ofrece generarlo (o, en un libro público,
 * ir al más cercano que tenga voz). `startSentence` es donde va la lectura: ▶ empieza ahí.
 */
export function PlayerBar({
  book,
  chapter,
  startSentence,
  onGo,
  onStep,
}: {
  book: PlayerBook;
  chapter: ChapterSummary;
  startSentence: () => number;
  onGo: (orderIndex: number, options?: { play?: boolean }) => void;
  /** ⏮/⏭: pasar al capítulo con audio más cercano y que suene. */
  onStep: (target: ChapterSummary) => void;
}) {
  const player = usePlayer();
  const bar = useRef<HTMLElement>(null);
  // Se lee todo lo que decide qué se muestra: el libro (voces listas), la voz y los trabajos.
  usePlayerState((s) => s.books[book.id]);
  usePlayerState((s) => s.jobs);
  const voice = usePlayerState((s) => s.voice);
  const loaded = usePlayerState((s) => s.loaded);
  const effective = player.effectiveVoice(chapter);
  const here = loaded?.chapterId === chapter.id;

  // El taller y el botón "Volver a la oración" se paran sobre el reproductor: necesitan su alto.
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const measure = () =>
      document.documentElement.style.setProperty('--player-height', `${node.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--player-height', '0px');
    };
  }, []);

  return (
    <section className="player" aria-label="Reproductor" ref={bar}>
      {effective || here ? (
        <Deck book={book} chapter={chapter} startSentence={startSentence} onStep={onStep} />
      ) : (
        <div className="player-empty">
          <EmptyPlayer book={book} chapter={chapter} voice={voice} onGo={onGo} />
        </div>
      )}
      <VoiceStatus book={book} chapter={chapter} />
    </section>
  );
}

function Deck({
  book,
  chapter,
  startSentence,
  onStep,
}: {
  book: PlayerBook;
  chapter: ChapterSummary;
  startSentence: () => number;
  onStep: (target: ChapterSummary) => void;
}) {
  const player = usePlayer();
  const playing = usePlayerState((s) => s.playing);
  const loaded = usePlayerState((s) => s.loaded);
  const speed = usePlayerState((s) => s.speed);
  const here = loaded?.chapterId === chapter.id;
  const duration = here ? loaded.durationMs : 0;
  const quill = useMemo(() => Pixel.quill(), []);
  const current = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const previous = player.audioChapter(book.id, chapter.id, -1);
  const next = player.audioChapter(book.id, chapter.id, 1);

  // La barra se mueve cada cuadro sin pasar por React.
  useEffect(() => {
    const paint = () => {
      const ms = here ? player.audio.currentTime * 1000 : 0;
      const input = progress.current;
      if (current.current) current.current.textContent = formatTime(ms);
      if (!input) return;
      const dragging = document.activeElement === input;
      if (!dragging) input.value = String(Math.round(ms));
      const shown = dragging ? Number(input.value) : ms;
      wrap.current?.style.setProperty(
        '--progress',
        `${Math.min(100, (100 * shown) / Math.max(1, duration))}%`,
      );
    };
    paint();
    return player.onFrame(paint);
  }, [player, here, duration]);

  const toggle = () => {
    if (here) player.togglePlay();
    else void player.load(book.id, chapter.id, { play: true, sentence: startSentence() });
  };

  return (
    <>
      <div className="player-track">
        <span className="player-time" ref={current}>
          0:00
        </span>
        <div className="progress" ref={wrap}>
          <span className="progress-track" aria-hidden="true">
            <span className="progress-fill" />
          </span>
          {/* La perilla es la pluma del tema; el <input> invisible encima es el control accesible. */}
          <span
            className="progress-thumb"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: quill }}
          />
          <input
            ref={progress}
            type="range"
            className="player-progress"
            min={0}
            max={Math.max(1, duration)}
            step={1000}
            defaultValue={0}
            disabled={!here}
            aria-label="Posición en el capítulo"
            onChange={(event) => player.seekTo(Number(event.target.value))}
          />
        </div>
        <span className="player-time total">{here ? formatTime(duration) : '–:––'}</span>
      </div>
      <div className="player-deck">
        <div className="player-meta">
          <span className="player-title">{chapter.title}</span>
          <span className="player-book">{book.title}</span>
        </div>
        <div className="player-controls">
          <ChapterStep label="Capítulo anterior" icon="prev" target={previous} onStep={onStep} />
          <button
            type="button"
            className="tool skip-button"
            aria-label="Retroceder 15 segundos"
            title="Retroceder 15 segundos"
            disabled={!here}
            onClick={() => {
              Sound.play('select');
              player.seekBy(-15_000);
            }}
          >
            <span className="skip">
              <Icon name="rewind" />
              <small>15</small>
            </span>
          </button>
          <button
            type="button"
            className="tool play"
            aria-label={here && playing ? 'Pausar' : 'Reproducir'}
            title={here && playing ? 'Pausar' : 'Reproducir'}
            onClick={() => {
              Sound.play('toggle', { force: true });
              toggle();
            }}
          >
            <Icon name={here && playing ? 'pause' : 'play'} className="big" />
          </button>
          <button
            type="button"
            className="tool skip-button"
            aria-label="Avanzar 15 segundos"
            title="Avanzar 15 segundos"
            disabled={!here}
            onClick={() => {
              Sound.play('select');
              player.seekBy(15_000);
            }}
          >
            <span className="skip">
              <Icon name="forward" />
              <small>15</small>
            </span>
          </button>
          <ChapterStep label="Capítulo siguiente" icon="next" target={next} onStep={onStep} />
        </div>
        <div className="player-extra">
          <SpeedButton speed={speed} />
          <VolumeButton />
          <VoiceButton book={book} chapter={chapter} />
        </div>
      </div>
    </>
  );
}

/** ⏮/⏭: al capítulo con audio más cercano, y suena. */
function ChapterStep({
  label,
  icon,
  target,
  onStep,
}: {
  label: string;
  icon: string;
  target: ChapterSummary | null;
  onStep: (target: ChapterSummary) => void;
}) {
  return (
    <button
      type="button"
      className="tool"
      aria-label={label}
      title={label}
      disabled={!target}
      onClick={() => target && onStep(target)}
    >
      <Icon name={icon} />
    </button>
  );
}

function EmptyPlayer({
  book,
  chapter,
  voice,
  onGo,
}: {
  book: PlayerBook;
  chapter: ChapterSummary;
  voice: string | null;
  onGo: (orderIndex: number, options?: { play?: boolean }) => void;
}) {
  const player = usePlayer();
  const job = player.jobFor(chapter.id, voice);
  if (chapter.characterCount === 0) return <p>Esta sección no tiene texto que narrar.</p>;

  if (book.isPublic || !player.canGenerate(book)) {
    const nearest =
      player.audioChapter(book.id, chapter.id, 1) ?? player.audioChapter(book.id, chapter.id, -1);
    return (
      <>
        <p>Este capítulo aún no tiene voz.</p>
        {nearest && (
          <div className="player-empty-actions">
            <button
              type="button"
              className="generate"
              onClick={() => onGo(nearest.orderIndex, { play: true })}
            >
              Escuchar «{nearest.title}»
            </button>
          </div>
        )}
      </>
    );
  }

  const busy = job && job.status !== 'error' && job.status !== 'ready';
  return (
    <>
      <p>Este capítulo aún no tiene audio.</p>
      <div className="player-empty-actions">
        {!busy && <GenerateButton book={book} chapter={chapter} voice={voice} />}
        <VoiceButton book={book} chapter={chapter} />
      </div>
    </>
  );
}

/** "Generar con Gonzalo (≈ 40 s)" y, debajo, cuánto usa de la cuota del mes. */
function GenerateButton({
  book,
  chapter,
  voice,
}: {
  book: PlayerBook;
  chapter: ChapterSummary;
  voice: string | null;
}) {
  const player = usePlayer();
  const usage = useQuery(player.usageQuery());
  const remaining = usage.data?.remaining;
  const short = remaining !== undefined && chapter.characterCount > remaining;
  const line: ReactNode =
    remaining === undefined ? null : short ? (
      <>
        Te faltan {formatNumber(chapter.characterCount - remaining)} caracteres. Tu cuota se
        reinicia el {resetDate(usage.data?.resetsAt)}.
      </>
    ) : (
      <>
        Usa {formatNumber(chapter.characterCount)} de tus {formatNumber(remaining)} caracteres de
        este mes
      </>
    );
  return (
    <div className="generate-wrap">
      <button
        type="button"
        className="generate"
        disabled={short || !voice}
        onClick={() => {
          Sound.play('start');
          void player.generateFromHere(book.id, chapter.id);
        }}
      >
        Generar con {player.voiceName(voice)} (≈ {generationEta(chapter.characterCount)})
      </button>
      {line && <small className="quota-line">{line}</small>}
    </div>
  );
}

/** Estado de la generación del capítulo con la voz elegida, bajo el reproductor. */
function VoiceStatus({ book, chapter }: { book: PlayerBook; chapter: ChapterSummary }) {
  const player = usePlayer();
  const voice = usePlayerState((s) => s.voice);
  const notice = usePlayerState((s) => s.notice);
  const loaded = usePlayerState((s) => s.loaded);
  usePlayerState((s) => s.jobs);
  const job = player.jobFor(chapter.id, voice);
  const name = player.voiceName(voice);
  const playingOther =
    loaded?.chapterId === chapter.id && loaded.voiceId !== voice ? loaded.voiceId : null;

  let content: ReactNode = null;
  if (notice) {
    content = <span className="voice-error">{notice}</span>;
  } else if (job?.status === 'error') {
    content = (
      <>
        <span className="voice-error">
          No se pudo generar con {name}: {job.error}.
        </span>
        <button
          type="button"
          className="link"
          onClick={() => void player.generate(book.id, chapter.id, { prefetch: false })}
        >
          Reintentar
        </button>
      </>
    );
  } else if (job && job.status !== 'ready') {
    const percent = job.total ? Math.round((100 * job.done) / job.total) : 0;
    content = (
      <>
        <span>
          {job.status === 'pending' && job.total === 0
            ? `En cola: ${name}…`
            : `Generando con ${name} · ${percent} %`}
          {playingOther ? ` · mientras, suena ${player.voiceName(playingOther)}` : ''}
        </span>
        <progress max={100} value={percent} aria-hidden="true" />
      </>
    );
  }
  return (
    <div className="voice-status" aria-live="polite" hidden={content === null}>
      {content}
    </div>
  );
}

// ------------------------------------------------------------ menús

/** Un menú flotante sobre su botón; se cierra con un clic fuera o con Escape. */
function Popover({
  anchor,
  label,
  className,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  label: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ right: number; bottom: number }>();
  useLayoutEffect(() => {
    const rect = anchor?.getBoundingClientRect();
    if (rect) {
      setPosition({
        right: Math.max(12, document.documentElement.clientWidth - rect.right),
        bottom: window.innerHeight - rect.top + 10,
      });
    }
    panel.current?.querySelector<HTMLElement>('input, button:not(:disabled)')?.focus();
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
    <div ref={panel} className={className} role="dialog" aria-label={label} style={position}>
      {children}
    </div>
  );
}

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** Volumen de la narración: deslizador, silenciar y valores rápidos. Se recuerda. */
function VolumeButton() {
  const player = usePlayer();
  const volume = usePlayerState((s) => s.volume);
  const muted = usePlayerState((s) => s.muted);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const silent = muted || volume === 0;
  const label = silent ? 'Silenciado' : percent(volume);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="tool volume-button"
        aria-label={`Volumen: ${label}`}
        title={`Volumen: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) Sound.play('open');
          setOpen(!open);
        }}
      >
        <Icon name={silent ? 'volume-off' : 'volume'} />
        <span className="volume-value">{silent ? '0' : Math.round(volume * 100)}</span>
      </button>
      {open && (
        <Popover
          anchor={anchor.current}
          label="Volumen"
          className="speed-menu volume-menu"
          onClose={() => setOpen(false)}
        >
          <div className="speed-head">
            <span>Volumen</span>
            <strong className="speed-value">{label}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volumen de la narración"
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
          <div className="speed-scale" aria-hidden="true">
            <span>0 %</span>
            <span>100 %</span>
          </div>
          <div className="speed-presets">
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => {
                Sound.play('toggle');
                player.toggleMute();
              }}
            >
              {muted ? 'Activar' : 'Silenciar'}
            </button>
            {VOLUME_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={!muted && value === volume}
                onClick={() => {
                  Sound.play('select');
                  player.setVolume(value);
                }}
              >
                {Math.round(value * 100)}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/** Velocidad: valores predefinidos y un control fino, sin tener que recorrer todos. */
function SpeedButton({ speed }: { speed: number }) {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="tool speed"
        aria-label="Velocidad de reproducción"
        title="Velocidad de reproducción"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) Sound.play('open');
          setOpen(!open);
        }}
      >
        {speedLabel(speed)}
      </button>
      {open && (
        <Popover
          anchor={anchor.current}
          label="Velocidad de reproducción"
          className="speed-menu"
          onClose={() => setOpen(false)}
        >
          <div className="speed-head">
            <span>Velocidad</span>
            <strong className="speed-value">{speedLabel(speed)}</strong>
          </div>
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.05}
            value={speed}
            aria-label="Velocidad personalizada"
            onChange={(event) => player.setSpeed(Number(event.target.value))}
          />
          <div className="speed-scale" aria-hidden="true">
            <span>0,5×</span>
            <span>3×</span>
          </div>
          <div className="speed-presets">
            {SPEED_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === speed}
                onClick={() => {
                  Sound.play('select');
                  player.setSpeed(value);
                }}
              >
                {value === 1 ? 'Normal' : speedLabel(value)}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/** La voz del narrador: elegir otra, ver cuáles están listas y escuchar una muestra. */
function VoiceButton({ book, chapter }: { book: PlayerBook; chapter: ChapterSummary }) {
  const player = usePlayer();
  const voice = usePlayerState((s) => s.voice);
  const voices = usePlayerState((s) => s.voices);
  usePlayerState((s) => s.jobs);
  const { state } = useSession();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const sample = useSample(open);
  const ready = player.readyVoices(chapter);
  const canGenerate = player.canGenerate(book) && chapter.characterCount > 0;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="tool voice-button"
        aria-label="Voz del narrador"
        title="Voz del narrador"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) Sound.play('open');
          setOpen(!open);
        }}
      >
        <Icon name="voice" />
        <span className="voice-name">{player.voiceName(voice)}</span>
      </button>
      {open && (
        <Popover
          anchor={anchor.current}
          label="Voz"
          className="speed-menu voice-menu"
          onClose={() => setOpen(false)}
        >
          <div className="speed-head">
            <span>Voz del narrador</span>
          </div>
          <div className="voice-list">
            {voices.map((v) => (
              <VoiceRow
                key={v.id}
                voice={v}
                selected={v.id === voice}
                ready={ready.includes(v.id)}
                canGenerate={canGenerate}
                job={player.jobFor(chapter.id, v.id)}
                eta={generationEta(chapter.characterCount)}
                sample={sample}
                onPick={() => {
                  player.selectVoice(v.id, book.id, chapter.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          {!canGenerate && (
            <p className="voice-note">
              {book.isPublic
                ? 'En la biblioteca pública suenan las voces que Lectio ya preparó.'
                : state.status === 'authenticated'
                  ? 'Esta sección no tiene texto que narrar.'
                  : 'Entra para generar otras voces.'}
            </p>
          )}
        </Popover>
      )}
    </>
  );
}

function VoiceRow({
  voice,
  selected,
  ready,
  canGenerate,
  job,
  eta,
  sample,
  onPick,
}: {
  voice: Voice;
  selected: boolean;
  ready: boolean;
  canGenerate: boolean;
  job: ReturnType<ReturnType<typeof usePlayer>['jobFor']>;
  eta: string;
  sample: ReturnType<typeof useSample>;
  onPick: () => void;
}) {
  const running = job && job.status !== 'error' && job.status !== 'ready';
  const status = ready
    ? 'Lista'
    : running
      ? job.total === 0
        ? 'En cola'
        : `Generando · ${Math.round((100 * job.done) / job.total)} %`
      : canGenerate
        ? `Se genera en ≈ ${eta}`
        : 'Sin generar';
  const sampleState =
    sample.voice === voice.id && sample.playing ? (sample.loading ? '…' : '❚❚') : '▶';
  return (
    <div className="voice-option">
      <button
        type="button"
        className="voice-pick"
        aria-pressed={selected}
        disabled={!ready && !canGenerate}
        onClick={onPick}
      >
        <strong>{voice.name}</strong>
        <span className={`voice-state${ready ? ' ready' : ''}`}>{status}</span>
      </button>
      <button
        type="button"
        className="voice-sample"
        aria-label={`Escuchar una muestra de ${voice.name}`}
        title="Escuchar una muestra"
        onClick={() => sample.toggle(voice)}
      >
        {sampleState}
      </button>
    </div>
  );
}

/** Muestra de cada voz: la genera el worker una vez y queda en el storage. */
function useSample(open: boolean) {
  const player = usePlayer();
  const audio = useMemo(() => new Audio(), []);
  const [state, setState] = useState({
    voice: null as string | null,
    playing: false,
    loading: false,
  });
  useEffect(() => {
    const update = () =>
      setState((s) => ({ ...s, playing: !audio.paused, loading: audio.readyState < 3 }));
    const events = ['playing', 'pause', 'ended', 'waiting', 'error'] as const;
    for (const event of events) audio.addEventListener(event, update);
    return () => {
      for (const event of events) audio.removeEventListener(event, update);
    };
  }, [audio]);
  useEffect(() => {
    if (!open) audio.pause();
  }, [open, audio]);
  return {
    ...state,
    toggle(voice: Voice) {
      if (state.voice === voice.id && !audio.paused) {
        audio.pause();
        return;
      }
      player.pause();
      audio.src = voice.sampleUrl;
      setState({ voice: voice.id, playing: true, loading: true });
      void audio.play().catch(() => setState((s) => ({ ...s, playing: false })));
    },
  };
}
