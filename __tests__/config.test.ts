import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as fs from 'fs'

// Mock the modules
jest.mock('fs')
jest.mock('@actions/core')

// Import after mocking
import { ConfigLoader } from '../src/config.js'

// Get mocked functions
const mockExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
  typeof fs.readFileSync
>

describe('ConfigLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadConfig', () => {
    it('should load and parse a valid config file', async () => {
      const mockConfig = `
rules:
  - path: "*.json"
    strategy: "theirs"
  - path: "src/**/*.ts"
    conflictType: "both-modified"
    strategy: "ours"
`
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(mockConfig)

      const loader = new ConfigLoader('.conflict-resolver.yml')
      const config = await loader.loadConfig()

      expect(config.rules).toHaveLength(2)
      expect(config.rules[0]).toEqual({
        path: '*.json',
        strategy: 'theirs'
      })
      expect(config.rules[1]).toEqual({
        path: 'src/**/*.ts',
        conflictType: 'both-modified',
        strategy: 'ours'
      })
    })

    it('should return empty rules if config file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const loader = new ConfigLoader('.conflict-resolver.yml')
      const config = await loader.loadConfig()

      expect(config.rules).toHaveLength(0)
    })

    it('should throw error for invalid strategy', async () => {
      const mockConfig = `
rules:
  - path: "*.json"
    strategy: "invalid"
`
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(mockConfig)

      const loader = new ConfigLoader('.conflict-resolver.yml')

      await expect(loader.loadConfig()).rejects.toThrow(
        'strategy must be either "ours" or "theirs"'
      )
    })

    it('should throw error for missing path field', async () => {
      const mockConfig = `
rules:
  - strategy: "ours"
`
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(mockConfig)

      const loader = new ConfigLoader('.conflict-resolver.yml')

      await expect(loader.loadConfig()).rejects.toThrow(
        'must have a "path" field'
      )
    })

    it('should throw error for missing strategy field', async () => {
      const mockConfig = `
rules:
  - path: "*.json"
`
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(mockConfig)

      const loader = new ConfigLoader('.conflict-resolver.yml')

      await expect(loader.loadConfig()).rejects.toThrow(
        'must have a "strategy" field'
      )
    })

    it('should throw error for invalid conflictType', async () => {
      const mockConfig = `
rules:
  - path: "*.json"
    strategy: "ours"
    conflictType: "invalid-type"
`
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(mockConfig)

      const loader = new ConfigLoader('.conflict-resolver.yml')

      await expect(loader.loadConfig()).rejects.toThrow('invalid conflictType')
    })

    it('should accept all valid conflict types', async () => {
      const validTypes = [
        'both-modified',
        'both-added',
        'both-deleted',
        'added-by-us',
        'added-by-them',
        'deleted-by-us',
        'deleted-by-them'
      ]

      for (const conflictType of validTypes) {
        const mockConfig = `
rules:
  - path: "*.json"
    strategy: "ours"
    conflictType: "${conflictType}"
`
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(mockConfig)

        const loader = new ConfigLoader('.conflict-resolver.yml')
        const config = await loader.loadConfig()

        expect(config.rules[0].conflictType).toBe(conflictType)
      }
    })
  })
})
