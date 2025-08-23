import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { ResolutionResult } from '../src/types.js'

// Mock the modules before importing
jest.mock('@actions/core')
jest.mock('../src/conflict-resolver.js')

// Import after mocking
import * as core from '@actions/core'
import { run } from '../src/main.js'
import { ConflictResolver } from '../src/conflict-resolver.js'

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('run', () => {
    it('should resolve conflicts successfully with resolved files', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const setOutputMock = jest.mocked(core.setOutput)
      const infoMock = jest.mocked(core.info)
      const warningMock = jest.mocked(core.warning)

      getInputMock.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['package.json', 'src/file.ts'],
          unresolvedFiles: ['src/other.ts']
        })

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(getInputMock).toHaveBeenCalledWith('config-path')
      expect(ConflictResolver).toHaveBeenCalledWith('.conflict-resolver.yml')
      expect(mockResolve).toHaveBeenCalled()

      expect(infoMock).toHaveBeenCalledWith('Starting Git Conflict Resolver')
      expect(infoMock).toHaveBeenCalledWith(
        'Config path: .conflict-resolver.yml'
      )

      expect(setOutputMock).toHaveBeenCalledWith(
        'resolved-files',
        'package.json,src/file.ts'
      )
      expect(setOutputMock).toHaveBeenCalledWith(
        'unresolved-files',
        'src/other.ts'
      )

      expect(warningMock).toHaveBeenCalledWith(
        '1 files still have conflicts and require manual resolution'
      )
    })

    it('should handle empty config path and use default', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const infoMock = jest.mocked(core.info)

      getInputMock.mockReturnValue('')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: [],
          unresolvedFiles: []
        })

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(infoMock).toHaveBeenCalledWith(
        'Config path: .conflict-resolver.yml (default)'
      )
      expect(ConflictResolver).toHaveBeenCalledWith('')
    })

    it('should show success message when all conflicts are resolved', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const infoMock = jest.mocked(core.info)
      const warningMock = jest.mocked(core.warning)

      getInputMock.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['package.json', 'src/file.ts'],
          unresolvedFiles: []
        })

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(infoMock).toHaveBeenCalledWith(
        'All conflicts resolved successfully!'
      )
      expect(warningMock).not.toHaveBeenCalled()
    })

    it('should not show any message when no conflicts exist', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const setOutputMock = jest.mocked(core.setOutput)
      const infoMock = jest.mocked(core.info)
      const warningMock = jest.mocked(core.warning)

      getInputMock.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: [],
          unresolvedFiles: []
        })

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(setOutputMock).toHaveBeenCalledWith('resolved-files', '')
      expect(setOutputMock).toHaveBeenCalledWith('unresolved-files', '')

      // Should not call warning or the success message
      const calls = infoMock.mock.calls
      expect(calls).not.toContainEqual(['All conflicts resolved successfully!'])
      expect(warningMock).not.toHaveBeenCalled()
    })

    it('should handle errors and call setFailed', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const setFailedMock = jest.mocked(core.setFailed)

      getInputMock.mockReturnValue('.conflict-resolver.yml')

      const errorMessage = 'Failed to load config file'
      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockRejectedValue(new Error(errorMessage))

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(setFailedMock).toHaveBeenCalledWith(errorMessage)
    })

    it('should handle non-Error objects thrown', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const setFailedMock = jest.mocked(core.setFailed)

      getInputMock.mockReturnValue('.conflict-resolver.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockRejectedValue('String error')

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      // When a non-Error is thrown, setFailed should not be called
      // because the if condition checks for instanceof Error
      expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('should handle multiple resolved and unresolved files', async () => {
      const getInputMock = jest.mocked(core.getInput)
      const setOutputMock = jest.mocked(core.setOutput)
      const warningMock = jest.mocked(core.warning)

      getInputMock.mockReturnValue('custom-config.yml')

      const mockResolve = jest
        .fn<() => Promise<ResolutionResult>>()
        .mockResolvedValue({
          resolvedFiles: ['file1.ts', 'file2.js', 'file3.md'],
          unresolvedFiles: ['conflict1.ts', 'conflict2.js']
        })

      jest.mocked(ConflictResolver).mockImplementation(
        () =>
          ({
            resolve: mockResolve
          }) as unknown as ConflictResolver
      )

      await run()

      expect(ConflictResolver).toHaveBeenCalledWith('custom-config.yml')

      expect(setOutputMock).toHaveBeenCalledWith(
        'resolved-files',
        'file1.ts,file2.js,file3.md'
      )
      expect(setOutputMock).toHaveBeenCalledWith(
        'unresolved-files',
        'conflict1.ts,conflict2.js'
      )

      expect(warningMock).toHaveBeenCalledWith(
        '2 files still have conflicts and require manual resolution'
      )
    })
  })
})
