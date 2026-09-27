import { mkdirSync, rmdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'fs';
import { join } from 'path';

/**
 * How long a `.lock.d` may exist WITHOUT a readable PID before we treat it as
 * orphaned rather than mid-acquire.
 *
 * The legitimate window between `mkdirSync` and `writeFileSync` is sub-
 * millisecond, so a lock dir that has sat pid-less for 30s did not come from a
 * live acquirer — it came from a process that died in that gap (or crashed
 * mid-write, leaving a 0-byte pid). Without this, such a lock is PERMANENT:
 * the pid-less/corrupt branches below return false forever and the stale-PID
 * reclaim further down is unreachable because it needs a parseable PID.
 */
const ORPHAN_LOCK_MS = 30_000;

/** Age in ms of the lock dir itself, or null if it cannot be stat'd. */
function lockAgeMs(lockDir: string): number | null {
  try {
    return Date.now() - statSync(lockDir).mtimeMs;
  } catch {
    return null;
  }
}

/** Reclaim an orphaned lock dir. Returns true only if we now hold it. */
function reclaimOrphanedLock(lockDir: string, pidFile: string): boolean {
  try {
    rmSync(lockDir, { recursive: true, force: true });
    mkdirSync(lockDir);
    writeFileSync(pidFile, String(process.pid));
    return true;
  } catch {
    // Another process beat us to the steal — let the caller retry.
    return false;
  }
}

/**
 * Acquire a mutex lock using mkdir (atomic on all filesystems).
 * Matches the bash pattern: mkdir .lock.d with PID tracking.
 *
 * Returns true if lock acquired, false if another process holds it.
 * Automatically recovers stale locks (dead process).
 */
export function acquireLock(dir: string): boolean {
  const lockDir = join(dir, '.lock.d');
  const pidFile = join(lockDir, 'pid');

  try {
    mkdirSync(lockDir);
    writeFileSync(pidFile, String(process.pid));
    return true;
  } catch (err) {
    // Only EEXIST means contention. EACCES / ENOSPC / EROFS / etc. are real
    // filesystem failures — propagate so the caller (withFileLockSync) does
    // not loop forever against a directory that will never be writable.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      throw err;
    }
    // mkdirSync failed with EEXIST — another process holds (or is mid-acquire
    // of) the lock.  We must NOT treat the gap between mkdirSync and
    // writeFileSync as "stale" — doing so allows two acquirers to interleave
    // and BOTH believe they hold the lock (the actual race that broke iter
    // 12).  When the PID file is missing, the holder is mid-acquire; the
    // caller should retry.
    let storedPidRaw: string;
    try {
      storedPidRaw = readFileSync(pidFile, 'utf-8').trim();
    } catch {
      // PID file not yet written.  Normally the holder is between mkdir and
      // writeFileSync, so refuse and let the caller retry.  But that gap is
      // sub-millisecond: if the dir has been pid-less for ORPHAN_LOCK_MS the
      // acquirer died in the gap and nothing else can ever recover this lock
      // (the stale-PID reclaim below needs a parseable PID), so reclaim it.
      const age = lockAgeMs(lockDir);
      if (age !== null && age > ORPHAN_LOCK_MS) {
        return reclaimOrphanedLock(lockDir, pidFile);
      }
      return false;
    }

    const storedPid = parseInt(storedPidRaw, 10);
    if (isNaN(storedPid) || storedPidRaw === '') {
      // Corrupt/empty PID file — same reasoning as the missing-PID case: a
      // live holder writes a valid PID immediately, so past ORPHAN_LOCK_MS
      // this is a crashed mid-write, not contention.  Reclaim rather than
      // deadlock forever.
      const age = lockAgeMs(lockDir);
      if (age !== null && age > ORPHAN_LOCK_MS) {
        return reclaimOrphanedLock(lockDir, pidFile);
      }
      return false;
    }

    // Check if process is still alive
    try {
      process.kill(storedPid, 0);
      // Process is alive - lock is held
      return false;
    } catch {
      // Process is dead - stale lock, remove and re-acquire atomically.
      return reclaimOrphanedLock(lockDir, pidFile);
    }
  }
}

/**
 * Release a mutex lock.
 */
export function releaseLock(dir: string): void {
  const lockDir = join(dir, '.lock.d');
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch {
    // Ignore errors on release
  }
}

/**
 * Inter-process lock options for `withFileLockSync`.
 */
export interface FileLockOptions {
  /** Total time to wait for the lock before throwing. Default 5000ms. */
  timeoutMs?: number;
  /** First retry delay; doubles up to maxBackoffMs. Default 5ms. */
  initialBackoffMs?: number;
  /** Cap on retry delay. Default 100ms. */
  maxBackoffMs?: number;
}

// SharedArrayBuffer + Atomics.wait gives us a clean cross-thread sleep
// from sync code without spinning the CPU.  One module-scoped buffer is
// reused across calls; we never write to it (only sleep on a wait that
// always times out at `ms`).
const SLEEP_SAB  = new SharedArrayBuffer(4);
const SLEEP_VIEW = new Int32Array(SLEEP_SAB);

/**
 * Acquire `dir`'s mutex, run `fn`, then release the lock — even if `fn`
 * throws.  Retries with exponential backoff (capped) until `timeoutMs`.
 *
 * Use this around any read-modify-write sequence on a per-agent file
 * (crons.json etc.) so two concurrent processes can't lose each other's
 * mutations between the read and the write (the atomic rename in
 * writeCrons is per-write only — it does NOT make the surrounding
 * read-modify-write transactional).
 *
 * @throws if the lock cannot be acquired within `timeoutMs`.
 */
export function withFileLockSync<T>(
  dir: string,
  fn: () => T,
  opts: FileLockOptions = {},
): T {
  const timeoutMs    = opts.timeoutMs        ?? 5_000;
  const initBackoff  = opts.initialBackoffMs ?? 5;
  const maxBackoff   = opts.maxBackoffMs     ?? 100;

  // Use process.hrtime.bigint() instead of Date.now() so the timeout works
  // under vi.useFakeTimers() (which freezes Date.now).  hrtime reads the
  // monotonic clock via syscall and is not stubbed by fake-timer libraries.
  const start = process.hrtime.bigint();
  const timeoutNs = BigInt(timeoutMs) * 1_000_000n;
  let backoff = initBackoff;

  while (!acquireLock(dir)) {
    if (process.hrtime.bigint() - start > timeoutNs) {
      throw new Error(
        `withFileLockSync: failed to acquire lock on "${dir}" within ${timeoutMs}ms`,
      );
    }
    Atomics.wait(SLEEP_VIEW, 0, 0, backoff);
    backoff = Math.min(backoff * 2, maxBackoff);
  }

  try {
    return fn();
  } finally {
    releaseLock(dir);
  }
}
