import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describeImage } from '../../../src/telegram/describe-image.js';

describe('describeImage', () => {
  const savedEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klavon-describe-image-'));
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('returns null when CTX_TELEGRAM_NO_VISION=1', async () => {
    process.env.CTX_TELEGRAM_NO_VISION = '1';
    process.env.ANTHROPIC_API_KEY = 'sk-anything';
    const file = path.join(tmpDir, 'x.jpg');
    fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff]));

    const result = await describeImage(file);

    expect(result).toBeNull();
  });

  it('returns null when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CTX_TELEGRAM_NO_VISION;
    const file = path.join(tmpDir, 'x.jpg');
    fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff]));

    const result = await describeImage(file);

    expect(result).toBeNull();
  });

  it('returns null when the file does not exist', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-anything';
    delete process.env.CTX_TELEGRAM_NO_VISION;
    const result = await describeImage(path.join(tmpDir, 'nope.jpg'));
    expect(result).toBeNull();
  });

  it('returns null when the file extension is not a supported image type', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-anything';
    delete process.env.CTX_TELEGRAM_NO_VISION;
    const file = path.join(tmpDir, 'thing.bmp');
    fs.writeFileSync(file, Buffer.from([0x42, 0x4d]));

    const result = await describeImage(file);

    expect(result).toBeNull();
  });

  it('returns null when the imagePath argument is empty', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-anything';
    delete process.env.CTX_TELEGRAM_NO_VISION;
    const result = await describeImage('');
    expect(result).toBeNull();
  });
});
