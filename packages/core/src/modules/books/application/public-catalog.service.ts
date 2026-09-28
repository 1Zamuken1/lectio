import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '../../../common/ids/uuid.js';
import { slugify } from '../../../common/slug.js';
import { FILE_STORAGE, storageKeys, type FileStorage } from '../../storage/file-storage.js';
import { BOOK_REPOSITORY, type BookRepository } from '../domain/ports.js';
import { ProcessBookService } from './process-book.service.js';

export interface PublishedBook {
  id: string;
  slug: string;
  /** false si ya estaba publicado (mismo archivo). */
  created: boolean;
  status: 'ready' | 'error';
  errorCode?: string;
  language: string | null;
}

/**
 * Carga libros al catálogo público (pnpm seed:public). Es un proceso interno, no un
 * endpoint: los libros públicos no tienen dueño (owner_id = null) y llevan un slug para
 * /libros/:slug. El EPUB se procesa en el mismo proceso, sin pasar por la cola: así el
 * script funciona aunque el worker no esté corriendo.
 */
@Injectable()
export class PublicCatalogService {
  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly processBook: ProcessBookService,
  ) {}

  async publish(input: { epub: Buffer; title: string }): Promise<PublishedBook> {
    const sourceHash = createHash('sha256').update(input.epub).digest('hex');
    const existing = await this.books.findPublicByHash(sourceHash);
    if (existing?.slug && existing.status === 'ready') {
      return { ...(await this.#summary(existing.id)), slug: existing.slug, created: false };
    }
    // Si quedó a medias (o en error) en una corrida anterior, se procesa de nuevo.
    const id = existing?.id ?? uuidv7();
    const slug = existing?.slug ?? (await this.#uniqueSlug(input.title));
    if (!existing) {
      const sourceKey = storageKeys.source(id);
      await this.storage.put(sourceKey, input.epub);
      await this.books.createPublic({ id, slug, sourceKey, sourceHash });
    }

    const outcome = await this.processBook.process(id);
    const summary = await this.#summary(id);
    return {
      ...summary,
      slug,
      created: !existing,
      ...(outcome.status === 'error' ? { status: 'error' as const, errorCode: outcome.code } : {}),
    };
  }

  async #summary(id: string): Promise<Omit<PublishedBook, 'slug' | 'created'>> {
    const detail = await this.books.findDetail(id);
    return {
      id,
      status: detail?.status === 'ready' ? 'ready' : 'error',
      language: detail?.language ?? null,
    };
  }

  async #uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (!(await this.books.slugTaken(candidate))) return candidate;
    }
  }
}
