/**
 * Carries a finished result into the next tool ("Continue with Compress PDF")
 * without making the user download and re-upload it.
 */
let pending: File[] | null = null;

export function handOff(files: File[]): void {
  pending = files;
}

export function takeHandOff(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
