import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'

export type ConflictResolveRule = {
  readonly targetPathPattern: string
  readonly conflictType?: ConflictType
  readonly strategy: ResolutionStrategy
}
