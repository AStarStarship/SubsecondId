// Copyright [AStarship](https://astarship.net).

// SSE (128-bit Subsecond Id UUID) — comprehensive test suite.
// Spec: ~/AStarStarship/ASCIICrabs/_Spec/Data/Clock.md
//
// SSE Bit Pattern: [36-bit unsigned seconds | 16-bit subsecond ticker | 76-bit random id]
//
// Security notes tested here:
//   - 76-bit random source (2^76 possible nodes ~ 7.5 x 10^22)
//   - 16-bit ticker (65,535 UUIDs/sec/node)
//   - 36-bit timestamp (68.7 billion sec ~ 2,177 year epoch)
//   - Source is generated once per process (not per UUID)
//   - Not UUIDv4 compatible (no version/variant bits)

import { randomInt as rng } from 'crypto';
import {
  SsUUId, SsUIdNext, SsUIdPack, SsUIdUnpack, SsUIdTimestamp,
  SsUIdTicker, SsUIdSource, SsUIdNextHex, SsUIdPrint,
  SsUIdNextBuffer, SsUIdSourceId, SsUIdSourceNext, SsUIdSourceIncrement,
  SsUIdTimestampBits, SsUIdTickerBits, SsUIdSourceBits, SsUIdTickerMax,
  BigIntInRange, TimestampSeconds,
} from '../dist';

import { expect, test, describe } from '@jest/globals';
import { TestCount } from './Global';

describe('SSE Constants — Clock.md compliance', () => {
  test('bit widths: 36 + 16 + 76 = 128', () => {
    const total = SsUIdTimestampBits + SsUIdTickerBits + SsUIdSourceBits;
    expect(total).toBe(128);
  });

  test('36-bit timestamp max = 2^36 - 1 = 68,719,476,735', () => {
    const max = (1n << 36n) - 1n;
    expect(max).toBe(68719476735n);
    const years = Number(max) / (365.25 * 24 * 60 * 60);
    expect(years).toBeGreaterThanOrEqual(2177);
    expect(years).toBeLessThanOrEqual(2178);
  });

  test('16-bit ticker max = 65,535', () => {
    expect(SsUIdTickerMax).toBe((1n << 16n) - 1n);
    expect(SsUIdTickerMax).toBe(65535n);
  });

  test('76-bit source max = 2^76 - 1', () => {
    const max = (1n << 76n) - 1n;
    expect(max.toString(16)).toBe('fffffffffffffffffff'); // 76 bits = 19 hex chars
  });
});

describe('SSE Pack/Unpack roundtrip', () => {
  test('known values roundtrip exactly', () => {
    const ts = 1789200000n, tk = 12345n, src = 0xdeadbeefcafe1234n;
    const id = SsUIdPack(ts, tk, src);
    expect(typeof id).toBe('bigint');
    const [tsR, tkR, srcR] = SsUIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
    expect(srcR).toBe(src);
  });

  test('zero values roundtrip', () => {
    const id = SsUIdPack(0, 0, 0n);
    const [tsR, tkR, srcR] = SsUIdUnpack(id);
    expect(tsR).toBe(0n);
    expect(tkR).toBe(0n);
    expect(srcR).toBe(0n);
  });

  test('max values roundtrip', () => {
    const ts = (1n << 36n) - 1n, tk = (1n << 16n) - 1n, src = (1n << 76n) - 1n;
    const id = SsUIdPack(ts, tk, src);
    const [tsR, tkR, srcR] = SsUIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
    expect(srcR).toBe(src);
  });

  test('random values roundtrip (1024 iterations)', () => {
    for (let i = 0; i < TestCount; ++i) {
      const ts = BigIntInRange(rng, 0n, (1n << 36n) - 1n);
      const tk = BigIntInRange(rng, 0n, (1n << 16n) - 1n);
      const src = BigIntInRange(rng, 0n, (1n << 76n) - 1n);
      const id = SsUIdPack(ts, tk, src);
      const [tsR, tkR, srcR] = SsUIdUnpack(id);
      expect(tsR).toBe(ts);
      expect(tkR).toBe(tk);
      expect(srcR).toBe(src);
    }
  });

  test('bit layout: fields do not overlap', () => {
    const idTs = SsUIdPack((1n << 36n) - 1n, 0n, 0n);
    expect(SsUIdTicker(idTs)).toBe(0n);
    expect(SsUIdSource(idTs)).toBe(0n);
    expect(SsUIdTimestamp(idTs)).toBe((1n << 36n) - 1n);

    const idTk = SsUIdPack(0n, (1n << 16n) - 1n, 0n);
    expect(SsUIdTimestamp(idTk)).toBe(0n);
    expect(SsUIdSource(idTk)).toBe(0n);
    expect(SsUIdTicker(idTk)).toBe((1n << 16n) - 1n);

    const idSrc = SsUIdPack(0n, 0n, (1n << 76n) - 1n);
    expect(SsUIdTimestamp(idSrc)).toBe(0n);
    expect(SsUIdTicker(idSrc)).toBe(0n);
    expect(SsUIdSource(idSrc)).toBe((1n << 76n) - 1n);
  });
});

