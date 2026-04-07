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
    const args = ['status', '--porcelain', '-z']
    if (this.noRenames) {
      args.push('--no-renames')
    }
    const output = await this.execGitCommand(args)

    if (!output) {
      return []
    }

    const conflictedFiles: ConflictedFile[] = []
    // -z uses NUL as delimiter and does not quote paths
    for (const entry of output.split('\0')) {
      if (entry.length < 3) {
        continue
      }
      const statusCode = entry.substring(0, 2)
      const conflictType = this.parseConflictType(statusCode)
      if (conflictType !== undefined) {
        conflictedFiles.push({ path: entry.substring(3), conflictType })
      }
    }

    return conflictedFiles
  }

  async resolveConflicts(
    files: ReadonlyArray<{ file: ConflictedFile; strategy: ResolutionStrategy }>
  ): Promise<string[]> {
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

    const failedPaths = new Set<string>()

    // Execute batched git commands, retry per-file on batch failure
    await this.execBatchOrPerFile(
      ['checkout', '--ours'],
      checkoutOurs,
      failedPaths
    )
    await this.execBatchOrPerFile(
      ['checkout', '--theirs'],
      checkoutTheirs,
      failedPaths
    )
    await this.execBatchOrPerFile(
      ['add'],
      addFiles.filter((f) => !failedPaths.has(f)),
      failedPaths
    )
    await this.execBatchOrPerFile(
      ['rm'],
      rmFiles.filter((f) => !failedPaths.has(f)),
      failedPaths
    )

    return [...failedPaths]
  }

  private async execBatchOrPerFile(
    command: string[],
    files: string[],
    failedPaths: Set<string>
  ): Promise<void> {
    if (files.length === 0) {
      return
    }

    try {
      await this.execGitCommand([...command, '--', ...files])
    } catch {
      for (const file of files) {
        try {
          await this.execGitCommand([...command, '--', file])
        } catch {
          failedPaths.add(file)
        }
      }
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
