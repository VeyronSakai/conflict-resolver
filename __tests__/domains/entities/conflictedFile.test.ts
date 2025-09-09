import { ConflictedFile } from '@domains/entities/conflictedFile.js'
import { ConflictType } from '@domains/value-objects/conflictType.js'

describe('ConflictedFile', () => {
  describe('isModified', () => {
    it('should return true for BothModified conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.BothModified)
      expect(file.isModified()).toBe(true)
    })

    it('should return true for AddedByUs conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.AddedByUs)
      expect(file.isModified()).toBe(true)
    })

    it('should return true for AddedByThem conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.AddedByThem)
      expect(file.isModified()).toBe(true)
    })

    it('should return false for DeletedByUs conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.DeletedByUs)
      expect(file.isModified()).toBe(false)
    })
  })

  describe('isDeleted', () => {
    it('should return true for DeletedByUs conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.DeletedByUs)
      expect(file.isDeleted()).toBe(true)
    })

    it('should return true for DeletedByThem conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.DeletedByThem)
      expect(file.isDeleted()).toBe(true)
    })

    it('should return false for BothModified conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.BothModified)
      expect(file.isDeleted()).toBe(false)
    })
  })

  describe('isAdded', () => {
    it('should return true for BothAdded conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.BothAdded)
      expect(file.isAdded()).toBe(true)
    })

    it('should return false for BothModified conflict', () => {
      const file = new ConflictedFile('test.ts', ConflictType.BothModified)
      expect(file.isAdded()).toBe(false)
    })
  })
})
