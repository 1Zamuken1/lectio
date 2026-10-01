import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { LoginScroll } from '../auth/LoginScroll';
import { useAuthPrompt } from '../auth/auth-prompt';
import { RoomFade } from '../library/room-door';
import { ConfirmDialog } from '../player/ConfirmDialog';
import { MiniPlayer } from '../player/MiniPlayer';
import { UpdateNotice } from '../pwa/UpdateNotice';
import { usePlayer, useSession } from './context';

/**
 * Marco de todas las pantallas: recupera la sesión al abrir la app y pone encima el
 * pergamino cuando hace falta entrar. Si la sesión vence a mitad de algo, el pergamino
 * aparece sobre la pantalla actual: debajo no se desmonta nada (el audio sigue sonando).
 */
export function Layout() {
  const { state, session } = useSession();
  const prompt = useAuthPrompt();
  const player = usePlayer();
  const client = useQueryClient();

  // Al cerrar sesión, deja de sonar un libro tuyo (los públicos siguen), y lo tuyo sale de
  // la caché guardada en el dispositivo: la próxima persona no lo ve ni sin conexión.
  useEffect(() => {
    if (state.status !== 'anonymous') return;
    const loaded = player.state.loaded;
    if (loaded && !player.state.books[loaded.bookId]?.isPublic) player.stop();
    client.removeQueries({
      predicate: ({ queryKey: [kind, scope, userId] }) =>
        (kind === 'books' && scope === 'mine') || (kind === 'book' && userId != null),
    });
  }, [state.status, player, client]);

  useEffect(() => {
    void session.restore();
  }, [session]);

  // Con un token nuevo (al entrar, o cuando la API vuelve a contestar tras estar caída o
  // arrancando), se vuelve a pedir lo que falló mientras tanto.
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    void client.invalidateQueries({ predicate: (query) => query.state.status === 'error' });
  }, [state, client]);

  // Al entrar desde otra pestaña, el pergamino de esta ya no hace falta.
  useEffect(() => {
    if (state.status === 'authenticated' && prompt.open && !prompt.open.then) prompt.close();
  }, [state.status, prompt]);

  const expired = state.status === 'expired';
  return (
    <>
      <Outlet />
      <MiniPlayer />
      <ConfirmDialog />
      <UpdateNotice />
      <RoomFade />
      {expired && (
        <LoginScroll
          reason="Tu sesión se cerró. Entra de nuevo para seguir: nada de lo que hacías se pierde."
          onClose={() => session.forget()}
        />
      )}
      {!expired && prompt.open && (
        <LoginScroll
          initialTab={prompt.open.tab}
          reason={prompt.open.reason}
          onClose={prompt.close}
          onDone={() => {
            const then = prompt.open?.then;
            prompt.close();
            then?.();
          }}
        />
      )}
    </>
  );
}
