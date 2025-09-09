import { ConfigRepository } from '../../src/domains/repositories/configRepository.js'
import { ConflictResolveRule } from '../../src/domains/value-objects/conflictRule.js'
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
    const defaultRules = [
      new ConflictResolveRule(
        'package-lock.json',
        undefined,
        ResolutionStrategy.Theirs,
        'Accept incoming package-lock.json'
      ),
      new ConflictResolveRule(
        '*.generated.ts',
        undefined,
        ResolutionStrategy.Theirs,
        'Accept incoming generated files'
      ),
      new ConflictResolveRule(
        'src/**/*.ts',
        'both-modified',
        ResolutionStrategy.Manual,
        'Manual resolution for source files'
      )
    ]
    return new ConfigRepositoryStub(defaultRules)
  }
}
