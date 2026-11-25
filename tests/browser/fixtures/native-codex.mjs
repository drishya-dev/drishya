switch (JSON.stringify(process.argv.slice(2))) {
  case '["app-server","--help"]':
    console.log('codex app-server --listen');
    break;
  case '["login","status"]':
    console.log('Logged in using a test stub');
    break;
  default:
    console.error('drishya test stub: only metadata probes are answered');
    process.exitCode = 1;
}
