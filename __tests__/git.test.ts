import { describe, expect, it, jest, beforeEach } from '@jest/globals'

// Mock modules before importing GitUtility
jest.mock('@actions/exec')
jest.mock('@actions/core')
jest.mock('fs')
jest.mock('path', () => ({
  join: jest.fn()
}))

import { GitUtility } from '../src/git.js'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'

const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
const mockFs = fs as jest.Mocked<typeof fs>
const mockPath = path as jest.Mocked<typeof path>

describe('GitUtility', () => {
  let gitUtility: GitUtility

  beforeEach(() => {
    gitUtility = new GitUtility()
    jest.clearAllMocks()
  })

  describe('getConflictedFiles', () => {
    it('should parse conflicted files correctly', async () => {
      const gitStatusOutput = 'UU file1.txt\nAA file2.js\nDD file3.json'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitStatusOutput))
        }
        return 0
      })

      const result = await gitUtility.getConflictedFiles()

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        path: 'file1.txt',
        statusCode: 'UU',
        conflictType: 'both-modified'
      })
      expect(result[1]).toEqual({
        path: 'file2.js',
        statusCode: 'AA',
        conflictType: 'both-added'
      })
      expect(result[2]).toEqual({
        path: 'file3.json',
        statusCode: 'DD',
        conflictType: 'both-deleted'
      })
    })

    it('should handle quoted filenames correctly', async () => {
      const gitStatusOutput =
        'UU "file with spaces.txt"\nAA "file\\twith\\ttabs.js"'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitStatusOutput))
        }
        return 0
      })

      const result = await gitUtility.getConflictedFiles()

      expect(result).toHaveLength(2)
      expect(result[0].path).toBe('file with spaces.txt')
      expect(result[1].path).toBe('file\twith\ttabs.js')
    })

    it('should filter out non-conflict files', async () => {
      const gitStatusOutput =
        'M  normal_file.txt\nUU conflict_file.txt\nA  added_file.js'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitStatusOutput))
        }
        return 0
      })

      const result = await gitUtility.getConflictedFiles()

      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('conflict_file.txt')
    })

    it('should handle empty git status output', async () => {
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(''))
        }
        return 0
      })

      const result = await gitUtility.getConflictedFiles()

      expect(result).toHaveLength(0)
    })

    it('should throw error when git status fails', async () => {
      mockExec.mockRejectedValue(new Error('Git command failed'))

      await expect(gitUtility.getConflictedFiles()).rejects.toThrow()
    })
  })

  describe('resolveConflict', () => {
    it('should resolve conflict using ours strategy', async () => {
      mockExec.mockResolvedValue(0)

      await gitUtility.resolveConflict('test.txt', 'ours')

      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockExec).toHaveBeenNthCalledWith(1, 'git', [
        'checkout',
        '--ours',
        'test.txt'
      ])
      expect(mockExec).toHaveBeenNthCalledWith(2, 'git', ['add', 'test.txt'])
    })

    it('should resolve conflict using theirs strategy', async () => {
      mockExec.mockResolvedValue(0)

      await gitUtility.resolveConflict('test.txt', 'theirs')

      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockExec).toHaveBeenNthCalledWith(1, 'git', [
        'checkout',
        '--theirs',
        'test.txt'
      ])
      expect(mockExec).toHaveBeenNthCalledWith(2, 'git', ['add', 'test.txt'])
    })

    it('should throw error when git checkout fails', async () => {
      mockExec.mockRejectedValueOnce(new Error('Checkout failed'))

      await expect(
        gitUtility.resolveConflict('test.txt', 'ours')
      ).rejects.toThrow()
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
        {
          silent: true
        }
      )
    })

    it('should return false when not in merge state', async () => {
      mockExec.mockRejectedValue(new Error('Not in merge state'))

      const result = await gitUtility.checkIfInMergeState()

      expect(result).toBe(false)
    })
  })

  describe('checkIfInRebaseState', () => {
    it('should return true when rebase-merge directory exists', async () => {
      const gitDir = '/path/to/.git'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitDir))
        }
        return 0
      })

      // Setup path.join mock
      const mockJoin = mockPath.join as jest.MockedFunction<
        (...paths: string[]) => string
      >
      mockJoin.mockImplementation((...args: string[]) => args.join('/'))

      // Mock fs.existsSync to return true for rebase-merge
      mockFs.existsSync.mockImplementation((path) => {
        return (path as string).includes('rebase-merge')
      })

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(true)
    })

    it('should return true when rebase-apply directory exists', async () => {
      const gitDir = '/path/to/.git'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitDir))
        }
        return 0
      })

      // Setup path.join mock
      const mockJoin = mockPath.join as jest.MockedFunction<
        (...paths: string[]) => string
      >
      mockJoin.mockImplementation((...args: string[]) => args.join('/'))

      // Mock fs.existsSync to return true for rebase-apply
      mockFs.existsSync.mockImplementation((path) => {
        return (path as string).includes('rebase-apply')
      })

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(true)
    })

    it('should return false when neither rebase directory exists', async () => {
      const gitDir = '/path/to/.git'
      mockExec.mockImplementation(async (command, args, options) => {
        if (
          options &&
          'listeners' in options &&
          options.listeners &&
          'stdout' in options.listeners
        ) {
          options.listeners.stdout!(Buffer.from(gitDir))
        }
        return 0
      })

      // Setup path.join mock
      const mockJoin = mockPath.join as jest.MockedFunction<
        (...paths: string[]) => string
      >
      mockJoin.mockImplementation((...args: string[]) => args.join('/'))

      // Mock fs.existsSync to return false
      mockFs.existsSync.mockReturnValue(false)

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(false)
    })

    it('should return false when git rev-parse fails', async () => {
      mockExec.mockRejectedValue(new Error('Git command failed'))

      const result = await gitUtility.checkIfInRebaseState()

      expect(result).toBe(false)
    })
  })
})
