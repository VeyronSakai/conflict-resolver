import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import { ConfigRepository } from '@domains/repositories/configRepository.js'
import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'

type YamlRule = {
  paths: string
  conflict_type?: string
  strategy: string
}

type YamlConfig = {
  rules: YamlRule[]
}

export class ConfigRepositoryImpl implements ConfigRepository {
  constructor(private configPath: string = '.github/conflict-resolver.yml') {}

  async loadRules(): Promise<ConflictResolveRule[]> {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Config file not found at ${this.configPath}`)
    }

    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8')
      const config = yaml.load(configContent) as YamlConfig

      this.validateConfig(config)

      core.info(
        `Loaded ${config.rules.length} conflict resolution rules from ${this.configPath}`
      )

      return config.rules.map(
        (rule) =>
          ({
            targetPathPattern: rule.paths,
            conflictType: rule.conflict_type,
            strategy: this.parseStrategy(rule.strategy)
          }) as ConflictResolveRule
      )
    } catch (error) {
      core.error(`Failed to load config: ${error}`)
      throw new Error(`Configuration loading failed: ${error}`)
    }
  }

  private validateConfig(config: YamlConfig): void {
    if (!config.rules || !Array.isArray(config.rules)) {
      throw new Error('Config must contain a "rules" array')
    }

    for (const rule of config.rules) {
      if (!rule.paths) {
        throw new Error('Each rule must have a "paths" field')
      }

      if (!rule.strategy) {
        throw new Error('Each rule must have a "strategy" field')
      }
    }
  }

  private parseStrategy(strategy: string): ResolutionStrategy {
    const validStrategies = Object.values(ResolutionStrategy)
    if (validStrategies.includes(strategy as ResolutionStrategy)) {
      return strategy as ResolutionStrategy
    }
    throw new Error(`Invalid strategy: ${strategy}`)
  }
}
