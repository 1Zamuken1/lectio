import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../app/context';
import { Icon } from '../components/art';
import type { DownloadRecord } from '../pwa/db';
import { downloads, useDownloads, type StorageUse } from '../pwa/downloads';
import { Sound } from '../theme/sound';

/** Cuánto dura el "Deshacer" antes de borrar de verdad. */
const UNDO_MS = 6000;

const number = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${number.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
  if (bytes < 1024 ** 3) return `${number.format(bytes / 1024 ** 2)} MB`;
  return `${number.format(bytes / 1024 ** 3)} GB`;
}

/**
 * El botón "Descargas" de la barra de las dos salas (frontend §2.4): el arcón, con un
 * número pequeño mientras algo se está bajando. Abre el panel.
 */
export function DownloadsButton() {
  const busy = useDownloads((s) => Object.keys(s.active).length);
  const [open, setOpen] = useState(false);
  if (!downloads.supported) return null;
  return (
    <>
      <button
        type="button"
        className="tool downloads"
        title={busy ? `Descargas (bajando ${busy})` : 'Descargas: lo que tienes sin conexión'}
        aria-haspopup="dialog"
        onClick={() => {
          Sound.play('toggle');
          setOpen(true);
        }}
      >
        <Icon name="chest" />
        <span className="label">Descargas</span>
        {busy > 0 && (
          <span className="tool-badge" aria-label={`, ${busy} bajando`}>
            {busy}
          </span>
        )}
      </button>
      {open && <DownloadsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

type Pending = { kind: 'chapter' | 'book'; id: string; text: string };

/**
 * El panel "Descargas": en el Scriptorium, un arcón abierto; en el Clásico, un panel
 * sobrio; en el celular, una hoja inferior. Arriba el espacio (usado y libre) y abajo lo
 * descargado por libro, con borrar por capítulo o libro (al instante, con "Deshacer") y
 * "Borrar todo" (pregunta antes).
 */
function DownloadsPanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const dialog = useRef<HTMLDialogElement>(null);
  const chapters = useDownloads((s) => s.chapters);
  const books = useDownloads((s) => s.books);
  const busy = useDownloads((s) => Object.keys(s.active).length);
  const [use, setUse] = useState<StorageUse | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [undo, setUndo] = useState<Pending | null>(null);
  const timers = useRef(new Map<string, { timer: number; run: () => Promise<void> }>());

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // El espacio se vuelve a medir cada vez que cambia lo descargado.
  useEffect(() => {
    let alive = true;
    void downloads.storageUse().then((value) => alive && setUse(value));
    return () => {
      alive = false;
    };
  }, [chapters]);

  // Los nombres de las voces ("Salomé"), en el idioma del primer libro.
  const language = Object.values(books)[0]?.detail.language;
  useEffect(() => {
    if (language) void player.loadVoices(language);
  }, [player, language]);

  // Lo que quedó esperando su "Deshacer" se borra al cerrar el panel o la pestaña.
  useEffect(() => {
    const scheduled = timers.current;
    const flush = () => {
      for (const { timer, run } of scheduled.values()) {
        window.clearTimeout(timer);
        void run();
      }
      scheduled.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const hidden = useMemo(() => new Set(pending.map((p) => `${p.kind}:${p.id}`)), [pending]);
  const groups = useMemo(() => {
    const byBook = new Map<string, DownloadRecord[]>();
    for (const record of Object.values(chapters)) {
      if (hidden.has(`chapter:${record.chapterId}`) || hidden.has(`book:${record.bookId}`))
        continue;
      byBook.set(record.bookId, [...(byBook.get(record.bookId) ?? []), record]);
    }
    return [...byBook.entries()]
      .map(([bookId, records]) => ({
        bookId,
        detail: books[bookId]?.detail ?? null,
        records: records.sort((a, b) => a.orderIndex - b.orderIndex),
        bytes: records.reduce((sum, r) => sum + downloads.bytes(r), 0),
      }))
      .sort((a, b) => (a.detail?.title ?? '').localeCompare(b.detail?.title ?? '', 'es'));
  }, [chapters, books, hidden]);

  const close = () => {
    Sound.play('toggle');
    dialog.current?.close();
    onClose();
  };

  const schedule = (item: Pending, run: () => Promise<void>) => {
    Sound.play('toggle');
    const key = `${item.kind}:${item.id}`;
    const commit = async () => {
      timers.current.delete(key);
      await run().catch(() => undefined);
      setPending((p) => p.filter((x) => `${x.kind}:${x.id}` !== key));
    };
    timers.current.set(key, {
      timer: window.setTimeout(() => void commit(), UNDO_MS),
      run: commit,
    });
    setPending((p) => [...p, item]);
    setUndo(item);
  };

  const revert = (item: Pending) => {
    Sound.play('toggle');
    const key = `${item.kind}:${item.id}`;
    window.clearTimeout(timers.current.get(key)?.timer);
    timers.current.delete(key);
    setPending((p) => p.filter((x) => `${x.kind}:${x.id}` !== key));
    setUndo(null);
  };

  const removeAll = async () => {
    const ok = await player.ask({
      title: 'Borrar todas las descargas',
      body: 'Nada quedará guardado para leer o escuchar sin conexión en este dispositivo.',
      confirm: 'Borrar todo',
      cancel: 'Cancelar',
    });
    if (!ok) return;
    for (const { timer } of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    setPending([]);
    setUndo(null);
    await downloads.removeAll();
  };

  const total = groups.reduce((sum, g) => sum + g.bytes, 0);
  const free = use?.quota != null && use.usage != null ? Math.max(0, use.quota - use.usage) : null;
  const used = use?.quota ? Math.min(1, (use.usage ?? 0) / use.quota) : 0;

  return (
    <dialog
      ref={dialog}
      className="downloads-panel"
      aria-labelledby="downloads-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="downloads-lid" aria-hidden="true" />
      <header className="downloads-head">
        <h2 id="downloads-title">Descargas</h2>
        <button type="button" className="detail-close" aria-label="Cerrar" onClick={close}>
          <Icon name="close" />
        </button>
      </header>

      <section className="downloads-space" aria-label="Espacio">
        <p>
          <span>
            Ocupan <strong>{formatBytes(total)}</strong>
          </span>
          {free !== null && (
            <span>
              Libres en este dispositivo: <strong>{formatBytes(free)}</strong>
            </span>
          )}
        </p>
        {use?.quota ? (
          <div
            className="downloads-candle"
            role="meter"
            aria-label="Espacio usado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(used * 100)}
            style={{ '--used': used } as React.CSSProperties}
          >
            <span className="wax" />
            <span className="flame" />
          </div>
        ) : null}
        {use && !use.persisted && groups.length > 0 && (
          <p className="downloads-note">
            Si el dispositivo se queda sin espacio, el navegador podría borrarlas.
          </p>
        )}
        {busy > 0 && (
          <p className="downloads-note" role="status">
            Bajando {busy === 1 ? '1 capítulo' : `${busy} capítulos`}…
          </p>
        )}
      </section>

      <div className="downloads-list">
        {groups.length === 0 ? (
          <div className="downloads-empty">
            <p>El arcón está vacío.</p>
            <p>
              Descarga capítulos desde la ficha de un libro para leerlos y escucharlos sin conexión.
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const title = group.detail?.title ?? 'Libro sin título';
            const downloading = group.records.some((r) => downloads.state.active[r.chapterId]);
            return (
              <section key={group.bookId} className="downloads-book" aria-label={title}>
                <header>
                  <div>
                    <h3>{title}</h3>
                    <p>
                      {group.detail?.author ? `${group.detail.author} · ` : ''}
                      {group.records.length === 1
                        ? '1 capítulo'
                        : `${group.records.length} capítulos`}{' '}
                      · {formatBytes(group.bytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="downloads-remove book"
                    disabled={downloading}
                    title={downloading ? 'Espera a que termine de bajar' : 'Quitar el libro'}
                    onClick={() =>
                      schedule(
                        {
                          kind: 'book',
                          id: group.bookId,
                          text: `Quité «${title}» de las descargas.`,
                        },
                        () => downloads.removeBook(group.bookId),
                      )
                    }
                  >
                    Quitar libro
                  </button>
                </header>
                <ul>
                  {group.records.map((record) => {
                    const chapter = group.detail?.chapters.find((c) => c.id === record.chapterId);
                    const label = chapter?.title ?? `Capítulo ${record.orderIndex + 1}`;
                    const voices = record.voices.map((v) => player.voiceName(v.voiceId)).join(', ');
                    return (
                      <li key={record.chapterId}>
                        <Icon name="downloaded" />
                        <span className="downloads-chapter">{label}</span>
                        <span className="downloads-meta">
                          {voices || 'solo texto'} · {formatBytes(downloads.bytes(record))}
                        </span>
                        <button
                          type="button"
                          className="downloads-remove"
                          aria-label={`Quitar «${label}» de las descargas`}
                          title="Quitar"
                          onClick={() =>
                            schedule(
                              {
                                kind: 'chapter',
                                id: record.chapterId,
                                text: `Quité «${label}» de las descargas.`,
                              },
                              () => downloads.removeChapter(record.chapterId),
                            )
                          }
                        >
                          <Icon name="close" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <footer className="downloads-foot">
        <p className="downloads-undo" role="status">
          {undo && pending.some((p) => p.id === undo.id) && (
            <>
              {undo.text}{' '}
              <button type="button" className="link" onClick={() => revert(undo)}>
                Deshacer
              </button>
            </>
          )}
        </p>
        <div className="confirm-actions">
          {groups.length > 0 && (
            <button type="button" className="danger" onClick={() => void removeAll()}>
              Borrar todo
            </button>
          )}
          <button type="button" className="primary" onClick={close}>
            Cerrar
          </button>
        </div>
      </footer>
    </dialog>
  );
}
