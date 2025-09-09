import * as core from '@actions/core'
import { ActionHandler } from './presentations/github-actions/actionHandler.js'
import { ConflictResolver } from './use-cases/conflictResolver.js'
import { ConfigRepositoryImpl } from './infrastructures/config/configRepositoryImpl.js'
import { GitRepositoryImpl } from './infrastructures/git/gitRepositoryImpl.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // Dependency Injection Container
  const configPath =
    core.getInput('config-path') || '.github/conflict-resolver.yml'

  // Create infrastructure implementations
  const configRepository = new ConfigRepositoryImpl(configPath)
  const gitRepository = new GitRepositoryImpl()

  // Create use-case with injected dependencies
  const conflictResolver = new ConflictResolver(configRepository, gitRepository)

  // Create and run presentation layer
  const actionHandler = new ActionHandler(conflictResolver)
  await actionHandler.run()
}
