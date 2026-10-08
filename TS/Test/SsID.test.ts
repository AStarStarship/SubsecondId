// Copyright [AStarship](https://astarship.net).

// SSD (64-bit Subsecond Id) — comprehensive test suite.
// Spec: ~/AStarStarship/ASCIICrabs/_Spec/Data/Clock.md
//
// Hot UUID Bit Pattern: [1-bit MSb | 27-bit seconds | 8-bit ticker | 28-bit source]
//
// Security notes tested here:
//   - Source field is a 28-bit random number (2^28 unique nodes)
//   - Ticker is an 8-bit counter (255 UUIDs/sec/node DDoS limit)
//   - Timestamp is 27-bit (134M sec ~ 4.25 yr epoch, masked from Unix)
//   - MSb is always 1 (distinguishes Hot from Cold/Anonymous patterns)
//   - Monotonicity: IDs never go backwards (clock stall safe)

import { randomInt as rng } from 'crypto';
import {
  SsId, SsIdNext, SsIdPack, SsIdUnpack, SsIdTimestamp, SsIdTicker,
  SsIdSource, SsIdMsb, SsIdNextHex, SsIdPrint, SsIdResetTicker,
  SsIdTicker_, SsIdLastId_,
  SsIdHotMsb, SsIdHotTimestampBits, SsIdHotTimestampMax,
  SsIdTickerBits, SsIdTickerMax, SsIdSourceBits, SubsecondIdSourceMax,
  SsIdColdTimestampBits, SsIdColdTickerBits, SsIdColdMsb,
  SsIdAnonymousTimestampBits, SsIdAnonymousRandomBits,
  SsIdAnonymousSecondsMin, SsIdAnonymousSecondsMax,
  NumberInRange, TimestampSeconds, SsIdWindowStart,
} from '../dist';

import { expect, test, describe, beforeEach } from '@jest/globals';
import { TestCount } from './Global';

// 4 years in seconds (the Hot UUID epoch).
const FourYearsSeconds = 4 * 365.25 * 24 * 60 * 60;

describe('SSD Constants — Clock.md compliance', () => {
  test('Hot UUID bit widths: 1 + 27 + 8 + 28 = 64', () => {
    const total = 1 + SsIdHotTimestampBits + SsIdTickerBits + SsIdSourceBits;
    expect(total).toBe(64);
  });

  test('MSb is 1 for Hot UUID', () => {
    expect(SsIdHotMsb).toBe(1);
  });

  test('27-bit seconds field max = 2^27 - 1 = 134,217,727', () => {
    expect(SsIdHotTimestampMax).toBe((1 << 27) - 1);
    expect(SsIdHotTimestampMax).toBe(134217727);
  });

  test('8-bit ticker max = 255 (DDoS rate limit)', () => {
    expect(SsIdTickerMax).toBe(255);
  });

  test('28-bit source max = 2^28 - 1 = 268,435,455', () => {
    expect(SubsecondIdSourceMax).toBe((1 << 28) - 1);
    expect(SubsecondIdSourceMax).toBe(268435455);
  });

  test('Cold UUID: 1 + 34 + 29 = 64', () => {
    const total = 1 + SsIdColdTimestampBits + SsIdColdTickerBits;
    expect(total).toBe(64);
    expect(SsIdColdMsb).toBe(0);
  });

  test('Hot Anonymous UUID: 27 + 31 = 58', () => {
    const total = SsIdAnonymousTimestampBits + SsIdAnonymousRandomBits;
    expect(total).toBe(58);
  });

  test('Hot Anonymous seconds window: [126,230,400, 130,424,704)', () => {
    expect(SsIdAnonymousSecondsMin).toBe(126230400);
    expect(SsIdAnonymousSecondsMax).toBe(130424704);
    // Window width is 2^22 = 4,194,304 seconds.
    expect(SsIdAnonymousSecondsMax - SsIdAnonymousSecondsMin).toBe(1 << 22);
  });
});

