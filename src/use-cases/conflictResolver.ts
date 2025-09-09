import * as core from '@actions/core'
import { ConfigRepository } from '../domains/repositories/configRepository.js'
import { GitRepository } from '../domains/repositories/gitRepository.js'
import { ConflictAnalyzer } from '../domains/services/conflictAnalyzer.js'
import { ResolutionStrategy } from '../domains/value-objects/resolutionStrategy.js'

export interface ResolutionResult {
  resolvedFiles: string[]
  unresolvedFiles: string[]
}

export class ConflictResolver {
  private conflictAnalyzer: ConflictAnalyzer

  constructor(
    private configRepository: ConfigRepository,
    private gitRepository: GitRepository
  ) {
    this.conflictAnalyzer = new ConflictAnalyzer()
  }

  async resolve(): Promise<ResolutionResult> {
    const rules = await this.configRepository.loadRules()
    const conflictedFiles = await this.gitRepository.getConflictedFiles()

    if (conflictedFiles.length === 0) {
      core.info('No merge conflicts detected')
      return { resolvedFiles: [], unresolvedFiles: [] }
    }

    core.info(`Found ${conflictedFiles.length} conflicted files`)

    const resolvedFiles: string[] = []
    const unresolvedFiles: string[] = []

    for (const file of conflictedFiles) {
      const strategy = this.conflictAnalyzer.determineStrategy(file, rules)
      const matchingRule = this.conflictAnalyzer.findMatchingRule(file, rules)

      if (matchingRule?.description) {
        core.info(`Applying rule: ${matchingRule.description}`)
      }

      if (strategy === ResolutionStrategy.Manual) {
        core.warning(
          `${file.path} requires manual resolution (conflict type: ${file.conflictType})`
        )
        unresolvedFiles.push(file.path)
      } else {
        try {
          await this.gitRepository.resolveConflict(file, strategy)
          await this.gitRepository.stageFile(file.path)
          resolvedFiles.push(file.path)
          core.info(`✓ Resolved ${file.path} using ${strategy} strategy`)
        } catch (error) {
          core.error(`Failed to resolve ${file.path}: ${error}`)
          unresolvedFiles.push(file.path)
        }
      }
    }

    this.logSummary(resolvedFiles, unresolvedFiles)

    return { resolvedFiles, unresolvedFiles }
  }

  private logSummary(resolvedFiles: string[], unresolvedFiles: string[]): void {
    core.info('=== Conflict Resolution Summary ===')

    if (resolvedFiles.length > 0) {
      core.info(`✓ Automatically resolved: ${resolvedFiles.length} files`)
      for (const file of resolvedFiles) {
        core.info(`  - ${file}`)
      }
    }

    if (unresolvedFiles.length > 0) {
      core.warning(
        `⚠ Manual resolution required: ${unresolvedFiles.length} files`
      )
      for (const file of unresolvedFiles) {
        core.warning(`  - ${file}`)
      }
    }
  }
}
