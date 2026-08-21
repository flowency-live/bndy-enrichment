import type { GigSource } from '../../knowledge/types.js';
import type { AcquisitionRouter } from './acquisition.js';
import type { FetchedSource, ParsedSource, SourceRunContext } from './types.js';

/**
 * Target SourceAdapter seam. Source-specific acquisition/parsing stays behind this
 * interface; the generic runner owns evidence, claims, diff and projection work.
 */
export interface SourceAdapter {
  fetch(
    config: GigSource,
    run: SourceRunContext,
    acquisition: AcquisitionRouter,
  ): Promise<FetchedSource>;

  parse(
    config: GigSource,
    run: SourceRunContext,
    raw: FetchedSource,
  ): Promise<ParsedSource>;
}

const adapters = new Map<string, SourceAdapter>();

export function registerSourceAdapter(adapterId: string, adapter: SourceAdapter): void {
  adapters.set(adapterId, adapter);
}

export function getSourceAdapter(config: GigSource): SourceAdapter | undefined {
  return adapters.get(config.adapter ?? config.id);
}

export function clearSourceAdapters(): void {
  adapters.clear();
}
