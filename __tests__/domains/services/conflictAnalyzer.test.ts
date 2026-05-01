import { ConflictAnalyzer } from '@domains/services/conflictAnalyzer.js'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import type { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'

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

describe('ConflictAnalyzer', () => {
  let analyzer: ConflictAnalyzer

  beforeEach(() => {
    analyzer = new ConflictAnalyzer()
  })

  describe('determineStrategy', () => {
    describe('basic pattern matching', () => {
      it('should return the strategy of matching rule', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'package.json',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('*.json', ResolutionStrategy.Theirs)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Theirs)
      })

      it('should match exact file path', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'package-lock.json',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('package-lock.json', ResolutionStrategy.Theirs),
          createStrategyRule('*.json', ResolutionStrategy.Ours)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Theirs)
      })

      it('should match wildcard patterns', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'src/components/Button.tsx',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('src/**/*.tsx', ResolutionStrategy.Ours)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Ours)
      })

      it('should return first matching rule when multiple rules match', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'src/index.ts',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('src/**/*.ts', ResolutionStrategy.Ours),
          createStrategyRule('*.ts', ResolutionStrategy.Theirs)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Ours)
      })
    })

    describe('conflict type matching', () => {
      it('should match rule with specific conflict type', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'test.ts',
          conflictType: ConflictType.DeletedByUs
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule(
            '*.ts',
            ResolutionStrategy.Theirs,
            ConflictType.BothModified
          ),
          createStrategyRule(
            '*.ts',
            ResolutionStrategy.Ours,
            ConflictType.DeletedByUs
          )
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Ours)
      })

      it('should not match rule with different conflict type', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'test.ts',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule(
            '*.ts',
            ResolutionStrategy.Ours,
            ConflictType.DeletedByUs
          )
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBeUndefined()
      })

      it('should match rule without conflict type for any conflict', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'test.ts',
          conflictType: ConflictType.DeletedByThem
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('*.ts', ResolutionStrategy.Theirs)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Theirs)
      })

      it('should handle all conflict types', () => {
        // Arrange
        const conflictTypes = [
          ConflictType.BothModified,
          ConflictType.DeletedByUs,
          ConflictType.DeletedByThem,
          ConflictType.BothAdded
        ]

        conflictTypes.forEach((conflictType) => {
          // Arrange
          const file: ConflictedFile = {
            path: 'test.ts',
            conflictType
          }
          const rules: ConflictResolveRule[] = [
            createStrategyRule('*.ts', ResolutionStrategy.Ours, conflictType)
          ]

          // Act
          const strategy = analyzer.determineStrategy(file, rules)

          // Assert
          expect(strategy).toBe(ResolutionStrategy.Ours)
        })
      })

      it('should support rename/rename conflict types (DD, AU, UA) when rule matches', () => {
        // Arrange
        const renameRenameConflictTypes = [
          ConflictType.DeletedByBoth, // DD
          ConflictType.AddedByUs, // AU
          ConflictType.AddedByThem // UA
        ]

        renameRenameConflictTypes.forEach((conflictType) => {
          const file: ConflictedFile = {
            path: 'test.ts',
            conflictType
          }
          const rules: ConflictResolveRule[] = [
            createStrategyRule('*.ts', ResolutionStrategy.Ours, conflictType)
          ]

          // Act
          const strategy = analyzer.determineStrategy(file, rules)

          // Assert
          expect(strategy).toBe(ResolutionStrategy.Ours)
        })
      })
    })

    describe('edge cases', () => {
      it('should return undefined when no rule matches', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'unknown.xml',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('*.ts', ResolutionStrategy.Ours),
          createStrategyRule('*.json', ResolutionStrategy.Theirs)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBeUndefined()
      })

      it('should return undefined when rules array is empty', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'test.ts',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = []

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBeUndefined()
      })

      it('should handle complex glob patterns', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'dist/bundle.min.js',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createStrategyRule('dist/**/*.min.js', ResolutionStrategy.Theirs)
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Theirs)
      })

      it('should not return a static strategy for delegated rules', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'src/index.ts',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          createScriptRule('src/**/*.ts', {
            path: '.github/conflict-resolver/rules/branch-aware.sh',
            shell: 'bash'
          })
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBeUndefined()
      })
    })
  })

  describe('findMatchingRule', () => {
    it('should return a delegated rule when path and conflict type match', () => {
      // Arrange
      const file: ConflictedFile = {
        path: 'src/index.ts',
        conflictType: ConflictType.BothModified
      }
      const resolverScript: ResolverScript = {
        path: '.github/conflict-resolver/rules/branch-aware.sh',
        shell: 'bash'
      }
      const rules: ConflictResolveRule[] = [
        createScriptRule(
          'src/**/*.ts',
          resolverScript,
          ConflictType.BothModified
        )
      ]

      // Act
      const matchingRule = analyzer.findMatchingRule(file, rules)

      // Assert
      expect(matchingRule).toEqual(
        createScriptRule(
          'src/**/*.ts',
          resolverScript,
          ConflictType.BothModified
        )
      )
    })
  })
})
