# Git Conflict Resolver Action

[![GitHub Super-Linter](https://github.com/VeyronSakai/conflict-resolver/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/VeyronSakai/conflict-resolver/actions/workflows/ci.yml/badge.svg)

A GitHub Action that automatically resolves Git conflicts based on predefined
rules in a YAML configuration file.

## Features

- 🔧 **Configuration-based resolution**: Define conflict resolution rules in a
  YAML file
- ⚡ **Automatic resolution**: Resolves conflicts using `ours` or `theirs`
  strategies
- 🎨 **Flexible pattern matching**: Use glob patterns to match files
- 🏷️ **Conflict type filtering**: Apply rules only to specific conflict types

## Usage

### Basic Example

```yaml
name: Merge develop branch with auto-resolved conflicts
on:
  workflow_dispatch:

jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: develop/v2.0 # Target branch

      - name: Create feature branch
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git switch -c feature/develop/v2.0-update

      - name: Merge develop branch
        run: |
          git fetch origin develop/v1.0
          git merge origin/develop/v1.0 --no-commit --no-ff || true

      - name: Resolve conflicts
        id: resolve
        uses: VeyronSakai/conflict-resolver@v0.1

      - name: Handle resolution results
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          UNRESOLVED_FILES: ${{ steps.resolve.outputs.unresolved-files }}
          RESOLVED_FILES: ${{ steps.resolve.outputs.resolved-files }}
        run: |
          if [ -z "$UNRESOLVED_FILES" ]; then
            # No unresolved conflicts - commit and create PR
            git add .
            git commit -m "Auto-resolve merge conflicts from develop/v1.0"
            git push -u origin feature/develop/v2.0-update

            gh pr create \
              --title "Merge develop/v1.0 with auto-resolved conflicts" \
              --base develop/v2.0 \
              --head feature/develop/v2.0-update
          else
            # Unresolved conflicts remain - fail the workflow
            echo "❌ Error: Unable to automatically resolve all conflicts"
            echo "Unresolved files:"
            echo "$UNRESOLVED_FILES"
            exit 1
          fi
```

### Configuration File Example

Create a `.github/conflict-resolver.yml` file in your repository as follows:

```yaml
# Git Conflict Resolver Configuration Example
# This file defines rules for automatically resolving Git conflicts

rules:
  # Always use theirs for package-lock.json
  # This is useful when you want to accept incoming changes for dependency lock files
  - paths: 'package-lock.json'
    strategy: 'theirs'

  # Always use theirs for yarn.lock
  - paths: 'yarn.lock'
    strategy: 'theirs'

  # Always use ours for auto-generated files
  - paths: '*.generated.ts'
    strategy: 'ours'

  - paths: '*.generated.js'
    strategy: 'ours'

  # For build output directories, always use ours
  - paths: 'dist/**/*'
    strategy: 'ours'

  - paths: 'build/**/*'
    strategy: 'ours'

  # Example with conflict_type specification
  # Only apply this rule when both sides modified the file
  - paths: 'src/**/*.test.ts'
    conflict_type: 'both-modified'
    strategy: 'theirs'

  # Another example with conflict_type
  # When a file is added by both sides, prefer theirs
  - paths: 'docs/**/*.md'
    conflict_type: 'both-added'
    strategy: 'theirs'
```

### Configuration Notes

**Rule Properties:**

- `paths` supports glob patterns (e.g., `*.js`, `src/**/*.ts`)
- `strategy` must be either `ours` or `theirs`
- `conflict_type` is optional. If not specified, the rule applies to all
  conflict types

**Rule Evaluation:**

- Rules are evaluated in order (first match wins)
- Place more specific patterns before general ones
- Test your patterns carefully, especially for critical files

**Valid conflict_type values:**

- `both-modified` (UU): Both sides modified the file
- `both-added` (AA): Both sides added the same file
- `deleted-by-us` (DU): We deleted, they modified
- `deleted-by-them` (UD): They deleted, we modified

## Inputs

| Name          | Description                                        | Required | Default                         |
| ------------- | -------------------------------------------------- | -------- | ------------------------------- |
| `config-path` | Path to the conflict resolution configuration file | No       | `.github/conflict-resolver.yml` |

## Outputs

| Name               | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `resolved-files`   | Comma-separated list of files that were successfully resolved          |
| `unresolved-files` | Comma-separated list of files that could not be resolved automatically |

## Conflict Types

The action recognizes the following Git conflict states:

### Supported Conflict Types

| Type              | Status Code | Description                    |
| ----------------- | ----------- | ------------------------------ |
| `both-modified`   | UU          | Both sides modified the file   |
| `both-added`      | AA          | Both sides added the same file |
| `deleted-by-us`   | DU          | We deleted, they modified      |
| `deleted-by-them` | UD          | They deleted, we modified      |

### Unsupported Conflict Types

The following conflict types are **not supported** for automatic resolution and
require manual intervention:

| Type              | Status Code | Description                                           |
| ----------------- | ----------- | ----------------------------------------------------- |
| `deleted-by-both` | DD          | Original file renamed differently on both branches    |
| `added-by-us`     | AU          | File renamed on our branch (rename/rename conflict)   |
| `added-by-them`   | UA          | File renamed on their branch (rename/rename conflict) |

**Why rename/rename conflicts are not supported:**

Rename/rename conflicts occur when both branches rename the same file to
different names. These conflicts require human judgment to decide:

- Which renamed file to keep
- Whether to keep both renamed files
- How to merge the content of the renamed files

When the action encounters these conflict types, it logs an error and leaves the
files for manual resolution.

## Configuration Rules

### Rule Properties

- **`paths`** (required): File path pattern (supports glob patterns)
  - Examples: `*.json`, `src/**/*.ts`, `docs/*.md`
- **`strategy`** (required): Resolution strategy
  - `ours`: Keep our version
  - `theirs`: Keep their version
- **`conflict_type`** (optional): Apply rule only to specific conflict types
  - If not specified, the rule applies to all conflict types

## Important Notes

- This action does **not** commit the resolved files automatically
- Always review the resolution results before merging
- The action only runs when Git is in a merge or rebase state
- Unmatched files remain in conflict state for manual resolution

## License

MIT
