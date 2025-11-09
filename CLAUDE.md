# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BlueprintUI CLI is an opinionated minimal CLI tool for creating and building Web Component libraries. It provides out-of-the-box tooling for compiling Web Component libraries using Rollup, TypeScript, and Lit framework.

This is a pnpm workspace monorepo with the following structure:
- `projects/cli` - The CLI tool source code
- `projects/example` - Example project for testing CLI commands

## Key Commands

### Workspace Commands
```bash
# Install dependencies for all projects
pnpm install

# Build all projects
pnpm build

# Build all projects in watch mode
pnpm build:watch
```

### CLI Commands
```bash
# Build library for production
bp build

# Build in watch mode for development
bp build --watch

# Generate new library project
bp new <library-name>

# API lockfile management
bp api --test    # Compare custom-elements.json to lockfile
bp api --update  # Update lockfile to latest API changes
```

### Example Project Commands
```bash
# From projects/example directory
pnpm start          # Serve + build in watch mode (port 3000)
pnpm build          # Build library for production
pnpm build:watch    # Build in watch mode
```

## Architecture

### Repository Structure
```
/cli/
├── pnpm-workspace.yaml
├── projects/
│   ├── cli/             # CLI tool source
│   │   ├── index.mjs
│   │   ├── rollup.config.mjs
│   │   ├── plugin-*.mjs
│   │   └── project/     # Template for new projects
│   └── example/         # Test bed for CLI commands
│       ├── src/
│       ├── blueprint.config.js
│       └── package.json
```

### CLI Structure (`projects/cli/`)
- `index.mjs` - Main CLI entry point with command parsing
- `rollup.config.mjs` - Core build configuration
- `plugin-*.mjs` - Custom Rollup plugins for various optimizations
- `project/` - Template directory for new projects

### Generated Project Structure
Projects follow this convention:
- `src/*/` - Component directories with `element.ts`, `element.css`, and `index.ts`
- `src/include/` - Side-effect imports (global styles, registrations)
- `src/index.ts` - Main library entry point
- `blueprint.config.js` - Build configuration

### Build Configuration
The `blueprint.config.js` file supports:
```javascript
{
  library: {
    entryPoints: ['./src/**/index.ts', './src/include/*.ts'],
    externals: [/^tslib/, /^lit/],
  }
}
```

## Technical Details

- **Web Components**: Uses Lit framework with TypeScript decorators
- **CSS Handling**: CSS modules imported with `{ type: 'css' }`
- **Build Output**: Preserves ES modules in `dist/lib/` for tree-shaking
- **API Documentation**: Auto-generates `custom-elements.json` manifest
- **TypeScript**: Targets ES2022 with ESNext modules
- **Node Requirements**: Node 24.11.0, pnpm 10.11.0
- **Package Manager**: pnpm with workspace support

## Testing

The `projects/example` directory serves as a test bed for CLI commands. To test CLI changes:

1. Make changes in `projects/cli`
2. Run `pnpm install` to link workspace dependencies
3. Test commands in `projects/example`

API contract testing is done via:
```bash
bp api --test  # Compares generated API to lockfile
```

No unit testing framework is included by default.