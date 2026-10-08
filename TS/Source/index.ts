// Copyright AStarship <https://astarship.net>.

export * from './SsId'
export * from './SsLId'
export * from './SsUId'

//--- Types ---//

// A 64-bit Subsecond Id.
export type SsId = bigint

/* A 64-bit Subsecond Locally Unique Id. */
export type SsLUId = bigint

// A 128-bit Subsecond Universally Unique Id.
export type SsUUId = bigint

/* A function pointer type for recycling random numbers. */
export type NumberIOFun = (a: number) => number

// Cryptographically-secure Random Number Generator function type.
export type RNG = (min: number, max: number) => number

// The module-level RNG, used by SsIdNext, SsUIdNext, and friends.
// Defaults to crypto.randomInt (cryptographically secure).
// Call SsIdSetRng() to swap in a custom RNG (e.g. LSTMRNG).
//
// The RNG type is (min, max) => number, returning a value in [min, max].
// The default wraps crypto.randomInt which is exclusive of max, so we
// add 1. For ranges near 2^48 (the largest used by BigIntInRange),
// max + 1 can reach 2^48 which exceeds crypto.randomInt's limit.
// We handle this by generating the value in [0, 2^48) and offsetting.
import { randomInt as _cryptoRng } from 'crypto'
export let SsIdRng: RNG = (min: number, max: number): number => {
  // crypto.randomInt(min, max) is exclusive of max, and (max - min)
  // must be <= 2^48 - 1. Our RNG type is inclusive of max, so we
  // normally call _cryptoRng(min, max + 1).
  if (max + 1 < 2 ** 48) {
    return _cryptoRng(min, max + 1)
  }
  // max + 1 >= 2^48: the range exceeds crypto.randomInt's limit.
  // Generate 48 bits as two 24-bit halves (use * NOT << since
  // JS << wraps mod 32).
  const hi = _cryptoRng(0, 2 ** 24)
  const lo = _cryptoRng(0, 2 ** 24)
  const val = hi * (2 ** 24) + lo
  // If min > 0, offset into [min, min + 2^48) then clamp to max.
  // In practice min is always 0 for the 48-bit range calls.
  return Math.min(min + val, max)
}

// Swaps the module-level RNG. Pass a function that takes (min, max)
// and returns a random integer in [min, max].
export function SsIdSetRng(rng: RNG): void {
  SsIdRng = rng
}

// Stores two sin-cos polar probability values -1 < x < 1.
export type Chance = {
  u: number,
  v: number
}

//--- Constants ---//

// Number of bits in a JS number.
export const NumberMantissaBits = 53

//--- SSD: 64-bit Subsecond Id (per Clock.md) ---//

// Hot UUID: [1-bit MSb | 27-bit seconds | 8-bit ticker | 28-bit source]
export const SsIdSourceBits = 28
export const SsIdTickerBits = 8
export const SsIdHotTimestampBits = 27
export const SsIdHotMsb = 1

// The combined ticker + source width (used for shifting).
export const SsIdTickerSourceBits = SsIdSourceBits + SsIdTickerBits

// The maximum 27-bit Hot timestamp value (seconds elapsed from epoch).
export const SsIdHotTimestampMax = (1 << SsIdHotTimestampBits) - 1

// Cold UUID: [0-bit MSb | 34-bit seconds | 29-bit ticker]
export const SsIdColdTimestampBits = 34
export const SsIdColdTickerBits = 29
export const SsIdColdMsb = 0

// Hot Anonymous UUID: [27-bit seconds | 31-bit random]
// Seconds >= 126,230,400 (4 years) and < 130,424,704 (4y + 2^22).
export const SsIdAnonymousTimestampBits = 27
export const SsIdAnonymousRandomBits = 31
export const SsIdAnonymousSecondsMin = 126230400
export const SsIdAnonymousSecondsMax = 130424704

// The maximum value the 64-bit SubsecondId ticker (Hot), which is also the mask.
export const SsIdTickerMax = (1 << SsIdTickerBits) - 1

