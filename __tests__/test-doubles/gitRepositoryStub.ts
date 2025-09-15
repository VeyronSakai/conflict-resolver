import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class GitRepositoryStub implements GitRepository {
  private conflictedFiles: ConflictedFile[]
  private resolvedFiles: Map<string, ResolutionStrategy> = new Map()
  private stagedFiles: Set<string> = new Set()
  private commits: string[] = []

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
    this.commits.push(message)
  }

  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }

  getCommits(): string[] {
    return this.commits
  }

  reset(): void {
    this.conflictedFiles = []
    this.resolvedFiles.clear()
    this.stagedFiles.clear()
    this.commits = []
  }

  static createWithSampleConflicts(): GitRepositoryStub {
    return new GitRepositoryStub([
      { path: 'package-lock.json', conflictType: ConflictType.BothModified },
      { path: 'src/index.ts', conflictType: ConflictType.BothModified },
      { path: 'config.generated.ts', conflictType: ConflictType.BothModified },
      { path: 'deleted-file.ts', conflictType: ConflictType.DeletedByUs }
    ])
  }
}
