import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import {
  ResolverScriptExecutionResult,
  ResolverScriptExecutor
} from '@domains/repositories/resolverScriptExecutor.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

export class ResolverScriptExecutorImpl implements ResolverScriptExecutor {
  constructor(private readonly workspacePath: string = process.cwd()) {}

  async determineStrategy(
    file: ConflictedFile,
    resolverScript: ResolverScript
  ): Promise<ResolverScriptExecutionResult> {
    const absoluteScriptPath = path.resolve(
      this.workspacePath,
      resolverScript.path
    )

    if (!fs.existsSync(absoluteScriptPath)) {
      throw new Error(`Resolver script not found at ${resolverScript.path}`)
    }

    let stdout = ''
    let stderr = ''

    const command = this.buildCommand(resolverScript.shell, absoluteScriptPath)
    const exitCode = await exec.exec(command.command, command.args, {
      cwd: this.workspacePath,
      env: {
        ...process.env,
        CONFLICT_RESOLVER_FILE_PATH: file.path,
        CONFLICT_RESOLVER_CONFLICT_TYPE: file.conflictType,
        CONFLICT_RESOLVER_REPO_ROOT: this.workspacePath,
        CONFLICT_RESOLVER_SCRIPT_PATH: resolverScript.path,
        CONFLICT_RESOLVER_SCRIPT_SHELL: resolverScript.shell
      },
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
        stderr: (data: Buffer) => {
          stderr += data.toString()
        }
      },
      silent: true
    })

    if (exitCode !== 0) {
      const stderrOutput = stderr.trim()
      throw new Error(
        stderrOutput
          ? `Resolver script '${resolverScript.path}' failed with exit code ${exitCode}: ${stderrOutput}`
          : `Resolver script '${resolverScript.path}' failed with exit code ${exitCode}`
      )
    }

    const decision = this.getLastNonEmptyLine(stdout)

    switch (decision) {
      case ResolutionStrategy.Ours:
        return { type: 'strategy', strategy: ResolutionStrategy.Ours }
      case ResolutionStrategy.Theirs:
        return { type: 'strategy', strategy: ResolutionStrategy.Theirs }
      case 'manual':
        return { type: 'manual' }
      case undefined:
        throw new Error(
          `Resolver script '${resolverScript.path}' did not output a resolution`
        )
      default:
        throw new Error(
          `Resolver script '${resolverScript.path}' returned invalid resolution '${decision}'`
        )
    }
  }

  private buildCommand(
    shell: string,
    absoluteScriptPath: string
  ): { command: string; args: string[] } {
    if (shell === 'pwsh') {
      return { command: shell, args: ['-File', absoluteScriptPath] }
    }

    return { command: shell, args: [absoluteScriptPath] }
  }

  private getLastNonEmptyLine(output: string): string | undefined {
    return output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .at(-1)
  }
}
