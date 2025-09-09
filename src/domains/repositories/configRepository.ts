import { ConflictResolveRule } from '../value-objects/conflictRule.js'

export interface ConfigRepository {
  loadRules(): Promise<ConflictResolveRule[]>
}
