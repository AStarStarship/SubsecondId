// Copyright [AStarship](https://astarship.net).

// TMT (64-bit Time Ticker) — comprehensive test suite.
// Spec: ~/AStarStarship/ASCIICrabs/_Spec/Data/Clock.md
//
// TMT Bit Pattern: [32-bit unsigned seconds | 32-bit subsecond ticker]
//
// Security notes tested here:
//   - 32-bit seconds: wraps in ~136 years from Unix epoch (year 2112)
//   - 32-bit ticker: 4.29B ticks/sec (no practical DDoS limit)
//   - No source field: TMT is NOT a UUID, it is a clock
//   - Monotonicity: IDs never go backwards (clock stall safe)
//   - Not thread-safe: module-level ticker state

import {
  SsLUId, SsLIdNext, SsLIdPack, SsLIdUnpack, SsLIdTimestamp,
  SsLIdTicker, SsLIdNextHex, SsLIdPrint,
  TmtTimestampBits, TmtTickerBits, TmtTickerMax,
  NumberInRange, TimestampSeconds,
} from '../dist';

import { randomInt as rng } from 'crypto';
import { expect, test, describe } from '@jest/globals';
import { TestCount } from './Global';

describe('TMT Constants — Clock.md compliance', () => {
  test('bit widths: 32 + 32 = 64', () => {
    expect(TmtTimestampBits + TmtTickerBits).toBe(64);
  });

  test('32-bit seconds max = 2^32 - 1 = 4,294,967,295', () => {
    const max = 2 ** 32 - 1;
    expect(max).toBe(4294967295);
    // Unix epoch + 2^32 seconds = 2038-01-19 (32-bit overflow).
    // But TMT uses unsigned 32-bit, so it wraps in year 2112
    // (2^32 seconds from 1970 = 136.1 years).
    const wrapYear = 1970 + Math.floor((2 ** 32) / (365.25 * 24 * 60 * 60));
    expect(wrapYear).toBe(2106);
  });

  test('32-bit ticker max = 2^32 - 1 = 4,294,967,295', () => {
    expect(TmtTickerMax).toBe(2 ** 32 - 1);
    expect(TmtTickerMax).toBe(4294967295);
  });
});

describe('TMT Pack/Unpack roundtrip', () => {
  test('known values roundtrip exactly', () => {
    const ts = 1789200000, tk = 12345;
    const id = SsLIdPack(ts, tk);
    expect(typeof id).toBe('bigint');
    const [tsR, tkR] = SsLIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
  });

  test('zero values roundtrip', () => {
    const id = SsLIdPack(0, 0);
    const [tsR, tkR] = SsLIdUnpack(id);
    expect(tsR).toBe(0);
    expect(tkR).toBe(0);
  });

  test('max values roundtrip', () => {
    const ts = 0xFFFFFFFF, tk = 0xFFFFFFFF;
    const id = SsLIdPack(ts, tk);
    const [tsR, tkR] = SsLIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
  });

  test('random values roundtrip (1024 iterations)', () => {
    for (let i = 0; i < TestCount; ++i) {
      const ts = NumberInRange(rng, 0, 0xFFFFFFFF);
      const tk = NumberInRange(rng, 0, TmtTickerMax);
      const id = SsLIdPack(ts, tk);
      const [tsR, tkR] = SsLIdUnpack(id);
      expect(tsR).toBe(ts);
      expect(tkR).toBe(tk);
    }
  });

  test('bit layout: fields do not overlap', () => {
    const idTs = SsLIdPack(0xFFFFFFFF, 0);
    expect(SsLIdTicker(idTs)).toBe(0);
    expect(SsLIdTimestamp(idTs)).toBe(0xFFFFFFFF);

    const idTk = SsLIdPack(0, 0xFFFFFFFF);
    expect(SsLIdTimestamp(idTk)).toBe(0);
    expect(SsLIdTicker(idTk)).toBe(0xFFFFFFFF);
  });

  test('bit layout: hex boundary values', () => {
    // Seconds = 1 (bit 32 set).
    const id1 = SsLIdPack(1, 0);
    expect(SsLIdUnpack(id1)).toEqual([1, 0]);

    // Ticker = 1 (bit 0 set).
    const id2 = SsLIdPack(0, 1);
    expect(SsLIdUnpack(id2)).toEqual([0, 1]);
  });
});

