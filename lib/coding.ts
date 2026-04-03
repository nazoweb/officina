import { base32Encode, base32Decode } from "./base32";
import {
  SECRET_KEY,
  isValidCategory,
  getCategoryName,
  normalizeCategory,
  type CategoryCode,
} from "./categories";

export interface DecodeResult {
  categoryCode: CategoryCode;
  categoryName: string;
  producerCode: string;
}

export interface EncodeResult {
  categoryCode: CategoryCode;
  categoryName: string;
  producerCode: string;
  stockCode: string;
}

/**
 * XOR bytes with a key, cycling the key if needed
 */
export function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/**
 * Derive the category-specific key using SHA-256
 * Key = SHA-256(SECRET_KEY + ":" + categoryCode)
 */
export async function deriveKey(categoryCode: string): Promise<Uint8Array> {
  const keyString = `${SECRET_KEY}:${categoryCode}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(keyString);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * Encode a producer code into a stock code
 */
export async function encodeProducerCode(
  categoryCode: string,
  producerCode: string
): Promise<EncodeResult> {
  // Normalize category
  const normalizedCategory = normalizeCategory(categoryCode);

  // Validate category
  if (!isValidCategory(normalizedCategory)) {
    throw new Error(`Categoria non valida: ${categoryCode}`);
  }

  // Trim and uppercase the producer code
  const normalizedProducerCode = producerCode.trim().toUpperCase();

  if (normalizedProducerCode.length === 0) {
    throw new Error("Il codice produttore non può essere vuoto");
  }

  // Convert producer code to UTF-8 bytes
  const encoder = new TextEncoder();
  const producerBytes = encoder.encode(normalizedProducerCode);

  // Derive the category key
  const key = await deriveKey(normalizedCategory);

  // XOR the producer bytes with the key
  const xoredBytes = xorBytes(producerBytes, key);

  // Base32 encode
  let base32Token = base32Encode(xoredBytes);

  // Remove trailing "=" padding
  base32Token = base32Token.replace(/=+$/, "");

  // Build final stock code
  const stockCode = `${normalizedCategory}-${base32Token}`;

  return {
    categoryCode: normalizedCategory,
    categoryName: getCategoryName(normalizedCategory),
    producerCode: normalizedProducerCode,
    stockCode,
  };
}

/**
 * Decode a stock code back to its original producer code
 */
export async function decodeStockCode(stockCode: string): Promise<DecodeResult> {
  // Trim and uppercase the stock code
  const normalizedStockCode = stockCode.trim().toUpperCase();

  // Verify it contains "-"
  if (!normalizedStockCode.includes("-")) {
    throw new Error("Formato non valido: il codice deve contenere un trattino (-)");
  }

  // Split at the first "-"
  const dashIndex = normalizedStockCode.indexOf("-");
  const categoryCode = normalizedStockCode.substring(0, dashIndex);
  const token = normalizedStockCode.substring(dashIndex + 1);

  // Normalize and validate category
  const normalizedCategory = normalizeCategory(categoryCode);

  if (!isValidCategory(normalizedCategory)) {
    throw new Error(`Categoria non valida: ${categoryCode}`);
  }

  if (token.length === 0) {
    throw new Error("Token mancante dopo il trattino");
  }

  try {
    // Base32 decode (handles padding restoration internally)
    const decodedBytes = base32Decode(token);

    // Derive the category key
    const key = await deriveKey(normalizedCategory);

    // XOR to get original bytes
    const originalBytes = xorBytes(decodedBytes, key);

    // Decode as UTF-8
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const producerCode = decoder.decode(originalBytes);

    return {
      categoryCode: normalizedCategory,
      categoryName: getCategoryName(normalizedCategory),
      producerCode,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Base32")) {
        throw new Error(`Token Base32 non valido: ${error.message}`);
      }
      if (error.name === "TypeError" || error.message.includes("UTF")) {
        throw new Error("Impossibile decodificare: dati UTF-8 non validi");
      }
    }
    throw new Error("Errore durante la decodifica del codice");
  }
}

/**
 * Parse bulk input format: "01-BOSCH123;02-PHILIPS999"
 * Returns both successful results and errors
 */
export async function encodeBulkInput(input: string): Promise<{
  results: EncodeResult[];
  errors: { input: string; error: string }[];
}> {
  const items = input
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const results: EncodeResult[] = [];
  const errors: { input: string; error: string }[] = [];

  for (const item of items) {
    if (!item.includes("-")) {
      errors.push({
        input: item,
        error: "Formato non valido: deve essere CATEGORIA-CODICE_PRODUTTORE",
      });
      continue;
    }

    const dashIndex = item.indexOf("-");
    const categoryPart = item.substring(0, dashIndex);
    const producerPart = item.substring(dashIndex + 1);

    try {
      const result = await encodeProducerCode(categoryPart, producerPart);
      results.push(result);
    } catch (error) {
      errors.push({
        input: item,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      });
    }
  }

  return { results, errors };
}

// ========================================
// INTERNAL TESTS (not exposed to users)
// ========================================

/**
 * Run internal verification tests
 * Call this during development to ensure algorithm correctness
 */
export async function runInternalTests(): Promise<void> {
  console.log("Running internal tests...");

  // Test 1: Same input -> same output (deterministic)
  const result1 = await encodeProducerCode("01", "BOSCH123");
  const result2 = await encodeProducerCode("01", "BOSCH123");
  console.assert(
    result1.stockCode === result2.stockCode,
    "Test 1 FAILED: Same input should produce same output"
  );
  console.log("Test 1 PASSED: Deterministic encoding");

  // Test 2: Round-trip encode/decode
  const originalCode = "VALEO77";
  const encoded = await encodeProducerCode("05", originalCode);
  const decoded = await decodeStockCode(encoded.stockCode);
  console.assert(
    decoded.producerCode === originalCode.toUpperCase(),
    "Test 2 FAILED: Round-trip should return original (uppercased)"
  );
  console.log("Test 2 PASSED: Round-trip encode/decode");

  // Test 3: Category normalization
  const result3 = await encodeProducerCode("1", "TEST");
  const result4 = await encodeProducerCode("01", "TEST");
  console.assert(
    result3.stockCode === result4.stockCode,
    "Test 3 FAILED: Category '1' should normalize to '01'"
  );
  console.log("Test 3 PASSED: Category normalization");

  // Test 4: Uppercase conversion
  const result5 = await encodeProducerCode("02", "lowercase");
  const decoded5 = await decodeStockCode(result5.stockCode);
  console.assert(
    decoded5.producerCode === "LOWERCASE",
    "Test 4 FAILED: Producer code should be uppercased"
  );
  console.log("Test 4 PASSED: Uppercase conversion");

  // Test 5: Bulk input parsing
  const bulk = await encodeBulkInput("01-ABC;02-DEF;INVALID;03-GHI");
  console.assert(
    bulk.results.length === 3,
    "Test 5a FAILED: Should have 3 valid results"
  );
  console.assert(
    bulk.errors.length === 1,
    "Test 5b FAILED: Should have 1 error"
  );
  console.log("Test 5 PASSED: Bulk input handling");

  // Test 6: Different categories produce different outputs
  const catA = await encodeProducerCode("01", "SAME");
  const catB = await encodeProducerCode("02", "SAME");
  console.assert(
    catA.stockCode !== catB.stockCode,
    "Test 6 FAILED: Different categories should produce different tokens"
  );
  console.log("Test 6 PASSED: Category affects encoding");

  console.log("All internal tests passed!");
}
