// Copyright AStarship <https://astarship.net>.
import { RNG, SsId, SsIdSourceBits, SsIdTickerBits,
  SsIdTickerMax, SsIdHotTimestampBits, SsIdHotMsb, SsIdHotTimestampMax,
  TimestampSeconds, SubsecondIdSourceMax } from './'

//--- Variables ---//

// The subsecond ticker count (0 to SsIdTickerMax = 255, 8-bit field).
export let SsIdTicker_ = 0

// The last ID produced (for monotonicity on clock stalls).
export let SsIdLastId_: SsId = 0n

// The stable 28-bit source identity for this minter. Set via SsIdSetSource().
// Default 0. A server should configure a fixed source id (its identity) so
// minted ids embed provenance: which server produced them.
export let SsIdSource_ = 0

// Configures the 28-bit source identity used by SsIdNext (stable per minter).
export function SsIdSetSource(source: number): void {
  if (source < 0 || source > SubsecondIdSourceMax) {
    throw new RangeError(`SsId source out of range: ${source}`)
  }
  SsIdSource_ = source
}

// Returns the currently configured source identity.
export function SsIdGetSource(): number {
  return SsIdSource_
}

//--- SsId ---//

//--- Calendar windowing (Hot UUID resets every 4 years) ---//

// Seconds per (mean) year, used to align the window on a calendar-year
// boundary. (A mean year avoids leap-year drift for window bookkeeping; the
// exact filing date is recoverable from the ticker + record metadata.)
export const SsIdSecondsPerYear = 365.25 * 24 * 60 * 60 // 31,557,600

// The 4-year Hot window length in seconds. The Hot UUID resets every 4 years.
export const SsIdFourYearSeconds = 4 * SsIdSecondsPerYear // 126,230,400

// Aligns an absolute Unix time DOWN to the start of the 4-year window it falls
// in, on a calendar-year basis (year floored to a multiple of 4). The Hot UUID
// seconds field counts elapsed seconds from this window start, so it resets to
// 0 at the top of every 4-year window (e.g. 2024, 2028, 2032).
export function SsIdWindowStart(now?: number): number {
  const t = now ?? TimestampSeconds()
  const Year = Math.floor(t / SsIdSecondsPerYear) // calendar year index
  const WindowYear = (Math.floor(Year / 4) * 4) * SsIdSecondsPerYear
  return Math.floor(WindowYear)
}

// Returns the 4-year window index for an absolute time (2024..2027 -> 0).
export function SsIdWindowCount(now?: number): number {
  const t = now ?? TimestampSeconds()
  return Math.floor(Math.floor(t / SsIdSecondsPerYear) / 4)
}

// Returns the next 64-bit SubsecondId (Hot UUID) for a case filing.
//
// Bit layout per Clock.md:
//   Hot UUID: [1-bit MSb | 27-bit seconds | 8-bit ticker | 28-bit source]
//
// The seconds field counts elapsed seconds from the start of the current
// 4-year calendar window (year rolled down to a multiple of 4). The source
// field is the stable configured server identity (anti-fraud provenance). The
// ticker increments (wrapping each second) for intra-second uniqueness.
export function SsIdNext(_rng?: RNG): SsId {
  const Ticker_ = SsIdTicker_
  const Ticker = Ticker_ < SsIdTickerMax ?
    Ticker_ + 1 : SsIdResetTicker()
  SsIdTicker_ = Ticker

  // Seconds elapsed within the current 4-year window (0 .. ~1.26e8),
  // masked to the 27-bit field.
  const Seconds = (TimestampSeconds() - SsIdWindowStart()) & SsIdHotTimestampMax

  // Build the 64-bit ID using BigInt.
  const Id = (BigInt(SsIdHotMsb) << 63n) |
             (BigInt(Seconds) << 36n) |
             (BigInt(Ticker) << 28n) |
             BigInt(SsIdSource_)

  // Monotonicity must NOT corrupt the identity fields (source/seconds).
  // Within a second the ticker makes ids strictly increasing, so the only case
  // where Id <= SsIdLastId_ is a clock stall/rollback. In that case we advance
  // the TICKER (and only roll the seconds up if the ticker is exhausted),
  // preserving the source identity. We never add 1 to the whole 64-bit value
  // (which would carry into the source field and break provenance).
  if (Id <= SsIdLastId_) {
    const [LastSeconds, LastTicker] = SsIdUnpack(SsIdLastId_)
    let NewSeconds = LastSeconds
    let NewTicker = LastTicker + 1
    if (NewTicker > SsIdTickerMax) {
      NewTicker = 1
      NewSeconds = (LastSeconds + 1) & SsIdHotTimestampMax
    }
    const Stepped = (BigInt(SsIdHotMsb) << 63n) |
                    (BigInt(NewSeconds) << 36n) |
                    (BigInt(NewTicker) << 28n) |
                    BigInt(SsIdSource_)
    SsIdLastId_ = Stepped
    SsIdTicker_ = NewTicker
    return Stepped
  }
  SsIdLastId_ = Id
  return Id
}

