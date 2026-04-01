/**
 * Format a raw digit string to E.164 format for the US.
 * Assumes 10-digit input (area code + number).
 */
export function formatToE164(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  if (clean.startsWith('1') && clean.length === 11) return `+${clean}`
  return `+1${clean}`
}

/**
 * Format raw digits into a human-readable US phone number.
 * Input: "5551234567" → Output: "(555) 123-4567"
 */
export function formatPhone(digits: string): string {
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Format an E.164 number for display.
 * Input: "+18449593997" → Output: "+1 (844) 959-3997"
 */
export function formatE164Display(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1)
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }
  return e164
}