export const SubsecondIdSourceMax = (1 << SsIdSourceBits) - 1

// 64-bit Time Ticker (TMT): [32-bit seconds | 32-bit subsecond ticker]
export const TmtTimestampBits = 32
export const TmtTickerBits = 32
// Use 2**32 NOT (1 << 32): JS shift counts wrap mod 32, so 1 << 32 === 1.
export const TmtTickerMax = 2 ** TmtTickerBits - 1

//--- SSE: 128-bit Subsecond Id (per Clock.md) ---//

// [36-bit unsigned seconds | 16-bit subsecond ticker | 76-bit random id]
export const SsUIdSourceBits = 76
export const SsUIdTickerBits = 16
export const SsUIdTimestampBits = 36
// The maximum value the 128-bit SubsecondId ticker, which is also the mask.
export const SsUIdTickerMax = (1n << BigInt(SsUIdTickerBits)) - 1n

/*--- Utilities ---*/

// Converts a bigint to a 2-byte hex string.
export function NumberToHex(value: number, dest: string = ''): string {
  let hex = value.toString(16)
  if(value < 10) return dest + '0' + hex
  return dest + hex
}

// Converts a hex character string to a byte as a number.
export function PrintHexByte(input: number, dest: string = ''): string {
  if(input < 0n || input > 15n) return dest
  return dest + NumberToHex(input & 0xf) + NumberToHex((input >> 4) & 0xf)
}

// Counts the number of bits in a byte.
export function ByteCountBits(value: number) {
  if(value < 16) {
    if(value < 4) {
      if(value < 2) {
        if (value < 1)    return 0
        else              return 1
      }
      else                return 2
    } else {
      if (value < 8)      return 3
      else                return 4
    }
  } else {
    if (value < 64) {
      if (value < 32)     return 5
      else                return 6
    } else
      if (value < 128)    return 7
  }
  return 8
}

export function CountAssertedBits(value: number): number {
  let count = 0
  while(value < 64) {
    count += value & 1
    value >>= 1
  }
  return count
}

export function CountLeadingOnes(value: number): number {
  let count = 0
  while(count < 64) {
    if(!(value >> (63 - count++) & 1)) break
  }
  return count
}

export function CountLeadingZeros(value: number): number {
  let count = 0
  while(count < 64) {
    if(value >> (63 - count++) & 1) break
  }
  return count
}

// Returns the number of bytes in a number.
export function NumberCountBytes(value: number): number {
  if (value <= 0xffffffff) {
    if (value <= 0xffff) {
      if(value <= 0xff)
        return 1
      else
        return 2
    } else {
      if (value <= 0xffffff)
        return 3
      else
        return 4
    }
  } else {
    if (value <= 0xffffffffffff) {
      if (value <= 0xffffffffff)
        return 5
      else
        return 6
    }
  }
  return 7
}

// Returns the number of bits in a number.
// For 0, returns 1 to match 0.toString(2).length === 1.
export function NumberCountBits(value: number): number {
  if (value === 0) return 1
  const Bits = (NumberCountBytes(value) - 1) << 3 // << 3 to * 8
  let msb = (value < 1 << 30) ? value >> Bits
                              : Number(BigInt(value) >> BigInt(Bits))
  return Bits + ByteCountBits(msb)
}

// Left pads and prints a number with the given character count.
export function NumberPrint(value: number, char_count: number,
                            pad: string = ' ') {
  const Value = value.toString()
  if(char_count <= 3) return '0'.repeat(char_count)
  if(Value.length > char_count)
    return Value.substring(0, char_count - 3) + '...'
  return pad.repeat(char_count - Value.length) + Value
}

// Left pads and prints a bigint or number with the given character count.
export function BigIntPrint(value: number | bigint, char_count: number,
                            pad: string = ' ') {
  const Value = value.toString()
  if(char_count <= 3) return '0'.repeat(char_count)
  if(Value.length > char_count)
    return Value.substring(0, char_count - 3) + '...'
    return pad.repeat(char_count - Value.length) + Value
}

