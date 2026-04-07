import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class SpyGitRepository implements GitRepository {
  private readonly conflictedFiles: ConflictedFile[]
  private resolvedFiles: Map<string, ResolutionStrategy> = new Map()
  private stagedFiles: Set<string> = new Set()

  constructor(conflictedFiles: ConflictedFile[] = []) {
    this.conflictedFiles = conflictedFiles
  }

  async getConflictedFiles(): Promise<ConflictedFile[]> {
    return this.conflictedFiles
  }

  async resolveConflicts(
    files: ReadonlyArray<{ file: ConflictedFile; strategy: ResolutionStrategy }>
  ): Promise<string[]> {
    for (const { file, strategy } of files) {
      this.resolvedFiles.set(file.path, strategy)
      this.stagedFiles.add(file.path)
    }
    return []
  }

  // Test helper methods
  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }
}
