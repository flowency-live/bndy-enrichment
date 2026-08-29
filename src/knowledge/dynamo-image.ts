import type { AttributeValue } from 'aws-lambda';

export function decodeAttributeValue(value: AttributeValue | undefined): unknown {
  if (!value) return undefined;
  if ('S' in value) return value.S;
  if ('N' in value) return Number(value.N);
  if ('BOOL' in value) return value.BOOL;
  if ('NULL' in value) return null;
  if ('L' in value) return (value.L ?? []).map((item) => decodeAttributeValue(item));
  if ('M' in value) return Object.fromEntries(Object.entries(value.M ?? {}).map(([key, item]) => [key, decodeAttributeValue(item)]));
  if ('SS' in value) return value.SS ?? [];
  if ('NS' in value) return (value.NS ?? []).map(Number);
  if ('BS' in value) return value.BS ?? [];
  if ('B' in value) return value.B;
  return undefined;
}

export function decodeDynamoImage(image: Record<string, AttributeValue> | undefined): Record<string, unknown> | null {
  if (!image) return null;
  return Object.fromEntries(Object.entries(image).map(([key, value]) => [key, decodeAttributeValue(value)]));
}
