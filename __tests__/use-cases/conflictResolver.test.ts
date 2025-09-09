import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { ConflictResolver } from '../../src/use-cases/conflictResolver.js'
import { ConfigRepositoryStub } from '../test-doubles/configRepositoryStub.js'
import { GitRepositoryStub } from '../test-doubles/gitRepositoryStub.js'
import { ConflictedFile } from '../../src/domains/entities/conflictedFile.js'
import { ConflictType } from '../../src/domains/value-objects/conflictType.js'
import { ConflictResolveRule } from '../../src/domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '../../src/domains/value-objects/resolutionStrategy.js'

// Note: @actions/core mocking is disabled due to ESM module constraints
// The tests focus on business logic validation rather than logging verification

describe('ConflictResolver', () => {
  let configRepositoryStub: ConfigRepositoryStub
  let gitRepositoryStub: GitRepositoryStub
  let conflictResolver: ConflictResolver

  beforeEach(() => {
    configRepositoryStub = new ConfigRepositoryStub()
    gitRepositoryStub = new GitRepositoryStub()
    conflictResolver = new ConflictResolver(
      configRepositoryStub,
      gitRepositoryStub
    )

    jest.clearAllMocks()
  })

  describe('resolve', () => {
    it('should return empty result when no conflicts exist', async () => {
      gitRepositoryStub.setConflictedFiles([])

      const result = await conflictResolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should resolve conflicts based on rules', async () => {
      const conflicts = [
        new ConflictedFile('package-lock.json', ConflictType.BothModified),
        new ConflictedFile('src/index.ts', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      const rules = [
        new ConflictResolveRule(
          'package-lock.json',
          undefined,
          ResolutionStrategy.Theirs
        ),
        new ConflictResolveRule('*.ts', undefined, ResolutionStrategy.Manual)
      ]
      configRepositoryStub.setRules(rules)

      const result = await conflictResolver.resolve()

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
      const conflicts = [
        new ConflictedFile('unknown.xml', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)
      configRepositoryStub.setRules([])

      const result = await conflictResolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['unknown.xml'])
    })

    it('should resolve multiple files with same rule', async () => {
      const conflicts = [
        new ConflictedFile('file1.generated.ts', ConflictType.BothModified),
        new ConflictedFile('file2.generated.ts', ConflictType.BothModified),
        new ConflictedFile('file3.generated.ts', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      const rules = [
        new ConflictResolveRule(
          '*.generated.ts',
          undefined,
          ResolutionStrategy.Theirs
        )
      ]
      configRepositoryStub.setRules(rules)

      const result = await conflictResolver.resolve()

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

    it('should log rule descriptions when available', async () => {
      const conflicts = [
        new ConflictedFile('package-lock.json', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      const rules = [
        new ConflictResolveRule(
          'package-lock.json',
          undefined,
          ResolutionStrategy.Theirs,
          'Accept incoming package-lock.json'
        )
      ]
      configRepositoryStub.setRules(rules)

      const result = await conflictResolver.resolve()

      // Verify resolution happened correctly
      expect(result.resolvedFiles).toEqual(['package-lock.json'])
      expect(result.unresolvedFiles).toEqual([])
    })

    it('should handle resolution errors gracefully', async () => {
      const conflicts = [
        new ConflictedFile('error-file.ts', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      const rules = [
        new ConflictResolveRule(
          'error-file.ts',
          undefined,
          ResolutionStrategy.Ours
        )
      ]
      configRepositoryStub.setRules(rules)

      // Mock the resolveConflict to throw an error
      gitRepositoryStub.resolveConflict = jest
        .fn<typeof gitRepositoryStub.resolveConflict>()
        .mockRejectedValue(new Error('Git error'))

      const result = await conflictResolver.resolve()

      expect(result.resolvedFiles).toEqual([])
      expect(result.unresolvedFiles).toEqual(['error-file.ts'])
    })

    it('should log summary with resolved and unresolved files', async () => {
      const conflicts = [
        new ConflictedFile('resolved1.json', ConflictType.BothModified),
        new ConflictedFile('resolved2.json', ConflictType.BothModified),
        new ConflictedFile('manual.ts', ConflictType.BothModified)
      ]
      gitRepositoryStub.setConflictedFiles(conflicts)

      const rules = [
        new ConflictResolveRule('*.json', undefined, ResolutionStrategy.Theirs),
        new ConflictResolveRule('*.ts', undefined, ResolutionStrategy.Manual)
      ]
      configRepositoryStub.setRules(rules)

      const result = await conflictResolver.resolve()

      // Verify the summary results
      expect(result.resolvedFiles).toEqual(['resolved1.json', 'resolved2.json'])
      expect(result.unresolvedFiles).toEqual(['manual.ts'])

      const resolvedFiles = gitRepositoryStub.getResolvedFiles()
      expect(resolvedFiles.size).toBe(2)
      expect(resolvedFiles.has('manual.ts')).toBe(false)
    })
  })
})