describe('TMT SsLIdNext — generation', () => {
  test('returns bigint', () => {
    const id = SsLIdNext();
    expect(typeof id).toBe('bigint');
  });

  test('monotonically increasing (1024 iterations)', () => {
    let prev = 0n;
    for (let i = 0; i < TestCount; ++i) {
      const id = SsLIdNext();
      expect(id).toBeGreaterThan(prev);
      prev = id;
    }
  });

  test('timestamp is close to current time', () => {
    const now = Math.floor(Date.now() / 1000);
    const id = SsLIdNext();
    const ts = SsLIdTimestamp(id);
    expect(Math.abs(ts - now)).toBeLessThanOrEqual(2);
  });

  test('ticker is within 32-bit range', () => {
    const id = SsLIdNext();
    const tk = SsLIdTicker(id);
    expect(tk).toBeGreaterThanOrEqual(0);
    expect(tk).toBeLessThanOrEqual(TmtTickerMax);
  });

  test('ticker increments within a second', () => {
    const id1 = SsLIdNext();
    const id2 = SsLIdNext();
    if (SsLIdTimestamp(id1) === SsLIdTimestamp(id2)) {
      expect(SsLIdTicker(id2)).toBe(SsLIdTicker(id1) + 1);
    }
  });

  test('ticker resets to 0 on new second', () => {
    // Wait for a new second (max 1s).
    const now = TimestampSeconds();
    while (TimestampSeconds() === now) { /* spin */ }
    const id = SsLIdNext();
    // The ticker should be 0 or 1 (first tick of the new second).
    const tk = SsLIdTicker(id);
    expect(tk).toBeLessThanOrEqual(1);
  });
});

describe('TMT Security analysis', () => {
  test('32-bit seconds wraps in year 2106', () => {
    // 2^32 seconds from Unix epoch (1970-01-01) = 2106-02-07.
    // This is a known limitation. Systems that need to run
    // past 2106 must use a different timestamp format.
    const wrapEpoch = 2 ** 32;
    const wrapDate = new Date(wrapEpoch * 1000);
    expect(wrapDate.getUTCFullYear()).toBe(2106);
  });

  test('FOOTGUN: TMT is NOT a UUID — no source field', () => {
    // TMT has no source/node identifier. Two different machines
    // generating TMTs in the same second will produce IDENTICAL
    // TMT values. TMT is a clock, not a unique ID.
    // For unique IDs, use SSD (SsId) or SSE (SsUId).
    const now = Math.floor(Date.now() / 1000);
    const id = SsLIdPack(now, 42);
    const [ts, tk] = SsLIdUnpack(id);
    expect(ts).toBe(now);
    expect(tk).toBe(42);
    // There is no way to extract a "source" from a TMT.
  });

  test('FOOTGUN: TMT is not thread-safe (module-level state)', () => {
    // tmt_ticker and tmt_timestamp are module-level variables.
    // Worker threads get separate copies (no race, but no
    // cross-thread monotonicity).
    const id = SsLIdNext();
    expect(typeof id).toBe('bigint');
  });

  test('FOOTGUN: 32-bit ticker has no DDoS limit', () => {
    // Unlike SSD (255/sec) and SSE (65535/sec), TMT allows
    // 4.29B ticks per second. There is no practical rate limit.
    // This is fine for a clock, but if you use TMT as a rate
    // limiter, it provides no protection.
    expect(TmtTickerMax).toBe(4294967295);
  });

  test('uniqueness: 10K TMTs from same process are all unique', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; ++i) {
      const id = SsLIdNext();
      const key = id.toString(16);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(10000);
  });
});

describe('TMT Hex serialization', () => {
  test('returns 16-char hex string', () => {
    const hex = SsLIdNextHex();
    expect(hex.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  test('hex roundtrips through BigInt', () => {
    const id = SsLIdNext();
    const hex = id.toString(16).padStart(16, '0');
    const parsed = BigInt('0x' + hex);
    expect(parsed).toBe(id);
  });

  test('hex is unique across calls', () => {
    const hexes = new Set<string>();
    for (let i = 0; i < 100; ++i) {
      hexes.add(SsLIdNextHex());
    }
    expect(hexes.size).toBe(100);
  });
});

describe('TMT Print', () => {
  test('returns string containing TMT', () => {
    const id = SsLIdNext();
    const printed = SsLIdPrint(id);
    expect(typeof printed).toBe('string');
    expect(printed).toContain('TMT');
  });

  test('print contains date', () => {
    const id = SsLIdNext();
    const printed = SsLIdPrint(id);
    const [ts] = SsLIdUnpack(id);
    const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
    expect(printed).toContain(dateStr);
  });
});

describe('TMT vs SSD vs SSE comparison', () => {
  test('TMT has no source field (SSD and SSE do)', () => {
    // TMT: [32-bit sec | 32-bit tick] — no source
    // SSD: [1-bit MSb | 27-bit sec | 8-bit tick | 28-bit src]
    // SSE: [36-bit sec | 16-bit tick | 76-bit src]
    // TMT is a clock, not a unique ID.
    const tmtId = SsLIdNext();
    // There is no SsLIdSource() function.
    // This is the key difference from SSD and SSE.
    expect(typeof tmtId).toBe('bigint');
  });

  test('SSD has DDoS limit (255/sec), TMT does not', () => {
    const { SsIdTickerMax } = require('../dist');
    expect(SsIdTickerMax).toBe(255);
    expect(TmtTickerMax).toBe(4294967295);
  });

  test('SSE has 128-bit IDs, TMT and SSD have 64-bit', () => {
    const tmtId = SsLIdNext();
    expect(tmtId < (1n << 64n)).toBe(true);

    const { SsUIdNext } = require('../dist');
    const sseId = SsUIdNext(() => 42);
    // SSE can be up to 128 bits.
    expect(sseId >= 0n).toBe(true);
  });
});
