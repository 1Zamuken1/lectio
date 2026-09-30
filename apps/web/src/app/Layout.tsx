import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { LoginScroll } from '../auth/LoginScroll';
import { useAuthPrompt } from '../auth/auth-prompt';
import { RoomFade } from '../library/room-door';
import { ConfirmDialog } from '../player/ConfirmDialog';
import { MiniPlayer } from '../player/MiniPlayer';
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

  // Al cerrar sesión, deja de sonar un libro tuyo (los públicos siguen).
  useEffect(() => {
    if (state.status !== 'anonymous') return;
    const loaded = player.state.loaded;
    if (loaded && !player.state.books[loaded.bookId]?.isPublic) player.stop();
  }, [state.status, player]);

  useEffect(() => {
    void session.restore();
  }, [session]);

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
