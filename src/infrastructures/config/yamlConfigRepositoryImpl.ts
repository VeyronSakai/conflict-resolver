import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import { ConfigRepository } from '../../domains/repositories/configRepository.js'
import { ConflictResolveRule } from '../../domains/value-objects/conflictResolveRule.js'
import { ResolutionStrategy } from '../../domains/value-objects/resolutionStrategy.js'

interface YamlRule {
  file_pattern: string
  conflict_type?: string
  strategy: string
  description?: string
}

interface YamlConfig {
  rules: YamlRule[]
}

export class YamlConfigRepositoryImpl implements ConfigRepository {
  constructor(private configPath: string = '.conflict-resolver.yml') {}

  async loadRules(): Promise<ConflictResolveRule[]> {
    try {
      if (!fs.existsSync(this.configPath)) {
        core.warning(
          `Config file not found at ${this.configPath}. No automatic conflict resolution will be performed.`
        )
        return []
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8')
      const config = yaml.load(configContent) as YamlConfig

      this.validateConfig(config)

      core.info(
        `Loaded ${config.rules.length} conflict resolution rules from ${this.configPath}`
      )

      return config.rules.map(
        (rule) =>
          new ConflictResolveRule(
            rule.file_pattern,
            rule.conflict_type,
            this.parseStrategy(rule.strategy),
            rule.description
          )
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
      if (!rule.file_pattern) {
        throw new Error('Each rule must have a "file_pattern" field')
      }
      if (!rule.strategy) {
        throw new Error('Each rule must have a "strategy" field')
      }
      if (!['ours', 'theirs', 'manual'].includes(rule.strategy)) {
        throw new Error(
          `Invalid strategy "${rule.strategy}". Must be "ours", "theirs", or "manual"`
        )
      }
    }
  }

  private parseStrategy(strategy: string): ResolutionStrategy {
    switch (strategy) {
      case 'ours':
        return ResolutionStrategy.Ours
      case 'theirs':
        return ResolutionStrategy.Theirs
      case 'manual':
        return ResolutionStrategy.Manual
      default:
        throw new Error(`Invalid strategy: ${strategy}`)
    }
  }
}
