import { memo, useMemo } from 'react';
import { Icons } from '../theme/icons';
import { useTheme } from '../theme/theme';

/**
 * Ícono del mundo activo: iluminado en el Scriptorium, de línea en Clásico. El SVG lo arma
 * icons.js a partir de sus cuadrículas (nunca con datos del usuario), por eso se inserta
 * como HTML.
 */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const { world } = useTheme();
  // world en las dependencias: el mismo nombre se dibuja distinto en cada mundo.
  const markup = useMemo(() => Icons.markup(name), [name, world]);
  return (
    <span
      className={`icon${className ? ` ${className}` : ''}`}
      data-icon={name}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * Pixel art generado por pixel.js (SVG de sprites propios, sin datos del usuario). Se
 * memoriza: una escena tiene miles de rectángulos y no cambia entre renders; día y noche
 * son solo variables de CSS.
 */
export const PixelArt = memo(function PixelArt({
  svg,
  className,
}: {
  svg: string;
  className?: string;
}) {
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
});
