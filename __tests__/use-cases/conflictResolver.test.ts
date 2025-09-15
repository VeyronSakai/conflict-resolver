import { jest, describe, expect, it } from '@jest/globals'
import { ConflictResolver } from '@use-cases/conflictResolver.js'
import { ConfigRepositoryStub } from '../test-doubles/configRepositoryStub.js'
import { GitRepositoryStub } from '../test-doubles/gitRepositoryStub.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

// Note: @actions/core mocking is disabled due to ESM module constraints
// The tests focus on business logic validation rather than logging verification

describe('ConflictResolver', () => {
  describe('resolve', () => {
    it('should return empty result when no conflicts exist', async () => {
      // Arrange
      const configRepositoryStub = new ConfigRepositoryStub([])
      const gitRepositoryStub = new GitRepositoryStub()
      gitRepositoryStub.setConflictedFiles([])
      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should resolve conflicts based on rules', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: 'package-lock.json',
          strategy: ResolutionStrategy.Theirs
        }
      ]
      const configRepositoryStub = new ConfigRepositoryStub(rules)
      const gitRepositoryStub = new GitRepositoryStub()
      const conflicts = [
        { path: 'package-lock.json', conflictType: ConflictType.BothModified },
        { path: 'src/index.ts', conflictType: ConflictType.BothModified }
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)
      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual(['package-lock.json'])
      expect(result.unresolvedFiles).toEqual(['src/index.ts'])

      const resolvedFiles = gitRepositoryStub.getResolvedFiles()
      expect(resolvedFiles.get('package-lock.json')).toBe(
        ResolutionStrategy.Theirs
      )
      expect(resolvedFiles.has('src/index.ts')).toBe(false)

      const stagedFiles = gitRepositoryStub.getStagedFiles()
      expect(stagedFiles.has('package-lock.json')).toBe(true)
      expect(stagedFiles.has('src/index.ts')).toBe(false)
    })

    it('should handle files without matching rules as manual', async () => {
      // Arrange
      const configRepositoryStub = new ConfigRepositoryStub([])
      const gitRepositoryStub = new GitRepositoryStub()
      const conflicts = [
        { path: 'unknown.xml', conflictType: ConflictType.BothModified }
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)
      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['unknown.xml'])
    })

    it('should resolve multiple files with same rule', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: '*.generated.ts',
          strategy: ResolutionStrategy.Theirs
        }
      ]
      const configRepositoryStub = new ConfigRepositoryStub(rules)
      const gitRepositoryStub = new GitRepositoryStub()
      const conflicts = [
        { path: 'file1.generated.ts', conflictType: ConflictType.BothModified },
        { path: 'file2.generated.ts', conflictType: ConflictType.BothModified },
        { path: 'file3.generated.ts', conflictType: ConflictType.BothModified }
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)
      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
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

      const resolvedFiles = gitRepositoryStub.getResolvedFiles()
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

    it('should handle resolution errors gracefully', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: 'error-file.ts',
          strategy: ResolutionStrategy.Ours
        }
      ]
      const configRepositoryStub = new ConfigRepositoryStub(rules)
      const gitRepositoryStub = new GitRepositoryStub()
      const conflicts = [
        { path: 'error-file.ts', conflictType: ConflictType.BothModified }
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      // Mock the resolveConflict to throw an error
      gitRepositoryStub.resolveConflict = jest
        .fn<typeof gitRepositoryStub.resolveConflict>()
        .mockRejectedValue(new Error('Git error'))

      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['error-file.ts'])
    })

    it('should log summary with resolved and unresolved files', async () => {
      // Arrange
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]
      const configRepositoryStub = new ConfigRepositoryStub(rules)
      const gitRepositoryStub = new GitRepositoryStub()
      const conflicts = [
        { path: 'resolved1.json', conflictType: ConflictType.BothModified },
        { path: 'resolved2.json', conflictType: ConflictType.BothModified },
        { path: 'manual.ts', conflictType: ConflictType.BothModified }
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)
      const conflictResolver = new ConflictResolver(
        configRepositoryStub,
        gitRepositoryStub
      )

      // Act
      const result = await conflictResolver.resolve()

      // Assert
      expect(result.resolvedFiles).toEqual(['resolved1.json', 'resolved2.json'])
      expect(result.unresolvedFiles).toEqual(['manual.ts'])

      const resolvedFiles = gitRepositoryStub.getResolvedFiles()
      expect(resolvedFiles.size).toBe(2)
      expect(resolvedFiles.has('manual.ts')).toBe(false)
    })
  })
})
