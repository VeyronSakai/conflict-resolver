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

  describe('determineStrategy', () => {
    describe('basic pattern matching', () => {
      it('should return the strategy of matching rule', () => {
        // Arrange
        const file: ConflictedFile = {
          path: 'package.json',
          conflictType: ConflictType.BothModified
        }
        const rules: ConflictResolveRule[] = [
          { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
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
          {
            targetPathPattern: 'package-lock.json',
            strategy: ResolutionStrategy.Theirs
          },
          { targetPathPattern: '*.json', strategy: ResolutionStrategy.Ours }
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
          {
            targetPathPattern: 'src/**/*.tsx',
            strategy: ResolutionStrategy.Ours
          }
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
          {
            targetPathPattern: 'src/**/*.ts',
            strategy: ResolutionStrategy.Ours
          },
          { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Theirs }
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
          {
            targetPathPattern: '*.ts',
            conflictType: ConflictType.BothModified,
            strategy: ResolutionStrategy.Theirs
          },
          {
            targetPathPattern: '*.ts',
            conflictType: ConflictType.DeletedByUs,
            strategy: ResolutionStrategy.Ours
          }
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
          {
            targetPathPattern: '*.ts',
            conflictType: ConflictType.DeletedByUs,
            strategy: ResolutionStrategy.Ours
          }
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
          {
            targetPathPattern: '*.ts',
            strategy: ResolutionStrategy.Theirs
          }
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
            {
              targetPathPattern: '*.ts',
              conflictType,
              strategy: ResolutionStrategy.Ours
            }
          ]

          // Act
          const strategy = analyzer.determineStrategy(file, rules)

          // Assert
          expect(strategy).toBe(ResolutionStrategy.Ours)
        })
      })

      it('should return undefined for unsupported conflict types (DD, AU, UA)', () => {
        // Arrange
        const unsupportedConflictTypes = [
          ConflictType.DeletedByBoth, // DD
          ConflictType.AddedByUs, // AU
          ConflictType.AddedByThem // UA
        ]

        unsupportedConflictTypes.forEach((conflictType) => {
          // Arrange
          const file: ConflictedFile = {
            path: 'test.ts',
            conflictType
          }
          const rules: ConflictResolveRule[] = [
            {
              targetPathPattern: '*.ts',
              strategy: ResolutionStrategy.Ours
            }
          ]

          // Act
          const strategy = analyzer.determineStrategy(file, rules)

          // Assert
          expect(strategy).toBeUndefined()
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
          { targetPathPattern: '*.ts', strategy: ResolutionStrategy.Ours },
          { targetPathPattern: '*.json', strategy: ResolutionStrategy.Theirs }
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
          {
            targetPathPattern: 'dist/**/*.min.js',
            strategy: ResolutionStrategy.Theirs
          }
        ]

        // Act
        const strategy = analyzer.determineStrategy(file, rules)

        // Assert
        expect(strategy).toBe(ResolutionStrategy.Theirs)
      })
    })
  })
})