describe('SSD Pack/Unpack roundtrip', () => {
  test('known values roundtrip exactly', () => {
    const ts = 12345, tk = 67, src = 89;
    const id = SsIdPack(ts, tk, src);
    expect(typeof id).toBe('bigint');
    const [tsR, tkR, srcR] = SsIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
    expect(srcR).toBe(src);
    expect(SsIdMsb(id)).toBe(1);
  });

  test('zero values roundtrip', () => {
    const id = SsIdPack(0, 0, 0);
    const [tsR, tkR, srcR] = SsIdUnpack(id);
    expect(tsR).toBe(0);
    expect(tkR).toBe(0);
    expect(srcR).toBe(0);
    expect(SsIdMsb(id)).toBe(1);
  });

  test('max values roundtrip', () => {
    const ts = SsIdHotTimestampMax, tk = 255, src = SubsecondIdSourceMax;
    const id = SsIdPack(ts, tk, src);
    const [tsR, tkR, srcR] = SsIdUnpack(id);
    expect(tsR).toBe(ts);
    expect(tkR).toBe(tk);
    expect(srcR).toBe(src);
    expect(SsIdMsb(id)).toBe(1);
  });

  test('random values roundtrip (1024 iterations)', () => {
    for (let i = 0; i < TestCount; ++i) {
      const ts = NumberInRange(rng, 0, SsIdHotTimestampMax);
      const tk = NumberInRange(rng, 0, SsIdTickerMax);
      const src = NumberInRange(rng, 0, SubsecondIdSourceMax);
      const id = SsIdPack(ts, tk, src);
      const [tsR, tkR, srcR] = SsIdUnpack(id);
      expect(tsR).toBe(ts);
      expect(tkR).toBe(tk);
      expect(srcR).toBe(src);
    }
  });

  test('bit layout: fields do not overlap', () => {
    // Set each field to all-1s and verify the others are zero.
    const idTs = SsIdPack(SsIdHotTimestampMax, 0, 0);
    expect(SsIdTicker(idTs)).toBe(0);
    expect(SsIdSource(idTs)).toBe(0);
    expect(SsIdTimestamp(idTs)).toBe(SsIdHotTimestampMax);

    const idTk = SsIdPack(0, 255, 0);
    expect(SsIdTimestamp(idTk)).toBe(0);
    expect(SsIdSource(idTk)).toBe(0);
    expect(SsIdTicker(idTk)).toBe(255);

    const idSrc = SsIdPack(0, 0, SubsecondIdSourceMax);
    expect(SsIdTimestamp(idSrc)).toBe(0);
    expect(SsIdTicker(idSrc)).toBe(0);
    expect(SsIdSource(idSrc)).toBe(SubsecondIdSourceMax);
  });

  test('bit layout: hex boundary values', () => {
    // Seconds = 1 (bit 36 set).
    const id1 = SsIdPack(1, 0, 0);
    expect(SsIdUnpack(id1)).toEqual([1, 0, 0]);

    // Ticker = 1 (bit 28 set).
    const id2 = SsIdPack(0, 1, 0);
    expect(SsIdUnpack(id2)).toEqual([0, 1, 0]);

    // Source = 1 (bit 0 set).
    const id3 = SsIdPack(0, 0, 1);
    expect(SsIdUnpack(id3)).toEqual([0, 0, 1]);
  });
});

describe('SSD SsIdNext — generation', () => {
  beforeEach(() => {
    SsIdResetTicker();
  });

  test('returns bigint', () => {
    const id = SsIdNext(rng);
    expect(typeof id).toBe('bigint');
  });

  test('MSb is always 1', () => {
    for (let i = 0; i < TestCount; ++i) {
      expect(SsIdMsb(SsIdNext(rng))).toBe(1);
    }
  });

  test('monotonically increasing (1024 iterations)', () => {
    let prev = 0n;
    for (let i = 0; i < TestCount; ++i) {
      const id = SsIdNext(rng);
      expect(id).toBeGreaterThan(prev);
      prev = id;
    }
  });

  test('timestamp is seconds-within-current-4-year-window (recovers ~now)', () => {
    const id = SsIdNext(rng);
    const now = TimestampSeconds();
    const ts = SsIdTimestamp(id);
    // The timestamp field counts elapsed seconds from the start of the current
    // 4-year calendar window, so it must be within the 27-bit range and, when
    // added back to the window start, recover the current absolute time. The
    // mean-year window boundary introduces a small approximation, so allow a
    // generous drift bound.
    expect(ts).toBeGreaterThanOrEqual(0);
    expect(ts).toBeLessThanOrEqual(SsIdHotTimestampMax);
    const recovered = ts + SsIdWindowStart(now);
    expect(Math.abs(recovered - now)).toBeLessThanOrEqual(60);
  });

  test('ticker increments within a second (or wraps at 255)', () => {
    const id1 = SsIdNext(rng);
    const id2 = SsIdNext(rng);
    const tk1 = SsIdTicker(id1);
    const tk2 = SsIdTicker(id2);
    if (SsIdTimestamp(id1) === SsIdTimestamp(id2)) {
      // Ticker increments each call. If the previous ticker was 255, the next
      // id would be smaller, so SsIdNext takes the monotonicity step path: it
      // advances to ticker 1 of the next second (preserving the source
      // identity), so ticker wraps 255 -> 1 rather than corrupting the id.
      if (tk1 < 255) expect(tk2).toBe(tk1 + 1);
      else expect(tk2).toBe(1);
    }
  });

  test('source is within 28-bit range', () => {
    for (let i = 0; i < 100; ++i) {
      const src = SsIdSource(SsIdNext(rng));
      expect(src).toBeGreaterThanOrEqual(0);
      expect(src).toBeLessThanOrEqual(SubsecondIdSourceMax);
    }
  });

  test('different sources generate different IDs', () => {
    // Pack with different sources, same time/ticker.
    const now = Math.floor(Date.now() / 1000) & SsIdHotTimestampMax;
    const id1 = SsIdPack(now, 1, 0x12345678);
    const id2 = SsIdPack(now, 1, 0x87654321);
    expect(id1).not.toBe(id2);
  });
});

