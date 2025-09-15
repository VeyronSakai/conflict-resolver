import { ConfigRepository } from '@domains/repositories/configRepository.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'

export class StubConfigRepository implements ConfigRepository {
  private rules: ConflictResolveRule[]

  constructor(rules: ConflictResolveRule[] = []) {
    this.rules = rules
  }

  async loadRules(): Promise<ConflictResolveRule[]> {
    return this.rules
  }
}
