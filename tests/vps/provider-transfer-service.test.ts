import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';

test('IntentService tracks provider-direct transfer snapshots in memory when Postgres is unavailable', async () => {
  const service = new IntentService(new IntentEngine());

  await service.upsertProviderTransfer({
    intentId: '0x' + '11'.repeat(32),
    provider: 'layerzero_value_transfer_api',
    providerQuoteId: 'quote_lz_direct',
    status: 'SUBMITTED',
    sourceSignature: '0x1234',
    latestProviderStatus: 'SIGNATURE_SUBMITTED',
    routeStepTypes: ['STARGATE_V2_TAXI'],
    metadata: { signatureCount: 1 },
  });
  await service.upsertProviderTransfer({
    intentId: '0x' + '11'.repeat(32),
    provider: 'layerzero_value_transfer_api',
    providerQuoteId: 'quote_lz_direct',
    status: 'SETTLED',
    destinationTxHash: '0xdestination',
    latestProviderStatus: 'SUCCEEDED',
  });

  const transfer = await service.getProviderTransfer({
    intentId: '0x' + '11'.repeat(32),
    provider: 'layerzero_value_transfer_api',
    providerQuoteId: 'quote_lz_direct',
  });

  assert.equal(transfer?.status, 'SETTLED');
  assert.equal(transfer?.sourceSignature, '0x1234');
  assert.equal(transfer?.destinationTxHash, '0xdestination');
  assert.equal(transfer?.latestProviderStatus, 'SUCCEEDED');
  assert.deepEqual(transfer?.routeStepTypes, ['STARGATE_V2_TAXI']);
  assert.deepEqual(transfer?.metadata, { signatureCount: 1 });
});
