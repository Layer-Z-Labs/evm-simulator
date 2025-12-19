# Asset Delta Simulator

A standalone service that simulates EVM transactions and predicts asset changes before signing. Returns structured deltas for ETH, ERC-20, ERC-721, and ERC-1155 tokens.

## Overview

The Asset Delta Simulator provides transaction preflight capabilities by:

1. **Forking the blockchain** using Anvil (from Foundry)
2. **Tracing transactions** with `debug_traceCall`
3. **Parsing transfer events** from execution logs
4. **Aggregating net deltas** per address

This enables wallets and dApps to show users exactly what assets will move before they sign.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Asset Delta Simulator                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   API    │───▶│ Simulator│───▶│  Tracer  │───▶│  Anvil   │  │
│  │  Routes  │    │          │    │          │    │  Fork    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                        │                              │          │
│                        ▼                              ▼          │
│                 ┌──────────┐                   ┌──────────┐     │
│                 │   Log    │                   │ Upstream │     │
│                 │  Parser  │                   │   RPC    │     │
│                 └──────────┘                   └──────────┘     │
│                        │                                         │
│                        ▼                                         │
│                 ┌──────────┐                                    │
│                 │  Delta   │                                    │
│                 │Aggregator│                                    │
│                 └──────────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| **ForkManager** | Spawns and manages Anvil fork processes |
| **Tracer** | Executes `debug_traceCall` and extracts native transfers |
| **LogParser** | Parses Transfer events (ERC-20/721/1155) from logs |
| **DeltaAggregator** | Computes net balance changes per address |
| **Simulator** | Orchestrates the simulation pipeline |

## API Reference

### POST /simulate

Simulate a transaction and return asset deltas.

**Request:**
```json
{
  "networkId": "localhost",
  "tx": {
    "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "to": "0xTokenContractAddress",
    "data": "0xa9059cbb000000000000000000000000...",
    "value": "0x0"
  }
}
```

**Response (success):**
```json
{
  "success": true,
  "revertReason": null,
  "gasUsed": "46680",
  "involvedAddresses": [
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "0xTokenContractAddress"
  ],
  "assetChanges": {
    "native": [],
    "erc20": [
      {
        "token": "0xTokenContractAddress",
        "from": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "to": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "amount": "1000000000000000000"
      }
    ],
    "erc721": [],
    "erc1155": []
  },
  "deltasByAddress": {
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
      "0xTokenContractAddress": "-1000000000000000000"
    },
    "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": {
      "0xTokenContractAddress": "+1000000000000000000"
    }
  }
}
```

**Response (revert):**
```json
{
  "success": false,
  "revertReason": "ERC20: transfer amount exceeds balance",
  "gasUsed": null,
  "involvedAddresses": [],
  "assetChanges": { "native": [], "erc20": [], "erc721": [], "erc1155": [] },
  "deltasByAddress": {}
}
```

### GET /health

Service health status.

```json
{
  "status": "healthy",
  "forks": {
    "localhost": {
      "status": "running",
      "port": 9545,
      "blockNumber": "58"
    }
  },
  "uptime": 3600,
  "timestamp": "2024-12-19T20:00:00.000Z"
}
```

### GET /networks

Available networks for simulation.

```json
{
  "networks": [
    { "id": "localhost", "chainId": 31337, "label": "Local Hardhat" },
    { "id": "sepolia", "chainId": 11155111, "label": "Sepolia Testnet" }
  ]
}
```

### POST /admin/refresh-fork

Kill and respawn a fork (useful if fork state becomes stale).

**Request:**
```json
{ "networkId": "localhost" }
```

**Response:**
```json
{ "success": true, "message": "Fork refreshed" }
```

## Installation

### Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Anvil)

### Local Development

```bash
# Clone and install
cd simulator-service
npm install

# Copy environment config
cp .env.example .env

# Start development server (hot reload)
npm run dev
```

The service starts on `http://localhost:9000`.

### Production Build

```bash
npm run build
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t simulator-service:latest .
```

### Run Standalone

Connect to a Hardhat/Anvil node running on your host machine:

```bash
docker run -d \
  --name simulator \
  -p 9000:9000 \
  --add-host=host.docker.internal:host-gateway \
  -e LOCALHOST_RPC_URL=http://host.docker.internal:8545 \
  -e NODE_ENV=production \
  simulator-service:latest
```

### Docker Compose

```bash
docker-compose up -d
```

The `docker-compose.yml` includes:
- Health checks
- Volume mounts for logs
- Host network bridge for local RPC access

### Verify Deployment

```bash
# Health check
curl http://localhost:9000/health

# Test simulation
curl -X POST http://localhost:9000/simulate \
  -H "Content-Type: application/json" \
  -d '{"networkId":"localhost","tx":{"from":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","to":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","value":"0xde0b6b3a7640000"}}'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9000` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server host |
| `FORK_BASE_PORT` | `9545` | Starting port for Anvil forks |
| `FORK_STARTUP_TIMEOUT_MS` | `30000` | Max wait time for fork to be ready |
| `FORK_REFRESH_INTERVAL_MS` | `60000` | Interval for periodic fork refresh (0 = disabled) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `NODE_ENV` | `development` | Environment (development, production) |
| `LOCALHOST_RPC_URL` | `http://127.0.0.1:8545` | RPC URL for localhost network |
| `SEPOLIA_RPC_URL` | - | RPC URL for Sepolia testnet |

### Adding Networks

Edit `src/config/networks.ts`:

