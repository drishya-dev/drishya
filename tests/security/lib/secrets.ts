// SEC-3: one fake secret per redaction rule. All invented for this suite; none is a real credential.
export interface Canary {
  /** The redaction rule that must catch it (the `rule` id `redactText` reports). */
  rule: string;
  /** The text as it would appear in a prompt, command or output. */
  text: string;
  /** The part that must never be found anywhere afterwards. */
  needle: string;
}

const c = (rule: string, needle: string, text = needle): Canary => ({ rule, text, needle });
const alnum = 'q7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIuYtReEwQ';

export const CANARIES: Canary[] = [
  c('private-key', 'MIIEowIBAAKCAQEAq7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIuYtReEwQcanary', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAq7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIuYtReEwQcanary\n-----END RSA PRIVATE KEY-----'),
  c('aws-access-key', 'AKIAZ7QX4K2M9W3PL6TB'),
  c('github-token', 'ghp_' + alnum.slice(0, 36)),
  c('anthropic-key', 'sk-ant-api03-' + alnum.slice(0, 30)),
  c('openai-key', 'sk-proj-' + alnum),
  c('nvidia-key', 'nvapi-' + alnum.slice(0, 30)),
  c('google-api-key', 'AIza' + 'Sy' + alnum.slice(0, 33)),
  c('slack-token', 'xoxb-1234567890-' + alnum.slice(0, 14)),
  c('stripe-key', 'sk_live_' + alnum.slice(0, 24)),
  c('npm-token', 'npm_' + alnum.slice(0, 36)),
  c('hf-token', 'hf_' + alnum.slice(0, 34)),
  c('pypi-token', 'pypi-AgEIcHlwaS5vcmcCJ' + alnum.slice(0, 40)),
  c('gitlab-token', 'glpat-' + alnum.slice(0, 24)),
  c('docker-token', 'dckr_pat_' + alnum.slice(0, 27)),
  c('digitalocean-token', 'dop_v1_' + 'a3f9c2e87b1d4056a3f9c2e87b1d4056'),
  c('sendgrid-key', 'SG.' + alnum.slice(0, 22) + '.' + alnum.slice(10, 40)),
  c('twilio-key', 'SK' + 'a3f9c2e87b1d4056a3f9c2e87b1d4056', 'twilio api key SKa3f9c2e87b1d4056a3f9c2e87b1d4056'),
  c('shopify-token', 'shpat_' + 'a3f9c2e87b1d4056a3f9c2e87b1d4056'),
  c('azure-storage-key', 'Zm9vYmFyYmF6cXV4cXV1eGNhbmFyeUtleTEyMzQ1Njc4OTBhYmNkZWY=', 'DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=Zm9vYmFyYmF6cXV4cXV1eGNhbmFyeUtleTEyMzQ1Njc4OTBhYmNkZWY=;'),
  c('databricks-token', 'dapi' + 'a3f9c2e87b1d4056a3f9c2e87b1d4056'),
  c('linear-token', 'lin_api_' + alnum + 'AB'),
  c('notion-token', 'secret_' + alnum + 'ABCDEFGH'),
  c('jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV'),
  c('discord-token', 'MTAxMjM0NTY3ODkwMTIzNDU2.GxYzAb.q7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIu'),
  c('bearer', 'q7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIu', 'Authorization: Bearer q7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIu'),
  c('url-credentials', 'hunter2canaryPW', 'postgres://admin:hunter2canaryPW@db.internal.example:5432/app'),
  c('secret-assignment', 'x9Kq2Lm7Vb4Tn8Rw3Zc6Yp1', 'db_password = "x9Kq2Lm7Vb4Tn8Rw3Zc6Yp1"'),
  // The link the CLI prints (and opens) carries the launch token in its fragment, so an agent's shell output can hold it.
  c('secret-assignment', 'Zk3q9XvLm2Rt7YpWa5NcB8dE', 'Open:  http://127.0.0.1:7878/#token=Zk3q9XvLm2Rt7YpWa5NcB8dE'),
];
