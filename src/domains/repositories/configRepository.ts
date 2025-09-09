import { ConflictRule } from '../value-objects/conflictRule.js'

export interface ConfigRepository {
  loadRules(): Promise<ConflictRule[]>
}
