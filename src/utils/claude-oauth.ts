/**
 * Cross-platform read of the Claude Code Max-plan OAuth token.
 *
 * macOS: Claude Code stores credentials in the login Keychain
 * (service "Claude Code-credentials"). Linux/other: it stores the same JSON
 * at ~/.claude/.credentials.json. Both shapes are
 * `{ claudeAiOauth: { accessToken: "sk-ant-oat…" } }`.
 *
 * Returns '' when no credential is available so callers can fall back to
 * an explicit ANTHROPIC_API_KEY or a suppressed-path stub.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

function fromKeychain(): string {
  try {
    const out = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-a', os.userInfo().username, '-w'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return JSON.parse(out)?.claudeAiOauth?.accessToken || '';
  } catch {
    return '';
  }
}

function fromCredentialsFile(): string {
  try {
    const p = path.join(os.homedir(), '.claude', '.credentials.json');
    const out = fs.readFileSync(p, 'utf-8');
    return JSON.parse(out)?.claudeAiOauth?.accessToken || '';
  } catch {
    return '';
  }
}

export function readClaudeOauthToken(): string {
  if (process.platform === 'darwin') {
    // Keychain first (authoritative on macOS), file as a secondary.
    return fromKeychain() || fromCredentialsFile();
  }
  return fromCredentialsFile();
}
