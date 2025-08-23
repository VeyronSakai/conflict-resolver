import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as exec from '@actions/exec'
import type { ExecOptions } from '@actions/exec'

// Mock the modules
jest.mock('@actions/exec')
jest.mock('@actions/core')
jest.mock('fs')

// Import after mocking
import { GitUtility } from '../src/git.js'
import * as fs from 'fs'

// Get mocked functions
const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
const mockExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>

describe('GitUtility', () => {
  let gitUtility: GitUtility

  beforeEach(() => {
    jest.clearAllMocks()
    gitUtility = new GitUtility()
  })

  describe('getConflictedFiles', () => {
    it('should parse conflicted files from git status', async () => {
      const mockOutput = `UU src/file1.ts
AA src/file2.ts
DD src/file3.ts
AU src/file4.ts
UA src/file5.ts
DU src/file6.ts
UD src/file7.ts
 M src/file8.ts
?? src/file9.ts`

      mockExec.mockImplementation(
        async (
          cmd: string,
          args?: string[],
          options?: ExecOptions
        ): Promise<number> => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from(mockOutput))
          }
          return 0
        }
      )

      const files = await gitUtility.getConflictedFiles()

      expect(files).toHaveLength(7)
      expect(files[0]).toEqual({
        path: 'src/file1.ts',
        statusCode: 'UU',
        conflictType: 'both-modified'
      })
      expect(files[1]).toEqual({
        path: 'src/file2.ts',
        statusCode: 'AA',
        conflictType: 'both-added'
      })
      expect(files[2]).toEqual({
        path: 'src/file3.ts',
        statusCode: 'DD',
        conflictType: 'both-deleted'
      })
      expect(files[3]).toEqual({
        path: 'src/file4.ts',
        statusCode: 'AU',
        conflictType: 'added-by-us'
      })
      expect(files[4]).toEqual({
        path: 'src/file5.ts',
        statusCode: 'UA',
        conflictType: 'added-by-them'
      })
      expect(files[5]).toEqual({
        path: 'src/file6.ts',
        statusCode: 'DU',
        conflictType: 'deleted-by-us'
      })
      expect(files[6]).toEqual({
        path: 'src/file7.ts',
        statusCode: 'UD',
        conflictType: 'deleted-by-them'
      })
    })

    it('should return empty array when no conflicts exist', async () => {
      const mockOutput = ` M src/file1.ts
?? src/file2.ts`

      mockExec.mockImplementation(
        async (
          cmd: string,
          args?: string[],
          options?: ExecOptions
        ): Promise<number> => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from(mockOutput))
          }
          return 0
        }
      )

      const files = await gitUtility.getConflictedFiles()

      expect(files).toHaveLength(0)
    })

    it('should handle empty git status output', async () => {
      mockExec.mockImplementation(
        async (
          cmd: string,
          args?: string[],
          options?: ExecOptions
        ): Promise<number> => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from(''))
          }
          return 0
        }
      )

      const files = await gitUtility.getConflictedFiles()

      expect(files).toHaveLength(0)
    })
  })

  describe('resolveConflict', () => {
    it('should resolve conflict with ours strategy', async () => {
      mockExec.mockResolvedValue(0)

      await gitUtility.resolveConflict('src/file.ts', 'ours')

      expect(mockExec).toHaveBeenCalledWith('git', [
        'checkout',
        '--ours',
        'src/file.ts'
      ])
      expect(mockExec).toHaveBeenCalledWith('git', ['add', 'src/file.ts'])
    })

    it('should resolve conflict with theirs strategy', async () => {
      mockExec.mockResolvedValue(0)

      await gitUtility.resolveConflict('src/file.ts', 'theirs')

      expect(mockExec).toHaveBeenCalledWith('git', [
        'checkout',
        '--theirs',
        'src/file.ts'
      ])
      expect(mockExec).toHaveBeenCalledWith('git', ['add', 'src/file.ts'])
    })

    it('should throw error when git checkout fails', async () => {
      mockExec.mockRejectedValue(new Error('Git checkout failed'))

      await expect(
        gitUtility.resolveConflict('src/file.ts', 'ours')
      ).rejects.toThrow('Git checkout failed')
    })
  })

  describe('checkIfInMergeState', () => {
    it('should return true when in merge state', async () => {
      mockExec.mockResolvedValue(0)

      const result = await gitUtility.checkIfInMergeState()

      expect(result).toBe(true)
      expect(mockExec).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--verify', 'MERGE_HEAD'],
        { silent: true }
      )
    })

    it('should return false when not in merge state', async () => {
      mockExec.mockRejectedValue(new Error('Not in merge'))

      const result = await gitUtility.checkIfInMergeState()

      expect(result).toBe(false)
    })
  })

  describe('checkIfInRebaseState', () => {
    it('should return true when rebase directories exist', async () => {
      mockExec.mockImplementation(
        async (
          cmd: string,
          args?: string[],
          options?: ExecOptions
        ): Promise<number> => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('.git'))
          }
          return 0
        }
      )

      mockExistsSync.mockReturnValue(true)

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(true)
    })

    it('should return false when rebase directories do not exist', async () => {
      mockExec.mockImplementation(
        async (
          cmd: string,
          args?: string[],
          options?: ExecOptions
        ): Promise<number> => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('.git'))
          }
          return 0
        }
      )

      mockExistsSync.mockReturnValue(false)

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(false)
    })

    it('should return false when git rev-parse fails', async () => {
      mockExec.mockRejectedValue(new Error('Not a git repo'))

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(false)
    })
  })
})