// Returns the number of bits in a bigint or number.
// For 0, returns 1 to match 0.toString(2).length === 1.
export function BinaryCount(value: bigint | number): number {
  const v = BigInt(value)
  if (v === 0n) return 1
  return v.toString(2).length
}

// Returns the number of bytes in a bigint.
export function BigIntCountBytes(value: bigint): number {
  const Bits = BinaryCount(value)
  return (Bits >> 3) + (Bits & 0x7 ? 1 : 0)
}

// Returns the number of bytes in a bigint.
export function BigIntCountBits(value: bigint): number {
  const ByteCount = BigIntCountBytes(value)

  return ((ByteCount - 1) << 3) + NumberCountBits(Number(value))
}

// Counts the number of decimals in a number.
export function NumberCountDecimals(value:number): number {
  // 2^53 = 9.007199254740992e15
  if(value < 0) value *= -1
  
  if(value < 100000000) {
    if (value < 10000) {
      if (value < 100) {
        if(value < 10)
          return 1
        else
          return 2
      } else {
        if (value < 1000)
          return 3
        else
          return 4
      }
    } else {
      if (value < 1000000) {
        if (value < 100000)
          return 5
        else
          return 6
      } else {
        if (value < 10000000)
          return 7
        else
          return 8
      }
    }
  } else {
    if (value < 1000000000000) {
      if (value < 10000000000) {
        if (value < 1000000000)
          return 9
        else
          return 10
      } else {
        if (value < 100000000000)
          return 11
        else
          return 12
      }
    } else {
      if (value < 100000000000000) {
        if (value < 10000000000000)
          return 13
        else
          return 14
      } else {
        if (value < 1000000000000000)
          return 15
        else
          return 16
      }
    }
  }
}

// Prints amd pads a number to a string to the given character count.
export function NumberPad(value: number, digit_count: number, 
    pad:string = ' ') {
  const DecimalCount = NumberCountDecimals(value)
  if(DecimalCount > digit_count) {
    if(digit_count <= 3) return '.'.repeat(digit_count)
    return value.toString().substring(0, digit_count - 3) + '...'
  }
  return pad.repeat(digit_count - DecimalCount) + value
}

// Counts the number of decimals in a string, number, or bigint.
// @warning Untested!
export function CountDecimals(value: bigint | number | string): number {
  switch(typeof value) {
    case 'bigint': return BigIntCountDecimals(BigInt(value))
    case 'number': return NumberCountDecimals(Number(value))
  }
  const Value = String(value)
  let i = 0
  let c = Value.charCodeAt(i)
  let leading_zero_count = 0
  if(c == '0'.charCodeAt(0)) {
    c = Value.charCodeAt(++i)
    while(c == '0'.charCodeAt(0)) c = Value.charCodeAt(++i)
    leading_zero_count = i
  }
  while(c != undefined && c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0))
    c = Value.charCodeAt(++i)
  return i - leading_zero_count
}

// Counts the number of decimals in a bigint.
export function BigIntCountDecimals(value:bigint): number {
  if(value < 0n) value *= -1n
  let decimal_count = 0
  const B53DecimalMax = 1000000000000000n
  while(value >= B53DecimalMax) {
    decimal_count += 15
    value /= B53DecimalMax
  }
  return decimal_count + NumberCountDecimals(Number(value))
}

/* Converts a BigInt to a Buffer.
@todo   Improve to copy bigint, which I've read is hacky with Node & CJS and
may require another function pointer type hack.
@return A Buffer containing [lid_source_lsw, SubsecondIdNextMSW()]. */
export function BigIntToBuffer(value: bigint) {
  const ByteCount = BigIntCountBytes(value)
  //console.log('value:' + value + ' ByteCount:' + ByteCount)
  const Buf = Buffer.alloc(ByteCount)
  for(let index = 0; index < ByteCount; ++index) {
    Buf[index] = Number((value >> BigInt(index << 3)) & 0xffn)
  }
  return Buf
}

