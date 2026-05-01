import { ResolutionStrategy } from '@domains/value-objects/resolutionStrategy.js'
import { ResolverScript } from '@domains/value-objects/resolverScript.js'

export type StaticConflictRuleResolution = {
  readonly type: 'strategy'
  readonly strategy: ResolutionStrategy
}

export type ScriptConflictRuleResolution = {
  readonly type: 'resolver-script'
  readonly resolverScript: ResolverScript
}

export type ConflictRuleResolution =
  | StaticConflictRuleResolution
  | ScriptConflictRuleResolution
