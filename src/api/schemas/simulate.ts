import { Type, Static } from '@sinclair/typebox';

export const TransactionParamsSchema = Type.Object({
  from: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
  to: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' })),
  data: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]*$' })),
  value: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]+$' })),
  gas: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]+$' })),
  gasPrice: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]+$' })),
  maxFeePerGas: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]+$' })),
  maxPriorityFeePerGas: Type.Optional(Type.String({ pattern: '^0x[a-fA-F0-9]+$' })),
});

export const SimulateRequestSchema = Type.Object({
  networkId: Type.String({ minLength: 1 }),
  tx: TransactionParamsSchema,
});

export type SimulateRequestBody = Static<typeof SimulateRequestSchema>;

// Response schemas (for documentation, not validation)
export const NativeTransferSchema = Type.Object({
  from: Type.String(),
  to: Type.String(),
  amount: Type.String(),
});

export const ERC20TransferSchema = Type.Object({
  token: Type.String(),
  from: Type.String(),
  to: Type.String(),
  amount: Type.String(),
});

export const ERC721TransferSchema = Type.Object({
  token: Type.String(),
  from: Type.String(),
  to: Type.String(),
  tokenId: Type.String(),
});

export const ERC1155TransferSchema = Type.Object({
  token: Type.String(),
  operator: Type.String(),
  from: Type.String(),
  to: Type.String(),
  id: Type.String(),
  amount: Type.String(),
});

export const AssetChangesSchema = Type.Object({
  native: Type.Array(NativeTransferSchema),
  erc20: Type.Array(ERC20TransferSchema),
  erc721: Type.Array(ERC721TransferSchema),
  erc1155: Type.Array(ERC1155TransferSchema),
});

// Approval schemas
export const ERC20ApprovalSchema = Type.Object({
  token: Type.String(),
  owner: Type.String(),
  spender: Type.String(),
  amount: Type.String(),
  isUnlimited: Type.Boolean(),
});

export const ERC721ApprovalSchema = Type.Object({
  token: Type.String(),
  owner: Type.String(),
  spender: Type.String(),
  tokenId: Type.String(),
});

export const OperatorApprovalSchema = Type.Object({
  token: Type.String(),
  owner: Type.String(),
  operator: Type.String(),
  approved: Type.Boolean(),
});

export const ApprovalChangesSchema = Type.Object({
  erc20: Type.Array(ERC20ApprovalSchema),
  erc721: Type.Array(ERC721ApprovalSchema),
  operatorApprovals: Type.Array(OperatorApprovalSchema),
});

export const AggregatedApprovalSchema = Type.Object({
  spender: Type.String(),
  amount: Type.String(),
  isUnlimited: Type.Boolean(),
});

export const SimulateResponseSchema = Type.Object({
  success: Type.Boolean(),
  revertReason: Type.Union([Type.String(), Type.Null()]),
  gasUsed: Type.Union([Type.String(), Type.Null()]),
  involvedAddresses: Type.Array(Type.String()),
  assetChanges: AssetChangesSchema,
  deltasByAddress: Type.Record(Type.String(), Type.Record(Type.String(), Type.String())),
  approvals: ApprovalChangesSchema,
  approvalsByAddress: Type.Record(Type.String(), Type.Record(Type.String(), AggregatedApprovalSchema)),
});
