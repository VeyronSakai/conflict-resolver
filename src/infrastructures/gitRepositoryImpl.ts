import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { GitRepository } from '@domains/repositories/gitRepository.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export interface GitRepositoryOptions {
  noRenames?: boolean
}

export class GitRepositoryImpl implements GitRepository {
  private readonly noRenames: boolean

  constructor(options: GitRepositoryOptions = {}) {
    this.noRenames = options.noRenames ?? false
  }

  async getConflictedFiles(): Promise<ConflictedFile[]> {
    const args = ['status', '--porcelain']
    if (this.noRenames) {
      args.push('--no-renames')
    }
    const output = await this.execGitCommand(args)

    if (!output.trim()) {
      return []
    }

    const conflictedFiles: ConflictedFile[] = []
    for (const line of output.trim().split('\n')) {
      const statusCode = line.substring(0, 2)
      const conflictType = this.parseConflictType(statusCode)
      if (conflictType !== undefined) {
        conflictedFiles.push({ path: line.substring(3), conflictType })
      }
    }

    return conflictedFiles
  }

  async resolveConflicts(
    files: ReadonlyArray<{ file: ConflictedFile; strategy: ResolutionStrategy }>
  ): Promise<void> {
    const checkoutOurs: string[] = []
    const checkoutTheirs: string[] = []
    const addFiles: string[] = []
    const rmFiles: string[] = []

    for (const { file, strategy } of files) {
      switch (file.conflictType) {
        case ConflictType.BothAdded:
        case ConflictType.BothModified:
          if (strategy === ResolutionStrategy.Ours) {
            checkoutOurs.push(file.path)
          } else {
            checkoutTheirs.push(file.path)
          }
          addFiles.push(file.path)
          break
        case ConflictType.DeletedByUs:
          if (strategy === ResolutionStrategy.Ours) {
            rmFiles.push(file.path)
          } else {
            addFiles.push(file.path)
          }
          break
        case ConflictType.DeletedByThem:
          if (strategy === ResolutionStrategy.Ours) {
            addFiles.push(file.path)
          } else {
            rmFiles.push(file.path)
          }
          break
        case ConflictType.DeletedByBoth:
          rmFiles.push(file.path)
          break
        case ConflictType.AddedByUs:
          if (strategy === ResolutionStrategy.Ours) {
            addFiles.push(file.path)
          } else {
            rmFiles.push(file.path)
          }
          break
        case ConflictType.AddedByThem:
          if (strategy === ResolutionStrategy.Ours) {
            rmFiles.push(file.path)
          } else {
            addFiles.push(file.path)
          }
          break
        default:
          core.error(
            `Conflict type '${file.conflictType}' for ${file.path} is not supported for auto-resolution. Manual resolution required.`
          )
          break
      }
    }

    // Execute batched git commands (at most 4 instead of N*2-3)
    if (checkoutOurs.length > 0) {
      await this.execGitCommand(['checkout', '--ours', '--', ...checkoutOurs])
    }
    if (checkoutTheirs.length > 0) {
      await this.execGitCommand([
        'checkout',
        '--theirs',
        '--',
        ...checkoutTheirs
      ])
    }
    if (addFiles.length > 0) {
      await this.execGitCommand(['add', '--', ...addFiles])
    }
    if (rmFiles.length > 0) {
      await this.execGitCommand(['rm', '--', ...rmFiles])
    }
  }

  private parseConflictType(statusCode: string): ConflictType | undefined {
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
        return undefined
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
