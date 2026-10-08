// Copyright AStarship <https://astarship.net>.
import { SsLUId, TmtTickerMax, TimestampSeconds } from './'

//--- Variables ---//

// TMT subsecond ticker count (0 to 2^32-1).
let tmt_ticker: number = 0

// Last time a TMT was created.
let tmt_timestamp: number = TimestampSeconds()

//--- Functions ---//

// Extracts the timestamp from a TMT (32-bit seconds).
// The 64-bit TMT is a BigInt: (seconds << 32) | ticker.
export function SsLIdTimestamp(id: SsLUId): number {
  return Number(id >> 32n)
}

// Extracts the ticker count from a TMT (32-bit ticker).
export function SsLIdTicker(id: SsLUId): number {
  return Number(id & 0xFFFFFFFFn)
}

// Extracts the timestamp and ticker from a TMT.
export function SsLIdUnpack(id: SsLUId): [number, number] {
  return [SsLIdTimestamp(id), SsLIdTicker(id)]
}

// Packs a timestamp and ticker into a TMT.
// TMT: [32-bit unsigned seconds | 32-bit subsecond ticker]
// Uses BigInt for exact 64-bit representation.
export function SsLIdPack(timestamp: number, ticker: number): SsLUId {
  return (BigInt(timestamp) << 32n) | BigInt(ticker)
}

// Prints a TMT to a string.
export function SsLIdPrint(id: SsLUId): string {
  const [timestamp, ticker] = SsLIdUnpack(id)
  const time = new Date(timestamp * 1000)
  return 'TMT:{ ' + time.toISOString().split('T')[0] + ' tick:' + ticker + ' }'
}

// Generates the next TMT (64-bit Time Ticker).
// Bit pattern: [32-bit unsigned seconds | 32-bit subsecond ticker]
export function SsLIdNext(): SsLUId {
  const timestamp = TimestampSeconds()
  let ticker = tmt_ticker

  if (timestamp !== tmt_timestamp) {
    tmt_timestamp = timestamp
    ticker = 0
  } else if (ticker >= TmtTickerMax) {
    // Ticker overflow: spin until next second.
    let now = timestamp
    while (now === tmt_timestamp) now = TimestampSeconds()
    tmt_timestamp = now
    ticker = 0
  }

  tmt_ticker = ticker + 1
  return SsLIdPack(timestamp, ticker)
}

// Generates the next TMT hex string.
export function SsLIdNextHex(): string {
  return SsLIdNext().toString(16).padStart(16, '0')
}
