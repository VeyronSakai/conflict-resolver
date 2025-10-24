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

  async resolveConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    this.resolvedFiles.set(file.path, strategy)
    // resolveConflict now stages the file internally (like the real implementation)
    this.stagedFiles.add(file.path)
  }

  // Test helper methods
  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }
}
