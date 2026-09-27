// Imported first by the CLI: node:sqlite prints an ExperimentalWarning on load. The API is
// stable enough for us and pinned to one Node line; the warning would only alarm users.
const emit = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning.message;
  if (/SQLite is an experimental feature/.test(text)) return;
  (emit as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;
