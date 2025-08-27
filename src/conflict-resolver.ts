import * as core from '@actions/core'
import { minimatch } from 'minimatch'
import { ConfigLoader } from './config.js'
import { GitUtility } from './git.js'
import { ConflictedFile, ConflictRule, ResolutionResult } from './types.js'

export class ConflictResolver {
  private configLoader: ConfigLoader
  private gitUtility: GitUtility

  constructor(configPath?: string) {
    this.configLoader = new ConfigLoader(configPath)
    this.gitUtility = new GitUtility()
  }

  async resolve(): Promise<ResolutionResult> {
    const config = await this.configLoader.loadConfig()

    if (config.rules.length === 0) {
      core.warning('No conflict resolution rules configured')
      return { resolvedFiles: [], unresolvedFiles: [] }
    }

    // Check if we're in a merge or rebase state
    const inMerge = await this.gitUtility.checkIfInMergeState()
    const inRebase = await this.gitUtility.checkIfInRebaseState()

    if (!inMerge && !inRebase) {
      core.info('Not in a merge or rebase state. No conflicts to resolve.')
      return { resolvedFiles: [], unresolvedFiles: [] }
    }

    // Get conflicted files
    const conflictedFiles = await this.gitUtility.getConflictedFiles()

    if (conflictedFiles.length === 0) {
      core.info('No conflicted files found')
      return { resolvedFiles: [], unresolvedFiles: [] }
    }

    core.info(`Found ${conflictedFiles.length} conflicted files`)

    const resolvedFiles: string[] = []
    const unresolvedFiles: string[] = []

    // Process each conflicted file
    for (const file of conflictedFiles) {
      const matchingRule = this.findMatchingRule(file, config.rules)

      if (matchingRule) {
        try {
          await this.gitUtility.resolveConflict(
            file.path,
            matchingRule.strategy
          )
          resolvedFiles.push(file.path)
          core.info(
            `✓ Resolved: ${file.path} (${file.conflictType}) using ${matchingRule.strategy}`
          )
        } catch (error) {
          unresolvedFiles.push(file.path)
          core.warning(`✗ Failed to resolve: ${file.path}`)
          if (error instanceof Error) {
            core.debug(error.message)
          }
        }
      } else {
        unresolvedFiles.push(file.path)
        core.info(`⊘ No matching rule for: ${file.path} (${file.conflictType})`)
      }
    }

    // Summary
    core.info('')
    core.info('=== Conflict Resolution Summary ===')
    core.info(`Resolved: ${resolvedFiles.length} files`)
    core.info(`Unresolved: ${unresolvedFiles.length} files`)

    if (resolvedFiles.length > 0) {
      core.info('')
      core.info('Resolved files:')
      resolvedFiles.forEach((file) => core.info(`  - ${file}`))
    }

    if (unresolvedFiles.length > 0) {
      core.info('')
      core.info('Unresolved files (require manual resolution):')
      unresolvedFiles.forEach((file) => core.info(`  - ${file}`))
    }

    return { resolvedFiles, unresolvedFiles }
  }

  private findMatchingRule(
    file: ConflictedFile,
    rules: ConflictRule[]
  ): ConflictRule | undefined {
    for (const rule of rules) {
      // Check if the file path matches the rule pattern
      const pathMatches = minimatch(file.path, rule.path)

      if (!pathMatches) {
        continue
      }

      // If conflictType is specified in the rule, check if it matches
      if (rule.conflictType) {
        if (file.conflictType === rule.conflictType) {
          return rule
        }
      } else {
        // If no conflictType specified, the rule applies to all conflict types
        return rule
      }
    }

    return undefined
  }
}
