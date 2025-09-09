import { ResolutionStrategy } from './resolutionStrategy.js'

export class ConflictRule {
  constructor(
    public readonly filePattern: string,
    public readonly conflictType?: string,
    public readonly strategy: ResolutionStrategy = ResolutionStrategy.Manual,
    public readonly description?: string
  ) {}
}
