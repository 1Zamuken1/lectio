import { useState } from 'react';
import type { BookDetail, ChapterSummary } from '../api/queries';
import { useApi, usePlayer } from '../app/context';
import { Icon } from '../components/art';
import { downloads, useDownloads } from '../pwa/downloads';
import { useOnline } from '../pwa/online';
import { Sound } from '../theme/sound';

/**
 * El anillo del avance. Va en dieciseisavos: en el Scriptorium es un marco de píxeles que
 * se llena por tramos, y en el Clásico, un círculo fino. 0 = en cola (vacío, punteado).
 */
function DownloadRing({ progress }: { progress: number }) {
  const step = Math.floor(progress * 16) / 16;
  return (
    <span
      className={`dl-ring${progress === 0 ? ' is-queued' : ''}`}
      style={{ '--p': step } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}

/**
 * El ícono al final de cada capítulo del atril (frontend §2.4): la flecha baja el
 * capítulo con la voz que suena (o solo el texto si no tiene audio); mientras baja, el
 * anillo; ya descargado, el sello, que al tocarlo pregunta si quitar la descarga.
 */
export function ChapterDownload({
  book,
  chapter,
  label,
}: {
  book: BookDetail;
  chapter: ChapterSummary;
  label: string;
}) {
  const api = useApi();
  const player = usePlayer();
  const online = useOnline();
  const record = useDownloads((s) => s.chapters[chapter.id]);
  const progress = useDownloads((s) => s.active[chapter.id]);
  const [failed, setFailed] = useState(false);

  if (!downloads.supported) return null;

  if (progress !== undefined) {
    const percent = Math.round(progress * 100);
    return (
      <span
        className="dl-toggle is-active"
        role="status"
        title={progress === 0 ? 'En cola' : `Descargando… ${percent} %`}
      >
        <DownloadRing progress={progress} />
        <span className="visually-hidden">
          {progress === 0 ? `${label}: en cola` : `${label}: descargando, ${percent} %`}
        </span>
      </span>
    );
  }

  if (record) {
    const voices = record.voices.map((v) => player.voiceName(v.voiceId)).join(', ');
    const what = voices ? `con ${voices}` : 'solo texto';
    const remove = async () => {
      Sound.play('toggle');
      const ok = await player.ask({
        title: 'Quitar la descarga',
        body: `"${label}" ya no se podrá abrir sin conexión en este dispositivo.`,
        confirm: 'Quitar',
        cancel: 'Dejarla',
      });
      if (ok) await downloads.removeChapter(chapter.id);
    };
    return (
      <button
        type="button"
        className="dl-toggle is-done"
        title={`Descargado (${what}). Tocar para quitar`}
        aria-label={`${label}: descargado, ${what}. Quitar la descarga`}
        onClick={() => void remove()}
      >
        <Icon name="downloaded" />
      </button>
    );
  }

  const voice = player.downloadVoice(chapter);
  const start = async () => {
    Sound.play('toggle');
    setFailed(false);
    try {
      await downloads.downloadChapter(api, book, chapter.id, voice);
    } catch {
      setFailed(true);
    }
  };
  const title = !online
    ? 'Sin conexión: para descargar hace falta internet'
    : failed
      ? 'No se pudo descargar. Tocar para reintentar'
      : voice
        ? `Descargar con ${player.voiceName(voice)}`
        : 'Descargar (solo texto: aún no tiene audio)';
  return (
    <button
      type="button"
      className={`dl-toggle${failed ? ' is-error' : ''}`}
      title={title}
      aria-label={`${label}: ${title.toLowerCase()}`}
      disabled={!online}
      onClick={() => void start()}
    >
      <Icon name="download" />
    </button>
  );
}

/**
 * "Descargar los próximos 3", bajo Continuar: desde el capítulo en que vas (o el primero),
 * los tres siguientes que faltan, cada uno con su voz.
 */
export function DownloadNext({ book, from }: { book: BookDetail; from: string | null }) {
  const api = useApi();
  const player = usePlayer();
  const online = useOnline();
  // Se recalcula al cambiar lo descargado o la cola.
  useDownloads((s) => s.chapters);
  useDownloads((s) => s.active);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  if (!downloads.supported) return null;
  const voiceFor = (id: string) => {
    const chapter = book.chapters.find((c) => c.id === id);
    return chapter ? player.downloadVoice(chapter) : null;
  };
  const targets = downloads.nextTargets(book, from, voiceFor);

  if (running) {
    return (
      <p className="lectern-download-next is-running" role="status">
        <Icon name="download" />
        Descargando {Math.min(running.done + 1, running.total)} de {running.total}…
      </p>
    );
  }
  if (targets.length === 0) {
    return (
      <p className="lectern-download-next is-done">
        <Icon name="downloaded" />
        Lo que sigue ya está descargado
      </p>
    );
  }

  const start = async () => {
    Sound.play('toggle');
    setFailed(false);
    try {
      await downloads.downloadNext(api, book, from, voiceFor, (done, total) =>
        setRunning({ done, total }),
      );
    } catch {
      setFailed(true);
    } finally {
      setRunning(null);
    }
  };
  // Menos de 3: son los últimos que quedan del libro.
  const label =
    targets.length === 3
      ? 'Descargar los próximos 3'
      : targets.length === 1
        ? 'Descargar el último que falta'
        : `Descargar los últimos ${targets.length}`;
  return (
    <>
      <button
        type="button"
        className="lectern-download-next"
        disabled={!online}
        title={online ? 'Para leer y escuchar sin conexión' : 'Sin conexión: hace falta internet'}
        onClick={() => void start()}
      >
        <Icon name="download" />
        {label}
      </button>
      {failed && (
        <p className="lectern-download-error" role="alert">
          No se pudo descargar todo. Vuelve a intentarlo.
        </p>
      )}
    </>
  );
}
