/** Íconos iluminados (Scriptorium) o de línea (Clásico), según el mundo activo. */
export declare const Icons: {
  icon(name: string, className?: string): HTMLSpanElement;
  set(element: HTMLElement, name: string): void;
  paint(root?: ParentNode): void;
  /** El SVG del ícono en el mundo activo ('' si no existe). */
  markup(name: string): string;
};
