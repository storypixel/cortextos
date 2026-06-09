/**
 * Image description via Anthropic vision API.
 *
 * The raw image path cannot be injected into the agent's message because
 * claude-code auto-attaches local image files referenced by path, which
 * triggers `API Error: 400 image/png not supported` and wedges the
 * session. So we pre-call vision here, get a text description back, and
 * inject the description instead.
 *
 * Returns null on any failure (missing API key, network error, timeout,
 * unsupported file). The caller treats null as "no description available"
 * and falls back to the original suppressed-path message.
 *
 * Disable entirely with CTX_TELEGRAM_NO_VISION=1.
 * Override model with CTX_VISION_MODEL (default: claude-haiku-4-5).
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_PROMPT =
  'Describe this image in 2-4 sentences. Focus on what is visually present: ' +
  'subjects, layout, any visible text, any UI elements with their labels and ' +
  'state. Be specific. Skip aesthetic judgment and adjectives.';

export interface DescribeImageOptions {
  timeoutMs?: number;
  model?: string;
  prompt?: string;
  log?: (line: string) => void;
}

function extToMediaType(p: string): string | null {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return null;
}

/**
 * Generate a text description of an image. Returns the description, or
 * null if vision is disabled / unavailable / failed.
 */
export async function describeImage(
  imagePath: string,
  opts: DescribeImageOptions = {},
): Promise<string | null> {
  if (process.env.CTX_TELEGRAM_NO_VISION === '1') return null;
  if (!imagePath || !fs.existsSync(imagePath)) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const log = opts.log || (() => {});
  const mediaType = extToMediaType(imagePath);
  if (!mediaType) {
    log(`[describe-image] unsupported extension for ${imagePath} — skipping`);
    return null;
  }

  const model = opts.model || process.env.CTX_VISION_MODEL || DEFAULT_MODEL;
  const prompt = opts.prompt || DEFAULT_PROMPT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let data: Buffer;
  try {
    data = fs.readFileSync(imagePath);
  } catch (err) {
    log(`[describe-image] read failed (${(err as Error).message}) — skipping`);
    return null;
  }

  const base64 = data.toString('base64');
  const body = {
    model,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Claude Code OAuth tokens (sk-ant-oat...) are NOT valid x-api-key values —
  // the endpoint returns `authentication_error: invalid x-api-key`. They must
  // be sent as a Bearer token with the oauth beta header instead. Workspace
  // API keys (sk-ant-api...) continue to use x-api-key. This lets vision work
  // off the daemon's OAuth token (the ecosystem.config.js readClaudeOauthToken
  // fallback) when no workspace key is present, instead of silently failing.
  const isOAuth = apiKey.startsWith('sk-ant-oat');
  const authHeaders: Record<string, string> = isOAuth
    ? { authorization: `Bearer ${apiKey}`, 'anthropic-beta': 'oauth-2025-04-20' }
    : { 'x-api-key': apiKey };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...authHeaders,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      log(`[describe-image] HTTP ${resp.status}: ${text.slice(0, 200)} — skipping`);
      return null;
    }

    const json = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const block = (json.content || []).find((c) => c.type === 'text');
    const text = (block?.text || '').trim();
    return text || null;
  } catch (err) {
    log(`[describe-image] request failed (${(err as Error).message}) — skipping`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
