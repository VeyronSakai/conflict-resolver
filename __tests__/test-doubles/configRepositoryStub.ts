import { ConfigRepository } from '../../src/domains/repositories/configRepository.js'
import type { ConflictResolveRule } from '../../src/domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '../../src/domains/value-objects/resolutionStrategy.js'

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
        filePattern: 'package-lock.json',
        strategy: ResolutionStrategy.Theirs,
        description: 'Accept incoming package-lock.json'
      },
      {
        filePattern: '*.generated.ts',
        strategy: ResolutionStrategy.Theirs,
        description: 'Accept incoming generated files'
      },
      {
        filePattern: 'src/**/*.ts',
        conflictType: 'both-modified',
        strategy: ResolutionStrategy.Manual,
        description: 'Manual resolution for source files'
      }
    ]
    return new ConfigRepositoryStub(defaultRules)
  }
}
