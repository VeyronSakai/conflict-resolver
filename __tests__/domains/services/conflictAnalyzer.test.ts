import { ConflictAnalyzer } from '@domains/services/conflictAnalyzer.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

describe('ConflictAnalyzer', () => {
  let analyzer: ConflictAnalyzer

  beforeEach(() => {
    analyzer = new ConflictAnalyzer()
  })

  describe('findMatchingRule', () => {
    it('should find a matching rule based on file pattern', () => {
      const file: ConflictedFile = {
        path: 'package-lock.json',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: 'package-lock.json',
          strategy: ResolutionStrategy.Theirs
        },
        { targetPathPattern: '*.js', strategy: ResolutionStrategy.Ours }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Theirs)
    })

    it('should find a matching rule with wildcard pattern', () => {
      const file: ConflictedFile = {
        path: 'src/index.ts',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: 'src/**/*.ts',
          strategy: ResolutionStrategy.Ours
        },
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Ours)
    })

    it('should return undefined when no rule matches', () => {
      const file: ConflictedFile = {
        path: 'unknown.xml',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeUndefined()
    })

    it('should match rule with specific conflict type', () => {
      const file: ConflictedFile = {
        path: 'test.ts',
        conflictType: ConflictType.DeletedByUs
      }
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: '*.ts',
          conflictType: 'both-modified',
          strategy: ResolutionStrategy.Ours
        },
        {
          targetPathPattern: '*.ts',
          conflictType: 'deleted-by-us',
          strategy: ResolutionStrategy.Ours
        }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Ours)
    })
  })

  describe('determineStrategy', () => {
    it('should return the strategy of matching rule', () => {
      const file: ConflictedFile = {
        path: 'package.json',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBe(ResolutionStrategy.Theirs)
    })

    it('should return undefined when no rule matches', () => {
      const file: ConflictedFile = {
        path: 'unknown.xml',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Ours },
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBeUndefined()
    })

    it('should return undefined when rules array is empty', () => {
      const file: ConflictedFile = {
        path: 'test.ts',
        conflictType: ConflictType.BothModified
      }
      const rules: ConflictResolveRule[] = []

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBeUndefined()
    })
  })
})
