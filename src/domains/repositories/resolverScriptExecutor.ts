import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export type ResolverScriptExecutionResult =
  | {
      readonly type: 'strategy'
      readonly strategy: ResolutionStrategy
    }
  | {
      readonly type: 'manual'
    }

export interface ResolverScriptExecutor {
  determineStrategy(
    file: ConflictedFile,
    resolverScript: ResolverScript
  ): Promise<ResolverScriptExecutionResult>
}
