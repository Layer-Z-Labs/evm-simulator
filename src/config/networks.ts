export interface NetworkConfig {
  id: string;
  chainId: number;
  upstreamRpc: string;
  label: string;
}

export const NETWORKS: NetworkConfig[] = [
  {
    id: 'localhost',
    chainId: 31337,
    upstreamRpc: process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545',
    label: 'Local Hardhat',
  },
  {
    id: 'sepolia',
    chainId: 11155111,
    upstreamRpc: process.env.SEPOLIA_RPC_URL || '',
    label: 'Sepolia Testnet',
  },
];

export function getNetwork(networkId: string): NetworkConfig | undefined {
  return NETWORKS.find(n => n.id === networkId);
}
