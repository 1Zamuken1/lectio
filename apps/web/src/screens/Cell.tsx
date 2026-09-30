import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLibrary } from '../api/queries';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Topbar } from '../components/Topbar';
import { DetailCard, LibraryRoom } from '../library/LibraryRoom';
import { progressLabel } from '../library/progress';
import { Sound } from '../theme/sound';

/** Tu celda de copista: tus libros y los públicos que empezaste. Pide entrar si no hay sesión. */
export function Cell() {
  const { state } = useSession();
  const navigate = useNavigate();
  const ask = useAuthPrompt((s) => s.ask);
  const books = useLibrary();

  useEffect(() => {
    if (state.status === 'anonymous') {
      ask({ reason: 'Tu celda guarda tus libros y por dónde vas. Entra o crea una cuenta.' });
    }
  }, [state.status, ask]);

  const signedIn = state.status === 'authenticated';
  return (
    <>
      <Topbar subtitle="tu celda">
        <button
          type="button"
          className="tool door"
          title="Ir a la biblioteca del monasterio"
          onClick={() => {
            Sound.play('open');
            navigate('/biblioteca');
          }}
        >
          <span className="label">Biblioteca</span>
        </button>
      </Topbar>
      <LibraryRoom
        books={signedIn ? books.data : []}
        loading={state.status === 'unknown' || (signedIn && books.isPending)}
        empty={
          signedIn ? (
            <p>Añade tu primer libro: un EPUB sin DRM.</p>
          ) : (
            <p>Entra para ver tu celda.</p>
          )
        }
        hint={(book) =>
          book
            ? `«${book.title ?? 'Sin título'}». ${progressLabel(book) ?? 'Aún sin abrir.'}`
            : 'Tus libros, a mano.'
        }
        renderDetail={(book, close) => (
          <DetailCard
            book={book}
            onClose={close}
            stats={[
              [
                'Estado',
                book.status === 'ready'
                  ? 'Listo'
                  : book.status === 'error'
                    ? 'Con problemas'
                    : 'Preparando',
              ],
              ['Tu lectura', progressLabel(book) ?? 'Sin empezar'],
            ]}
          >
            {book.status === 'ready' && (
              <Link
                className="open-book"
                to={`/leer/${book.id}`}
                onClick={() => Sound.play('open')}
              >
                {book.progress ? 'Continuar' : 'Empezar'}
              </Link>
            )}
          </DetailCard>
        )}
      />
    </>
  );
}
