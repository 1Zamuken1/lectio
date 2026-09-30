import { create } from 'zustand';

/** El evento de Chrome que permite ofrecer la instalación desde un botón propio. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** El navegador ofrece instalar (Android, escritorio): el botón "Instalar" aparece. */
  offer: BeforeInstallPromptEvent | null;
}

export const useInstall = create<InstallState>(() => ({ offer: null }));

/**
 * Escucha la oferta de instalación (frontend §2.4). Va al arrancar, antes que React: el
 * evento puede llegar muy pronto. Se guarda en vez de dejar que Chrome muestre su barra.
 */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstall.setState({ offer: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ offer: null }));
}

/** Muestra el diálogo del navegador. La oferta se usa una vez, acepten o no. */
export async function install(): Promise<void> {
  const offer = useInstall.getState().offer;
  if (!offer) return;
  useInstall.setState({ offer: null });
  await offer.prompt();
  await offer.userChoice;
}

/** Ya se abre como app instalada (sin barra del navegador). */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iPhone o iPad (el iPad se presenta como Mac, pero con pantalla táctil). */
function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

const IOS_HINT_KEY = 'lectio:ios-install-hint';

/**
 * En iPhone no hay oferta de instalación: se instala desde Compartir. El búho lo explica
 * una sola vez; devuelve true solo la primera vez que se pregunta (y lo recuerda).
 */
export function takeIosInstallHint(): boolean {
  if (!isIos() || isStandalone()) return false;
  try {
    if (localStorage.getItem(IOS_HINT_KEY)) return false;
    localStorage.setItem(IOS_HINT_KEY, '1');
    return true;
  } catch {
    return false; // sin almacenamiento, mejor no insistir en cada visita
  }
}
