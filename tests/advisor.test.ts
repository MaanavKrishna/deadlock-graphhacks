import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { parseAdvice, advise } from '../src/server/advisor';
import type { Deal } from '../src/shared/types';
it('accepts only a bounded plain-language advisor summary', () => {
  expect(
    parseAdvice('{"summary":"The three participants satisfy the proposed constraints."}'),
  ).toBe('The three participants satisfy the proposed constraints.');
  expect(() => parseAdvice('not json')).toThrow();
  expect(() => parseAdvice('{"summary":""}')).toThrow();
  expect(() => parseAdvice(JSON.stringify({ summary: 'x'.repeat(601) }))).toThrow();
});
it('uses an actual HTTP advisor and falls back on malformed output or timeout', async () => {
  const prior = {
    key: process.env.MODEL_API_KEY,
    name: process.env.MODEL_NAME,
    url: process.env.MODEL_BASE_URL,
  };
  let mode = 'valid';
  const server = createServer((req, res) => {
    req.resume();
    if (mode === 'timeout') return;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                mode === 'valid' ? '{"summary":"Capacity and delivery limits pass."}' : 'invalid',
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.MODEL_API_KEY = 'synthetic-test-key';
  process.env.MODEL_NAME = 'test-model';
  process.env.MODEL_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const deal = {
    status: 'awaiting_approval',
    participants: [],
    legs: [],
    rounds: 1,
  } as unknown as Deal;
  try {
    expect(await advise(deal)).toBe('Capacity and delivery limits pass.');
    mode = 'malformed';
    expect(await advise(deal)).toContain('unavailable');
    mode = 'timeout';
    expect(await advise(deal, 25)).toContain('unavailable');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [key, value] of Object.entries({
      MODEL_API_KEY: prior.key,
      MODEL_NAME: prior.name,
      MODEL_BASE_URL: prior.url,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
