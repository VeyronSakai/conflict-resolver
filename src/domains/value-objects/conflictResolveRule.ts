import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ConflictRuleResolution } from '@domains/value-objects/conflictRuleResolution.js'

export type ConflictResolveRule = {
  readonly targetPathPattern: string
  readonly conflictType?: ConflictType
  readonly resolution: ConflictRuleResolution
}
