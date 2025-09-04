import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import { ConflictedFile, ConflictType, ResolutionStrategy } from './types.js'

export class GitUtility {
  private statusToConflictType(statusCode: string): ConflictType | undefined {
    switch (statusCode) {
      case 'UU':
        return 'both-modified'
      case 'AA':
        return 'both-added'
      case 'DD':
        return 'both-deleted'
      case 'AU':
        return 'added-by-us'
      case 'UA':
        return 'added-by-them'
      case 'DU':
        return 'deleted-by-us'
      case 'UD':
        return 'deleted-by-them'
      default:
        return undefined
    }
  }

  async getConflictedFiles(): Promise<ConflictedFile[]> {
    const conflictedFiles: ConflictedFile[] = []

    let output = ''
    const options: exec.ExecOptions = {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString()
        }
      },
      silent: true
    }

    try {
      await exec.exec('git', ['status', '--porcelain'], options)
    } catch (error) {
      core.error('Failed to get git status')
      throw error
    }

    const lines = output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)

    for (const line of lines) {
      const statusCode = line.substring(0, 2)
      let filePath = line.substring(3).trim()

      // Handle quoted filenames (git quotes filenames with special characters)
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        // Remove quotes and handle basic escape sequences
        filePath = filePath
          .slice(1, -1)
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
      }

      // Check if this is a conflict (both sides have changes)
      const conflictStatuses = ['UU', 'AA', 'DD', 'AU', 'UA', 'DU', 'UD']
      if (conflictStatuses.includes(statusCode)) {
        conflictedFiles.push({
          path: filePath,
          statusCode,
          conflictType: this.statusToConflictType(statusCode)
        })
      }
    }

    return conflictedFiles
  }

  async resolveConflict(
    filePath: string,
    strategy: ResolutionStrategy
  ): Promise<void> {
    core.info(`Resolving conflict in ${filePath} using ${strategy} strategy`)

    try {
      // Use git checkout with --ours or --theirs flag
      await exec.exec('git', ['checkout', `--${strategy}`, filePath])

      // Stage the resolved file
      await exec.exec('git', ['add', filePath])

      core.info(`Successfully resolved ${filePath}`)
    } catch (error) {
      core.error(`Failed to resolve conflict in ${filePath}`)
      throw error
    }
  }

  async checkIfInMergeState(): Promise<boolean> {
    try {
      await exec.exec('git', ['rev-parse', '--verify', 'MERGE_HEAD'], {
        silent: true
      })
      return true
    } catch {
      return false
    }
  }

  async checkIfInRebaseState(): Promise<boolean> {
    try {
      let output = ''
      const options: exec.ExecOptions = {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString()
          }
        },
        silent: true
      }

      await exec.exec('git', ['rev-parse', '--git-dir'], options)
      const gitDir = output.trim()

      // Check for rebase directories
      return (
        fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
        fs.existsSync(path.join(gitDir, 'rebase-apply'))
      )
    } catch {
      return false
    }
  }
}
