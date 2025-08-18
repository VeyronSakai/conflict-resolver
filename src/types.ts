export type ResolutionStrategy = 'ours' | 'theirs'

export type ConflictType =
  | 'both-modified' // UU
  | 'both-added' // AA
  | 'both-deleted' // DD
  | 'added-by-us' // AU
  | 'added-by-them' // UA
  | 'deleted-by-us' // DU
  | 'deleted-by-them' // UD

export interface ConflictRule {
  path: string
  strategy: ResolutionStrategy
  conflictType?: ConflictType
}

export interface ConflictResolverConfig {
  rules: ConflictRule[]
}

export interface ConflictedFile {
  path: string
  statusCode: string
  conflictType?: ConflictType
}

export interface ResolutionResult {
  resolvedFiles: string[]
  unresolvedFiles: string[]
}
