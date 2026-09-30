import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useApi } from '../app/context';
import { KIND_LABEL, formatDuration, formatNumber } from './text';

/** El reporte del pipeline tal como lo guarda el worker (`processing_report`). */
interface ProcessingReport {
  pipelineVersion: number;
  durationMs: number;
  navSource: string;
  language: { value: string; source: 'metadata' | 'detected' };
  chapters: { total: number; narrative: number };
  characters: { all: number; narrative: number; estimatedMinutes: number };
  classification: Array<{
    orderIndex: number;
    title: string;
    kind: keyof typeof KIND_LABEL;
    signal: string;
    confidence: 'high' | 'low';
    evidence: string;
  }>;
  cleaning: Record<string, { semantic: number; heuristic: number }>;
  narration: Record<string, number>;
  warnings: Array<{ code: string; message: string }>;
}

const SIGNAL: Record<string, string> = {
  semantic: 'semántica',
  landmark: 'landmark',
  title: 'título',
  heuristic: 'heurística',
  default: 'por defecto',
};

const RULES: Record<string, string> = {
  S1_page_numbers: 'Números de página',
  S1_line_numbers: 'Números de verso',
  S2_running_headers: 'Encabezados repetidos',
  S2_duplicate_titles: 'Títulos repetidos',
  S3_hidden: 'Elementos ocultos',
  S4_notes: 'Llamadas a nota reescritas',
  N1_noterefs: 'Marcas de nota no narradas',
  N2_dois: 'DOIs',
  N3_urls: 'URLs y correos',
  N4_citations: 'Citas bibliográficas',
  N5_legal: 'ISBN y avisos legales',
};

/** Precio por millón de caracteres (docs/lectio-decision-tts.md). */
const PRICES: Array<[string, number]> = [
  ['Edge TTS (MVP)', 0],
  ['Kokoro · DeepInfra', 0.62],
  ['Azure Speech', 15],
];

const money = (value: number) =>
  value === 0
    ? 'gratis'
    : `US$ ${value < 0.01 ? '< 0,01' : value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="stat">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

/**
 * La pestaña Reporte, portada del preview: qué es cada sección del libro y por qué, qué se
 * limpió y cuánto costaría narrarlo con cada proveedor. Clic en una sección la abre.
 */
export function Report({
  bookId,
  onOpen,
}: {
  bookId: string;
  onOpen: (orderIndex: number) => void;
}) {
  const api = useApi();
  const report = useQuery({
    queryKey: ['report', bookId],
    queryFn: () => api.get<ProcessingReport>(`/api/v1/books/${bookId}/report`),
    staleTime: Infinity,
  });

  if (report.isPending) return <p className="chapter-loading">Abriendo el reporte…</p>;
  if (!report.data) return <p className="chapter-loading">No pudimos abrir el reporte.</p>;
  const r = report.data;
  const narrative = r.characters.narrative;
  const cleaning = Object.entries(r.cleaning).filter(([, v]) => v.semantic + v.heuristic > 0);
  const narration = Object.entries(r.narration).filter(([, count]) => count > 0);

  return (
    <section className="report">
      <h2>Resumen</h2>
      <div className="stats">
        <Stat
          value={formatNumber(r.chapters.narrative)}
          label={`capítulos narrativos de ${r.chapters.total} secciones`}
        />
        <Stat value={formatDuration(r.characters.estimatedMinutes)} label="de audio estimado" />
        <Stat value={formatNumber(narrative)} label="caracteres de narración" />
        <Stat value={`${formatNumber(r.durationMs)} ms`} label="de procesamiento" />
      </div>
      <p className="fine-print">
        Idioma: {r.language.value} ({r.language.source === 'metadata' ? 'declarado' : 'detectado'})
        · índice desde {r.navSource} · pipeline v{r.pipelineVersion}
      </p>

      <h2>Costo estimado del audio</h2>
      <Table headers={['Proveedor', 'Libro completo']}>
        {PRICES.map(([name, perMillion]) => (
          <tr key={name}>
            <td>{name}</td>
            <td className="num">{money((narrative / 1e6) * perMillion)}</td>
          </tr>
        ))}
      </Table>
      <p className="fine-print">
        Precios por millón de caracteres de docs/lectio-decision-tts.md; solo capítulos narrativos.
      </p>

      <h2>Clasificación de secciones</h2>
      <Table headers={['#', 'Sección', 'Tipo', 'Señal', 'Evidencia']}>
        {r.classification.map((c) => (
          <tr key={c.orderIndex}>
            <td className="num">{c.orderIndex}</td>
            <td>
              <button
                type="button"
                className="tool report-open"
                onClick={() => onOpen(c.orderIndex)}
              >
                {c.title}
              </button>
            </td>
            <td>{KIND_LABEL[c.kind]}</td>
            <td className={c.confidence === 'low' ? 'low' : ''}>
              {SIGNAL[c.signal] ?? c.signal}
              {c.confidence === 'low' ? ' (baja confianza)' : ''}
            </td>
            <td>{c.evidence}</td>
          </tr>
        ))}
      </Table>

      <h2>Limpieza estructural</h2>
      {cleaning.length ? (
        <Table headers={['Regla', 'Semántica', 'Heurística']}>
          {cleaning.map(([rule, v]) => (
            <tr key={rule}>
              <td>{RULES[rule] ?? rule}</td>
              <td className="num">{formatNumber(v.semantic)}</td>
              <td className="num">{formatNumber(v.heuristic)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="empty">No hizo falta limpiar nada.</p>
      )}

      <h2>Limpieza de narración</h2>
      {narration.length ? (
        <Table headers={['Regla', 'Coincidencias']}>
          {narration.map(([rule, count]) => (
            <tr key={rule}>
              <td>{RULES[rule] ?? rule}</td>
              <td className="num">{formatNumber(count)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="empty">Sin cambios.</p>
      )}

      <h2>Advertencias</h2>
      {r.warnings.length ? (
        r.warnings.map((w) => (
          <div key={`${w.code}:${w.message}`} className="warning">
            <code>{w.code}</code> {w.message}
          </div>
        ))
      ) : (
        <p className="empty">Ninguna.</p>
      )}
    </section>
  );
}
