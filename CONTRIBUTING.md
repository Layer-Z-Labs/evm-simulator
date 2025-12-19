# Contributing

Thanks for your interest in contributing to Asset Delta Simulator!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/Layer-Z-Labs/evm-simulator.git
cd evm-simulator

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start development server
npm run dev
```

## Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Anvil)

## Running Tests

```bash
npm test
```

## Code Style

- TypeScript strict mode
- ESM modules
- Functional patterns where practical

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run type check (`npx tsc --noEmit`)
6. Commit with a descriptive message
7. Push and open a PR

## Reporting Issues

Please include:
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
