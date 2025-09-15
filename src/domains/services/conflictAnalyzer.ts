import { minimatch } from 'minimatch'
import { ConflictedFile } from '@domains/value-objects/conflictedFile.js'
import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class ConflictAnalyzer {
  findMatchingRule(
    file: ConflictedFile,
    rules: ConflictResolveRule[]
  ): ConflictResolveRule | undefined {
    for (const rule of rules) {
      if (this.matches(rule, file.path, file.conflictType)) {
        return rule
      }
    }
    return undefined
  }

  private matches(
    rule: ConflictResolveRule,
    filePath: string,
    conflictType: string
  ): boolean {
    if (!minimatch(filePath, rule.targetPathPattern)) {
      return false
    }
    return !(rule.conflictType && rule.conflictType !== conflictType)
  }

  determineStrategy(
    file: ConflictedFile,
    rules: ConflictResolveRule[]
  ): ResolutionStrategy {
    const matchingRule = this.findMatchingRule(file, rules)
    return matchingRule?.strategy ?? ResolutionStrategy.Manual
  }
}
