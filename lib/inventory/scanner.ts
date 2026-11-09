// Correct keyboard-layout substitutions as text enters a scanner field.
// Preserve spaces and case while the operator is still typing.
export function normalizeScannerInput(value: string): string {
  return value.replace(/['‘’]/g, "-");
}
