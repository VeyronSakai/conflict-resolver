import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
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
      const conflictType = await this.detectConflictType(filePath)
      conflictedFiles.push({ path: filePath, conflictType })
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

    if (
      file.conflictType === ConflictType.DeletedByUs ||
      file.conflictType === ConflictType.DeletedByThem
    ) {
      await this.handleDeletedConflict(file, strategy)
    } else if (file.conflictType === ConflictType.BothAdded) {
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
    } else if (statusOutput.includes('AA')) {
      return ConflictType.BothAdded
    } else if (statusOutput.includes('DU')) {
      return ConflictType.DeletedByUs
    } else if (statusOutput.includes('UD')) {
      return ConflictType.DeletedByThem
    } else if (statusOutput.includes('UU')) {
      return ConflictType.BothModified
    } else {
      // AU and UA are not conflicts - they are files added on one side only
      // If we somehow get here with AU/UA, treat as a regular modification conflict
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
    // Check if file is binary
    const isBinary = await this.isBinaryFile(file.path)

    if (isBinary) {
      // For binary files, use git checkout to properly handle binary content
      await this.execGitCommand(['checkout', `--${strategy}`, file.path])
    } else {
      // For text files, use the existing string-based approach
      const content = await this.getFileContent(file.path, strategy)
      fs.writeFileSync(file.path, content)
    }

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

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      // Use git diff to check if file is binary
      // Git will report binary files in the diff output
      const output = await this.execGitCommand([
        'diff',
        '--numstat',
        'HEAD',
        '--',
        filePath
      ])

      // Binary files show as "-\t-\t" in numstat output
      if (output.includes('-\t-\t')) {
        return true
      }

      // Also check using git's attributes
      const checkBinaryOutput = await this.execGitCommand([
        'check-attr',
        'binary',
        filePath
      ])

      if (checkBinaryOutput.includes('binary: set')) {
        return true
      }

      // Check common binary file extensions as fallback
      const binaryExtensions = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.ico',
        '.pdf',
        '.zip',
        '.tar',
        '.gz',
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.bin',
        '.dat'
      ]
      const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
      return binaryExtensions.includes(ext)
    } catch {
      // If detection fails, check file extension as fallback
      const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico']
      return binaryExtensions.includes(ext)
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
