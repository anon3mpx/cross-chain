import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStatusAPI } from '../../src/vps/api/StatusAPI';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

test('buildStatusAPI accepts an injected rpcProviderRegistry', async () => {
  const app = buildStatusAPI(
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    }),
    {
      rpcProviderRegistry: {
        getReadProvider() {
          return {
            getTransactionReceipt: async () => ({ status: 1 }),
          } as any;
        },
      } as any,
    },
  );

  assert.ok(app);
});
