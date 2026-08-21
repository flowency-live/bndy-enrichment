import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { GigSource } from '../../knowledge/types.js';
import type { NormalisedSourceEvent, SourceEventDiff, SourceRunContext, SourceRunReport } from './types.js';

export interface SourceRunArtifactStore {
  writeNormalised(config: GigSource, run: SourceRunContext, events: NormalisedSourceEvent[]): Promise<string>;
  writeDiff(config: GigSource, run: SourceRunContext, diff: SourceEventDiff): Promise<string>;
  writeReport(config: GigSource, run: SourceRunContext, report: SourceRunReport): Promise<string>;
  loadNormalised(key?: string): Promise<NormalisedSourceEvent[]>;
}

function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

export class S3SourceRunArtifactStore implements SourceRunArtifactStore {
  constructor(
    private readonly bucketName: string,
    private readonly client = new S3Client({}),
  ) {}

  private prefix(config: GigSource, run: SourceRunContext): string {
    return `source-runs/${safe(config.id)}/${safe(run.runId)}`;
  }

  private async writeJson(key: string, value: unknown): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: 'application/json; charset=utf-8',
      IfNoneMatch: '*',
    }));
    return key;
  }

  async writeNormalised(config: GigSource, run: SourceRunContext, events: NormalisedSourceEvent[]): Promise<string> {
    return await this.writeJson(`${this.prefix(config, run)}/normalised.json`, events);
  }

  async writeDiff(config: GigSource, run: SourceRunContext, diff: SourceEventDiff): Promise<string> {
    return await this.writeJson(`${this.prefix(config, run)}/diff.json`, diff);
  }

  async writeReport(config: GigSource, run: SourceRunContext, report: SourceRunReport): Promise<string> {
    return await this.writeJson(`${this.prefix(config, run)}/run-report.json`, report);
  }

  async loadNormalised(key?: string): Promise<NormalisedSourceEvent[]> {
    if (!key) return [];
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const text = await response.Body?.transformToString('utf-8');
    if (!text) return [];
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`Normalised artifact is not an array: ${key}`);
    return parsed as NormalisedSourceEvent[];
  }
}
