import { describe, expect, it } from '@jest/globals'
import { ConflictResolver } from '@use-cases/conflictResolver.js'
import { StubConfigRepository } from '../test-doubles/stubConfigRepository.js'
import { SpyGitRepository } from '../test-doubles/spyGitRepository.js'
import { StubResolverScriptExecutor } from '../test-doubles/stubResolverScriptExecutor.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'

// Note: @actions/core mocking is disabled due to ESM module constraints
// The tests focus on business logic validation rather than logging verification

const createStrategyRule = (
  targetPathPattern: string,
  strategy: ResolutionStrategy,
  conflictType?: ConflictType
): ConflictResolveRule => ({
  targetPathPattern,
  conflictType,
  resolution: {
    type: 'strategy',
    strategy
  }
})

const createScriptRule = (
  targetPathPattern: string,
  resolverScript: ResolverScript,
  conflictType?: ConflictType
): ConflictResolveRule => ({
  targetPathPattern,
  conflictType,
  resolution: {
    type: 'resolver-script',
    resolverScript
  }
})

const createConflictResolver = (
  rules: ConflictResolveRule[],
  conflicts: Array<{ path: string; conflictType: ConflictType }>,
  resolverScriptExecutor: StubResolverScriptExecutor = new StubResolverScriptExecutor()
) => {
  const stubConfigRepository = new StubConfigRepository(rules)
  const spyGitRepository = new SpyGitRepository(conflicts)
  const conflictResolver = new ConflictResolver(
    stubConfigRepository,
    spyGitRepository,
    resolverScriptExecutor
  )

  return { conflictResolver, spyGitRepository, resolverScriptExecutor }
}

