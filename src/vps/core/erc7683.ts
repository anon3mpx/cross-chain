export interface OnchainCrossChainOrder {
  fillDeadline: number;
  orderDataType: string;
  orderData: string;
}

export interface GaslessCrossChainOrder {
  originSettler: string;
  user: string;
  nonce: string;
  originChainId: number;
  openDeadline: number;
  fillDeadline: number;
  orderDataType: string;
  orderData: string;
}

export interface OrderOutput {
  token: string;
  amount: string;
  recipient: string;
  chainId: number;
}

export interface FillInstruction {
  destinationChainId: number;
  destinationSettler: string;
  originData: string;
}

export interface ResolvedCrossChainOrder {
  user: string;
  originChainId: number;
  openDeadline: number;
  fillDeadline: number;
  orderId: string;
  maxSpent: OrderOutput[];
  minReceived: OrderOutput[];
  fillInstructions: FillInstruction[];
}

export const EMPX_ORDER_DATA_TYPE =
  '0x8a952478905121147191dfedd22132cd68d0817cb041bb3bf4cc531030ef8e1f' as const;

export interface EmpxSwapOrderV1 {
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  recipient: string;
  nativeDstAddress?: string;
  slippageBps?: number;
  partnerId?: string;
  integratorId?: string;
  agentId?: string;
}
