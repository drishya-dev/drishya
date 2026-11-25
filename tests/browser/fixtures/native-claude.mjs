switch (JSON.stringify(process.argv.slice(2))) {
  case '["--help"]':
    console.log('Usage: claude --input-format --output-format --permission-prompt-tool --replay-user-messages');
    break;
  case '["auth","status","--json"]':
    console.log('{"loggedIn":true}');
    break;
  default:
    console.error('drishya test stub: only metadata probes are answered');
    process.exitCode = 1;
}
