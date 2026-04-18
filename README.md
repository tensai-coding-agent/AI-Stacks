# AI Stacks

A modern monorepo for AI-powered applications and shared libraries.

[![CI](https://github.com/tensai-coding-agent/AI-Stacks/actions/workflows/ci.yml/badge.svg)](https://github.com/tensai-coding-agent/AI-Stacks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

AI Stacks is a curated collection of AI applications, tools, and shared libraries designed to accelerate AI development. Built with modern TypeScript, this monorepo provides:

- **Shared Libraries**: Reusable AI utilities, UI components, and core infrastructure
- **Applications**: Production-ready AI applications for various use cases
- **Development Tools**: Streamlined development with Docker, CI/CD, and automated workflows

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (`npm install -g pnpm`)
- Docker & Docker Compose (for local services)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tensai-coding-agent/AI-Stacks.git
   cd AI-Stacks
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start infrastructure services**:
   ```bash
   docker-compose up -d
   ```

4. **Copy environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

5. **Start development**:
   ```bash
   pnpm dev
   ```

## Project Structure

```
ai-stacks/
├── packages/              # Shared libraries
│   ├── core/             # Core utilities, types, shared config
│   ├── ui/               # React component library
│   └── ai/               # AI/ML utilities and providers
├── projects/              # Applications
│   └── [project-name]/   # Individual AI applications
├── tools/                 # Development tools
│   ├── eslint-config/    # Shared ESLint configurations
│   └── ts-config/        # Shared TypeScript configurations
├── docs/                  # Documentation
│   └── adr/              # Architecture Decision Records
├── .github/               # GitHub Actions workflows
├── docker-compose.yml     # Local infrastructure
└── package.json          # Root workspace configuration
```

## Packages Index

| Package | Description | Status |
|---------|-------------|--------|
| `@ai-stacks/core` | Core utilities, types, shared configurations | Planned |
| `@ai-stacks/ui` | React component library with AI-themed components | Planned |
| `@ai-stacks/ai` | AI provider integrations, LLM utilities, embeddings | Planned |

## Projects Index

| Project | Description | Status |
|---------|-------------|--------|
| (No projects yet) | | |

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Clean all build artifacts |
| `pnpm format` | Format code with Prettier |

## Development Workflow

1. Create a feature branch: `git checkout -b feature/TICKET-123-description`
2. Make your changes following [Contributing Guidelines](CONTRIBUTING.md)
3. Run quality checks: `pnpm lint && pnpm typecheck && pnpm test`
4. Commit with Paperclip attribution (see [AGENTS.md](AGENTS.md))
5. Push and open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Infrastructure Services

The `docker-compose.yml` provides local development infrastructure:

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Relational database |
| Redis | 6379 | Cache and message queue |
| MinIO | 9000 | S3-compatible object storage |
| Qdrant | 6333 | Vector database for AI embeddings |

## Documentation

- [Contributing Guide](CONTRIBUTING.md) - Development workflow and guidelines
- [Architecture Decision Records](docs/adr/) - Design decisions and rationale
- [Agent Instructions](AGENTS.md) - Guidelines for AI agents working in this repo

## Technology Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm 9+
- **CI/CD**: GitHub Actions
- **Infrastructure**: Docker Compose

## Roadmap

- [x] Repository structure and tooling
- [x] CI/CD pipeline
- [x] Development environment (Docker Compose)
- [ ] Core packages (ui, ai, core)
- [ ] First AI application
- [ ] Documentation site

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
