import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as fs from 'fs'
import { ConfigLoader } from '../src/config.js'

jest.mock('fs')
jest.mock('@actions/core')

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

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
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

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
        ;(fs.existsSync as jest.Mock).mockReturnValue(true)
        ;(fs.readFileSync as jest.Mock).mockReturnValue(mockConfig)

        const loader = new ConfigLoader('.conflict-resolver.yml')
        const config = await loader.loadConfig()

        expect(config.rules[0].conflictType).toBe(conflictType)
      }
    })
  })
})
