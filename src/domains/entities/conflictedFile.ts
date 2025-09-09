import { ConflictType } from '../value-objects/conflictType.js'

export class ConflictedFile {
  constructor(
    public readonly path: string,
    public readonly conflictType: ConflictType
  ) {}

  isModified(): boolean {
    return (
      this.conflictType === ConflictType.BothModified ||
      this.conflictType === ConflictType.AddedByUs ||
      this.conflictType === ConflictType.AddedByThem
    )
  }

  isDeleted(): boolean {
    return (
      this.conflictType === ConflictType.DeletedByUs ||
      this.conflictType === ConflictType.DeletedByThem
    )
  }

  isAdded(): boolean {
    return this.conflictType === ConflictType.BothAdded
  }
}
