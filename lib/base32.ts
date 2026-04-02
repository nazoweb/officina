// RFC 4648 Base32 Alphabet
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a Uint8Array into a Base32 string (RFC 4648)
 */
export function base32Encode(data: Uint8Array): string {
  if (data.length === 0) return "";

  let result = "";
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < data.length; i++) {
    buffer = (buffer << 8) | data[i];
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      const index = (buffer >> bitsInBuffer) & 0x1f;
      result += BASE32_ALPHABET[index];
    }
  }

  // Handle remaining bits
  if (bitsInBuffer > 0) {
    const index = (buffer << (5 - bitsInBuffer)) & 0x1f;
    result += BASE32_ALPHABET[index];
  }

  // Add padding to make length a multiple of 8
  while (result.length % 8 !== 0) {
    result += "=";
  }

  return result;
}

/**
 * Decodes a Base32 string into a Uint8Array (RFC 4648)
 * Handles padding restoration automatically
 */
export function base32Decode(encoded: string): Uint8Array {
  // Remove any whitespace and convert to uppercase
  let input = encoded.trim().toUpperCase();

  // Restore padding if needed
  while (input.length % 8 !== 0) {
    input += "=";
  }

  // Remove padding for processing
  const withoutPadding = input.replace(/=+$/, "");

  if (withoutPadding.length === 0) return new Uint8Array(0);

  // Validate characters
  for (const char of withoutPadding) {
    if (!BASE32_ALPHABET.includes(char)) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
  }

  const result: number[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const char of withoutPadding) {
    const value = BASE32_ALPHABET.indexOf(char);
    buffer = (buffer << 5) | value;
    bitsInBuffer += 5;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      result.push((buffer >> bitsInBuffer) & 0xff);
    }
  }

  return new Uint8Array(result);
}