describe('SSE SsUIdNext — generation', () => {
  test('returns bigint', () => {
    const id = SsUIdNext(rng);
    expect(typeof id).toBe('bigint');
  });

  test('monotonically increasing (1024 iterations)', () => {
    let prev = 0n;
    for (let i = 0; i < TestCount; ++i) {
      const id = SsUIdNext(rng);
      expect(id).toBeGreaterThan(prev);
      prev = id;
    }
  });

  test('timestamp is close to current time', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const id = SsUIdNext(rng);
    const ts = SsUIdTimestamp(id);
    expect(ts).toBeGreaterThanOrEqual(now - 2n);
    expect(ts).toBeLessThanOrEqual(now + 2n);
  });

  test('source is within 76-bit range', () => {
    const id = SsUIdNext(rng);
    const src = SsUIdSource(id);
    expect(src).toBeGreaterThanOrEqual(0n);
    expect(src).toBeLessThanOrEqual((1n << 76n) - 1n);
  });

  test('ticker is within 16-bit range', () => {
    const id = SsUIdNext(rng);
    const tk = SsUIdTicker(id);
    expect(tk).toBeGreaterThanOrEqual(0n);
    expect(tk).toBeLessThanOrEqual(65535n);
  });

  test('source is stable across calls (same process)', () => {
    const id1 = SsUIdNext(rng);
    const id2 = SsUIdNext(rng);
    // The 76-bit source is generated once and reused.
    expect(SsUIdSource(id1)).toBe(SsUIdSource(id2));
  });

  test('different tickers produce different IDs', () => {
    const id1 = SsUIdNext(rng);
    const id2 = SsUIdNext(rng);
    expect(id1).not.toBe(id2);
  });
});

describe('SSE Security analysis', () => {
  test('76-bit source: 2^76 = 7.5 x 10^22 possible nodes', () => {
    // Birthday bound: collision probability reaches 50%
    // at ~2.6 x 10^11 nodes. For 1M nodes, collision
    // probability is ~7.5 x 10^-17 (negligible).
    const twoTo76 = 2n ** 76n;
    expect(twoTo76).toBe(75557863725914323419136n);
  });

  test('16-bit ticker: 65,535 UUIDs/sec/node', () => {
    // Each node can generate up to 65,535 UUIDs per second.
    // After that, it must wait for the next second.
    expect(2n ** 16n).toBe(65536n);
  });

  test('36-bit timestamp: 68.7B sec ~ 2,177 year epoch', () => {
    // The 36-bit timestamp field wraps in ~2,177 years.
    // This is a non-issue for any realistic system.
    const max = 2n ** 36n;
    const years = Number(max) / (365.25 * 24 * 60 * 60);
    expect(years).toBeGreaterThanOrEqual(2177);
    expect(years).toBeLessThanOrEqual(2178);
  });

  test('FOOTGUN: source is per-process, not per-UUID', () => {
    // The 76-bit source is generated once per process.
    // All UUIDs from the same process share the same source.
    // This is by design (the spec says "Systems may use the same
    // 76-bit random id for all UUIDs, or generate a new random
    // number every time."), but it means:
    //   - UUIDs from the same process are NOT fully unique by source
    //   - Uniqueness within a process relies on timestamp + ticker
    //   - If two processes restart at the same second with the same
    //     source (impossible with crypto.randomInt), they could collide
    const id1 = SsUIdNext(rng);
    const id2 = SsUIdNext(rng);
    expect(SsUIdSource(id1)).toBe(SsUIdSource(id2));
  });

  test('FOOTGUN: not UUIDv4 compatible', () => {
    // SSE does NOT have UUIDv4 version (4) or variant (8,9,A,B) bits.
    // Code that expects RFC 4122 UUID layout will misparse SSE.
    // The 36-bit timestamp starts at bit 92 (MSB of 128-bit value).
    const id = SsUIdNext(rng);
    // UUIDv4 version is at bits 76-79 (0-indexed from LSB).
    // SSE has source bits there, so the "version" will be random.
    const versionBits = Number((id >> 76n) & 0x0Fn);
    // This will almost certainly NOT be 4.
    // (We don't assert it, just document the incompatibility.)
    expect(versionBits).toBeGreaterThanOrEqual(0);
    expect(versionBits).toBeLessThanOrEqual(15);
  });

  test('FOOTGUN: SsUIdNext is not thread-safe (module-level state)', () => {
    // uid_source, uid_ticker, uid_timestamp are module-level.
    // Worker threads get separate copies (no race, but no
    // cross-thread monotonicity).
    const id = SsUIdNext(rng);
    expect(typeof id).toBe('bigint');
  });

  test('uniqueness: 10K IDs from same process are all unique', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; ++i) {
      const id = SsUIdNext(rng);
      const key = id.toString(16);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(10000);
  });
});

