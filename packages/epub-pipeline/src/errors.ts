/**
 * Errores fatales del pipeline. `code` es estable: el backend lo persiste en
 * `Book.error_code` y el frontend decide el mensaje al usuario a partir de él.
 */
export type PipelineErrorCode =
  'INVALID_ARCHIVE' | 'MISSING_PACKAGE' | 'DRM_PROTECTED' | 'NO_TEXT_CONTENT' | 'LIMITS_EXCEEDED';

export class PipelineError extends Error {
  override readonly name = 'PipelineError';
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    readonly code: PipelineErrorCode,
    message: string,
    options: { cause?: unknown; details?: Record<string, unknown> } = {},
  ) {
    super(message, { cause: options.cause });
    this.details = options.details ?? {};
  }
}

/** Problemas no fatales: el libro se procesa igual, pero quedan en el reporte. */
export type PipelineWarningCode =
  | 'MIMETYPE_INVALID'
  | 'MIMETYPE_NOT_FIRST'
  | 'MANIFEST_ITEM_MISSING'
  | 'SPINE_ITEM_UNRESOLVED'
  | 'TITLE_MISSING'
  | 'LANGUAGE_MISSING';

export interface PipelineWarning {
  code: PipelineWarningCode;
  message: string;
  details?: Record<string, unknown>;
}
