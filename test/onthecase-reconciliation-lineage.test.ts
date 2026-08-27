import { describe, expect, it, vi } from 'vitest';
import { DynamoSqsSourceFanoutPublisher } from '../src/sources/runner/fanout.js';

function makePublisher() {
  const ddbSend = vi.fn().mockResolvedValue({});
  const sqsSend = vi.fn().mockResolvedValue({});
  return { publisher: new DynamoSqsSourceFanoutPublisher('state-table','queue',{send:ddbSend} as any,{send:sqsSend} as any), ddbSend, sqsSend };
}

describe('On The Case owned reconciliation task scoping', () => {
  it('keeps BAU venue hydration daily', async () => {
    const {publisher,ddbSend}=makePublisher();
    await publisher.publish({sourceId:'onthecase-venue-hydration',taskKey:'venue:onthecase:venue:108',task:{kind:'venue',url:'https://onthecasemusic.co.uk/venues/108/x'}},'2026-08-27T08:00:00.000Z');
    expect((ddbSend.mock.calls[0][0] as any).input.Item.taskKey).toBe('venue:onthecase:venue:108@2026-08-27');
  });
  it('keeps BAU band hydration weekly', async () => {
    const {publisher,ddbSend}=makePublisher();
    await publisher.publish({sourceId:'onthecase-band-hydration',taskKey:'band:onthecase:band:12550',task:{kind:'band',url:'https://onthecasemusic.co.uk/bands/12550/x'}},'2026-08-27T08:00:00.000Z');
    expect((ddbSend.mock.calls[0][0] as any).input.Item.taskKey).toBe('band:onthecase:band:12550@2026W35');
  });
  it('scopes venue hydration to an explicit owned reconciliation', async () => {
    const {publisher,ddbSend,sqsSend}=makePublisher(); const rid='onthecase-gig-led-2026-08-27T08-00-00-000Z';
    await publisher.publish({sourceId:'onthecase-venue-hydration',taskKey:'venue:onthecase:venue:108',task:{kind:'venue',url:'https://onthecasemusic.co.uk/venues/108/x'}},'2026-08-27T08:00:00.000Z',rid);
    expect((ddbSend.mock.calls[0][0] as any).input.Item.taskKey).toBe(`venue:onthecase:venue:108@${rid}`);
    expect(JSON.parse((sqsSend.mock.calls[0][0] as any).input.MessageBody).reconciliationId).toBe(rid);
  });
  it('scopes band hydration to the same explicit owned reconciliation', async () => {
    const {publisher,ddbSend}=makePublisher(); const rid='onthecase-gig-led-2026-08-27T08-00-00-000Z';
    await publisher.publish({sourceId:'onthecase-band-hydration',taskKey:'band:onthecase:band:12550',task:{kind:'band',url:'https://onthecasemusic.co.uk/bands/12550/x'}},'2026-08-27T08:00:00.000Z',rid);
    expect((ddbSend.mock.calls[0][0] as any).input.Item.taskKey).toBe(`band:onthecase:band:12550@${rid}`);
  });
});
