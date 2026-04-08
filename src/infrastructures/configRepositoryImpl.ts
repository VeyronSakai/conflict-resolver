import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import { ConfigRepository } from '@domains/repositories/configRepository.js'
import { ConflictResolveRule } from '@domains/value-objects/conflictResolveRule.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'
import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'

type YamlRule = {
  paths?: string
  conflict_type?: string
  strategy?: string
  resolver_script?: {
    path?: string
    shell?: string
  }
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
      const config = yaml.load(configContent)

      this.validateConfig(config)

      core.info(
        `Loaded ${config.rules.length} conflict resolution rules from ${this.configPath}`
      )

      return config.rules.map((rule) => this.parseRule(rule))
    } catch (error) {
      core.error(`Failed to load config: ${error}`)
      throw new Error(`Configuration loading failed: ${error}`)
    }
  }

  private validateConfig(config: unknown): asserts config is YamlConfig {
    if (
      !config ||
      typeof config !== 'object' ||
      !('rules' in config) ||
      !Array.isArray(config.rules)
    ) {
      throw new Error('Config must contain a "rules" array')
    }

    for (const rule of config.rules) {
      this.validateRule(rule)
    }
  }

  private validateRule(rule: unknown): void {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Each rule must be an object')
    }

    const yamlRule = rule as YamlRule

    if (!yamlRule.paths || typeof yamlRule.paths !== 'string') {
      throw new Error('Each rule must have a "paths" field')
    }

    const hasStrategy = typeof yamlRule.strategy === 'string'
    const hasResolverScript = yamlRule.resolver_script !== undefined

    if (hasStrategy === hasResolverScript) {
      throw new Error(
        'Each rule must specify exactly one of "strategy" or "resolver_script"'
      )
    }

    if (hasStrategy) {
      this.parseStrategy(yamlRule.strategy!)
      if (yamlRule.conflict_type) {
        this.parseConflictType(yamlRule.conflict_type)
      }
      return
    }

    if (yamlRule.conflict_type) {
      this.parseConflictType(yamlRule.conflict_type)
    }
    this.parseResolverScript(yamlRule.resolver_script)
  }

  private parseRule(rule: YamlRule): ConflictResolveRule {
    const conflictType = rule.conflict_type
      ? this.parseConflictType(rule.conflict_type)
      : undefined

    if (rule.strategy) {
      return {
        targetPathPattern: rule.paths!,
        conflictType,
        resolution: {
          type: 'strategy',
          strategy: this.parseStrategy(rule.strategy)
        }
      }
    }

    return {
      targetPathPattern: rule.paths!,
      conflictType,
      resolution: {
        type: 'resolver-script',
        resolverScript: this.parseResolverScript(rule.resolver_script)
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

  private parseConflictType(conflictType: string): ConflictType {
    const validConflictTypes = Object.values(ConflictType)
    if (validConflictTypes.includes(conflictType as ConflictType)) {
      return conflictType as ConflictType
    }
    throw new Error(`Invalid conflict_type: ${conflictType}`)
  }

  private parseResolverScript(
    resolverScript: YamlRule['resolver_script']
  ): ResolverScript {
    if (
      !resolverScript ||
      typeof resolverScript !== 'object' ||
      !resolverScript.path ||
      typeof resolverScript.path !== 'string' ||
      !resolverScript.shell ||
      typeof resolverScript.shell !== 'string'
    ) {
      throw new Error(
        '"resolver_script" must contain both "path" and "shell" fields'
      )
    }

    const resolvedPath = path.resolve(process.cwd(), resolverScript.path)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Resolver script not found at ${resolverScript.path}`)
    }

    return {
      path: resolverScript.path,
      shell: resolverScript.shell
    }
  }
}
