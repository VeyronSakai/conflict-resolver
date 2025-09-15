import { ConflictedFile } from '@domains/value-objects/conflictedFile.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export interface GitRepository {
  getConflictedFiles(): Promise<ConflictedFile[]>
  resolveConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void>
  stageFile(filePath: string): Promise<void>
  commitChanges(message: string): Promise<void>
}
