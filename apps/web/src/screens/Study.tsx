import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { isPreparing, keys, useLibrary, type BookSummary } from '../api/queries';
import { useApi, useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Icon } from '../components/art';
import { Topbar } from '../components/Topbar';
import { bookErrorMessage } from '../library/book-messages';
import { BookCrew } from '../library/BookCrew';
import { FailedBook } from '../library/FailedBook';
import { Lectern } from '../library/Lectern';
import { LibraryRoom } from '../library/LibraryRoom';
import { progressLabel, readerHref } from '../library/progress';
import { useGoThroughDoor } from '../library/room-door';
import { useOnline } from '../pwa/online';
import { BlankBook, DropVeil, useBookUpload, useFileDrop, useFilePicker } from '../library/upload';
import { Sound } from '../theme/sound';
import { hasCrew } from '../theme/worlds';

type Notice = { text: string; id: number; action?: { label: string; run: () => void } };

/** Cuánto se puede deshacer "Quitar de mi estudio" antes de borrarlo en el servidor. */
const UNDO_MS = 6000;

/**
 * Tu estudio: tus libros y los públicos que empezaste. Pide entrar si no hay sesión. Aquí
 * se suben los EPUB (botón, libro en blanco o soltándolos en la sala): la cuadrilla trae
 * el libro nuevo por la repisa mientras el worker lo prepara, y el búho avisa cuando está.
 * Si falla, el libro arde (la primera vez) y queda como tarjeta con "Quitar".
 */
export function Study() {
  const { state } = useSession();
  const go = useGoThroughDoor();
  const toLibrary = () => go('/biblioteca');
  const ask = useAuthPrompt((s) => s.ask);
  const books = useLibrary();
  const signedIn = state.status === 'authenticated';
  // Sin conexión no se sube ni se quita nada: la sala muestra lo de la última visita.
  const online = useOnline();

  const [notice, setNotice] = useState<Notice | null>(null);
  const [focus, setFocus] = useState<{ bookId: string; id: number; open?: boolean } | null>(null);
  const notify = (text: string, action?: Notice['action']) =>
    setNotice((n) => ({ text, action, id: (n?.id ?? 0) + 1 }));
  const goTo = (bookId: string, open = true) =>
    setFocus((f) => ({ bookId, open, id: (f?.id ?? 0) + 1 }));

  // La cuadrilla: trae un libro a la vez (el último subido); su lomo espera escondido.
  const [crew, setCrew] = useState<{ bookId: string; placed: boolean } | null>(null);
  const { upload, busy } = useBookUpload({
    notify,
    focus: (bookId) => goTo(bookId),
    uploaded: (bookId) => {
      goTo(bookId, false);
      if (animated()) setCrew({ bookId, placed: false });
    },
  });
  const picker = useFilePicker((files) => void upload(files));
  const dragging = useFileDrop(signedIn && online, (files) => void upload(files));

  const burnt = useBurntBooks();
  const removal = useUndoableRemoval(notify);

  useEffect(() => {
    if (state.status === 'anonymous' && online) {
      ask({ reason: 'Tu estudio guarda tus libros y por dónde vas. Entra o crea una cuenta.' });
    }
  }, [state.status, ask, online]);

  const announce = useReadyAnnouncements(books.data, notify, crew?.bookId ?? null);
  const shown = useMemo(
    () => books.data?.filter((b) => !removal.pending.has(b.id)),
    [books.data, removal.pending],
  );
  const crewBook = crew ? books.data?.find((b) => b.id === crew.bookId) : undefined;
  const hidden = useMemo(() => new Set(crew && !crew.placed ? [crew.bookId] : []), [crew]);

  return (
    <>
      <Topbar subtitle="tu estudio">
        <button
          type="button"
          className="tool door"
          title="Ir a la biblioteca del monasterio"
          onClick={toLibrary}
        >
          <Icon name="door" />
          <span className="label">Biblioteca</span>
        </button>
      </Topbar>
      <LibraryRoom
        room="study"
        onDoor={toLibrary}
        books={signedIn ? shown : []}
        loading={state.status === 'unknown' || (signedIn && books.isPending)}
        notice={notice}
        focus={focus}
        hiddenIds={hidden}
        renderBook={(book) =>
          // Mientras la cuadrilla lo trae, su hueco queda vacío aunque ya haya fallado.
          book.status === 'error' && !hidden.has(book.id) ? (
            <FailedBook
              book={book}
              burn={animated() && !burnt.seen(book.id)}
              onBurnt={() => burnt.mark(book.id)}
              onRemove={() => removal.remove(book)}
            />
          ) : undefined
        }
        tools={
          signedIn &&
          shown &&
          shown.length > 0 && (
            <button
              type="button"
              className="add-book"
              onClick={picker.open}
              disabled={busy || !online}
              title={online ? undefined : 'Sin conexión: para subir un libro hace falta internet'}
            >
              {busy ? 'Subiendo…' : '+ Añadir libro'}
            </button>
          )
        }
        empty={
          signedIn ? (
            <BlankBook onClick={picker.open} busy={busy || !online} />
          ) : (
            <p>
              {online
                ? 'Entra para ver tu estudio.'
                : 'Sin conexión: podrás entrar cuando vuelva internet.'}
            </p>
          )
        }
        hint={(book) =>
          book
            ? isPreparing(book)
              ? 'Aún lo estoy preparando: en unos segundos estará listo.'
              : book.status === 'error'
                ? bookErrorMessage(book.errorCode)
                : `«${book.title ?? 'Sin título'}». ${progressLabel(book) ?? 'Aún sin abrir.'}`
            : shown?.length
              ? 'Tus libros, a mano.'
              : 'Aquí va tu primer libro.'
        }
        renderDetail={(book, close) => (
          <Lectern
            book={book}
            href={readerHref(book)}
            onClose={close}
            status={
              isPreparing(book) ? (
                <p className="lectern-note">
                  Aún lo estoy preparando: en unos segundos aparecen aquí sus capítulos.
                </p>
              ) : book.status === 'error' ? (
                <p className="lectern-note">{bookErrorMessage(book.errorCode)}</p>
              ) : undefined
            }
          >
            {/* Tus libros se pueden quitar (los públicos que empezaste, no: son del catálogo). */}
            {!book.isPublic && !isPreparing(book) && (
              <button
                type="button"
                className={book.status === 'error' ? 'open-book' : 'lectern-remove'}
                disabled={!online}
                title={online ? undefined : 'Sin conexión: para quitarlo hace falta internet'}
                onClick={() => {
                  close();
                  removal.remove(book);
                }}
              >
                Quitar de mi estudio
              </button>
            )}
          </Lectern>
        )}
      />
      {crew && (
        <BookCrew
          key={crew.bookId}
          bookId={crew.bookId}
          ready={!!crewBook && !isPreparing(crewBook)}
          onPlaced={() => {
            setCrew((c) => (c ? { ...c, placed: true } : c));
            if (crewBook) announce(crewBook);
          }}
          onGone={() => setCrew(null)}
        />
      )}
      {picker.element}
      {dragging && <DropVeil />}
    </>
  );
}

