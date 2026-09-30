import { useMemo, type ReactNode } from 'react';
import type { BookDetail, ChapterSummary } from '../api/queries';
import { ApiImage } from '../components/ApiImage';
import { Pixel } from '../theme/pixel';
import { KIND_LABEL, estimatedMinutes, formatDuration } from './text';

/** ¿Hay audio listo en alguna voz? */
export const hasAudio = (chapter: ChapterSummary) =>
  chapter.audio.some((a) => a.status === 'ready');

/**
 * El índice del libro: la ficha con la portada, los capítulos agrupados por su sección
 * (con la marca ♪ si ya tienen audio), el búho y el interruptor de las secciones no
 * narrativas. En el celular se abre como panel (`open`).
 */
export function ReaderSidebar({
  book,
  currentId,
  hideAux,
  open,
  onToggleAux,
  onGo,
}: {
  book: BookDetail;
  currentId: string | null;
  hideAux: boolean;
  open: boolean;
  onToggleAux: () => void;
  onGo: (orderIndex: number) => void;
}) {
  const owl = useMemo(() => Pixel.owlBadge(), []);
  const auxCount = book.chapters.filter((c) => c.kind !== 'narrative').length;

  const items: ReactNode[] = [];
  let group: string | null = null;
  for (const chapter of book.chapters) {
    const aux = chapter.kind !== 'narrative';
    if (aux && hideAux && chapter.id !== currentId) continue;
    const groupName = chapter.ancestors.join(' › ');
    if (groupName !== group) {
      group = groupName;
      if (groupName) {
        items.push(
          <li key={`g:${chapter.id}`} className="toc-group" role="presentation">
            {groupName}
          </li>,
        );
      }
    }
    const withAudio = hasAudio(chapter);
    items.push(
      <li key={chapter.id}>
        <button
          type="button"
          aria-current={chapter.id === currentId ? 'page' : undefined}
          onClick={() => onGo(chapter.orderIndex)}
        >
          <span className={`toc-title${aux ? ' is-hidden' : ''}`}>{chapter.title}</span>
          {aux ? (
            <span className="kind">{KIND_LABEL[chapter.kind]}</span>
          ) : (
            <span className="toc-meta" title={withAudio ? 'Tiene audio' : undefined}>
              {withAudio ? '♪ ' : ''}
              {formatDuration(estimatedMinutes(chapter.characterCount))}
            </span>
          )}
        </button>
      </li>,
    );
  }

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Índice del libro">
      <div className="book-card">
        {book.coverUrl ? (
          <ApiImage src={book.coverUrl} isPublic={book.isPublic} alt="" />
        ) : (
          <span />
        )}
        <div>
          <h1>{book.title ?? 'Sin título'}</h1>
          <p>{book.author || 'Autor desconocido'}</p>
        </div>
      </div>
      <ul className="toc">{items}</ul>
      <div className="companion-slot" aria-hidden="true">
        <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: owl }} />
        <span>Sabio, el búho, vela tu lectura.</span>
      </div>
      {auxCount > 0 && (
        <button type="button" className="toc-toggle" onClick={onToggleAux}>
          {hideAux
            ? `Mostrar las ${auxCount} secciones no narrativas`
            : 'Ocultar las secciones no narrativas'}
        </button>
      )}
    </nav>
  );
}
