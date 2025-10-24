import { minimatch } from 'minimatch'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'

export class ConflictAnalyzer {
  determineStrategy(
    file: ConflictedFile,
    rules: ConflictResolveRule[]
  ): ResolutionStrategy | undefined {
    const matchingRule = this.findMatchingRule(file, rules)
    return matchingRule?.strategy
  }

  private findMatchingRule(
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
    conflictType: ConflictType
  ): boolean {
    if (!minimatch(filePath, rule.targetPathPattern)) {
      return false
    }

    // DD, AU, UA はサポート対象外
    if (
      conflictType === ConflictType.DeletedByBoth ||
      conflictType === ConflictType.AddedByUs ||
      conflictType === ConflictType.AddedByThem
    ) {
      return false
    }

    return !(rule.conflictType && rule.conflictType !== conflictType)
  }
}