export function NumberToBuffer(value: number) {
  const ByteCount = NumberCountBytes(value)
  //console.log('value:' + value + ' ByteCount:' + ByteCount)
  const Buf = Buffer.alloc(ByteCount)
  for(let index = 0; index < ByteCount; ++index) {
    Buf[index] = (value >> (index << 3)) & 0xff
  }
  return Buf
}

// Prints amd pads a number to a string to the given character count.
export function BigIntPad(value: bigint, decimals_max: number, 
  pad:string = ' ') {
  const DecimalCount = BigIntCountDecimals(value)
  if(DecimalCount > decimals_max) {
    if(decimals_max <= 3) return pad.repeat(decimals_max)
    return value.toString().substring(0, decimals_max - 3) + '...'
  }
  return pad.repeat(decimals_max - DecimalCount) + value
}

// Pads a binary string with leading zeros aligned to a bit boundary.
// @warning Does not check if the value string is not a binary string.
export function BinaryPad(value: string | number | bigint | undefined,
                          bit_count: number = 64, prefix: string = '0b',
                          pad: string = '0') { 
  if(bit_count <= 0) return ''
  const str = (typeof value === 'string')
            ? String(value)
            : value == undefined
            ? ''
            : value.toString(2)
  if(bit_count < str.length) {
    if (bit_count < 3) return prefix + '.'.repeat(bit_count)
    return prefix + str.substring(0, bit_count - 3) + '...'
  }
  return prefix + pad.repeat(bit_count - str.length) + str
}

export function BinaryPadBits(value: string | number | bigint | undefined,
    bit_count: number = 64, prefix: string = '0b') { 
  return BinaryPad(value, bit_count, prefix) + ':' + 
    (typeof value === 'string' 
      ? String(value).length : BigInt(value ?? 0n).toString(2).length)
}

// Converts a Buffer to a BigInt.
export function BufferToBigInt(buf: Buffer): bigint {
  //console.log('buf:"' + buf.toString() + '":' + buf.length)
  let result = 0n
  for(let i = 0; i < buf.length; ++i)
    result |= BigInt(buf[i] ?? 0) << BigInt(i << 3)
  return result
}

// Converts a Buffer to a BigInt.
export function BufferToHex(buf: Buffer): string {
  let result = ''
  for(let i = 0; i < buf.length; ++i)
    result = PrintHexByte(buf[i] ?? 0, result)
  return result
}

// Pads a hex value with leading zeros aligned to n-bit boundary.
// @warning Does not check if the value string is not a hex string.
export function HexPad(value: string | number | bigint | undefined, 
    bit_count: number = 64, prefix: string = '0x', pad: string = '0'): string
{
  if(bit_count <= 0) return ''
  const HexCount = (bit_count >> 2) + ((bit_count & 0x3) ? 1 : 0)
  let hex = typeof value === 'string'
          ? String(value)
          : value == undefined
            ? ''
            : value.toString(16)
  if(hex.length > HexCount) {
    if (HexCount < 3) return prefix + '.'.repeat(HexCount)
    return prefix + hex.substring(0, HexCount - 3) + '...'
  }
  return prefix + pad.repeat(HexCount - hex.length) + hex
}

// Pads a hex value with leading zeros aligned to n-bit boundary 
// followed by the bit count.
export function HexPadBits(value: string | number | bigint | undefined,
  bit_count: number = 64, prefix: string = '0x') { 
  return HexPad(value, bit_count, prefix, ) + ':' + 
    (typeof value === 'string' ? String(value).length 
                                           : BinaryCount(BigInt(value ?? 0n)))
}

// Converts a hex character string to a number.
export function HexToNibble(input: string | undefined): number {
  if (input == undefined) return -1
  let c = input.charCodeAt(0)
  if(c < '0'.charCodeAt(0) || c > 'z'.charCodeAt(0)) return -1
  if(c <= '9'.charCodeAt(0))
    return c - '0'.charCodeAt(0)
  if(c >= 'a'.charCodeAt(0))
    return c - 'a'.charCodeAt(0) + 10
  if(c < 'A'.charCodeAt(0) || c > 'Z'.charCodeAt(0))
    return -1
  return c - 'A'.charCodeAt(0) + 10
}

