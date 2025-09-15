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
      case ConflictType.DeletedByUs:
        await this.resolveDeletedByUsConflict(file, strategy)
        break
      case ConflictType.DeletedByThem:
        await this.resolveDeletedByThemConflict(file, strategy)
        break
      case ConflictType.BothAdded:
        await this.resolveBothAddedConflict(file, strategy)
        break
      case ConflictType.BothModified:
        await this.resolveBothModifiedConflict(file, strategy)
        break
      default:
        throw new Error(
          `Unexpected conflict type for ${file.path}: ${file.conflictType}`
        )
    }
  }

  async stageFile(filePath: string): Promise<void> {
    await this.execGitCommand(['add', '--', filePath])
  }

  async commitChanges(message: string): Promise<void> {
    await this.execGitCommand(['commit', '-m', message])
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
      case 'DU':
        return ConflictType.DeletedByUs
      case 'UD':
        return ConflictType.DeletedByThem
      case 'UU':
        return ConflictType.BothModified
      default:
        // AU, UA, and DD are not conflicts
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
        await this.execGitCommand(['rm', '--', file.path])
        core.info(`Resolved ${file.path} by keeping deletion (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side kept the file, so restore it
        await this.execGitCommand(['add', '--', file.path])
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
        await this.execGitCommand(['add', '--', file.path])
        core.info(`Resolved ${file.path} by keeping file (ours)`)
        break
      case ResolutionStrategy.Theirs:
        // Their side deleted the file, so accept deletion
        await this.execGitCommand(['rm', '--', file.path])
        core.info(`Resolved ${file.path} by accepting deletion (theirs)`)
        break
    }
  }

  private async resolveBothAddedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    // Check if file is binary
    const isBinary = await this.isBinaryFile(file.path)

    if (isBinary) {
      // For binary files, use git checkout to properly handle binary content
      await this.execGitCommand(['checkout', `--${strategy}`, '--', file.path])
    } else {
      // For text files, use the existing string-based approach
      const content = await this.getFileContent(file.path, strategy)
      fs.writeFileSync(file.path, content)
    }

    await this.execGitCommand(['add', '--', file.path])
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async resolveBothModifiedConflict(
    file: ConflictedFile,
    strategy: ResolutionStrategy
  ): Promise<void> {
    await this.execGitCommand(['checkout', `--${strategy}`, '--', file.path])
    await this.execGitCommand(['add', '--', file.path])
    core.info(`Resolved ${file.path} using ${strategy} strategy`)
  }

  private async getFileContent(
    filePath: string,
    strategy: ResolutionStrategy
  ): Promise<string> {
    switch (strategy) {
      case ResolutionStrategy.Ours:
        return await this.execGitCommand(['show', `:2:${filePath}`])
      case ResolutionStrategy.Theirs:
        return await this.execGitCommand(['show', `:3:${filePath}`])
      default:
        // This should never happen due to TypeScript exhaustiveness checking
        return ''
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
        '--',
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
        '.bin'
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
