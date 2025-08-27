import * as core from '@actions/core'
import { ConflictResolver } from './conflict-resolver.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configPath = core.getInput('config-path')

    core.info('Starting Git Conflict Resolver')
    core.info(
      `Config path: ${configPath || '.conflict-resolver.yml (default)'}`
    )

    const resolver = new ConflictResolver(configPath)
    const result = await resolver.resolve()

    // Set outputs for other workflow steps to use
    core.setOutput('resolved-files', result.resolvedFiles.join(','))
    core.setOutput('unresolved-files', result.unresolvedFiles.join(','))

    if (result.unresolvedFiles.length > 0) {
      core.warning(
        `${result.unresolvedFiles.length} files still have conflicts and require manual resolution`
      )
    } else if (result.resolvedFiles.length > 0) {
      core.info('All conflicts resolved successfully!')
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
