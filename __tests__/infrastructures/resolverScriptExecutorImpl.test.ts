import { describe, expect, it } from '@jest/globals'
import { ResolverScriptExecutorImpl } from '@infrastructures/resolverScriptExecutorImpl.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

describe('ResolverScriptExecutorImpl', () => {
  const executor = new ResolverScriptExecutorImpl(process.cwd())

  describe('determineStrategy', () => {
    it('returns a strategy from a bash resolver script and passes conflict context', async () => {
      // Act
      const result = await executor.determineStrategy(
        {
          path: 'package-lock.json',
          conflictType: ConflictType.BothModified
        },
        {
          path: '__fixtures__/resolver-scripts/context-aware.sh',
          shell: 'bash'
        }
      )

      // Assert
      expect(result).toEqual({
        type: 'strategy',
        strategy: ResolutionStrategy.Theirs
      })
    })

    it('returns manual when the resolver script prints manual', async () => {
      // Act
      const result = await executor.determineStrategy(
        {
          path: 'package-lock.json',
          conflictType: ConflictType.BothModified
        },
        {
          path: '__fixtures__/resolver-scripts/return-manual.sh',
          shell: 'bash'
        }
      )

      // Assert
      expect(result).toEqual({ type: 'manual' })
    })

    it('rejects when the resolver script returns an invalid decision', async () => {
      // Act / Assert
      await expect(
        executor.determineStrategy(
          {
            path: 'package-lock.json',
            conflictType: ConflictType.BothModified
          },
          {
            path: '__fixtures__/resolver-scripts/invalid-output.sh',
            shell: 'bash'
          }
        )
      ).rejects.toThrow("returned invalid resolution 'not-a-valid-resolution'")
    })

    it('rejects when the resolver script exits with an error', async () => {
      // Act / Assert
      await expect(
        executor.determineStrategy(
          {
            path: 'package-lock.json',
            conflictType: ConflictType.BothModified
          },
          {
            path: '__fixtures__/resolver-scripts/fail.sh',
            shell: 'bash'
          }
        )
      ).rejects.toThrow('failed with exit code 7')
    })
  })
})