describe('SSD Security analysis', () => {
  test('source field: 28 bits = 268M unique nodes', () => {
    // 2^28 = 268,435,456 possible source IDs.
    // A distributed system with < 268M nodes can have unique source IDs.
    expect(2 ** SsIdSourceBits).toBe(268435456);
  });

  test('ticker field: 8 bits = 255 UUIDs/sec/node', () => {
    // The 8-bit ticker caps each node at 255 UUIDs per second.
    // This is a DDoS rate limit per the spec.
    expect(2 ** SsIdTickerBits).toBe(256);
    expect(SsIdTickerMax).toBe(255);
  });

  test('timestamp: 27 bits = 134M sec ~ 4.25 yr epoch', () => {
    // 2^27 = 134,217,728 seconds = 4 years, 100 days, ~15 hours.
    // Current Unix timestamps (~1.79B sec) are masked to 27 bits,
    // so the epoch wraps every 4.25 years.
    expect(2 ** SsIdHotTimestampBits).toBe(134217728);
    const years = 134217728 / (365.25 * 24 * 60 * 60);
    expect(years).toBeCloseTo(4.25, 1);
  });

  test('collision resistance: same source + same second = unique via ticker', () => {
    // Ticker is at bits 28-35, so a ticker diff of 1 = 2^28.
    const now = Math.floor(Date.now() / 1000) & SsIdHotTimestampMax;
    const id1 = SsIdPack(now, 1, 42);
    const id2 = SsIdPack(now, 2, 42);
    const diff = Number(id2 - id1);
    expect(diff).toBe(2 ** 28); // Ticker shifted to bit 28.
  });

  test('collision resistance: different sources in same second = unique', () => {
    const now = Math.floor(Date.now() / 1000) & SsIdHotTimestampMax;
    const id1 = SsIdPack(now, 1, 1);
    const id2 = SsIdPack(now, 1, 2);
    const diff = Number(id2 - id1);
    expect(diff).toBe(1); // Source differs by 1.
  });

  test('FOOTGUN: ticker overflow wraps to 0, not 256', () => {
    // SsIdPack does NOT check for ticker > 255.
    // Passing 256 will silently set the wrong bits.
    const id = SsIdPack(1000, 256, 42);
    const [tsR, tkR, srcR] = SsIdUnpack(id);
    // 256 & 0xFF = 0, so ticker wraps to 0.
    expect(tkR).toBe(0);
    // Source is unaffected.
    expect(srcR).toBe(42);
  });

  test('FOOTGUN: timestamp > 27 bits is silently masked', () => {
    // SsIdPack masks the timestamp to 27 bits.
    // Current Unix time (~1.79B) is 31 bits, so it wraps.
    const unixTime = 1789200000; // ~2026
    const id = SsIdPack(unixTime, 1, 42);
    const ts = SsIdTimestamp(id);
    expect(ts).toBe(unixTime & SsIdHotTimestampMax);
    // This is the documented behavior, but users must know:
    // the 27-bit field wraps every 4.25 years.
  });

  test('FOOTGUN: source > 28 bits overflows into ticker', () => {
    // SsIdPack does NOT mask the source field.
    // Passing 2^28 will set bit 28 (the ticker bit).
    const id = SsIdPack(1000, 0, 2 ** 28);
    const [tsR, tkR, srcR] = SsIdUnpack(id);
    // Source mask is 0x0FFFFFFF, so 2^28 & 0x0FFFFFFF = 0.
    expect(srcR).toBe(0);
    // Bit 28 is the ticker bit, so ticker = 1.
    expect(tkR).toBe(1);
  });

  test('FOOTGUN: SsIdNext is not thread-safe (module-level state)', () => {
    // SsIdTicker_ and SsIdLastId_ are module-level variables.
    // In a multi-threaded environment (worker threads),
    // each thread has its own copy, so there is no race condition
    // but also no cross-thread monotonicity guarantee.
    // This test documents the behavior.
    const id = SsIdNext(rng);
    expect(typeof id).toBe('bigint');
  });

  test('FOOTGUN: not cryptographically secure without crypto rng', () => {
    // The default RNG is Math.random(), which is NOT cryptographically
    // secure. For security-sensitive applications, pass crypto.randomInt.
    // This test documents that passing a custom RNG is supported.
    // Note: NumberInRange calls rng(min, max) with 2 args, so a
    // 0-arg function like () => 42 will ignore the range.
    const id1 = SsIdNext(rng);
    const id2 = SsIdNext(rng);
    // IDs are unique (different tickers or sources).
    expect(id1).not.toBe(id2);
    // Source is within 28-bit range.
    expect(SsIdSource(id1)).toBeGreaterThanOrEqual(0);
    expect(SsIdSource(id1)).toBeLessThanOrEqual(SubsecondIdSourceMax);
  });

  test('uniqueness: 10K IDs from same source are all unique', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; ++i) {
      const id = SsIdNext(rng);
      const key = id.toString(16);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(10000);
  });
});

