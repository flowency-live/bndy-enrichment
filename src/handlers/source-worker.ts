import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { HttpAcquisitionRouter } from '../sources/runner/acquisition.js';
import { createRunnerDependencies } from '../sources/runner/runtime.js';
import { runSource, type SourceRunRequest } from '../sources/runner/runner.js';

function requestFrom(record: SQSRecord): SourceRunRequest {
  const parsed = JSON.parse(record.body) as Partial<SourceRunRequest>;
  if (!parsed.sourceId || !parsed.reason) throw new Error('Invalid SourceScan message');
  if (parsed.reason !== 'scheduled' && parsed.reason !== 'manual') throw new Error(`Invalid scan reason: ${parsed.reason}`);
  if (parsed.taskKey && (!parsed.task || typeof parsed.task !== 'object')) throw new Error('Source taskKey requires task payload');
  return {
    ...parsed,
    sourceId: parsed.sourceId,
    reason: parsed.reason,
    requestedAt: parsed.requestedAt ?? new Date().toISOString(),
  } as SourceRunRequest;
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const deps = createRunnerDependencies(new HttpAcquisitionRouter());
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    let request: SourceRunRequest | undefined;
    try {
      request = requestFrom(record);
      const config = await deps.registry.get(request.sourceId);
      if (!config) throw new Error(`Unknown source: ${request.sourceId}`);
      if (config.runtimeClass !== 'standard') throw new Error(`Source ${config.id} belongs on BrowserScanQueue`);
      if (request.taskKey) await deps.fanout?.mark(request.sourceId, request.taskKey, 'running', new Date().toISOString());
      const result = await runSource(request, deps);
      if (result.report.status === 'failed') throw new Error(result.report.errors.map((error) => error.message).join('; '));
      if (request.taskKey) {
        const terminalDisposition = result.observation?.httpStatus === 410 ? 'http-410-gone' : undefined;
        await deps.fanout?.mark(
          request.sourceId,
          request.taskKey,
          'completed',
          result.report.completedAt,
          terminalDisposition,
        );
      }
    } catch (error) {
      console.error('SourceWorker failed', error);
      if (request?.taskKey) {
        try {
          await deps.fanout?.mark(
            request.sourceId,
            request.taskKey,
            'failed',
            new Date().toISOString(),
            error instanceof Error ? error.message : String(error),
          );
        } catch (markError) {
          console.error('Failed to mark source task failure', markError);
        }
      }
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
