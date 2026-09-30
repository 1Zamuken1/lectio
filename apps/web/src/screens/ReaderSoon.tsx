import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBookDetail } from '../api/queries';
import { useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';

/**
 * Provisional hasta la etapa 3: la ruta del lector (`/leer/:id` para tus libros,
 * `/libros/:slug` para los públicos) ya carga el libro y el capítulo pedido; el lector y
 * el reproductor ocuparán esta pantalla.
 */
export function ReaderSoon() {
  const { id, slug } = useParams();
  const [params] = useSearchParams();
  const { state } = useSession();
  const ask = useAuthPrompt((s) => s.ask);
  const isPublic = slug !== undefined;
  const detail = useBookDetail({
    id: id ?? `slug:${slug}`,
    slug: slug ?? null,
    isPublic,
    // Espera a saber si hay sesión: un libro privado sin sesión daría 401.
    status: state.status === 'unknown' ? 'pending' : 'ready',
  });
  const back = isPublic ? '/biblioteca' : '/estudio';

  useEffect(() => {
    document.body.dataset.screen = 'reader-soon';
  }, []);

  useEffect(() => {
    if (!isPublic && state.status === 'anonymous') {
      ask({ reason: 'Este libro está en el estudio de alguien. Entra para abrir el tuyo.' });
    }
  }, [isPublic, state.status, ask]);

  const book = detail.data;
  const order = Number(params.get('capitulo') ?? book?.progress?.chapterOrder ?? NaN);
  const chapter = book?.chapters.find((c) => c.orderIndex === order);
  const missing = detail.error instanceof ApiError && [401, 403, 404].includes(detail.error.status);

  return (
    <main className="reader-soon">
      <div className="reader-soon-page">
        {detail.isPending ? (
          <p>Abriendo el libro…</p>
        ) : missing || !book ? (
          <>
            <h1>No encontramos este libro</h1>
            <p>Puede que no sea tuyo o que ya no esté en la estantería.</p>
          </>
        ) : (
          <>
            <h1>{book.title ?? 'Sin título'}</h1>
            <p className="author">{book.author || 'Autor desconocido'}</p>
            {chapter && <p className="reader-soon-chapter">{chapter.title}</p>}
            <p>
              El lector llega pronto: aquí vas a leer y escuchar este libro, con la voz que elijas y
              desde la misma oración.
            </p>
          </>
        )}
        <Link className="open-book" to={back}>
          {isPublic ? 'Volver a la biblioteca' : 'Volver a tu estudio'}
        </Link>
      </div>
    </main>
  );
}
