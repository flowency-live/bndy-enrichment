import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AuthorityAssertionSchema, type AuthorityAssertion, type AuthorityEntityType } from './claim-authority.js';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export const AUTHORITY_ENTITY_INDEX = 'SubjectClaimsIndex';

export function authorityAssertionItem(assertion: AuthorityAssertion): Record<string, unknown> {
  const parsed = AuthorityAssertionSchema.parse(assertion);
  return {
    pk: `AUTHORITY#${parsed.id}`,
    sk: 'META',
    entityType: 'AuthorityAssertion',
    ...parsed,
    GSI2PK: `AUTHORITY_ENTITY#${parsed.entityType}#${parsed.entityId}`,
    GSI2SK: `${parsed.updatedAt}#${parsed.id}`,
  };
}

export class AuthorityAssertionStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(assertion: AuthorityAssertion): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: authorityAssertionItem(assertion),
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async listByEntity(entityType: AuthorityEntityType, entityId: string, limit = 100): Promise<AuthorityAssertion[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: AUTHORITY_ENTITY_INDEX,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `AUTHORITY_ENTITY#${entityType}#${entityId}` },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => AuthorityAssertionSchema.parse(item));
  }
}
