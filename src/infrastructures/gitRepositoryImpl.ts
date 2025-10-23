import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class GitRepositoryImpl implements GitRepository {
  async getConflictedFiles(): Promise<ConflictedFile[]> {
    const output = await this.execGitCommand([
      'diff',
      '--name-only',
      '--diff-filter=U'
    ])

    if (!output.trim()) {
      return []
    }

    const filePaths = output.trim().split('\n')
    const conflictedFiles: ConflictedFile[] = []

    for (const filePath of filePaths) {
      const conflictType = await this.getConflictType(filePath)
      conflictedFiles.push({ path: filePath, conflictType })
    }

    return conflictedFiles
  }

  async resolveConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    switch (file.conflictType) {
      case ConflictType.AddedByThem:
        await this.resolveAddedByThemConflict(file, strategy)
        break
      case ConflictType.AddedByUs:
        await this.resolveAddedByUsConflict(file, strategy)
        break
      case ConflictType.BothAdded:
        await this.resolveBothAddedConflict(file, strategy)
        break
      case ConflictType.BothModified:
        await this.resolveBothModifiedConflict(file, strategy)
        break
      case ConflictType.DeletedByBoth:
        await this.resolveDeletedByBothConflict(file, strategy)
        break
      case ConflictType.DeletedByUs:
        await this.resolveDeletedByUsConflict(file, strategy)
        break
      case ConflictType.DeletedByThem:
        await this.resolveDeletedByThemConflict(file, strategy)
        break
      default:
        throw new Error(
          `Unexpected conflict type for ${file.path}: ${file.conflictType}`
        )
    }
  }

  async stageFile(filePath: string): Promise<void> {
    await this.gitAddFile(filePath)
  }

  private async getConflictType(filePath: string): Promise<ConflictType> {
    const statusOutput = await this.execGitCommand([
      'status',
      '--porcelain',
      '--',
      filePath
    ])

    // Git status --porcelain format: XY filename
    // The first two characters are the status code
    const statusCode = statusOutput.substring(0, 2)

    switch (statusCode) {
      case 'AA':
        return ConflictType.BothAdded
      case 'AU':
        return ConflictType.AddedByUs
      case 'DD':
        return ConflictType.DeletedByBoth
      case 'DU':
        return ConflictType.DeletedByUs
      case 'UA':
        return ConflictType.AddedByThem
      case 'UD':
        return ConflictType.DeletedByThem
      case 'UU':
        return ConflictType.BothModified
      default:
        // If we somehow get here, it's an unexpected status
        throw new Error(
          `Unexpected git status for ${filePath}: ${statusOutput.trim()}`
        )
    }
  }

  private async resolveDeletedByUsConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    switch (strategy) {
      case ResolutionStrategy.Ours:
        // Our side deleted the file, so keep it deleted
        await this.gitRemoveFile(file.path)
        core.info(`Resolved ${file.path} by keeping deletion (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side kept the file, so restore it
        await this.gitAddFile(file.path)
        core.info(`Resolved ${file.path} by keeping file (theirs)`)
        break
    }
  }

  private async resolveDeletedByThemConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    switch (strategy) {
      case ResolutionStrategy.Ours:
        // Our side kept the file, so keep it
        await this.gitAddFile(file.path)
        core.info(`Resolved ${file.path} by keeping file (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side deleted the file, so accept deletion
        await this.gitRemoveFile(file.path)
        core.info(`Resolved ${file.path} by accepting deletion (theirs)`)
        break
    }
  }

  private async resolveDeletedByBothConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    // Both sides deleted the file, so we just need to accept the deletion
    // Strategy doesn't matter here as both sides agree on deletion
    // Use git add instead of git rm because the file is already deleted from working directory
    await this.gitAddFile(file.path)
    core.info(
      `Resolved ${file.path} by accepting deletion from both sides (${strategy})`
    )
  }

  private async resolveAddedByUsConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    switch (strategy) {
      case ResolutionStrategy.Ours:
        // Our side added the file, so keep it
        await this.gitAddFile(file.path)
        core.info(`Resolved ${file.path} by keeping our added file (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side doesn't have this file, so remove it
        await this.gitRemoveFile(file.path)
        core.info(`Resolved ${file.path} by removing our added file (theirs)`)
        break
    }
  }

  private async resolveAddedByThemConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    switch (strategy) {
      case ResolutionStrategy.Ours:
        // Our side doesn't have this file, so remove it
        await this.gitRemoveFile(file.path)
        core.info(`Resolved ${file.path} by removing their added file (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side added the file, so keep it
        await this.gitAddFile(file.path)
        core.info(`Resolved ${file.path} by keeping their added file (theirs)`)
        break
    }
  }

  private async resolveBothAddedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    await this.gitCheckoutFile(file.path, strategy)
    await this.gitAddFile(file.path)
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async resolveBothModifiedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    await this.gitCheckoutFile(file.path, strategy)
    await this.gitAddFile(file.path)
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async gitAddFile(filePath: string): Promise<void> {
    await this.execGitCommand(['add', '--', filePath])
  }

  private async gitRemoveFile(filePath: string): Promise<void> {
    await this.execGitCommand(['rm', '--', filePath])
  }

  private async gitCheckoutFile(
    filePath: string,
    strategy: ResolutionStrategy
  ): Promise<void> {
    await this.execGitCommand(['checkout', `--${strategy}`, '--', filePath])
  }

  private async execGitCommand(args: string[]): Promise<string> {
    let output = ''
    const options: exec.ExecOptions = {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString()
        }
      },
      silent: true
    }

    const exitCode = await exec.exec('git', args, options)
    if (exitCode !== 0) {
      throw new Error(`Git command failed: git ${args.join(' ')}`)
    }

    return output
  }
}
