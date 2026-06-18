import type { DocumentModel } from './ast';

/* ── Exporter interface ──
 *
 * Every exporter receives a fully-parsed DocumentModel (AST + metadata)
 * and returns the exported content as a string. The exporter must not
 * read, parse, or otherwise access raw markdown directly.
 */

export interface ExportResult {
  content: string;
  /** Suggested file extension without dot (e.g. 'html', 'pdf', 'tex') */
  extension: string;
  /** MIME type for the output (e.g. 'text/html', 'application/pdf') */
  mime: string;
}

export interface Exporter {
  /** Unique identifier (e.g. 'html', 'latex', 'typst') */
  readonly name: string;
  /** Human-readable label in Arabic (e.g. 'HTML', 'PDF', 'لا텍') */
  readonly label: string;
  /** File extensions this exporter produces (without dot) */
  readonly extensions: string[];
  /**
   * Export a DocumentModel to the target format.
   * Returns the exported content and metadata.
   */
  export(model: DocumentModel): ExportResult | Promise<ExportResult>;
}

/* ── Exporter registry (pluggable) ── */

const registry = new Map<string, Exporter>();

/**
 * Register an exporter. Replaces any existing exporter with the same name.
 */
export function registerExporter(exporter: Exporter): void {
  registry.set(exporter.name, exporter);
}

/**
 * Unregister an exporter by name. Returns true if it was registered.
 */
export function unregisterExporter(name: string): boolean {
  return registry.delete(name);
}

/**
 * Get a registered exporter by name. Returns undefined if not found.
 */
export function getExporter(name: string): Exporter | undefined {
  return registry.get(name);
}

/**
 * List all registered exporters.
 */
export function listExporters(): Exporter[] {
  return [...registry.values()];
}

/**
 * Check if an exporter is registered.
 */
export function hasExporter(name: string): boolean {
  return registry.has(name);
}

/**
 * Convenience: export a document using a named exporter.
 * Throws if the exporter is not registered.
 */
export async function exportDocument(
  model: DocumentModel,
  exporterName: string,
): Promise<ExportResult> {
  const exporter = registry.get(exporterName);
  if (!exporter) {
    throw new Error(`Exporter "${exporterName}" is not registered. Available: ${[...registry.keys()].join(', ')}`);
  }
  return exporter.export(model);
}
