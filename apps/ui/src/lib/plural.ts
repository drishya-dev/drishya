/** Formats an integer count with its singular or plural noun. */
export const pluralWord = (count: number, one: string, many = `${one}s`): string => (count === 1 ? one : many);

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${pluralWord(count, one, many)}`;
