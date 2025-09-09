import { ResolutionStrategy } from './resolutionStrategy.js'

export type ConflictResolveRule = {
  readonly targetPathPattern: string
  readonly conflictType?: string
  readonly strategy: ResolutionStrategy
}
