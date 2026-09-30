import { create } from 'zustand';

/**
 * Pedir que se inicie sesión desde cualquier parte ("Para subir libros, entra…"). El
 * pergamino lo muestra el layout; `then` corre al entrar (por ejemplo, ir al estudio).
 */
interface AuthPrompt {
  open: null | { tab: 'login' | 'register'; reason?: string; then?: () => void };
  ask(options: { tab?: 'login' | 'register'; reason?: string; then?: () => void }): void;
  close(): void;
}

export const useAuthPrompt = create<AuthPrompt>((set) => ({
  open: null,
  ask: ({ tab = 'login', reason, then }) => set({ open: { tab, reason, then } }),
  close: () => set({ open: null }),
}));