// Resets the 8-bit subsecond ticker and returns 1.
export function SsIdResetTicker(): number {
  SsIdTicker_ = 1
  return SsIdTicker_
}

// Packs a Hot UUID: [1-bit MSb | 27-bit seconds | 8-bit ticker | 28-bit source].
// The 27-bit seconds field stores seconds elapsed from the Hot UUID epoch.
export function SsIdPack(timestamp: number, ticker: number, source: number): SsId {
  const sec = (timestamp & SsIdHotTimestampMax)
  return (BigInt(SsIdHotMsb) << 63n) |
         (BigInt(sec) << 36n) |
         (BigInt(ticker) << 28n) |
         BigInt(source)
}

// Unpacks a Hot UUID into [seconds, ticker, source].
export function SsIdUnpack(id: SsId): [number, number, number] {
  const seconds = Number((id >> 36n) & 0x7FFFFFFn)
  const ticker = Number((id >> 28n) & 0xFFn)
  const source = Number(id & 0x0FFFFFFFn)
  return [seconds, ticker, source]
}

// Extracts the 27-bit timestamp from a Hot UUID.
export function SsIdTimestamp(id: SsId): number {
  return SsIdUnpack(id)[0]
}

// Extracts the 8-bit subsecond ticker from a Hot UUID.
export function SsIdTicker(id: SsId): number {
  return SsIdUnpack(id)[1]
}

// Extracts the 28-bit source from a Hot UUID.
export function SsIdSource(id: SsId): number {
  return SsIdUnpack(id)[2]
}

// Returns the 1-bit MSb (Hot UUID flag) from a Hot UUID.
export function SsIdMsb(id: SsId): number {
  return Number((id >> 63n) & 1n)
}

//--- SsId Next Hex ---//

// Returns the next 64-bit SubsecondId as a 16-character hex string.
export function SsIdNextHex(rng?: RNG): string {
  const HexCount = 16
  return SsIdNext(rng).toString(16).padStart(HexCount, '0')
}

//--- SsId Print ---//

// Prints a Hot UUID to its canonical string form:
//   1.27.8.28  (bit widths of the four fields)
export function SsIdPrint(id: SsId): string {
  const [seconds, ticker, source] = SsIdUnpack(id)
  return (
    (SsIdMsb(id)).toString().padStart(1, '0') + '.' +
    BinaryPadBits(seconds, SsIdHotTimestampBits) + '.' +
    BinaryPadBits(ticker, SsIdTickerBits) + '.' +
    BinaryPadBits(source, SsIdSourceBits)
  )
}

// Pads a number to the given bit count in binary.
function BinaryPadBits(value: number, bits: number): string {
  return value.toString(2).padStart(bits, '0')
}
