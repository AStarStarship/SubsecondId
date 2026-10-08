// Copyright [AStarship](https://astarship.net).

import { randomInt as rng } from 'crypto';
import { BigIntCountDecimals, BigIntInBitRange, BigIntIsInBitRange,
  BigIntToBuffer, BigIntRandom, BinaryPad, BinaryPadBits, BufferToBigInt,
  ByteCountBits, HexToBigInt, HexToBuffer, HexPadBits, NumberCountBits,
  NumberCountBytes, NumberCountDecimals
} from '../dist';

import { expect, test } from '@jest/globals';
import { NumberInTestRange, TestBitCount, TestBitsUpTo, TestCount, 
  TestsPerBit } from './Global';

// Number of times to print the test loop.
const TestPrintCount = 0;

// Asserts the lsw_i and msw_i are the same as the lsw_p and msw_p 
// respectively.
export function BigIntVerify(expected: bigint, found: bigint, tag: string) {
  if(expected != found)
    console.log('\nUnexpected error at Utilities' + tag + 
      '\nExpected: ' + HexPadBits(expected) +
      '\nFound   : ' + HexPadBits(found) +
      '\nXOR     : ' + HexPadBits(found ^ expected) + '\n' +
      '\nExpected: ' + BinaryPadBits(expected) +
      '\nFound   : ' + BinaryPadBits(found) +
      '\nXOR     : ' + BinaryPadBits(found ^ expected));
  expect(expected == found).toBe(true); 
}

test('Utilities.Test', () => {
  let i = 0;
  let j = 0;

  //console.log('Testing ByteCountBits');
  expect(ByteCountBits(0)).toBe(0);
  for(j = 1; j <= 8; ++j)
    while(++i < 1 << j) expect(ByteCountBits(i)).toBe(j);

  //console.log('Testing BigIntRandom...');
  for(i = 0; i < TestPrintCount; ++i) {
    const BitCount = 64;
    const STR = BigIntRandom(rng, BitCount);
    if(STR.toString(2).length > BitCount)
      console.log('STR: ' + STR + ' 0b' + STR.toString(2) + ':' + 
                  STR.toString(2).length + '\n');
    const STRPad = BinaryPad(STR, BitCount, '');
    if(STRPad.length > BitCount)
      console.log('STRPad: ' + STRPad + ':' + STRPad.length + '\n');
    expect(STR.toString(2).length).toBeLessThanOrEqual(BitCount);
    expect(STRPad.length).toBeLessThanOrEqual(BitCount);
  }
  
  //console.log('Testing BigIntInBitRange...');
  for(i = 1; i <= TestBitsUpTo; ++i) {
    for(j = 1; j <= 100; ++j) {
      //console.log('-------------------------------------------------------');
      const V = BigIntInBitRange(rng, i, i);
      let padded = BinaryPad(V, 64);
      if (!BigIntIsInBitRange(V, i, i))
        console.log(i + '.) V:0x' + V.toString(16) + 
                    ':' + V.toString(2).length +
                    ' 0b' + padded + ':' + V.toString(2).length + '\n');
      expect(BigIntIsInBitRange(V, i, i)).toBe(true);
    }
  }
  
  //console.log('Testing NumberCountBytes');
  i = 0;
  for(j = 0; j < TestBitCount; ++j)
    while(++i < (1 << j))
      expect(NumberCountBytes(i)).toBe(Math.ceil(i.toString(16).length / 2));
  
  for(j = 0; j < TestCount; ++j) {
    const V = NumberInTestRange();
    expect(NumberCountBytes(V)).toBe(Math.ceil(V.toString(16).length / 2));
  }
  
  //console.log('Testing NumberCountBits');
  i = 0;
  for(j = 0; j < TestBitCount; ++j)
    while(++i < (1 << j)) expect(NumberCountBits(i)).toBe(j);

  for(j = 0; j < TestCount; ++j) {
    const V = NumberInTestRange();
    if (NumberCountBits(V) != V.toString(2).length) {
      console.log('V:' + V + ' 0x' + V.toString(16) + ' 0b' + V.toString(2));
    }
    expect(NumberCountBits(V)).toBe(V.toString(2).length);
  }

  let problem_children: number[] = [81034501338101, 133095497592179];
  for(let k = 0; k < problem_children.length; ++k){
    let red_headed_stepchild = problem_children[k];
    if(red_headed_stepchild == undefined) break;
    expect(NumberCountBits(red_headed_stepchild)).
      toBe(red_headed_stepchild.toString(2).length)
  }

  //console.log('Testing HexToBigInt');
  for(j = 0; j < TestPrintCount; ++j) {
    let Value = BigIntRandom(rng);
    //console.log('Value:0x' + Value);
    const Result = HexToBigInt(Value.toString(16));
    //console.log('Result:' + Result);
    if(Value != Result) {
      console.log('HexToBigInt CRITICAL ERROR ' + Value + ': 0x' + 
                  Value.toString(16) + ' found ' + Result + ': 0x' + 
                  Result.toString(16));
    }
    expect(Value).toBe(Result);
  }
  
  let int_i = BigIntRandom(rng);

  let str = int_i.toString(16);
  let int_p = HexToBigInt(str);
  BigIntVerify(int_i, int_p, '::HexToBigInt::A');
  //console.log(
  //  'Scanning SubsecondUUID Hex...\n\n' +
  //  '\nint_i: 0x' + int_i.toString(16) + "  0b'" + int_i.toString(2) + 
  //  '\nint_p: 0x' + int_p.toString(16) + "  0b'" + int_p.toString(2) +
  //  '\nint_h: 0x' + str);

  BigIntVerify(int_i, int_p, '::B');

  let buf = BigIntToBuffer(int_i);
  int_p = BufferToBigInt(buf);
  BigIntVerify(int_i, int_p, '::C');

  buf = HexToBuffer(str);
  expect(buf).not.toBe(undefined);
  int_p = BufferToBigInt(buf);
  BigIntVerify(int_i, int_p, '::D');
  
  for(j = 2; j < TestBitCount; ++j) {
    for (let i = 0; i < (j < TestsPerBit ? j >> 2 : TestsPerBit); ++i) {
      int_i = BigIntInBitRange(rng, j < TestsPerBit ? 1 : j, j);
      const IntIHex = int_i.toString(16);
      int_p = HexToBigInt(IntIHex);
      BigIntVerify(int_i, int_p, '::BigIntToHex');
      
      buf = BigIntToBuffer(int_i);
      int_p = BufferToBigInt(buf);
      BigIntVerify(int_i, int_p, '::BigIntToBuffer');
      
      buf = HexToBuffer(IntIHex);
      int_p = BufferToBigInt(buf);
      BigIntVerify(int_i, int_p, '::HexToBuffer');
    }
  }
  
  //console.log("Testing NumberCountDecimals...");
  expect(NumberCountDecimals(1)).toBe(1);
  for(i = 0; i < 100000; ++i) {
    const Expected = i.toString().length;
    const Received = NumberCountDecimals(i);
    if(Expected != Received) {
      console.log('Unexpected error at Utilities::NumberCountDecimals'
                + '\nExpected: ' + Expected + '\nReceived:' + Received);
    }
    expect(Received).toBe(Expected);
  }
  j = 10;
  for(i = 2; i <= 16; ++i) {
    expect(NumberCountDecimals(j)).toBe(j.toString().length);
    j *= 10;
  }
  
  //console.log("Testing BigIntCountDecimals...");
  let value = 10000000000000000n;
  for(i = 17; i <= 100; ++i) {
    expect(BigIntCountDecimals(value)).toBe(i);
    value *= 10n;
  }
});
