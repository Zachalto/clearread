/**
 * ClearRead backend — a thin Express proxy in front of the Anthropic API.
 *
 * Why have a backend at all? The Anthropic API key MUST NOT live in the
 * browser. Any client-side request that includes a real key would expose
 * it to anyone who opens DevTools. This server holds the key server-side
 * and forwards only the prompt and the user's text.
 *
 * Design pattern: Proxy. The frontend hits /api/simplify; we forward to
 * Anthropic; we send the model's reply back. The client never sees a key.
 *
 * Graceful no-key mode: if ANTHROPIC_API_KEY is missing, the server still
 * starts (so the frontend works), and /api/simplify returns a clear 503
 * that the frontend uses to hide the Simplify button. This is the
 * "keyless build" state — drop a key into .env and restart to enable AI.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })
);

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const hasKey = Boolean(apiKey);
const client = hasKey ? new Anthropic({ apiKey }) : null;

const MODEL = 'claude-haiku-4-5-20251001';

// System prompt is fixed across every Simplify call, so we mark it as a
// cache breakpoint. Anthropic prompt-caching reuses the prefix for ~5
// minutes, cutting cost ~80% and latency noticeably on repeat calls.
const SIMPLIFY_SYSTEM = `You are a reading accessibility assistant for people with dyslexia.

Rewrite the user's text following these rules:
- Aim for a 6th-grade reading level.
- Use short sentences (15 words or fewer when possible).
- Replace uncommon words with common ones.
- Prefer active voice over passive voice.
- Keep paragraph structure when meaningful — separate paragraphs with a blank line.
- Preserve ALL factual content. Do not add facts, opinions, or commentary.
- Do not summarize. Rewrite at the same length or slightly shorter — not condensed.

Output ONLY the rewritten text. No preamble, no explanation, no quotes around the output.`;

app.get('/api/health', (req, res) => {
  res.json({ ok: true, aiEnabled: hasKey, model: hasKey ? MODEL : null });
});

app.post('/api/simplify', async (req, res) => {
  if (!hasKey) {
    return res.status(503).json({
      error:
        'AI features are disabled. Add ANTHROPIC_API_KEY to server/.env and restart to enable.',
    });
  }

  const { text, level = 'easier' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Body must include a non-empty "text" string.' });
  }
  if (text.length > 8000) {
    return res
      .status(413)
      .json({ error: 'Text is too long. Limit is 8000 characters per request.' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SIMPLIFY_SYSTEM,
          // Cache the system prompt — fixed across all Simplify calls, so
          // subsequent requests within ~5 minutes pay only the user-message cost.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Reading level target: ${level}.\n\nText to rewrite:\n${text}`,
        },
      ],
    });

    const simplified = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({
      simplified,
      usage: response.usage, // includes cache_read_input_tokens on cache hits
      model: response.model,
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    const status = err?.status && Number.isInteger(err.status) ? err.status : 502;
    res.status(status).json({
      error: err?.message || 'Upstream API error',
    });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`ClearRead backend listening on http://localhost:${PORT}`);
  console.log(`AI features: ${hasKey ? 'ENABLED' : 'DISABLED (no ANTHROPIC_API_KEY)'}`);
});