// Converts a hex string to an bigint.
export function HexToBigInt(hex: string): bigint {
  let result = 0n
  let length = hex.length
  if(hex == undefined || length == 0) return result
  let i = 0
  while(--length >= 0)
  result |= BigInt(HexToNibble(hex[i++]) << (length << 2))
  return result
}

// Converts a hex string to an number.
export function HexToNumber(hex: string): number {
  let result = 0
  let length = hex.length
  if(hex == undefined || length == 0) return result
  let i = 0
  while(--length >= 0)
  result |= HexToNibble(hex[i++]) << (length << 2)
  return result
}

// Converts a hex string to a Buffer.
export function HexToBuffer(hex: string): Buffer {
  //console.log ('::HexToBuffer(hex):"' + hex + '"')
  let length = hex.length
  let j = 0
  let nibble = hex[j]
  while(nibble == '0') nibble = hex[++j]
  let count = length - j
  const LSb = count & 0x1
  const ByteCount = (count >> 1) + LSb // >> 1 to / 2
  const Buf = Buffer.alloc(ByteCount)
  if(ByteCount <= 0) return Buf
  let i = ByteCount - 1
  let a = HexToNibble(nibble)
  if(a < 0) return Buf
  if(LSb == 1) {
    Buf[i--] = a
    a = HexToNibble(hex[++j])
    if(a < 0) return Buf
  }
  while (a >= 0) {
    let b =  HexToNibble(hex[++j])
    //console.log('a:' + a + ' b:' + b)
    if(b < 0) {
      Buf[i] = a
      return Buf
    }
    Buf[i--] = (a << 4) | b
    a = HexToNibble(hex[++j])
  }
  return Buf
}

// Generates a random bigint in the given min:max range.
export function BigIntInRange(rng: RNG, 
    min: bigint | number = 0,
    max: bigint | number = 0xffffffffffff): bigint {
  if(min > max) return 0n
  if(min == max) return BigInt(min)
  // Generate a random number in the given range.
  const Max = BigInt(max)
  const Min = BigInt(min)
  const Range = Max - Min // 5-(-8)=13
  const RangeBits = BigInt(BinaryCount(Range))
  //console.log('BigIntInRange: Min:' + Min + ':' + Min.toString(2).length +
  //            ' Max:' + Max + ':' + Max.toString(2).length + 
  //            ' RangeBits:' + RangeBits)
  let result = 0n
  let count = RangeBits - 1n
  while(count > 48n) {
    count -= 48n
    result |= BigInt(rng(0, 0xffffffffffff)) << count
    //console.log('count:' + count + ' result:0b' + BinaryPad(result) +
    //            ':' + result.toString(2).length)
  }
  // Generate the last 48 or less bits
  const Shift = (RangeBits - count)
  const Remainder = Number(Range >> Shift)
  if(Remainder != 0)
    result |= BigInt(rng(0, Remainder)) << Shift
  /*
  console.log('RangeBits:' + RangeBits + ' count:' + count + 
              ' Remainder: ' + Remainder + 
              ' result.bit_count:' + result.toString(2).length)
  */
  return Min + result
}

export function NumberInRange(rng: RNG,
    min: number = 0,
    max: number = 0xffffffffffff): number {
  return Number(BigIntInRange(rng, min, max))
}

// Generates a cryptographically secure bigint.
export function BigIntInBitRange(rng: RNG, bit_min: bigint | number = 1,
    bit_max: bigint | number = 64): bigint {
  if(bit_min <= 0 || bit_max <= 0 || bit_min > bit_max) return 0n
  const Max = (1n << BigInt(bit_max)) - 1n
  const Min = bit_min == 1n ? 0n : (1n << (BigInt(bit_min) - 1n))
  //console.log('bit_min:' + bit_min + ' bit_max:' + bit_max + ' Min:' + 
  //            Min + ' Max:' + Max)
  return BigIntInRange(rng, Min, Max)
}

