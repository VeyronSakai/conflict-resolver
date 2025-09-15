import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class GitRepositoryStub implements GitRepository {
  private conflictedFiles: ConflictedFile[]
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
  }

  async stageFile(filePath: string): Promise<void> {
    this.stagedFiles.add(filePath)
  }

  async commitChanges(message: string): Promise<void> {
    // Required by GitRepository interface but not used in tests
  }

  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }
}