describe('SSD Hex serialization', () => {
  beforeEach(() => {
    SsIdResetTicker();
  });

  test('returns 16-char hex string', () => {
    const hex = SsIdNextHex(rng);
    expect(hex.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  test('hex roundtrips through BigInt', () => {
    const id = SsIdNext(rng);
    const hex = id.toString(16).padStart(16, '0');
    const parsed = BigInt('0x' + hex);
    expect(parsed).toBe(id);
  });

  test('hex is unique across calls', () => {
    const hexes = new Set<string>();
    for (let i = 0; i < 100; ++i) {
      hexes.add(SsIdNextHex(rng));
    }
    expect(hexes.size).toBe(100);
  });
});

describe('SSD Print', () => {
  beforeEach(() => {
    SsIdResetTicker();
  });

  test('returns string with 4 dot-separated fields', () => {
    const id = SsIdNext(rng);
    const printed = SsIdPrint(id);
    expect(typeof printed).toBe('string');
    const fields = printed.split('.');
    expect(fields.length).toBe(4);
  });

  test('first field is MSb (1 for Hot UUID)', () => {
    const id = SsIdNext(rng);
    const printed = SsIdPrint(id);
    expect(printed.startsWith('1.')).toBe(true);
  });

  test('field widths: 1 + 27 + 8 + 28 bits', () => {
    const id = SsIdPack(12345, 67, 89);
    const printed = SsIdPrint(id);
    const fields = printed.split('.');
    expect(fields.length).toBe(4);
    // MSb: 1 char
    expect(fields[0]!.length).toBe(1);
    // Seconds: 27 bits
    expect(fields[1]!.length).toBe(27);
    // Ticker: 8 bits
    expect(fields[2]!.length).toBe(8);
    // Source: 28 bits
    expect(fields[3]!.length).toBe(28);
  });

  test('print matches unpack', () => {
    const id = SsIdPack(12345, 67, 89);
    const printed = SsIdPrint(id);
    const [ts, tk, src] = SsIdUnpack(id);
    const fields = printed.split('.');
    expect(parseInt(fields[1]!, 2)).toBe(ts);
    expect(parseInt(fields[2]!, 2)).toBe(tk);
    expect(parseInt(fields[3]!, 2)).toBe(src);
  });
});

describe('SSD Cold UUID constants (not yet implemented)', () => {
  test('Cold UUID bit pattern: 0 + 34 + 29 = 64', () => {
    // MSb=0, 34-bit seconds, 29-bit ticker.
    // 544-year epoch (2^34 seconds).
    expect(1 + SsIdColdTimestampBits + SsIdColdTickerBits).toBe(64);
    const years = (2 ** 34) / (365.25 * 24 * 60 * 60);
    expect(years).toBeCloseTo(544.4, 0);
  });
});

describe('SSD Hot Anonymous UUID constants (not yet implemented)', () => {
  test('Hot Anonymous: 27-bit seconds + 31-bit random = 58 bits', () => {
    expect(SsIdAnonymousTimestampBits + SsIdAnonymousRandomBits).toBe(58);
  });

  test('seconds window is within 27-bit range', () => {
    expect(SsIdAnonymousSecondsMin).toBeGreaterThanOrEqual(0);
    expect(SsIdAnonymousSecondsMax).toBeLessThanOrEqual(SsIdHotTimestampMax);
  });
});
