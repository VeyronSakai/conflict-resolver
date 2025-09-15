import { ConflictType } from '../value-objects/conflictType.js'

export type ConflictedFile = {
  readonly path: string
  readonly conflictType: ConflictType
}
