import { Link, useNavigate } from 'react-router';
import { usePublicBooks } from '../api/queries';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Topbar } from '../components/Topbar';
import { DetailCard, LibraryRoom } from '../library/LibraryRoom';
import { progressLabel } from '../library/progress';
import { Sound } from '../theme/sound';

/**
 * La gran biblioteca del monasterio: el catálogo público. Se lee y se escucha sin cuenta;
 * la puerta lleva a la celda (pide entrar si no hay sesión).
 */
export function PublicLibrary() {
  const books = usePublicBooks();
  const navigate = useNavigate();
  const { state } = useSession();
  const ask = useAuthPrompt((s) => s.ask);

  const goToCell = () => {
    Sound.play('open');
    if (state.status === 'authenticated') navigate('/celda');
    else
      ask({
        reason: 'Tu celda guarda tus libros y por dónde vas. Entra o crea una cuenta.',
        then: () => navigate('/celda'),
      });
  };

  return (
    <>
      <Topbar subtitle="biblioteca">
        <button type="button" className="tool door" onClick={goToCell} title="Ir a tu celda">
          <span className="label">Mi celda</span>
        </button>
      </Topbar>
      <LibraryRoom
        books={books.data}
        loading={books.isPending}
        empty={<p>La biblioteca del monasterio aún no tiene libros.</p>}
        hint={(book) =>
          book
            ? `«${book.title ?? 'Sin título'}». ${book.progress ? 'Sigamos donde lo dejaste.' : 'Buena elección.'}`
            : books.data?.length
              ? 'Elige un libro de la estantería. Aquí se lee y se escucha sin cuenta.'
              : 'Aquí no hay libros todavía.'
        }
        renderDetail={(book, close) => (
          <DetailCard
            book={book}
            onClose={close}
            stats={[
              ['Idioma', book.language?.toUpperCase() ?? '—'],
              ['Tu lectura', progressLabel(book) ?? 'Sin empezar'],
            ]}
          >
            <Link
              className="open-book"
              to={`/libros/${book.slug}`}
              onClick={() => Sound.play('open')}
            >
              {book.progress ? 'Continuar' : 'Empezar'}
            </Link>
          </DetailCard>
        )}
      />
    </>
  );
}