// Generates a random number in the given range of bits.
export function NumberInBitRange(rng: RNG, bit_min: number, bit_max: number) {
  if(bit_min <= 0 || bit_max <= 0 || bit_min > bit_max || bit_max > 52) return 0
  const Max = (1 << bit_max) - 1
  const Min = bit_min == 1 ? 0 : (1 << (bit_min - 1))
  //console.log('bit_min:' + bit_min + ' bit_max:' + bit_max + ' Min:' + 
  //            Min + ' Max:' + Max)
  return NumberInRange(rng, Min, Max)
}

// Returns the maximum and one integer below the minimum value of the given bit 
// range.
// Examples: bit_min: 1 bit_max: 1 -> -1 < value <= 1
//           bit_min: 1 bit_max: 2 -> -1 < value <= 3
//           bit_min: 2 bit_max: 2 ->  1 < value <= 3
//           bit_min: 2 bit_max: 3 ->  1 < value <= 7
//           bit_min: 3 bit_max: 3 ->  3 < value <= 7
//           bit_min: 3 bit_max: 4 ->  3 < value <= 7
export function BitRangeMinMax(bit_min: bigint | number = 0,
  bit_max: bigint | number = 64) : [number, number] {
  const Max = (1n << BigInt(bit_max)) - 1n
  const Min = bit_min <= 1n ? -1n : (1n << (BigInt(bit_min) - 1n)) - 1n
  return [Number(Min), Number(Max)]
}

// Checks to see if a BigInt is in the given range.
export function BigIntIsInBitRange(value: bigint | number,
    bit_min: bigint | number = 0, bit_max: bigint | number = 64): boolean {
  const V = BigInt(value)
  const Max = (1n << BigInt(bit_max)) - 1n
  // For bit_min == 1: values with 1 bit are just 1, so Min = 0.
  // For bit_min > 1: Min = 2^(bit_min-1) (smallest value with bit_min bits).
  const Min = bit_min <= 1n ? 0n : (1n << (BigInt(bit_min) - 1n))
  /*
  console.log('BigIntIsInBitRange: value:0x' + value.toString(16) + ':' + 
              value.toString(2).length + ' bit_min:' + bit_min + 
              ' bit_max:' + bit_max + 
              ' Min:0x' + Min.toString(16) + ':' + Min.toString(2).length +
              ' Max:0x' + Max.toString(16) + ':' + Max.toString(2).length)
  */
  return V >= Min && V <= Max
}

// Generates a cryptographically secure bigint.
export function BigIntRandom(rng: RNG, 
    bit_count: bigint | number = 64): bigint {
  return BigIntInBitRange(rng, 0, bit_count)
}

export function NumberRandom(rng: RNG): number {
  return rng(Number.MIN_VALUE, Number.MAX_VALUE)
}

export function NumberNZ(rng: RNG, min: number = Number.MIN_VALUE, 
                         max: number = Number.MAX_VALUE): number {
  let generated = 0.0
  if(min >= max || (max - min) == generated) return generated
  while(generated == 0.0) {
    generated = rng(Number.MIN_VALUE, Number.MAX_VALUE)
  }
  return generated
}

// Generates the next non-zero random number between -1 and 1.
export function NumberNZFromNeg1To1(rng: RNG): number {
  let generated = 0.0
  while(generated == 0.0) {
    generated = rng(-1, 1)
  }
  return generated
}

// Gets the current date-time in seconds as a bigint.
export function TimestampSeconds(): number {
  return Math.floor(new Date().getTime() / 1000)
}

// Spin waits until the next second.
export function TimestampSecondsNext() {
  let time_start = TimestampSeconds()
  let now = time_start
  while(now == time_start) now = TimestampSeconds()
  return now
}

// Gets the current date-time in seconds as a bigint.
export function TimestampSecondsNextBigInt(): bigint {
  return BigInt(TimestampSecondsNext())
}

// Gets the current date-time in seconds as a number.
export function TimestampSecondsAsBigInt(): bigint {
  return BigInt(TimestampSeconds())
}
