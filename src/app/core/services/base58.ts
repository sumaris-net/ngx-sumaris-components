// Base58 encoding/decoding
// Originally written by Mike Hearn for BitcoinJ
// Copyright (c) 2011 Google Inc
// Ported to JavaScript by Stefan Thomas
// Merged Buffer refactorings from base58-native by Stephen Pair
// Copyright (c) 2013 BitPay Inc
// Rewritten in TypeScript by Ludovic Pecquot

// @dynamic
export class Base58 {

  private static alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  private static alphabetMap;

  private static getAlphabetMap() {
    if (!Base58.alphabetMap){
      this.alphabetMap = {};
      for (let i = 0; i < Base58.alphabet.length; i++) {
        Base58.alphabetMap[Base58.alphabet.charAt(i)] = i;
      }
    }
    return Base58.alphabetMap;
  }

  public static encode(buffer: Uint8Array): string {
    if (buffer.length === 0) return '';

    let i; let j; const digits = [0];
    for (i = 0; i < buffer.length; i++) {
      for (j = 0; j < digits.length; j++) digits[j] <<= 8;
      digits[digits.length - 1] += buffer[i];

      let carry = 0;
      for (j = digits.length - 1; j >= 0; j--){
        digits[j] += carry;
        carry = (digits[j] / 58) | 0;
        digits[j] %= 58;
      }

      while (carry) {
        digits.unshift(carry);
        carry = (digits[0] / 58) | 0;
        digits[0] %= 58;
      }
    }

    // deal with leading zeros
    for (i = 0; i < buffer.length - 1 && buffer[i] === 0; i++) digits.unshift(0);

    return digits.map(function(digit) { return Base58.alphabet[digit]; }).join('');
  }

  public static decode(string: string): Uint8Array {
    if (string.length === 0) return (new Uint8Array());

    const input = string.split('').map(function(c){
      return Base58.getAlphabetMap()[c];
    });

    let i; let j; const bytes = [0];
    for (i = 0; i < input.length; i++) {
      for (j = 0; j < bytes.length; j++) bytes[j] *= 58;
      bytes[bytes.length - 1] += input[i];

      let carry = 0;
      for (j = bytes.length - 1; j >= 0; j--){
        bytes[j] += carry;
        carry = bytes[j] >> 8;
        bytes[j] &= 0xff;
      }

      while (carry) {
        bytes.unshift(carry);
        carry = bytes[0] >> 8;
        bytes[0] &= 0xff;
      }
    }

    // deal with leading zeros
    for (i = 0; i < input.length - 1 && input[i] === 0; i++) bytes.unshift(0);
    return (new Uint8Array(bytes));
  }
}
