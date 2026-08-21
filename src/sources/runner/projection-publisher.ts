import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ProjectionWorkItemSchema, type ProjectionWorkItem } from '../../knowledge/types.js';

export interface ProjectionPublisher {
  publish(item: ProjectionWorkItem): Promise<void>;
}

export class SqsProjectionPublisher implements ProjectionPublisher {
  constructor(
    private readonly queueUrl: string,
    private readonly client = new SQSClient({}),
  ) {}

  async publish(item: ProjectionWorkItem): Promise<void> {
    const parsed = ProjectionWorkItemSchema.parse(item);
    await this.client.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(parsed),
    }));
  }
}
