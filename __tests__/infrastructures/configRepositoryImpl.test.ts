import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from '@jest/globals'
import { ConfigRepositoryImpl } from '@infrastructures/configRepositoryImpl.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

const tempDirectories: string[] = []

const createConfigFile = (content: string): string => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'conflict-resolver-config-')
  )
  tempDirectories.push(tempDirectory)

  const configPath = path.join(tempDirectory, 'conflict-resolver.yml')
  fs.writeFileSync(configPath, content)

  return configPath
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop()
    if (tempDirectory) {
      fs.rmSync(tempDirectory, { recursive: true, force: true })
    }
  }
})

describe('ConfigRepositoryImpl', () => {
  describe('loadRules', () => {
    it('loads static strategy rules', async () => {
      // Arrange
      const configPath = createConfigFile(`
rules:
  - paths: 'package-lock.json'
    conflict_type: 'both-modified'
    strategy: 'theirs'
`)
      const repository = new ConfigRepositoryImpl(configPath)

      // Act
      const rules = await repository.loadRules()

      // Assert
      expect(rules).toEqual([
        {
          targetPathPattern: 'package-lock.json',
          conflictType: ConflictType.BothModified,
          resolution: {
            type: 'strategy',
            strategy: ResolutionStrategy.Theirs
          }
        }
      ])
    })

    it('loads delegated resolver script rules using repository-root relative paths', async () => {
      // Arrange
      const configPath = createConfigFile(`
rules:
  - paths: 'package-lock.json'
    resolver_script:
      path: '__fixtures__/resolver-scripts/context-aware.sh'
      shell: 'bash'
`)
      const repository = new ConfigRepositoryImpl(configPath)

      // Act
      const rules = await repository.loadRules()

      // Assert
      expect(rules).toEqual([
        {
          targetPathPattern: 'package-lock.json',
          resolution: {
            type: 'resolver-script',
            resolverScript: {
              path: '__fixtures__/resolver-scripts/context-aware.sh',
              shell: 'bash'
            }
          }
        }
      ])
    })

    it('rejects rules that specify both strategy and resolver_script', async () => {
      // Arrange
      const configPath = createConfigFile(`
rules:
  - paths: 'package-lock.json'
    strategy: 'theirs'
    resolver_script:
      path: '__fixtures__/resolver-scripts/context-aware.sh'
      shell: 'bash'
`)
      const repository = new ConfigRepositoryImpl(configPath)

      // Act / Assert
      await expect(repository.loadRules()).rejects.toThrow(
        'Each rule must specify exactly one of "strategy" or "resolver_script"'
      )
    })

    it('rejects delegated rules when resolver_script is missing shell', async () => {
      // Arrange
      const configPath = createConfigFile(`
rules:
  - paths: 'package-lock.json'
    resolver_script:
      path: '__fixtures__/resolver-scripts/context-aware.sh'
`)
      const repository = new ConfigRepositoryImpl(configPath)

      // Act / Assert
      await expect(repository.loadRules()).rejects.toThrow(
        '"resolver_script" must contain both "path" and "shell" fields'
      )
    })

    it('rejects invalid conflict types', async () => {
      // Arrange
      const configPath = createConfigFile(`
rules:
  - paths: 'package-lock.json'
    conflict_type: 'not-a-real-conflict'
    strategy: 'theirs'
`)
      const repository = new ConfigRepositoryImpl(configPath)

      // Act / Assert
      await expect(repository.loadRules()).rejects.toThrow(
        'Invalid conflict_type: not-a-real-conflict'
      )
    })
  })
})
