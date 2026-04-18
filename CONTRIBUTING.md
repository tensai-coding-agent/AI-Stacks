# Contributing to AI Stacks

Thank you for your interest in contributing to AI Stacks! This document provides guidelines and workflows for contributing to this monorepo.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Code Quality](#code-quality)
- [Documentation](#documentation)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (install via `npm install -g pnpm`)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/tensai-coding-agent/AI-Stacks.git
   cd AI-Stacks
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. Start the development environment:
   ```bash
   pnpm dev
   ```

## Development Workflow

1. **Create a feature branch** from the latest `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/TICKET-123-description
   ```

2. **Make your changes** following the coding standards

3. **Test locally**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

4. **Commit your changes** with clear messages (see [Commit Messages](#commit-messages))

5. **Push and open a Pull Request** (see [Pull Request Process](#pull-request-process))

## Project Structure

```
ai-stacks/
├── packages/          # Shared libraries and components
│   ├── ui/           # UI component library
│   ├── core/         # Core utilities and types
│   └── ai/           # AI/ML shared utilities
├── projects/          # Individual applications
│   ├── web/          # Web application
│   └── api/          # API server
├── tools/             # Development and build tools
│   ├── eslint-config/
│   └── typescript-config/
└── docs/              # Documentation and ADRs
```

## Branch Naming Convention

All branches must follow this pattern:

```
feature/{TICKET-ID}-{brief-description}
```

Examples:
- `feature/TEN-54-ai-stacks-activation`
- `feature/TEN-123-add-auth-middleware`
- `feature/TEN-45-fix-build-error`

**Direct pushes to `main` are strictly prohibited.**

## Commit Messages

Use clear, imperative commit messages:

- ✅ `feat: add user authentication middleware`
- ✅ `fix: resolve build error in packages/ui`
- ✅ `docs: update README with setup instructions`
- ✅ `refactor: simplify data fetching logic`

Format:
```
<type>: <description>

[optional body]

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

All commits **MUST** include the Paperclip attribution line.

## Pull Request Process

1. **Push your branch**:
   ```bash
   git push origin HEAD
   ```

2. **Create a Pull Request** using GitHub CLI:
   ```bash
   gh pr create \
     --title "[TICKET-ID] Brief description" \
     --body "Closes TICKET-ID.\n\n### Summary of Changes\n- List key changes\n- List tests run" \
     --base main
   ```

3. **PR Requirements**:
   - Clear title with ticket reference
   - Description explaining changes
   - All CI checks passing
   - At least one reviewer approval

4. **After Approval**: Merge using "Squash and merge"

## Code Quality

### Linting

We use ESLint and Prettier:

```bash
pnpm lint        # Check code
pnpm lint:fix    # Auto-fix issues
pnpm format      # Format with Prettier
```

### Type Checking

All TypeScript code must pass type checking:

```bash
pnpm typecheck
```

### Testing

Run tests before submitting PR:

```bash
pnpm test        # Run all tests
pnpm test:watch  # Run in watch mode
```

## Documentation

- Update README.md if you change setup instructions
- Add ADRs (Architecture Decision Records) for significant decisions in `docs/adr/`
- Document APIs and components with JSDoc/TSDoc comments

## Questions?

If you have questions, please:
1. Check existing documentation
2. Ask in the project's discussion channel
3. Create an issue with the `question` label

Co-Authored-By: Paperclip <noreply@paperclip.ing>
