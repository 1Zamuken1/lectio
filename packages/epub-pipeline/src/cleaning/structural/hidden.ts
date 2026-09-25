import { descendants, tagName } from '../../dom/xhtml.js';
import type { RuleStats } from '../stats.js';

const HIDDEN_STYLE = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden)\s*(;|$)/i;
/** Las imágenes decorativas llevan `aria-hidden`, pero en la lectura siguen siendo útiles. */
const MEDIA_TAGS = new Set(['img', 'svg', 'image', 'figure']);

/** S3. Elementos ocultos: el autor del EPUB no quería que se vieran ni se leyeran. */
export function removeHidden(root: Element, stats: RuleStats): void {
  for (const element of [...descendants(root)]) {
    if (!element.parentNode) continue;
    const hidden =
      element.hasAttribute('hidden') ||
      (element.getAttribute('aria-hidden') === 'true' && !MEDIA_TAGS.has(tagName(element))) ||
      HIDDEN_STYLE.test(element.getAttribute('style') ?? '');
    if (hidden) {
      element.remove();
      stats.S3_hidden.semantic++;
    }
  }
}
