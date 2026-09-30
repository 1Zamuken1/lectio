import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useUploadBook } from '../api/queries';
import { Sound } from '../theme/sound';
import { NOT_AN_EPUB, looksLikeEpub, uploadErrorMessage } from './book-messages';

/**
 * Subir libros al estudio: con el botón "Añadir libro" o soltando archivos en cualquier
 * parte de la sala. Cada resultado se cuenta con `notify` (lo dice el búho) y, si el libro
 * ya estaba, `focus` lo elige en la repisa (409 BOOK_ALREADY_EXISTS trae su id).
 */
export function useBookUpload({
  notify,
  focus,
}: {
  notify: (text: string) => void;
  focus: (bookId: string) => void;
}) {
  const mutation = useUploadBook();
  const [busy, setBusy] = useState(false);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        if (!looksLikeEpub(file)) {
          notify(NOT_AN_EPUB);
          continue;
        }
        notify(`Subiendo «${file.name}»…`);
        try {
          await mutation.mutateAsync(file);
          Sound.play('confirm');
          notify('¡Recibido! Lo estoy preparando: en unos segundos estará en tu repisa.');
        } catch (error) {
          if (error instanceof ApiError && error.code === 'BOOK_ALREADY_EXISTS') {
            notify('Ya tienes este libro: aquí está.');
            if (typeof error.body.bookId === 'string') focus(error.body.bookId);
          } else notify(uploadErrorMessage(error));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return { upload, busy };
}

/** El selector de archivos, oculto: lo abren el botón y el libro en blanco. */
export function useFilePicker(onFiles: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept=".epub,application/epub+zip"
      multiple
      hidden
      onChange={(event) => {
        onFiles([...(event.target.files ?? [])]);
        event.target.value = '';
      }}
    />
  );
  return { open: () => input.current?.click(), element };
}

/**
 * Soltar archivos en la sala: `dragging` mientras hay archivos encima de la ventana (para
 * mostrar el velo). El contador evita el parpadeo al pasar sobre elementos hijos.
 */
export function useFileDrop(enabled: boolean, onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onFiles);
  useEffect(() => {
    handler.current = onFiles;
  });

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      handler.current([...(event.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [enabled]);

  return dragging;
}

/** El velo mientras se arrastra un archivo sobre el estudio. */
export function DropVeil() {
  return (
    <div className="drop-veil" aria-hidden="true">
      <p>Suelta el EPUB para ponerlo en tu repisa</p>
    </div>
  );
}

/** En la repisa vacía: un libro en blanco que invita a añadir el primero. */
export function BlankBook({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <div className="blank-shelf">
      <button
        type="button"
        className="spine blank-book"
        aria-label="Añade tu primer libro"
        onClick={onClick}
        disabled={busy}
      >
        <span className="spine-title">Tu primer libro</span>
      </button>
      <p>
        Un EPUB sin DRM: pulsa el libro en blanco o suelta el archivo en cualquier parte del
        estudio.
      </p>
    </div>
  );
}
