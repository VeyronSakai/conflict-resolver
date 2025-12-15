import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class SpyGitRepository implements GitRepository {
  private readonly conflictedFiles: ConflictedFile[]
  private resolvedFiles: Map<string, ResolutionStrategy> = new Map()
  private stagedFiles: Set<string> = new Set()
  private failStageFilePaths: Set<string>

  constructor(
    conflictedFiles: ConflictedFile[] = [],
    options: { failStageFilePaths?: string[] } = {}
  ) {
    this.conflictedFiles = conflictedFiles
    this.failStageFilePaths = new Set(options.failStageFilePaths ?? [])
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
    if (this.failStageFilePaths.has(filePath)) {
      throw new Error('fatal: pathspec did not match any files')
    }
    this.stagedFiles.add(filePath)
  }

  // Test helper methods
  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }
}
