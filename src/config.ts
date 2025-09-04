import * as core from '@actions/core'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { ConflictResolverConfig, ConflictRule } from './types.js'

export class ConfigLoader {
  private configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath || '.conflict-resolver.yml'
  }

  async loadConfig(): Promise<ConflictResolverConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        core.warning(
          `Config file not found at ${this.configPath}. No automatic conflict resolution will be performed.`
        )
        return { rules: [] }
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8')
      const config = yaml.load(configContent) as ConflictResolverConfig

      this.validateConfig(config)

      core.info(
        `Loaded ${config.rules.length} conflict resolution rules from ${this.configPath}`
      )
      return config
    } catch (error) {
      if (error instanceof Error) {
        core.error(`Failed to load config: ${error.message}`)
      }
      throw error
    }
  }

  private validateConfig(config: ConflictResolverConfig): void {
    if (!config.rules || !Array.isArray(config.rules)) {
      throw new Error('Config must contain a "rules" array')
    }

    config.rules.forEach((rule, index) => {
      this.validateRule(rule, index)
    })
  }

  private validateRule(rule: ConflictRule, index: number): void {
    if (!rule.path) {
      throw new Error(`Rule at index ${index} must have a "path" field`)
    }

    if (!rule.strategy) {
      throw new Error(`Rule at index ${index} must have a "strategy" field`)
    }

    if (rule.strategy !== 'ours' && rule.strategy !== 'theirs') {
      throw new Error(
        `Rule at index ${index}: strategy must be either "ours" or "theirs"`
      )
    }

    if (rule.conflictType) {
      const validTypes = [
        'both-modified',
        'both-added',
        'both-deleted',
        'added-by-us',
        'added-by-them',
        'deleted-by-us',
        'deleted-by-them'
      ]
      if (!validTypes.includes(rule.conflictType)) {
        throw new Error(
          `Rule at index ${index}: invalid conflictType "${rule.conflictType}"`
        )
      }
    }
  }
}
