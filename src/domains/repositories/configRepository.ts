import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'

export interface ConfigRepository {
  loadRules(): Promise<ConflictResolveRule[]>
}
