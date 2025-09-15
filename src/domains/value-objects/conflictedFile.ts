import { ConflictType } from './conflictType.js'

export type ConflictedFile = {
  readonly path: string
  readonly conflictType: ConflictType
}