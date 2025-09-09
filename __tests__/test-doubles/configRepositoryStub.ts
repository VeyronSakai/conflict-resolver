import { ConfigRepository } from '@domains/repositories/configRepository.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class ConfigRepositoryStub implements ConfigRepository {
  private rules: ConflictResolveRule[]

  constructor(rules: ConflictResolveRule[] = []) {
    this.rules = rules
  }

  async loadRules(): Promise<ConflictResolveRule[]> {
    return this.rules
  }

  setRules(rules: ConflictResolveRule[]): void {
    this.rules = rules
  }

  static createWithDefaultRules(): ConfigRepositoryStub {
    const defaultRules: ConflictResolveRule[] = [
      {
        targetPathPattern: 'package-lock.json',
        strategy: ResolutionStrategy.Theirs
      },
      {
        targetPathPattern: '*.generated.ts',
        strategy: ResolutionStrategy.Theirs
      },
      {
        targetPathPattern: 'src/**/*.ts',
        conflictType: 'both-modified',
        strategy: ResolutionStrategy.Manual
      }
    ]
    return new ConfigRepositoryStub(defaultRules)
  }
}
