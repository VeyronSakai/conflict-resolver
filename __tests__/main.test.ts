import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { ResolutionResult } from '../src/types.js'

// Create mock functions
const mockGetInput = jest.fn<(name: string) => string>()
const mockSetOutput = jest.fn<(name: string, value: string) => void>()
const mockInfo = jest.fn<(message: string) => void>()
const mockWarning = jest.fn<(message: string | Error) => void>()
const mockSetFailed = jest.fn<(message: string | Error) => void>()
const mockDebug = jest.fn<(message: string) => void>()
const mockError = jest.fn<(message: string | Error) => void>()

// Mock the modules before importing
jest.mock('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  info: mockInfo,
  warning: mockWarning,
  setFailed: mockSetFailed,
  debug: mockDebug,
  error: mockError
}))

const MockConflictResolver = jest.fn()
jest.mock('../src/conflict-resolver.js', () => ({
  ConflictResolver: MockConflictResolver
}))

// Import after mocking
import { run } from '../src/main.js'

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInput.mockReset()
    mockSetOutput.mockReset()
    mockInfo.mockReset()
    mockWarning.mockReset()
    mockSetFailed.mockReset()
    mockDebug.mockReset()
    mockError.mockReset()
  })

  describe('run', () => {
    it('should resolve conflicts successfully with resolved files', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['package.json', 'src/file.ts'],
          unresolvedFiles: ['src/other.ts']
        })

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(mockGetInput).toHaveBeenCalledWith('config-path')
      expect(MockConflictResolver).toHaveBeenCalledWith('.conflict-resolver.yml')
      expect(mockResolve).toHaveBeenCalled()

      expect(mockInfo).toHaveBeenCalledWith('Starting Git Conflict Resolver')
      expect(mockInfo).toHaveBeenCalledWith(
        'Config path: .conflict-resolver.yml'
      )

      expect(mockSetOutput).toHaveBeenCalledWith(
        'resolved-files',
        'package.json,src/file.ts'
      )
      expect(mockSetOutput).toHaveBeenCalledWith(
        'unresolved-files',
        'src/other.ts'
      )

      expect(mockWarning).toHaveBeenCalledWith(
        '1 files still have conflicts and require manual resolution'
      )
    })

    it('should handle empty config path and use default', async () => {
      mockGetInput.mockReturnValue('')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: [],
          unresolvedFiles: []
        })

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(mockInfo).toHaveBeenCalledWith(
        'Config path: .conflict-resolver.yml (default)'
      )
      expect(MockConflictResolver).toHaveBeenCalledWith('')
    })

    it('should show success message when all conflicts are resolved', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['package.json', 'src/file.ts'],
          unresolvedFiles: []
        })

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(mockInfo).toHaveBeenCalledWith(
        'All conflicts resolved successfully!'
      )
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should not show any message when no conflicts exist', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: [],
          unresolvedFiles: []
        })

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(mockSetOutput).toHaveBeenCalledWith('resolved-files', '')
      expect(mockSetOutput).toHaveBeenCalledWith('unresolved-files', '')

      // Should not call warning or the success message
      const calls = mockInfo.mock.calls
      expect(calls).not.toContainEqual([
        'All conflicts resolved successfully!'
      ])
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should handle errors and call setFailed', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const errorMessage = 'Failed to load config file'
      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockRejectedValue(new Error(errorMessage))

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith(errorMessage)
    })

    it('should handle non-Error objects thrown', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockRejectedValue('String error')

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      // When a non-Error is thrown, setFailed should not be called
      // because the if condition checks for instanceof Error
      expect(mockSetFailed).not.toHaveBeenCalled()
    })

    it('should handle multiple resolved and unresolved files', async () => {
      mockGetInput.mockReturnValue('custom-config.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['file1.ts', 'file2.js', 'file3.md'],
          unresolvedFiles: ['conflict1.ts', 'conflict2.js']
        })

      MockConflictResolver.mockImplementation(
        () =>
          ({
            resolve: mockResolve
          })
      )

      await run()

      expect(MockConflictResolver).toHaveBeenCalledWith('custom-config.yml')

      expect(mockSetOutput).toHaveBeenCalledWith(
        'resolved-files',
        'file1.ts,file2.js,file3.md'
      )
      expect(mockSetOutput).toHaveBeenCalledWith(
        'unresolved-files',
        'conflict1.ts,conflict2.js'
      )

      expect(mockWarning).toHaveBeenCalledWith(
        '2 files still have conflicts and require manual resolution'
      )
    })
  })
})