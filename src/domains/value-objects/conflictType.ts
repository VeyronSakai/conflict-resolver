export enum ConflictType {
  BothModified = 'both-modified', // UU
  DeletedByUs = 'deleted-by-us', // DU
  DeletedByThem = 'deleted-by-them', // UD
  BothAdded = 'both-added', // AA
  DeletedByBoth = 'deleted-by-both', // DD (typically occurs in rename/rename conflicts)
  AddedByUs = 'added-by-us', // AU (typically occurs in rename/rename conflicts)
  AddedByThem = 'added-by-them' // UA (typically occurs in rename/rename conflicts)
}
