import { ResolutionStrategy } from './resolutionStrategy.js'

export class ConflictRule {
  constructor(
    public readonly filePattern: string,
    public readonly conflictType?: string,
    public readonly strategy: ResolutionStrategy = ResolutionStrategy.Manual,
    public readonly description?: string
  ) {}

  matches(filePath: string, conflictType: string): boolean {
    if (this.conflictType && this.conflictType !== conflictType) {
      return false
    }
    return true
  }
}
