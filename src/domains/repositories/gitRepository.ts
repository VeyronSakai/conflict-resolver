import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export interface GitRepository {
  getConflictedFiles(): Promise<ConflictedFile[]>
  /** Resolves conflicts in batch. Returns paths that failed to resolve. */
  resolveConflicts(
    files: ReadonlyArray<{ file: ConflictedFile; strategy: ResolutionStrategy }>
  ): Promise<string[]>
}
