export enum ConflictType {
  BothModified = 'both-modified', // UU
  DeletedByUs = 'deleted-by-us', // DU
  DeletedByThem = 'deleted-by-them', // UD
  BothAdded = 'both-added', // AA
  DeletedByBoth = 'deleted-by-both', // DD
  AddedByUs = 'added-by-us', // AU
  AddedByThem = 'added-by-them' // UA
}
