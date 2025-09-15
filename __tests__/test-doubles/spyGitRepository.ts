import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class SpyGitRepository implements GitRepository {
  private conflictedFiles: ConflictedFile[]
  private resolvedFiles: Map<string, ResolutionStrategy> = new Map()
  private stagedFiles: Set<string> = new Set()
  
  // Spy tracking for operations performed
  private addedFiles: Set<string> = new Set()
  private removedFiles: Set<string> = new Set()
  private checkedOutFiles: Map<string, ResolutionStrategy> = new Map()

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
    // Track the resolution for backward compatibility
    this.resolvedFiles.set(file.path, strategy)
    
    // Simulate behavior based on conflict type and strategy
    switch (file.conflictType) {
      case ConflictType.DeletedByUs:
        if (strategy === ResolutionStrategy.Ours) {
          // Our side deleted the file, so keep it deleted
          this.removedFiles.add(file.path)
        } else {
          // Their side kept the file, so restore it
          this.addedFiles.add(file.path)
        }
        break
        
      case ConflictType.DeletedByThem:
        if (strategy === ResolutionStrategy.Ours) {
          // Our side kept the file, so keep it
          this.addedFiles.add(file.path)
        } else {
          // Their side deleted the file, so accept deletion
          this.removedFiles.add(file.path)
        }
        break
        
      case ConflictType.BothAdded:
      case ConflictType.BothModified:
        // Both cases use checkout + add
        this.checkedOutFiles.set(file.path, strategy)
        this.addedFiles.add(file.path)
        break
        
      default:
        throw new Error(
          `Unexpected conflict type for ${file.path}: ${file.conflictType}`
        )
    }
  }

  async stageFile(filePath: string): Promise<void> {
    this.stagedFiles.add(filePath)
  }

  async commitChanges(message: string): Promise<void> {
    // Required by GitRepository interface but not used in tests
  }

  // Backward compatibility methods
  getResolvedFiles(): Map<string, ResolutionStrategy> {
    return this.resolvedFiles
  }

  getStagedFiles(): Set<string> {
    return this.stagedFiles
  }
  
  // Spy methods to inspect operations performed
  getAddedFiles(): Set<string> {
    return this.addedFiles
  }
  
  getRemovedFiles(): Set<string> {
    return this.removedFiles
  }
  
  getCheckedOutFiles(): Map<string, ResolutionStrategy> {
    return this.checkedOutFiles
  }
  
  // Helper method to check if file was processed correctly
  wasFileResolvedCorrectly(filePath: string): boolean {
    return this.resolvedFiles.has(filePath) && 
           (this.addedFiles.has(filePath) || 
            this.removedFiles.has(filePath) || 
            this.checkedOutFiles.has(filePath))
  }
}
