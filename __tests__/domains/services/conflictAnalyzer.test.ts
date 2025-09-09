import { ConflictAnalyzer } from '../../../src/domains/services/conflictAnalyzer.js'
import { ConflictedFile } from '../../../src/domains/entities/conflictedFile.js'
import { ConflictResolveRule } from '../../../src/domains/value-objects/conflictRule.js'
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
      const rules = [
        new ConflictResolveRule('*.ts', undefined, ResolutionStrategy.Manual),
        new ConflictResolveRule(
          'package-lock.json',
          undefined,
          ResolutionStrategy.Theirs
        ),
        new ConflictResolveRule('*.js', undefined, ResolutionStrategy.Ours)
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Theirs)
    })

    it('should find a matching rule with wildcard pattern', () => {
      const file = new ConflictedFile('src/index.ts', ConflictType.BothModified)
      const rules = [
        new ConflictResolveRule('src/**/*.ts', undefined, ResolutionStrategy.Manual),
        new ConflictResolveRule('*.json', undefined, ResolutionStrategy.Theirs)
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Manual)
    })

    it('should return undefined when no rule matches', () => {
      const file = new ConflictedFile('unknown.xml', ConflictType.BothModified)
      const rules = [
        new ConflictResolveRule('*.ts', undefined, ResolutionStrategy.Manual),
        new ConflictResolveRule('*.json', undefined, ResolutionStrategy.Theirs)
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeUndefined()
    })

    it('should match rule with specific conflict type', () => {
      const file = new ConflictedFile('test.ts', ConflictType.DeletedByUs)
      const rules = [
        new ConflictResolveRule('*.ts', 'both-modified', ResolutionStrategy.Manual),
        new ConflictResolveRule('*.ts', 'deleted-by-us', ResolutionStrategy.Ours)
      ]

      const matchingRule = analyzer.findMatchingRule(file, rules)

      expect(matchingRule).toBeDefined()
      expect(matchingRule?.strategy).toBe(ResolutionStrategy.Ours)
    })
  })

  describe('determineStrategy', () => {
    it('should return the strategy of matching rule', () => {
      const file = new ConflictedFile('package.json', ConflictType.BothModified)
      const rules = [
        new ConflictResolveRule('*.json', undefined, ResolutionStrategy.Theirs)
      ]

      const strategy = analyzer.determineStrategy(file, rules)

      expect(strategy).toBe(ResolutionStrategy.Theirs)
    })

    it('should return Manual strategy when no rule matches', () => {
      const file = new ConflictedFile('unknown.xml', ConflictType.BothModified)
      const rules = [
        new ConflictResolveRule('*.ts', undefined, ResolutionStrategy.Ours),
        new ConflictResolveRule('*.json', undefined, ResolutionStrategy.Theirs)
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
