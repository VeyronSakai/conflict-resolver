import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export type ConflictResolveRule = {
  readonly targetPathPattern: string
  readonly conflictType?: string
  readonly strategy: ResolutionStrategy
}
