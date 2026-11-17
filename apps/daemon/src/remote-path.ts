/**
 * SEC-4b: a folder named by a journal is the journal's claim, not the reader's. On Windows a path that begins with two
 * separators (`\\host\share`, `//host/share`, `\\?\UNC\host\share`, `\\.\pipe\name`) is opened over the network or as a
 * device, so merely checking that it exists contacts another machine or opens a device. Nothing recorded may reach the file
 * system as such a path before the reader has approved that workspace; afterwards the approval flow refuses it too.
 * Elsewhere the same spelling is an ordinary local path.
 */
export const isNetworkOrDevicePath = (path: string): boolean => /^[\\/]{2}/.test(path);

/** True when `path` must not be checked on this machine before approval. */
export const isUnsafeRecordedPath = (path: string, platform: string = process.platform): boolean => platform === 'win32' && isNetworkOrDevicePath(path);
