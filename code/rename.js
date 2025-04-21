function rename(oldPath, newPath) {
  if (oldPath === newPath) {
    return true;
  }
  
  inMemory.set(newPath, inMemory.get(oldPath));
  inMemory.delete(oldPath);

  return true;
}