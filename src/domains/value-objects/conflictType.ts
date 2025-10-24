export enum ConflictType {
  BothModified = 'both-modified', // UU
  DeletedByUs = 'deleted-by-us', // DU
  DeletedByThem = 'deleted-by-them', // UD
  BothAdded = 'both-added', // AA
  DeletedByBoth = 'deleted-by-both', // DD (rename/rename - not supported for auto-resolution)
  AddedByUs = 'added-by-us', // AU (rename/rename - not supported for auto-resolution)
  AddedByThem = 'added-by-them', // UA (rename/rename - not supported for auto-resolution)
  Unknown = 'unknown' // Unknown conflict type - not supported for auto-resolution
}
