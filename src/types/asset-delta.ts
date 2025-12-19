export interface NativeTransfer {
  from: string;
  to: string;
  amount: string; // Decimal string for JSON safety
}

export interface ERC20Transfer {
  token: string;
  from: string;
  to: string;
  amount: string;
}

export interface ERC721Transfer {
  token: string;
  from: string;
  to: string;
  tokenId: string;
}

export interface ERC1155Transfer {
  token: string;
  operator: string;
  from: string;
  to: string;
  id: string;
  amount: string;
}

// Approval types
export interface ERC20Approval {
  token: string;
  owner: string;
  spender: string;
  amount: string;
  isUnlimited: boolean;
}

export interface ERC721Approval {
  token: string;
  owner: string;
  spender: string;
  tokenId: string;
}

export interface OperatorApproval {
  token: string;
  owner: string;
  operator: string;
  approved: boolean;
}

export interface ApprovalChanges {
  erc20: ERC20Approval[];
  erc721: ERC721Approval[];
  operatorApprovals: OperatorApproval[];
}

// Aggregated approval per owner: { "0xToken": { spender, amount, isUnlimited } }
export interface AggregatedApproval {
  spender: string;
  amount: string;
  isUnlimited: boolean;
}

export type TokenApprovals = Record<string, AggregatedApproval>;
export type ApprovalsByAddress = Record<string, TokenApprovals>;

export interface AssetChanges {
  native: NativeTransfer[];
  erc20: ERC20Transfer[];
  erc721: ERC721Transfer[];
  erc1155: ERC1155Transfer[];
}

// Net delta per address: { "native": "+100", "0xToken": "-50" }
export type AddressDeltas = Record<string, string>;
export type DeltasByAddress = Record<string, AddressDeltas>;
