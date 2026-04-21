# ADR-001: Monorepo Structure with pnpm and Turbo

## Status

Accepted

## Context

The AI Stacks project needs a scalable repository structure to support:
- Multiple AI applications with shared libraries
- Efficient build and development workflows
- Clear separation of concerns between packages and applications
- Support for TypeScript across all projects

We evaluated several monorepo tools:
- **npm workspaces**: Built-in but limited orchestration
- **yarn workspaces**: Good but we prefer pnpm's disk efficiency
- **pnpm workspaces**: Fast, disk-efficient, strict dependency management
- **nx**: Powerful but adds complexity we don't need initially
- **Turborepo**: Excellent build caching and task orchestration

## Decision

We will use **pnpm workspaces** with **Turborepo** for:
1. Package management and workspace linking (pnpm)
2. Build caching and task orchestration (Turborepo)
3. TypeScript project references for type safety

### Structure

```
ai-stacks/
├── packages/          # Shared libraries
│   ├── core/         # Core utilities and types
│   ├── ui/           # UI component library
│   └── ai/           # AI/ML utilities
├── projects/          # Applications
│   ├── web/          # Web frontend
│   └── api/          # API backend
├── tools/             # Build tools and configs
│   ├── eslint-config/
│   └── ts-config/
└── docs/              # Documentation
```

### Key Configuration Files

1. **package.json**: Defines workspaces and scripts
2. **pnpm-workspace.yaml**: (implicit via package.json workspaces)
3. **turbo.json**: Defines task dependencies and caching
4. **tsconfig.json**: Root TypeScript configuration

## Consequences

### Positive

- **Fast installs**: pnpm's content-addressable store
- **Strict dependencies**: Prevents phantom dependencies
- **Efficient builds**: Turbo caches build outputs
- **Parallel execution**: Tasks run in parallel when possible
- **Type safety**: TypeScript project references

### Negative

- **Learning curve**: Team needs to understand pnpm + Turbo
- **Initial setup**: More configuration than single-package repo
- **Tooling compatibility**: Some tools may need pnpm-specific config

## Implementation Notes

1. All packages must have valid package.json files
2. Internal dependencies use `workspace:*` protocol
3. Build outputs in `dist/`, `.next/`, or `build/` are cached
4. Environment variables in `.env` affect all builds

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

Co-Authored-By: Paperclip <noreply@paperclip.ing>
