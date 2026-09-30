import { Link } from 'react-router';
import { usePublicBooks } from '../api/queries';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Icon } from '../components/art';
import { Topbar } from '../components/Topbar';
import { DetailCard, LibraryRoom } from '../library/LibraryRoom';
import { progressLabel } from '../library/progress';
import { useGoThroughDoor } from '../library/room-door';
import { Sound } from '../theme/sound';

/**
 * La gran biblioteca del monasterio: el catálogo público. Se lee y se escucha sin cuenta;
 * la puerta lleva a tu estudio (pide entrar si no hay sesión).
 */
export function PublicLibrary() {
  const books = usePublicBooks();
  const go = useGoThroughDoor();
  const { state } = useSession();
  const ask = useAuthPrompt((s) => s.ask);

  const goToStudy = () => {
    if (state.status === 'authenticated') go('/estudio');
    else
      ask({
        reason: 'Tu estudio guarda tus libros y por dónde vas. Entra o crea una cuenta.',
        then: () => go('/estudio'),
      });
  };

  return (
    <>
      <Topbar subtitle="biblioteca">
        <button type="button" className="tool door" onClick={goToStudy} title="Ir a tu estudio">
          <Icon name="door" />
          <span className="label">Mi estudio</span>
        </button>
      </Topbar>
      <LibraryRoom
        room="monastery"
        onDoor={goToStudy}
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
