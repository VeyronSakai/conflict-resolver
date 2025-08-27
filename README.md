# Git Conflict Resolver Action

[![GitHub Super-Linter](https://github.com/VeyronSakai/conflict-resolver/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/VeyronSakai/conflict-resolver/actions/workflows/ci.yml/badge.svg)

A GitHub Action that automatically resolves Git conflicts based on predefined
rules in a YAML configuration file.

## Features

- 🔧 **Configuration-based resolution**: Define conflict resolution rules in a
  YAML file
- 🎯 **Accurate conflict detection**: Detects 7 different types of Git conflict
  states
- ⚡ **Automatic resolution**: Resolves conflicts using `ours` or `theirs`
  strategies
- 🎨 **Flexible pattern matching**: Use glob patterns to match files
- 🏷️ **Conflict type filtering**: Apply rules only to specific conflict types
- 📊 **Detailed reporting**: Get comprehensive output of resolved and unresolved
  files

## Usage

### Basic Example

```yaml
name: Auto-resolve conflicts
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  resolve-conflicts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Resolve conflicts
        uses: VeyronSakai/conflict-resolver@v1
        with:
          config-path: '.conflict-resolver.yml'
```

### Configuration File

Create a `.conflict-resolver.yml` file in your repository root:

```yaml
rules:
  # Always use theirs for package lock files
  - path: 'package-lock.json'
    strategy: 'theirs'

  - path: 'yarn.lock'
    strategy: 'theirs'

  # Always use ours for generated files
  - path: '*.generated.ts'
    strategy: 'ours'

  - path: 'dist/**/*'
    strategy: 'ours'

  # Use theirs for test files when both modified
  - path: '**/*.test.ts'
    conflictType: 'both-modified'
    strategy: 'theirs'

  # Use theirs for documentation when both added
  - path: 'docs/**/*.md'
    conflictType: 'both-added'
    strategy: 'theirs'
```

## Inputs

| Name          | Description                                        | Required | Default                  |
| ------------- | -------------------------------------------------- | -------- | ------------------------ |
| `config-path` | Path to the conflict resolution configuration file | No       | `.conflict-resolver.yml` |

## Outputs

| Name               | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `resolved-files`   | Comma-separated list of files that were successfully resolved          |
| `unresolved-files` | Comma-separated list of files that could not be resolved automatically |

## Conflict Types

The action recognizes the following Git conflict states:

| Type              | Status Code | Description                    |
| ----------------- | ----------- | ------------------------------ |
| `both-modified`   | UU          | Both sides modified the file   |
| `both-added`      | AA          | Both sides added the same file |
| `both-deleted`    | DD          | Both sides deleted the file    |
| `added-by-us`     | AU          | We added, they modified        |
| `added-by-them`   | UA          | They added, we modified        |
| `deleted-by-us`   | DU          | We deleted, they modified      |
| `deleted-by-them` | UD          | They deleted, we modified      |

## Configuration Rules

### Rule Properties

- **`path`** (required): File path pattern (supports glob patterns)
  - Examples: `*.json`, `src/**/*.ts`, `docs/*.md`
- **`strategy`** (required): Resolution strategy
  - `ours`: Keep our version
  - `theirs`: Keep their version
- **`conflictType`** (optional): Apply rule only to specific conflict types
  - If not specified, the rule applies to all conflict types

### Rule Evaluation

- Rules are evaluated in order (first match wins)
- Use more specific patterns before general ones
- Test your patterns carefully, especially for critical files

## Examples

### Auto-resolve dependency lock files

```yaml
rules:
  - path: 'package-lock.json'
    strategy: 'theirs'
  - path: 'yarn.lock'
    strategy: 'theirs'
  - path: 'pnpm-lock.yaml'
    strategy: 'theirs'
```

### Handle generated files

```yaml
rules:
  - path: '**/*.generated.*'
    strategy: 'ours'
  - path: 'dist/**/*'
    strategy: 'ours'
  - path: 'build/**/*'
    strategy: 'ours'
```

### Resolve test files

```yaml
rules:
  - path: '**/*.test.ts'
    conflictType: 'both-modified'
    strategy: 'theirs'
  - path: '**/*.spec.js'
    conflictType: 'both-modified'
    strategy: 'theirs'
```

## Important Notes

- This action does **not** commit the resolved files automatically
- Always review the resolution results before merging
- The action only runs when Git is in a merge or rebase state
- Unmatched files remain in conflict state for manual resolution

## Development

### Setup

```bash
npm install
```

### Test

```bash
npm test
```

### Build

```bash
npm run bundle
```

### Format and Lint

```bash
npm run format:write
npm run lint
```

## License

MIT
