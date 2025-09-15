export enum ConflictType {
  BothModified = 'both-modified', // UU
  DeletedByUs = 'deleted-by-us', // DU
  DeletedByThem = 'deleted-by-them', // UD
  BothAdded = 'both-added' // AA
}
