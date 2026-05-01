import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import {
  ResolverScriptExecutionResult,
  ResolverScriptExecutor
} from '@domains/repositories/resolverScriptExecutor.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'

type StubResolverScriptExecutorOptions = {
  resultsByPath?: Record<string, ResolverScriptExecutionResult>
  errorsByPath?: Record<string, Error>
}

export class StubResolverScriptExecutor implements ResolverScriptExecutor {
  private readonly resultsByPath: Map<string, ResolverScriptExecutionResult>
  private readonly errorsByPath: Map<string, Error>
  private readonly calls: Array<{
    file: ConflictedFile
    resolverScript: ResolverScript
  }> = []

  constructor(options: StubResolverScriptExecutorOptions = {}) {
    this.resultsByPath = new Map(Object.entries(options.resultsByPath ?? {}))
    this.errorsByPath = new Map(Object.entries(options.errorsByPath ?? {}))
  }

  async determineStrategy(
    file: ConflictedFile,
    resolverScript: ResolverScript
  ): Promise<ResolverScriptExecutionResult> {
    this.calls.push({ file, resolverScript })

    const error = this.errorsByPath.get(file.path)
    if (error) {
      throw error
    }

    return this.resultsByPath.get(file.path) ?? { type: 'manual' }
  }

  getCalls(): Array<{ file: ConflictedFile; resolverScript: ResolverScript }> {
    return this.calls
  }
}