```typescript
export const NETWORKS: NetworkConfig[] = [
  {
    id: 'mainnet',
    chainId: 1,
    upstreamRpc: process.env.MAINNET_RPC_URL || '',
    label: 'Ethereum Mainnet',
  },
  // ... other networks
];
```

## How It Works

### 1. Fork Management

When a simulation is requested for a network:
- If no fork exists, Anvil spawns with `--fork-url` pointing to the upstream RPC
- The fork runs on a dynamically allocated port (starting at 9545)
- Forks are reused for subsequent requests (stateless simulation)

### 2. Fork Synchronization

Anvil forks snapshot blockchain state at spawn time. To stay synchronized with the upstream chain:

- **Periodic Refresh**: Every `FORK_REFRESH_INTERVAL_MS` (default: 60s), active forks are refreshed
- **Hot Swap**: New fork spawns before old one is killed (~300ms refresh with zero downtime)
- **Request Queuing**: Requests arriving during refresh wait for the new fork to be ready
- **Port Recycling**: Freed ports are reused to prevent unbounded port allocation
- **Graceful Fallback**: If refresh fails, the existing fork continues serving requests

This ensures simulations reflect recent on-chain state (new contracts, balance changes) without manual intervention.

### 3. Transaction Tracing

The service calls `debug_traceCall` with the `callTracer`:

```typescript
const result = await client.request({
  method: 'debug_traceCall',
  params: [tx, 'latest', { tracer: 'callTracer', tracerConfig: { withLog: true } }],
});
```

This returns:
- The full call tree (for native ETH transfers)
- All emitted event logs (for token transfers)

### 4. Event Parsing

Transfer events are identified by topic signatures:

| Event | Topic0 |
|-------|--------|
| ERC-20/721 Transfer | `0xddf252ad...` |
| ERC-1155 TransferSingle | `0xc3d58168...` |
| ERC-1155 TransferBatch | `0x4a39dc06...` |

**ERC-20 vs ERC-721 Disambiguation:**
- 3 topics + data = ERC-20 (amount in data)
- 4 topics = ERC-721 (tokenId in topic[3])

### 5. Delta Aggregation

All transfers are aggregated into net changes per address:

```typescript
// Input: Multiple transfers
[
  { from: "0xA", to: "0xB", amount: 100 },
  { from: "0xB", to: "0xA", amount: 30 },
]

// Output: Net deltas
{
  "0xA": { "0xToken": "-70" },  // 100 out, 30 in = -70 net
  "0xB": { "0xToken": "+70" },  // 100 in, 30 out = +70 net
}
```

## Response Fields

### `involvedAddresses`

All unique addresses that appear in any transfer:
- Sender addresses
- Recipient addresses
- Token contract addresses

Useful for quick filtering: if none of these addresses are in your "watched" set, you can skip detailed processing.

### `deltasByAddress`

Net balance changes per address, formatted as signed strings:
- `"+100"` = gained 100 units
- `"-50"` = lost 50 units
- `"native"` key = ETH balance change
- Token address key = ERC-20/721/1155 change

For NFTs, the key format is `tokenAddress:tokenId`.

### `assetChanges`

Raw transfer events, useful for:
- Building transaction summaries
- Showing transfer flow diagrams
- Auditing individual movements

## Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Transaction succeeds | 200 | `success: true` |
| Transaction reverts | 200 | `success: false, revertReason: "..."` |
| Unknown network | 400 | `success: false, revertReason: "Unknown network: X"` |
| Fork spawn failure | 503 | `success: false, revertReason: "Failed to start fork"` |
| Invalid request body | 400 | Schema validation error |

## Development

### Project Structure

```
simulator-service/
├── src/
│   ├── index.ts                 # Entry point
│   ├── server.ts                # Fastify setup
│   ├── config/
│   │   ├── env.ts               # Environment config
│   │   └── networks.ts          # Network definitions
│   ├── api/
│   │   ├── routes/              # HTTP endpoints
│   │   └── schemas/             # TypeBox validation
│   ├── core/
│   │   ├── simulator.ts         # Main orchestrator
│   │   ├── tracer.ts            # debug_traceCall wrapper
│   │   ├── log-parser.ts        # Event log parsing
│   │   └── delta-aggregator.ts  # Net delta calculation
│   ├── fork/
│   │   ├── fork-manager.ts      # Anvil lifecycle
│   │   └── types.ts             # Fork types
│   ├── decoders/                # Calldata decoders
│   └── types/                   # Shared types
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # TypeScript compilation
npm start        # Production server
npm test         # Run tests
```

### Type Checking

```bash
npx tsc --noEmit
```

## Limitations

- **Single transaction only**: Bundle simulation not yet supported
- **No state persistence**: Each simulation runs against a fresh fork state
- **Anvil required**: Debug tracing requires Anvil (Hardhat's `debug_traceCall` may differ)
- **No fiat pricing**: Asset values not converted to USD

## Integration Example

### Wallet Extension

```typescript
async function checkTransaction(tx: TransactionRequest): Promise<boolean> {
  const response = await fetch('http://localhost:9000/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      networkId: 'localhost',
      tx: {
        from: tx.from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      },
    }),
  });

  const result = await response.json();

  if (!result.success) {
    console.warn('Transaction would revert:', result.revertReason);
    return false;
  }

  // Check if any managed tokens are involved
  const managedTokens = await getManagedTokens(tx.from);
  const involvedManagedTokens = result.assetChanges.erc20
    .filter(t => managedTokens.has(t.token.toLowerCase()));

  if (involvedManagedTokens.length > 0) {
    // Trigger rewriting logic
    return true;
  }

  return false;
}
```

## License

MIT
