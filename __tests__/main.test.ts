import { describe, expect, it, jest, beforeEach } from '@jest/globals'

// Mock the modules before any imports
jest.mock('@actions/core')
jest.mock('../src/conflict-resolver.js')

describe('main', () => {
  let mockGetInput: jest.Mock
  let mockSetOutput: jest.Mock
  let mockInfo: jest.Mock
  let mockWarning: jest.Mock
  let mockSetFailed: jest.Mock
  let MockConflictResolver: jest.Mock
  let mockResolve: jest.Mock
  let run: () => Promise<void>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()

    // Set up mocks
    mockGetInput = jest.fn()
    mockSetOutput = jest.fn()
    mockInfo = jest.fn()
    mockWarning = jest.fn()
    mockSetFailed = jest.fn()
    mockResolve = jest.fn()

    // Mock @actions/core
    jest.mocked(await import('@actions/core')).getInput = mockGetInput
    jest.mocked(await import('@actions/core')).setOutput = mockSetOutput
    jest.mocked(await import('@actions/core')).info = mockInfo
    jest.mocked(await import('@actions/core')).warning = mockWarning
    jest.mocked(await import('@actions/core')).setFailed = mockSetFailed

    // Mock ConflictResolver
    MockConflictResolver = jest.fn(() => ({
      resolve: mockResolve
    }))
    jest.mocked(await import('../src/conflict-resolver.js')).ConflictResolver =
      MockConflictResolver as never

    // Import the function to test
    const mainModule = await import('../src/main.js')
    run = mainModule.run
  })

  describe('run', () => {
    it('should resolve conflicts successfully with resolved files', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')
      mockResolve.mockResolvedValue({
        resolvedFiles: ['package.json', 'src/file.ts'],
        unresolvedFiles: ['src/other.ts']
      })

      await run()

      expect(mockGetInput).toHaveBeenCalledWith('config-path')
      expect(MockConflictResolver).toHaveBeenCalledWith(
        '.conflict-resolver.yml'
      )
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
      mockResolve.mockResolvedValue({
        resolvedFiles: [],
        unresolvedFiles: []
      })

      await run()

      expect(mockInfo).toHaveBeenCalledWith(
        'Config path: .conflict-resolver.yml (default)'
      )
      expect(MockConflictResolver).toHaveBeenCalledWith('')
    })

    it('should show success message when all conflicts are resolved', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')
      mockResolve.mockResolvedValue({
        resolvedFiles: ['package.json', 'src/file.ts'],
        unresolvedFiles: []
      })

      await run()

      expect(mockInfo).toHaveBeenCalledWith(
        'All conflicts resolved successfully!'
      )
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should not show any message when no conflicts exist', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')
      mockResolve.mockResolvedValue({
        resolvedFiles: [],
        unresolvedFiles: []
      })

      await run()

      expect(mockSetOutput).toHaveBeenCalledWith('resolved-files', '')
      expect(mockSetOutput).toHaveBeenCalledWith('unresolved-files', '')

      // Should not call warning or the success message
      const calls = mockInfo.mock.calls
      expect(calls).not.toContainEqual(['All conflicts resolved successfully!'])
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should handle errors and call setFailed', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')

      const errorMessage = 'Failed to load config file'
      mockResolve.mockRejectedValue(new Error(errorMessage))

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith(errorMessage)
    })

    it('should handle non-Error objects thrown', async () => {
      mockGetInput.mockReturnValue('.conflict-resolver.yml')
      mockResolve.mockRejectedValue('String error')

      await run()

      // When a non-Error is thrown, setFailed should not be called
      // because the if condition checks for instanceof Error
      expect(mockSetFailed).not.toHaveBeenCalled()
    })

    it('should handle multiple resolved and unresolved files', async () => {
      mockGetInput.mockReturnValue('custom-config.yml')
      mockResolve.mockResolvedValue({
        resolvedFiles: ['file1.ts', 'file2.js', 'file3.md'],
        unresolvedFiles: ['conflict1.ts', 'conflict2.js']
      })

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
