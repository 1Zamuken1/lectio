import { useEffect, useRef } from 'react';
import { usePlayerState } from '../app/context';
import { Sound } from '../theme/sound';

/**
 * Las preguntas del reproductor ("¿Pasar a otro capítulo?", "¿Generar este capítulo?")
 * en el diálogo del preview. Un clic fuera o Escape es "no".
 */
export function ConfirmDialog() {
  const request = usePlayerState((s) => s.confirm);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (request && !dialog.current?.open) dialog.current?.showModal();
  }, [request]);

  if (!request) return null;
  const answer = (value: boolean) => {
    Sound.play(value ? 'confirm' : 'toggle');
    dialog.current?.close();
    request.resolve(value);
  };
  return (
    <dialog
      ref={dialog}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        answer(false);
      }}
      onClick={(event) => {
        if (event.target === dialog.current) answer(false); // clic fuera del recuadro
      }}
    >
      <h2 id="confirm-title">{request.title}</h2>
      <p>{request.body}</p>
      <div className="confirm-actions">
        <button type="button" className="tool" autoFocus onClick={() => answer(false)}>
          {request.cancel}
        </button>
        <button type="button" className="tool primary" onClick={() => answer(true)}>
          {request.confirm}
        </button>
      </div>
    </dialog>
  );
}
