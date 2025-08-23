import { describe, expect, it, jest, beforeEach } from '@jest/globals'

// Mock the modules
jest.mock('../src/config.js')
jest.mock('../src/git.js')
jest.mock('@actions/core')

// Import after mocking
import { ConflictResolver } from '../src/conflict-resolver.js'
import { ConfigLoader } from '../src/config.js'
import { GitUtility } from '../src/git.js'
import type { ConflictResolverConfig, ConflictedFile } from '../src/types.js'

const MockedConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>
const MockedGitUtility = GitUtility as jest.MockedClass<typeof GitUtility>

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let mockLoadConfig: jest.MockedFunction<() => Promise<ConflictResolverConfig>>
  let mockCheckIfInMergeState: jest.MockedFunction<() => Promise<boolean>>
  let mockCheckIfInRebaseState: jest.MockedFunction<() => Promise<boolean>>
  let mockGetConflictedFiles: jest.MockedFunction<
    () => Promise<ConflictedFile[]>
  >
  let mockResolveConflict: jest.MockedFunction<
    (filePath: string, strategy: 'ours' | 'theirs') => Promise<void>
  >

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock implementations
    mockLoadConfig = jest.fn()
    mockCheckIfInMergeState = jest.fn()
    mockCheckIfInRebaseState = jest.fn()
    mockGetConflictedFiles = jest.fn()
    mockResolveConflict = jest.fn()

    MockedConfigLoader.mockImplementation(
      () =>
        ({
          loadConfig: mockLoadConfig
        }) as unknown as ConfigLoader
    )

    MockedGitUtility.mockImplementation(
      () =>
        ({
          checkIfInMergeState: mockCheckIfInMergeState,
          checkIfInRebaseState: mockCheckIfInRebaseState,
          getConflictedFiles: mockGetConflictedFiles,
          resolveConflict: mockResolveConflict
        }) as unknown as GitUtility
    )

    resolver = new ConflictResolver('.conflict-resolver.yml')
  })

  describe('resolve', () => {
    it('should resolve conflicts based on matching rules', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [
          { path: '*.json', strategy: 'theirs' },
          {
            path: 'src/**/*.ts',
            strategy: 'ours',
            conflictType: 'both-modified'
          }
        ]
      })

      mockCheckIfInMergeState.mockResolvedValue(true)
      mockCheckIfInRebaseState.mockResolvedValue(false)
      mockGetConflictedFiles.mockResolvedValue([
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
      mockResolveConflict.mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['package.json', 'src/file.ts'])
      expect(result.unresolvedFiles).toEqual(['src/other.ts'])

      expect(mockResolveConflict).toHaveBeenCalledWith('package.json', 'theirs')
      expect(mockResolveConflict).toHaveBeenCalledWith('src/file.ts', 'ours')
      expect(mockResolveConflict).toHaveBeenCalledTimes(2)
    })

    it('should handle no config rules', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: []
      })

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should handle not being in merge or rebase state', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockCheckIfInMergeState.mockResolvedValue(false)
      mockCheckIfInRebaseState.mockResolvedValue(false)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
      expect(mockGetConflictedFiles).not.toHaveBeenCalled()
    })

    it('should handle no conflicted files', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockCheckIfInMergeState.mockResolvedValue(true)
      mockCheckIfInRebaseState.mockResolvedValue(false)
      mockGetConflictedFiles.mockResolvedValue([])

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should handle resolution failures', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockCheckIfInMergeState.mockResolvedValue(true)
      mockCheckIfInRebaseState.mockResolvedValue(false)
      mockGetConflictedFiles.mockResolvedValue([
        {
          path: 'package.json',
          statusCode: 'UU',
          conflictType: 'both-modified'
        }
      ])
      mockResolveConflict.mockRejectedValue(new Error('Failed to resolve'))

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['package.json'])
    })

    it('should match patterns with minimatch', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [{ path: 'src/**/*.ts', strategy: 'ours' }]
      })

      mockCheckIfInMergeState.mockResolvedValue(true)
      mockCheckIfInRebaseState.mockResolvedValue(false)
      mockGetConflictedFiles.mockResolvedValue([
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
      mockResolveConflict.mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['src/deep/nested/file.ts'])
      expect(result.unresolvedFiles).toEqual(['test/file.ts', 'src/file.js'])
    })

    it('should respect conflictType when specified', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [
          { path: '*.ts', strategy: 'ours', conflictType: 'both-modified' },
          { path: '*.ts', strategy: 'theirs', conflictType: 'both-added' }
        ]
      })

      mockCheckIfInMergeState.mockResolvedValue(true)
      mockCheckIfInRebaseState.mockResolvedValue(false)
      mockGetConflictedFiles.mockResolvedValue([
        { path: 'file1.ts', statusCode: 'UU', conflictType: 'both-modified' },
        { path: 'file2.ts', statusCode: 'AA', conflictType: 'both-added' },
        { path: 'file3.ts', statusCode: 'DU', conflictType: 'deleted-by-us' }
      ])
      mockResolveConflict.mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['file1.ts', 'file2.ts'])
      expect(result.unresolvedFiles).toEqual(['file3.ts'])

      expect(mockResolveConflict).toHaveBeenCalledWith('file1.ts', 'ours')
      expect(mockResolveConflict).toHaveBeenCalledWith('file2.ts', 'theirs')
    })

    it('should work in rebase state', async () => {
      mockLoadConfig.mockResolvedValue({
        rules: [{ path: '*.json', strategy: 'theirs' }]
      })

      mockCheckIfInMergeState.mockResolvedValue(false)
      mockCheckIfInRebaseState.mockResolvedValue(true)
      mockGetConflictedFiles.mockResolvedValue([
        {
          path: 'package.json',
          statusCode: 'UU',
          conflictType: 'both-modified'
        }
      ])
      mockResolveConflict.mockResolvedValue(undefined)

      const result = await resolver.resolve()

      expect(result.resolvedFiles).toEqual(['package.json'])
      expect(result.unresolvedFiles).toEqual([])
    })
  })
})