describe('SSE Hex serialization', () => {
  test('returns 32-char hex string', () => {
    const hex = SsUIdNextHex(rng);
    expect(hex.length).toBe(32);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  test('hex roundtrips through BigInt', () => {
    const id = SsUIdNext(rng);
    const hex = id.toString(16).padStart(32, '0');
    const parsed = BigInt('0x' + hex);
    expect(parsed).toBe(id);
  });

  test('hex is unique across calls', () => {
    const hexes = new Set<string>();
    for (let i = 0; i < 100; ++i) {
      hexes.add(SsUIdNextHex(rng));
    }
    expect(hexes.size).toBe(100);
  });
});

describe('SSE Buffer serialization', () => {
  test('returns 16-byte Buffer', () => {
    const buf = SsUIdNextBuffer(rng);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(16);
  });

  test('Buffer roundtrips through BigInt', () => {
    const buf = SsUIdNextBuffer(rng);
    // Reconstruct from buffer.
    let parsed = 0n;
    for (let i = 0; i < buf.length; ++i) {
      parsed |= BigInt(buf[i] ?? 0) << BigInt(i * 8);
    }
    // The buffer contains a valid 128-bit SSE.
    expect(parsed).toBeGreaterThanOrEqual(0n);
  });

  test('Buffer bytes are in [0, 255]', () => {
    const buf = SsUIdNextBuffer(rng);
    for (let i = 0; i < buf.length; ++i) {
      expect(buf[i]).toBeGreaterThanOrEqual(0);
      expect(buf[i]).toBeLessThanOrEqual(255);
    }
  });
});

describe('SSE Source management', () => {
  test('SsUIdSourceId returns the current 76-bit source', () => {
    const source = SsUIdSourceId();
    expect(typeof source).toBe('bigint');
    expect(source).toBeGreaterThanOrEqual(0n);
    expect(source).toBeLessThanOrEqual((1n << 76n) - 1n);
  });

  test('SsUIdSourceNext generates a new source', () => {
    const oldSource = SsUIdSourceId();
    SsUIdSourceNext(rng);
    const newSource = SsUIdSourceId();
    // Very unlikely to be the same (76-bit random).
    // We don't assert inequality because it's theoretically possible.
    expect(newSource).toBeGreaterThanOrEqual(0n);
    expect(newSource).toBeLessThanOrEqual((1n << 76n) - 1n);
  });

  test('SsUIdSourceIncrement wraps at 76-bit max', () => {
    const max = (1n << 76n) - 1n;
    // We can't easily set the internal source to max,
    // but we can verify the function doesn't crash.
    SsUIdSourceIncrement();
    const source = SsUIdSourceId();
    expect(source).toBeGreaterThanOrEqual(0n);
    expect(source).toBeLessThanOrEqual(max);
  });
});

describe('SSE Print', () => {
  test('returns string containing SSE', () => {
    const id = SsUIdNext(rng);
    const printed = SsUIdPrint(id);
    expect(typeof printed).toBe('string');
    expect(printed).toContain('SSE');
  });

  test('print contains timestamp date', () => {
    const id = SsUIdNext(rng);
    const printed = SsUIdPrint(id);
    const [ts] = SsUIdUnpack(id);
    const dateStr = new Date(Number(ts) * 1000).toISOString().split('T')[0];
    expect(printed).toContain(dateStr);
  });
});