describe('ConflictResolver', () => {
  describe('resolve', () => {
    it('should return empty result when no conflicts exist', async () => {
      // Arrange
      const { conflictResolver } = createConflictResolver([], [])

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should resolve conflicts based on rules', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        createStrategyRule('package-lock.json', ResolutionStrategy.Theirs)
      ]
      const conflicts = [
        { path: 'package-lock.json', conflictType: ConflictType.BothModified },
        { path: 'src/index.ts', conflictType: ConflictType.BothModified }
      ]
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual(['package-lock.json'])
      expect(result.unresolvedFiles).toEqual(['src/index.ts'])

      const resolvedFiles = spyGitRepository.getResolvedFiles()
      expect(resolvedFiles.get('package-lock.json')).toBe(
        ResolutionStrategy.Theirs
      )
      expect(resolvedFiles.has('src/index.ts')).toBe(false)

      const stagedFiles = spyGitRepository.getStagedFiles()
      expect(stagedFiles.has('package-lock.json')).toBe(true)
      expect(stagedFiles.has('src/index.ts')).toBe(false)
    })

    it('should handle files without matching rules as manual', async () => {
      // Arrange
      const conflicts = [
        { path: 'unknown.xml', conflictType: ConflictType.BothModified }
      ]
      const { conflictResolver } = createConflictResolver([], conflicts)

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['unknown.xml'])
    })

    it('should resolve multiple files with same rule', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        createStrategyRule('*.generated.ts', ResolutionStrategy.Theirs)
      ]
      const conflicts = [
        { path: 'file1.generated.ts', conflictType: ConflictType.BothModified },
        { path: 'file2.generated.ts', conflictType: ConflictType.BothModified },
        { path: 'file3.generated.ts', conflictType: ConflictType.BothModified }
      ]
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([
        'file1.generated.ts',
        'file2.generated.ts',
        'file3.generated.ts'
      ])
      expect(result.unresolvedFiles).toEqual([])

      const resolvedFiles = spyGitRepository.getResolvedFiles()
      expect(resolvedFiles.size).toBe(3)
      expect(resolvedFiles.get('file1.generated.ts')).toBe(
        ResolutionStrategy.Theirs
      )
      expect(resolvedFiles.get('file2.generated.ts')).toBe(
        ResolutionStrategy.Theirs
      )
      expect(resolvedFiles.get('file3.generated.ts')).toBe(
        ResolutionStrategy.Theirs
      )
    })

    it('should log summary with resolved and unresolved files', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        createStrategyRule('*.json', ResolutionStrategy.Theirs)
      ]
      const conflicts = [
        { path: 'resolved1.json', conflictType: ConflictType.BothModified },
        { path: 'resolved2.json', conflictType: ConflictType.BothModified },
        { path: 'manual.ts', conflictType: ConflictType.BothModified }
      ]
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual(['resolved1.json', 'resolved2.json'])
      expect(result.unresolvedFiles).toEqual(['manual.ts'])

      const resolvedFiles = spyGitRepository.getResolvedFiles()
      expect(resolvedFiles.size).toBe(2)
      expect(resolvedFiles.has('manual.ts')).toBe(false)
    })

    it('should resolve rename/delete conflict when rule matches', async () => {
      // Arrange
      const path = '__tests__/test-conflict-files/rename-vs-delete-base.txt'
      const rules: ConflictResolveRule[] = [
        createStrategyRule(
          '**/rename-vs-delete-base.txt',
          ResolutionStrategy.Theirs,
          ConflictType.DeletedByThem
        )
      ]
      const conflicts = [{ path, conflictType: ConflictType.DeletedByThem }]
      const { conflictResolver } = createConflictResolver(rules, conflicts)

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([path])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should resolve rename/delete conflict with ours strategy when rule matches', async () => {
      // Arrange
      const path = '__tests__/test-conflict-files/rename-vs-delete-base-2.txt'
      const rules: ConflictResolveRule[] = [
        createStrategyRule(
          '**/rename-vs-delete-base-2.txt',
          ResolutionStrategy.Ours,
          ConflictType.DeletedByThem
        )
      ]
      const conflicts = [{ path, conflictType: ConflictType.DeletedByThem }]
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([path])
      expect(result.unresolvedFiles).toEqual([])

      const resolvedFiles = spyGitRepository.getResolvedFiles()
      expect(resolvedFiles.get(path)).toBe(ResolutionStrategy.Ours)
    })

    it('should auto-resolve rename/rename conflicts (DD, AU, UA) with ours strategy', async () => {
      // Arrange
      const renameTxt = '__tests__/test-conflict-files/rename.txt'
      const renameBaseTxt = '__tests__/test-conflict-files/rename-base.txt'
      const renameIncomingTxt =
        '__tests__/test-conflict-files/rename-incoming.txt'

      const rules: ConflictResolveRule[] = [
        createStrategyRule(
          '**/rename.txt',
          ResolutionStrategy.Ours,
          ConflictType.DeletedByBoth
        ),
        createStrategyRule(
          '**/rename-base.txt',
          ResolutionStrategy.Ours,
          ConflictType.AddedByUs
        ),
        createStrategyRule(
          '**/rename-incoming.txt',
          ResolutionStrategy.Ours,
          ConflictType.AddedByThem
        )
      ]
      const conflicts = [
        { path: renameTxt, conflictType: ConflictType.DeletedByBoth },
        { path: renameBaseTxt, conflictType: ConflictType.AddedByUs },
        { path: renameIncomingTxt, conflictType: ConflictType.AddedByThem }
      ]
      const { conflictResolver } = createConflictResolver(rules, conflicts)

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([
        renameTxt,
        renameBaseTxt,
        renameIncomingTxt
      ])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should resolve conflicts with a delegated script rule', async () => {
      // Arrange
      const resolverScript: ResolverScript = {
        path: '.github/conflict-resolver/rules/branch-aware.sh',
        shell: 'bash'
      }
      const rules: ConflictResolveRule[] = [
        createScriptRule('package-lock.json', resolverScript)
      ]
      const conflicts = [
        { path: 'package-lock.json', conflictType: ConflictType.BothModified }
      ]
      const resolverScriptExecutor = new StubResolverScriptExecutor({
        resultsByPath: {
          'package-lock.json': {
            type: 'strategy',
            strategy: ResolutionStrategy.Theirs
          }
        }
      })
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts,
        resolverScriptExecutor
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual(['package-lock.json'])
      expect(result.unresolvedFiles).toEqual([])
      expect(spyGitRepository.getResolvedFiles().get('package-lock.json')).toBe(
        ResolutionStrategy.Theirs
      )
      expect(resolverScriptExecutor.getCalls()).toEqual([
        {
          file: {
            path: 'package-lock.json',
            conflictType: ConflictType.BothModified
          },
          resolverScript
        }
      ])
    })

    it('should leave conflicts unresolved when a delegated script returns manual', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        createScriptRule('package-lock.json', {
          path: '.github/conflict-resolver/rules/branch-aware.sh',
          shell: 'bash'
        })
      ]
      const conflicts = [
        { path: 'package-lock.json', conflictType: ConflictType.BothModified }
      ]
      const resolverScriptExecutor = new StubResolverScriptExecutor({
        resultsByPath: {
          'package-lock.json': { type: 'manual' }
        }
      })
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts,
        resolverScriptExecutor
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['package-lock.json'])
      expect(spyGitRepository.getResolvedFiles().size).toBe(0)
    })

    it('should leave conflicts unresolved when delegated script execution fails', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        createScriptRule('package-lock.json', {
          path: '.github/conflict-resolver/rules/branch-aware.sh',
          shell: 'bash'
        })
      ]
      const conflicts = [
        { path: 'package-lock.json', conflictType: ConflictType.BothModified }
      ]
      const resolverScriptExecutor = new StubResolverScriptExecutor({
        errorsByPath: {
          'package-lock.json': new Error('script failed')
        }
      })
      const { conflictResolver, spyGitRepository } = createConflictResolver(
        rules,
        conflicts,
        resolverScriptExecutor
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['package-lock.json'])
      expect(spyGitRepository.getResolvedFiles().size).toBe(0)
    })
  })
})
