import { minimatch } from 'minimatch'
import { ConflictedFile } from '../entities/conflictedFile.js'
import { ConflictRule } from '../value-objects/conflictRule.js'
import { ResolutionStrategy } from '../value-objects/resolutionStrategy.js'

export class ConflictAnalyzer {
  findMatchingRule(
    file: ConflictedFile,
    rules: ConflictRule[]
  ): ConflictRule | undefined {
    for (const rule of rules) {
      if (this.matches(rule, file.path, file.conflictType)) {
        return rule
      }
    }
    return undefined
  }

  private matches(
    rule: ConflictRule,
    filePath: string,
    conflictType: string
  ): boolean {
    if (!minimatch(filePath, rule.filePattern)) {
      return false
    }
    return !(rule.conflictType && rule.conflictType !== conflictType)
  }

  determineStrategy(
    file: ConflictedFile,
    rules: ConflictRule[]
  ): ResolutionStrategy {
    const matchingRule = this.findMatchingRule(file, rules)
    return matchingRule?.strategy ?? ResolutionStrategy.Manual
  }
}
