import * as core from '@actions/core'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConfigRepository } from '@domains/repositories/configRepository.js'
import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ResolverScriptExecutor } from '@domains/repositories/resolverScriptExecutor.js'
import { ConflictAnalyzer } from '@domains/services/conflictAnalyzer.js'
import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export interface ResolutionResult {
  resolvedFiles: string[]
  unresolvedFiles: string[]
}

export class ConflictResolver {
  private conflictAnalyzer: ConflictAnalyzer

  constructor(
    private configRepository: ConfigRepository,
    private gitRepository: GitRepository,
    private resolverScriptExecutor: ResolverScriptExecutor
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

    const toResolve: Array<{
      file: ConflictedFile
      strategy: ResolutionStrategy
    }> = []

    for (const file of conflictedFiles) {
      const matchingRule = this.conflictAnalyzer.findMatchingRule(file, rules)

      if (!matchingRule) {
        this.logUnresolved(
          file,
          `no matching rule (conflict type: ${file.conflictType})`
        )
        unresolvedFiles.push(file.path)
        continue
      }

      const strategy = await this.determineStrategy(file, matchingRule)

      if (!strategy) {
        unresolvedFiles.push(file.path)
      } else {
        toResolve.push({ file, strategy })
      }
    }

    if (toResolve.length > 0) {
      const failedPaths = await this.gitRepository.resolveConflicts(toResolve)
      const failedSet = new Set(failedPaths)
      for (const { file, strategy } of toResolve) {
        if (failedSet.has(file.path)) {
          core.error(`Failed to resolve ${file.path}`)
          unresolvedFiles.push(file.path)
        } else {
          resolvedFiles.push(file.path)
          core.info(`✓ Resolved ${file.path} using ${strategy} strategy`)
        }
      }
    }

    this.logSummary(resolvedFiles, unresolvedFiles)

    return { resolvedFiles, unresolvedFiles }
  }

  private async determineStrategy(
    file: ConflictedFile,
    rule: ConflictResolveRule
  ): Promise<ResolutionStrategy | undefined> {
    if (rule.resolution.type === 'strategy') {
      return rule.resolution.strategy
    }

    try {
      const result = await this.resolverScriptExecutor.determineStrategy(
        file,
        rule.resolution.resolverScript
      )

      if (result.type === 'manual') {
        this.logUnresolved(
          file,
          `resolver script '${rule.resolution.resolverScript.path}' returned manual`
        )
        return undefined
      }

      return result.strategy
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logUnresolved(
        file,
        `resolver script '${rule.resolution.resolverScript.path}' failed: ${message}`
      )
      return undefined
    }
  }

  private logUnresolved(file: ConflictedFile, reason: string): void {
    core.warning(`${file.path} requires manual resolution (${reason})`)
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