/** La cuadrilla y el fuego solo en un mundo con su gente y con movimiento; si no, directo. */
function animated(): boolean {
  const root = document.documentElement.dataset;
  return hasCrew(root.world, 'bookCrew') && root.motion === 'full';
}

/**
 * Cuando un libro que se estaba preparando queda listo (o falla), el búho lo cuenta. El
 * que trae la cuadrilla se anuncia al dejarlo en su hueco (`announce`), no antes.
 */
function useReadyAnnouncements(
  books: BookSummary[] | undefined,
  notify: (text: string) => void,
  carried: string | null,
) {
  const previous = useRef(new Map<string, BookSummary['status']>());
  const say = (book: BookSummary) => {
    if (book.status === 'ready') {
      Sound.play('bell');
      notify(`«${book.title ?? 'Tu libro'}» ya está en tu repisa.`);
    } else if (book.status === 'error') notify(bookErrorMessage(book.errorCode));
  };
  useEffect(() => {
    if (!books) return;
    for (const book of books) {
      const before = previous.current.get(book.id);
      const wasPreparing = before === 'pending' || before === 'processing';
      if (wasPreparing && !isPreparing(book) && book.id !== carried) say(book);
    }
    previous.current = new Map(books.map((b) => [b.id, b.status]));
    // Solo importa el cambio de la lista (notify es nueva en cada render).
  }, [books]);
  return say;
}

const BURNT_KEY = 'lectio:burnt';

/** Los libros que ya ardieron en este navegador: no vuelven a arder cada vez que entras. */
function useBurntBooks() {
  const [ids, setIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(BURNT_KEY) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  return {
    seen: (id: string) => ids.has(id),
    mark: (id: string) =>
      setIds((current) => {
        const next = new Set(current).add(id);
        try {
          localStorage.setItem(BURNT_KEY, JSON.stringify([...next].slice(-200)));
        } catch {
          // Sin almacenamiento (modo privado): arderá otra vez la próxima; no pasa nada.
        }
        return next;
      }),
  };
}

/**
 * "Quitar de mi estudio" sin confirmar: el libro desaparece al instante, el búho ofrece
 * "Deshacer" durante unos segundos y luego se borra en el servidor. Si sales del estudio
 * antes, se borra al salir.
 */
function useUndoableRemoval(notify: (text: string, action?: Notice['action']) => void) {
  const api = useApi();
  const client = useQueryClient();
  const { state } = useSession();
  const userId = state.status === 'authenticated' ? state.user.id : '';
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const forget = (id: string) =>
    setPending((p) => {
      const next = new Set(p);
      next.delete(id);
      return next;
    });

  const commit = (id: string) => {
    timers.current.delete(id);
    void api
      .delete(`/api/v1/books/${id}`)
      .catch((error: unknown) =>
        notify(
          error instanceof ApiError && error.code === 'BOOK_BUSY'
            ? 'Hay audio generándose para ese libro: espera a que termine y vuelve a quitarlo.'
            : 'No pude quitarlo: inténtalo otra vez.',
        ),
      )
      .finally(() => {
        void client.invalidateQueries({ queryKey: keys.library(userId) });
        forget(id);
      });
  };

  // Lo que quedó por borrar se envía igual al salir del estudio, al recargar o al cerrar la
  // pestaña (keepalive: la petición sobrevive a la página).
  useEffect(() => {
    const scheduled = timers.current;
    const flush = () => {
      for (const [id, timer] of scheduled) {
        window.clearTimeout(timer);
        void api
          .request(`/api/v1/books/${id}`, { method: 'DELETE', keepalive: true })
          .catch(() => undefined);
      }
      scheduled.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [api]);

  return {
    pending,
    remove(book: BookSummary) {
      Sound.play('toggle');
      setPending((p) => new Set(p).add(book.id));
      timers.current.set(
        book.id,
        window.setTimeout(() => commit(book.id), UNDO_MS),
      );
      notify(
        book.title ? `Quité «${book.title}» de tu estudio.` : 'Quité el libro de tu estudio.',
        {
          label: 'Deshacer',
          run: () => {
            window.clearTimeout(timers.current.get(book.id));
            timers.current.delete(book.id);
            forget(book.id);
            notify('Listo, sigue en tu repisa.');
          },
        },
      );
    },
  };
}
