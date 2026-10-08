// Copyright AStarship <https://astarship.net>.
import { SsUUId, RNG, BigIntInRange, BigIntToBuffer,
  SsUIdTimestampBits, SsUIdTickerBits, SsUIdSourceBits,
  SsUIdTickerMax, TimestampSeconds, TimestampSecondsNext, SsIdRng } from './'

//--- Variables ---//

// 76-bit random source id (generated on first use).
let uid_source: bigint = 0n

// 16-bit subsecond ticker.
let uid_ticker: number = 0

// Last time a SsUId was created.
let uid_timestamp: number = TimestampSeconds()

// The last SSE produced (for monotonicity on clock stalls).
let uid_last_id: SsUUId = 0n

//--- Functions ---//

// Extracts the timestamp from a SSE (36-bit unsigned seconds).
export function SsUIdTimestamp(subsec_id: SsUUId): bigint {
  const shift = BigInt(SsUIdSourceBits + SsUIdTickerBits)
  return subsec_id >> shift
}

// Extracts the ticker count from a SSE (16-bit).
export function SsUIdTicker(subsec_id: SsUUId): bigint {
  const sourceBits = BigInt(SsUIdSourceBits)
  const mask = (1n << BigInt(SsUIdTickerBits)) - 1n
  return (subsec_id >> sourceBits) & mask
}

// Extracts the 76-bit random source id from a SSE.
export function SsUIdSource(subsec_id: SsUUId): bigint {
  const mask = (1n << BigInt(SsUIdSourceBits)) - 1n
  return subsec_id & mask
}

// Packs a timestamp, ticker, and source into a SSE.
// SSE: [36-bit unsigned seconds | 16-bit subsecond ticker | 76-bit random id]
export function SsUIdPack(timestamp: bigint | number, ticker: bigint | number,
  source: bigint): SsUUId {
  const ts = BigInt(timestamp)
  const tk = BigInt(ticker)
  const shift = BigInt(SsUIdTickerBits + SsUIdSourceBits)
  return (ts << shift) | (tk << BigInt(SsUIdSourceBits)) | source
}

// Extracts the timestamp, ticker, and source from a SSE.
export function SsUIdUnpack(subsec_id: SsUUId): [bigint, bigint, bigint] {
  return [SsUIdTimestamp(subsec_id), SsUIdTicker(subsec_id), SsUIdSource(subsec_id)]
}

// Prints a SSE to a string.
export function SsUIdPrint(subsec_id: SsUUId): string {
  const [timestamp, ticker, source] = SsUIdUnpack(subsec_id)
  const time = new Date(Number(timestamp) * 1000)
  return 'SSE:{ timestamp: ' + time.toISOString().split('T')[0] +
    '\n       tick   :' + ticker.toString() +
    '\n       source :' + source.toString(16) + ' }'
}

// Gets the current 76-bit source id.
export function SsUIdSourceId(): bigint {
  return uid_source
}

// Generates a cryptographically-secure random 76-bit source id.
// Uses the module-level RNG (set via SsIdSetRng).
export function SsUIdSourceNext(rng?: RNG): void {
  const Rng = rng ?? SsIdRng
  let source = 0n
  while (source === 0n) {
    source = BigIntInRange(Rng, 1n, (1n << BigInt(SsUIdSourceBits)) - 1n)
  }
  uid_source = source
}

// Increments the source id (for collision recovery).
export function SsUIdSourceIncrement(): void {
  const max = (1n << BigInt(SsUIdSourceBits)) - 1n
  if (uid_source >= max) {
    uid_source = 1n
  } else {
    uid_source = uid_source + 1n
  }
}

/* Generates the next 128-bit SSE.
   Bit pattern: [36-bit unsigned seconds | 16-bit subsecond ticker | 76-bit random id]
   Uses the module-level RNG (set via SsIdSetRng). Pass a custom RNG
   as an argument to override for a single call. */
export function SsUIdNext(rng?: RNG): SsUUId {
  const Rng = rng ?? SsIdRng
  const timestamp = TimestampSeconds()
  let ticker = uid_ticker

  if (timestamp !== uid_timestamp) {
    uid_timestamp = timestamp
    ticker = 0
  } else if (ticker >= SsUIdTickerMax) {
    const next = TimestampSecondsNext()
    uid_timestamp = next
    ticker = 0
  }

  uid_ticker = ticker + 1

  if (uid_source === 0n) {
    SsUIdSourceNext(Rng)
  }

  const id = SsUIdPack(timestamp, ticker, uid_source)

  // Monotonicity: if the clock stalled or wrapped, ensure the ID
  // is at least last + 1. Without this, a second-boundary crossing
  // (ticker reset to 0) produces an ID lower than the previous one.
  if (id <= uid_last_id) {
    uid_last_id = uid_last_id + 1n
    return uid_last_id
  }
  uid_last_id = id
  return id
}

// Generates the next SSE as a hex string (32 hex chars = 128 bits).
export function SsUIdNextHex(rng?: RNG, dest: string = ''): string {
  return dest + SsUIdNext(rng).toString(16).padStart(32, '0')
}

/* Generates the next SSE as a Buffer (16 bytes = 128 bits).
   @return A Buffer containing the 16 bytes of the 128-bit id. */
export function SsUIdNextBuffer(rng?: RNG): Buffer {
  const id = SsUIdNext(rng)
  const buf = Buffer.alloc(16)
  for (let i = 0; i < 16; i++) {
    buf[i] = Number((id >> BigInt(i * 8)) & 0xFFn)
  }
  return buf
}
