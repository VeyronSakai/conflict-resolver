import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import { GitRepository } from '../../domains/repositories/gitRepository.js'
import { ConflictedFile } from '../../domains/entities/conflictedFile.js'
import { ConflictType } from '../../domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '../../domains/value-objects/resolutionStrategy.js'

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
      const conflictType = await this.detectConflictType(filePath)
      conflictedFiles.push(new ConflictedFile(filePath, conflictType))
    }

    return conflictedFiles
  }

  async resolveConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    if (strategy === ResolutionStrategy.Manual) {
      core.info(`Skipping ${file.path} - requires manual resolution`)
      return
    }

    if (file.isDeleted()) {
      await this.handleDeletedConflict(file, strategy)
    } else if (file.isAdded()) {
      await this.handleAddedConflict(file, strategy)
    } else {
      await this.handleModifiedConflict(file, strategy)
    }
  }

  async stageFile(filePath: string): Promise<void> {
    await this.execGitCommand(['add', filePath])
  }

  async commitChanges(message: string): Promise<void> {
    await this.execGitCommand(['commit', '-m', message])
  }

  private async detectConflictType(filePath: string): Promise<ConflictType> {
    const statusOutput = await this.execGitCommand([
      'status',
      '--porcelain',
      filePath
    ])

    if (statusOutput.includes('DD')) {
      return ConflictType.BothModified // Both sides deleted
    } else if (statusOutput.includes('AU')) {
      return ConflictType.AddedByUs
    } else if (statusOutput.includes('UA')) {
      return ConflictType.AddedByThem
    } else if (statusOutput.includes('AA')) {
      return ConflictType.BothAdded
    } else if (statusOutput.includes('DU')) {
      return ConflictType.DeletedByUs
    } else if (statusOutput.includes('UD')) {
      return ConflictType.DeletedByThem
    } else {
      return ConflictType.BothModified
    }
  }

  private async handleDeletedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    if (file.conflictType === ConflictType.DeletedByUs) {
      if (strategy === ResolutionStrategy.Ours) {
        await this.execGitCommand(['rm', file.path])
        core.info(`Resolved ${file.path} by keeping deletion (ours)`)
      } else {
        await this.execGitCommand(['add', file.path])
        core.info(`Resolved ${file.path} by keeping file (theirs)`)
      }
    } else if (file.conflictType === ConflictType.DeletedByThem) {
      if (strategy === ResolutionStrategy.Ours) {
        await this.execGitCommand(['add', file.path])
        core.info(`Resolved ${file.path} by keeping file (ours)`)
      } else {
        await this.execGitCommand(['rm', file.path])
        core.info(`Resolved ${file.path} by accepting deletion (theirs)`)
      }
    }
  }

  private async handleAddedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    const content = await this.getFileContent(file.path, strategy)
    fs.writeFileSync(file.path, content)
    await this.execGitCommand(['add', file.path])
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async handleModifiedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    await this.execGitCommand(['checkout', `--${strategy}`, file.path])
    await this.execGitCommand(['add', file.path])
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async getFileContent(
    filePath: string,
    strategy: ResolutionStrategy
  ): Promise<string> {
    if (strategy === ResolutionStrategy.Ours) {
      return await this.execGitCommand(['show', `:2:${filePath}`])
    } else {
      return await this.execGitCommand(['show', `:3:${filePath}`])
    }
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
