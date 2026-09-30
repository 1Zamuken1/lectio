import { useQuery } from '@tanstack/react-query';
import { useApi } from '../app/context';

/**
 * Imagen de la API. Un <img src> no puede mandar la cabecera Authorization, así que las
 * imágenes de libros privados se piden con el token y se muestran como blob. Las de libros
 * públicos van directo (el navegador las cachea). El blob queda en la caché de TanStack
 * Query: volver a la biblioteca no las descarga de nuevo.
 */
export function ApiImage({
  src,
  isPublic,
  alt,
  className,
}: {
  src: string;
  isPublic: boolean;
  alt: string;
  className?: string;
}) {
  const api = useApi();
  const blob = useQuery({
    queryKey: ['image', src],
    queryFn: async () => {
      const response = await api.send(src, { raw: true });
      return URL.createObjectURL(await response.blob());
    },
    enabled: !isPublic,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
  const url = isPublic ? src : blob.data;
  if (!url) return <div className={`${className ?? ''} cover-loading`} aria-hidden="true" />;
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />;
}
