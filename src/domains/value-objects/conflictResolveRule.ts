import { ResolutionStrategy } from './resolutionStrategy.js'

export type ConflictResolveRule = {
  readonly filePattern: string
  readonly conflictType?: string
  readonly strategy: ResolutionStrategy
  readonly description?: string
}
