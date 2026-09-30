import { useEffect, useRef, useState } from 'react';
import { isPreparing, useLibrary, type BookSummary } from '../api/queries';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Icon } from '../components/art';
import { Topbar } from '../components/Topbar';
import { bookErrorMessage } from '../library/book-messages';
import { Lectern } from '../library/Lectern';
import { LibraryRoom } from '../library/LibraryRoom';
import { progressLabel, readerHref } from '../library/progress';
import { useGoThroughDoor } from '../library/room-door';
import { BlankBook, DropVeil, useBookUpload, useFileDrop, useFilePicker } from '../library/upload';
import { Sound } from '../theme/sound';

/**
 * Tu estudio: tus libros y los públicos que empezaste. Pide entrar si no hay sesión. Aquí
 * se suben los EPUB (botón, libro en blanco o soltándolos en la sala); mientras el worker
 * los prepara, la repisa se refresca sola y el búho avisa cuando están listos.
 */
export function Study() {
  const { state } = useSession();
  const go = useGoThroughDoor();
  const toLibrary = () => go('/biblioteca');
  const ask = useAuthPrompt((s) => s.ask);
  const books = useLibrary();
  const signedIn = state.status === 'authenticated';

  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  const [focus, setFocus] = useState<{ bookId: string; id: number } | null>(null);
  const notify = (text: string) => setNotice((n) => ({ text, id: (n?.id ?? 0) + 1 }));
  const { upload, busy } = useBookUpload({
    notify,
    focus: (bookId) => setFocus((f) => ({ bookId, id: (f?.id ?? 0) + 1 })),
  });
  const picker = useFilePicker((files) => void upload(files));
  const dragging = useFileDrop(signedIn, (files) => void upload(files));

  useEffect(() => {
    if (state.status === 'anonymous') {
      ask({ reason: 'Tu estudio guarda tus libros y por dónde vas. Entra o crea una cuenta.' });
    }
  }, [state.status, ask]);

  useReadyAnnouncements(books.data, notify);

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
        books={signedIn ? books.data : []}
        loading={state.status === 'unknown' || (signedIn && books.isPending)}
        notice={notice}
        focus={focus}
        tools={
          signedIn &&
          books.data &&
          books.data.length > 0 && (
            <div className="shelf-tools">
              <button type="button" className="add-book" onClick={picker.open} disabled={busy}>
                {busy ? 'Subiendo…' : '+ Añadir libro'}
              </button>
            </div>
          )
        }
        empty={
          signedIn ? (
            <BlankBook onClick={picker.open} busy={busy} />
          ) : (
            <p>Entra para ver tu estudio.</p>
          )
        }
        hint={(book) =>
          book
            ? isPreparing(book)
              ? 'Aún lo estoy preparando: en unos segundos estará listo.'
              : book.status === 'error'
                ? bookErrorMessage(book.errorCode)
                : `«${book.title ?? 'Sin título'}». ${progressLabel(book) ?? 'Aún sin abrir.'}`
            : books.data?.length
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
          />
        )}
      />
      {picker.element}
      {dragging && <DropVeil />}
    </>
  );
}

/** Cuando un libro que se estaba preparando queda listo (o falla), el búho lo cuenta. */
function useReadyAnnouncements(books: BookSummary[] | undefined, notify: (text: string) => void) {
  const previous = useRef(new Map<string, BookSummary['status']>());
  useEffect(() => {
    if (!books) return;
    for (const book of books) {
      const before = previous.current.get(book.id);
      const wasPreparing = before === 'pending' || before === 'processing';
      if (wasPreparing && book.status === 'ready') {
        Sound.play('bell');
        notify(`«${book.title ?? 'Tu libro'}» ya está en tu repisa.`);
      } else if (wasPreparing && book.status === 'error') {
        notify(bookErrorMessage(book.errorCode));
      }
    }
    previous.current = new Map(books.map((b) => [b.id, b.status]));
    // Solo importa el cambio de la lista (notify es nueva en cada render).
  }, [books]);
}
