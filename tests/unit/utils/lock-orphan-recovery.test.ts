import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, utimesSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { acquireLock, releaseLock } from '../../../src/utils/lock';

/**
 * Regression tests for the permanently-poisoned inbox lock.
 *
 * `acquireLock` mkdirs `.lock.d` and *then* writes the pid file. If a process
 * dies between those two calls the dir is left with a missing (or 0-byte) pid.
 * Every later acquire then hit a `return false` that no code path could undo:
 * the stale-PID reclaim needs a parseable PID, so it was unreachable.
 *
 * `checkInbox` calls `acquireLock` bare and turns `false` into `[]`, so the
 * lock did not merely block — it made a full inbox report as an empty one.
 * Observed in the wild: an agent inbox poisoned for five weeks while every
 * check returned "empty" and 213 messages accumulated unread.
 */
describe('acquireLock — orphaned lock recovery', () => {
  let testDir: string;
  const ORPHAN_AGE_MS = 60_000; // comfortably past the 30s threshold

  const lockDir = () => join(testDir, '.lock.d');
  const pidFile = () => join(lockDir(), 'pid');

  const backdate = (ms: number) => {
    const t = new Date(Date.now() - ms);
    utimesSync(lockDir(), t, t);
  };

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'cortextos-lock-orphan-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('reclaims a lock dir left with NO pid file (acquirer died mid-acquire)', () => {
    mkdirSync(lockDir());
    backdate(ORPHAN_AGE_MS);

    expect(acquireLock(testDir)).toBe(true);
    expect(readFileSync(pidFile(), 'utf-8').trim()).toBe(String(process.pid));

    releaseLock(testDir);
  });

  it('reclaims a lock dir left with a 0-byte pid file (crashed mid-write)', () => {
    mkdirSync(lockDir());
    writeFileSync(pidFile(), '');
    backdate(ORPHAN_AGE_MS);

    expect(acquireLock(testDir)).toBe(true);
    expect(readFileSync(pidFile(), 'utf-8').trim()).toBe(String(process.pid));

    releaseLock(testDir);
  });

  it('reclaims a lock dir whose pid file is corrupt (non-numeric)', () => {
    mkdirSync(lockDir());
    writeFileSync(pidFile(), 'not-a-pid');
    backdate(ORPHAN_AGE_MS);

    expect(acquireLock(testDir)).toBe(true);
    releaseLock(testDir);
  });

  // --- guards: recovery must NOT reintroduce the interleaving race it replaced ---

  it('does NOT steal a FRESH pid-less lock (holder is genuinely mid-acquire)', () => {
    mkdirSync(lockDir()); // no backdate: this is the real sub-ms window

    expect(acquireLock(testDir)).toBe(false);
    expect(existsSync(pidFile())).toBe(false);

    rmSync(lockDir(), { recursive: true, force: true });
  });

  it('does NOT steal a lock held by a LIVE process', () => {
    mkdirSync(lockDir());
    writeFileSync(pidFile(), String(process.pid));
    backdate(ORPHAN_AGE_MS); // old, but the owner is alive — age must not override liveness

    expect(acquireLock(testDir)).toBe(false);
    expect(readFileSync(pidFile(), 'utf-8').trim()).toBe(String(process.pid));

    rmSync(lockDir(), { recursive: true, force: true });
  });

  it('recovered lock behaves normally afterwards (acquire → release → re-acquire)', () => {
    mkdirSync(lockDir());
    backdate(ORPHAN_AGE_MS);

    expect(acquireLock(testDir)).toBe(true);
    releaseLock(testDir);
    expect(existsSync(lockDir())).toBe(false);

    expect(acquireLock(testDir)).toBe(true);
    releaseLock(testDir);
  });
});
