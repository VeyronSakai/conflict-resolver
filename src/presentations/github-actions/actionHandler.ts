import * as core from '@actions/core'
import { ConflictResolver } from '../../use-cases/conflictResolver.js'

export class ActionHandler {
  constructor(private conflictResolver: ConflictResolver) {}

  async run(): Promise<void> {
    try {
      core.info('Starting Git Conflict Resolver')

      const configPath = core.getInput('config-path')
      if (configPath) {
        core.info(`Config path: ${configPath}`)
      } else {
        core.info('Config path: .conflict-resolver.yml (default)')
      }

      const result = await this.conflictResolver.resolve()

      this.setOutputs(result.resolvedFiles, result.unresolvedFiles)
      this.logFinalStatus(result.resolvedFiles, result.unresolvedFiles)
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(error.message)
      } else {
        core.setFailed('An unknown error occurred')
      }
    }
  }

  private setOutputs(resolvedFiles: string[], unresolvedFiles: string[]): void {
    core.setOutput('resolved-files', resolvedFiles.join(','))
    core.setOutput('unresolved-files', unresolvedFiles.join(','))
  }

  private logFinalStatus(
    resolvedFiles: string[],
    unresolvedFiles: string[]
  ): void {
    if (unresolvedFiles.length > 0) {
      core.warning(
        `${unresolvedFiles.length} files still have conflicts and require manual resolution`
      )
    } else if (resolvedFiles.length > 0) {
      core.info('All conflicts resolved successfully!')
    }
  }
}
