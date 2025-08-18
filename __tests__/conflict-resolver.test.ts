import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { ConflictResolver } from '../src/conflict-resolver.js'
import { ConfigLoader } from '../src/config.js'
import { GitUtility } from '../src/git.js'

jest.mock('../src/config.js')
jest.mock('../src/git.js')
jest.mock('@actions/core')

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let mockConfigLoader: jest.Mocked<ConfigLoader>
  let mockGitUtility: jest.Mocked<GitUtility>

  beforeEach(() => {
    jest.clearAllMocks()

    resolver = new ConflictResolver('.conflict-resolver.yml')

    // Get the mocked instances
    mockConfigLoader = (resolver as any)
      .configLoader as jest.Mocked<ConfigLoader>
    mockGitUtility = (resolver as any).gitUtility as jest.Mocked<GitUtility>
  })

  describe('resolve', () => {
    it('should resolve conflicts based on matching rules', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [
          { path: '*.json', strategy: 'theirs' },
          {
            path: 'src/**/*.ts',
            strategy: 'ours',
            conflictType: 'both-modified'
          }
        ]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(true)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)
      mockGitUtility.getConflictedFiles = jest.fn().mockResolvedValue([
        {
          path: 'package.json',
          statusCode: 'UU',
          conflictType: 'both-modified'
        },
        {
          path: 'src/file.ts',
          statusCode: 'UU',
          conflictType: 'both-modified'
        },
        { path: 'src/other.ts', statusCode: 'AA', conflictType: 'both-added' }
      ])
      mockGitUtility.resolveConflict = jest.fn().mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['package.json', 'src/file.ts'])
      expect(result.unresolvedFiles).toEqual(['src/other.ts'])

      expect(mockGitUtility.resolveConflict).toHaveBeenCalledWith(
        'package.json',
        'theirs'
      )
      expect(mockGitUtility.resolveConflict).toHaveBeenCalledWith(
        'src/file.ts',
        'ours'
      )
      expect(mockGitUtility.resolveConflict).toHaveBeenCalledTimes(2)
    })

    it('should handle no config rules', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: []
      })

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should handle not being in merge or rebase state', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(false)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
      expect(mockGitUtility.getConflictedFiles).not.toHaveBeenCalled()
    })

    it('should handle no conflicted files', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(true)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)
      mockGitUtility.getConflictedFiles = jest.fn().mockResolvedValue([])

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should handle resolution failures', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(true)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)
      mockGitUtility.getConflictedFiles = jest
        .fn()
        .mockResolvedValue([
          {
            path: 'package.json',
            statusCode: 'UU',
            conflictType: 'both-modified'
          }
        ])
      mockGitUtility.resolveConflict = jest
        .fn()
        .mockRejectedValue(new Error('Failed to resolve'))

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['package.json'])
    })

    it('should match patterns with minimatch', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [{ path: 'src/**/*.ts', strategy: 'ours' }]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(true)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)
      mockGitUtility.getConflictedFiles = jest.fn().mockResolvedValue([
        {
          path: 'src/deep/nested/file.ts',
          statusCode: 'UU',
          conflictType: 'both-modified'
        },
        {
          path: 'test/file.ts',
          statusCode: 'UU',
          conflictType: 'both-modified'
        },
        { path: 'src/file.js', statusCode: 'UU', conflictType: 'both-modified' }
      ])
      mockGitUtility.resolveConflict = jest.fn().mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['src/deep/nested/file.ts'])
      expect(result.unresolvedFiles).toEqual(['test/file.ts', 'src/file.js'])
    })

    it('should respect conflictType when specified', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [
          { path: '*.ts', strategy: 'ours', conflictType: 'both-modified' },
          { path: '*.ts', strategy: 'theirs', conflictType: 'both-added' }
        ]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(true)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(false)
      mockGitUtility.getConflictedFiles = jest.fn().mockResolvedValue([
        { path: 'file1.ts', statusCode: 'UU', conflictType: 'both-modified' },
        { path: 'file2.ts', statusCode: 'AA', conflictType: 'both-added' },
        { path: 'file3.ts', statusCode: 'DU', conflictType: 'deleted-by-us' }
      ])
      mockGitUtility.resolveConflict = jest.fn().mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['file1.ts', 'file2.ts'])
      expect(result.unresolvedFiles).toEqual(['file3.ts'])

      expect(mockGitUtility.resolveConflict).toHaveBeenCalledWith(
        'file1.ts',
        'ours'
      )
      expect(mockGitUtility.resolveConflict).toHaveBeenCalledWith(
        'file2.ts',
        'theirs'
      )
    })

    it('should work in rebase state', async () => {
      mockConfigLoader.loadConfig = jest.fn().mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockGitUtility.checkIfInMergeState = jest.fn().mockResolvedValue(false)
      mockGitUtility.checkIfInRebaseState = jest.fn().mockResolvedValue(true)
      mockGitUtility.getConflictedFiles = jest
        .fn()
        .mockResolvedValue([
          {
            path: 'package.json',
            statusCode: 'UU',
            conflictType: 'both-modified'
          }
        ])
      mockGitUtility.resolveConflict = jest.fn().mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['package.json'])
      expect(result.unresolvedFiles).toEqual([])
    })
  })
})
