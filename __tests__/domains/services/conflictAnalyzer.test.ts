import { ConflictAnalyzer } from '../../../src/domains/services/conflictAnalyzer.js'
import { ConflictedFile } from '../../../src/domains/entities/conflictedFile.js'
import type { ConflictResolveRule } from '../../../src/domains/value-objects/conflictResolveRule.js'
import { ConflictType } from '../../../src/domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '../../../src/domains/value-objects/resolutionStrategy.js'

describe('ConflictAnalyzer', () => {
  let analyzer: ConflictAnalyzer

  beforeEach(() => {
    analyzer = new ConflictAnalyzer()
  })

  describe('findMatchingRule', () => {
    it('should find a matching rule based on file pattern', () => {
      const file = new ConflictedFile(
        'package-lock.json',
        ConflictType.BothModified
      )
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Manual },
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
      const file = new ConflictedFile('src/index.ts', ConflictType.BothModified)
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: 'src/**/*.ts',
          strategy: ResolutionStrategy.Manual
        },
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Manual)
    })

    it('should return undefined when no rule matches', () => {
      const file = new ConflictedFile('unknown.xml', ConflictType.BothModified)
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Manual },
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeUndefined()
    })

    it('should match rule with specific conflict type', () => {
      const file = new ConflictedFile('test.ts', ConflictType.DeletedByUs)
      const rules: ConflictResolveRule[] = [
        {
          targetPathPattern: '*.ts',
          conflictType: 'both-modified',
          strategy: ResolutionStrategy.Manual
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
      const file = new ConflictedFile('package.json', ConflictType.BothModified)
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBe(ResolutionStrategy.Theirs)
    })

    it('should return Manual strategy when no rule matches', () => {
      const file = new ConflictedFile('unknown.xml', ConflictType.BothModified)
      const rules: ConflictResolveRule[] = [
        { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Ours },
        { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
      ]

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBe(ResolutionStrategy.Manual)
    })

    it('should return Manual strategy when rules array is empty', () => {
      const file = new ConflictedFile('test.ts', ConflictType.BothModified)
      const rules: ConflictResolveRule[] = []

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBe(ResolutionStrategy.Manual)
    })
  })
})
