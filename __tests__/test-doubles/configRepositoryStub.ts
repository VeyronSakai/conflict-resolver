import { ConfigRepository } from '../../src/domains/repositories/configRepository.js'
import { ConflictRule } from '../../src/domains/value-objects/conflictRule.js'
import { ResolutionStrategy } from '../../src/domains/value-objects/resolutionStrategy.js'

export class ConfigRepositoryStub implements ConfigRepository {
  private rules: ConflictRule[]

  constructor(rules: ConflictRule[] = []) {
    this.rules = rules
  }

  async loadRules(): Promise<ConflictRule[]> {
    return this.rules
  }

  setRules(rules: ConflictRule[]): void {
    this.rules = rules
  }

  static createWithDefaultRules(): ConfigRepositoryStub {
    const defaultRules = [
      new ConflictRule(
        'package-lock.json',
        undefined,
        ResolutionStrategy.Theirs,
        'Accept incoming package-lock.json'
      ),
      new ConflictRule(
        '*.generated.ts',
        undefined,
        ResolutionStrategy.Theirs,
        'Accept incoming generated files'
      ),
      new ConflictRule(
        'src/**/*.ts',
        'both-modified',
        ResolutionStrategy.Manual,
        'Manual resolution for source files'
      )
    ]
    return new ConfigRepositoryStub(defaultRules)
  }
}
