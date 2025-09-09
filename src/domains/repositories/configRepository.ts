import { ConflictResolveRule } from '../value-objects/conflictResolveRule.js'

export interface ConfigRepository {
  loadRules(): Promise<ConflictResolveRule[]>
}
