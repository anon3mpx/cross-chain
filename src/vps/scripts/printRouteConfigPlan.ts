import {
  buildMessagingRouteConfigPlan,
  renderMessagingRouteConfigPlan,
} from '../config/routeConfigPlanner';

interface CliArgs {
  srcChainId: number;
  dstChainId: number;
  assetAliases?: string[];
  json: boolean;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const plan = buildMessagingRouteConfigPlan({
    srcChainId: args.srcChainId,
    dstChainId: args.dstChainId,
    ...(args.assetAliases ? { assetAliases: args.assetAliases } : {}),
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderMessagingRouteConfigPlan(plan));
}

function parseArgs(argv: string[]): CliArgs {
  let srcChainId: number | null = null;
  let dstChainId: number | null = null;
  let assetAliases: string[] | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--src-chain-id') {
      srcChainId = parseNumber(argv[++index], '--src-chain-id');
      continue;
    }
    if (arg === '--dst-chain-id') {
      dstChainId = parseNumber(argv[++index], '--dst-chain-id');
      continue;
    }
    if (arg === '--assets') {
      const raw = argv[++index] ?? '';
      assetAliases = raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  if (srcChainId === null) throw new Error('--src-chain-id is required');
  if (dstChainId === null) throw new Error('--dst-chain-id is required');

  return {
    srcChainId,
    dstChainId,
    ...(assetAliases ? { assetAliases } : {}),
    json,
  };
}

function parseNumber(value: string | undefined, flag: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${flag} requires an integer value`);
  }
  return Number.parseInt(value, 10);
}

main();
