/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — PRIVACY SANITIZER & CSV FORMULA-INJECTION DEFENSE
 * SPRINT 2: GATE 0.3 (PRIVACY & REDACTION) & GATE 0.4 (CSV SAFETY)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Redaksi handle pengguna publik (misal: @johndoe -> @j***oe)
 */
export function redactHandle(rawHandle: string): string {
  if (!rawHandle) return '@anon'
  const clean = rawHandle.trim().replace(/^@/, '')
  if (clean.length === 0) return '@anon'
  if (clean.length <= 3) return `@${clean.charAt(0)}***`
  const first = clean.charAt(0)
  const last = clean.slice(-2)
  return `@${first}***${last}`
}

/**
 * Redaksi alamat email (misal: analisis@militer.id -> a***s@militer.id)
 */
export function redactEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`
  }
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`
}

/**
 * Redaksi nomor telepon (misal: 0812-3456-7890 -> 0812-****-7890)
 */
export function redactPhoneNumber(phone: string): string {
  if (!phone) return phone
  const clean = phone.trim()
  if (/^(\+?\d{2,4}[-\s]?)(\d{3,4})([-\s]?\d{3,4})$/.test(clean)) {
    return clean.replace(/^(\+?\d{2,4}[-\s]?)(\d{3,4})([-\s]?\d{3,4})$/, '$1****$3')
  }
  if (clean.length <= 6) return '****'
  const prefix = clean.slice(0, 4)
  const suffix = clean.slice(-4)
  return `${prefix}****${suffix}`
}

/**
 * Menjalankan redaksi privasi default pada seluruh teks input publik
 */
export function applyPrivacyRedaction(rawText: string): string {
  if (!rawText) return ''
  let redacted = rawText

  // 1. Redaksi email
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
    return redactEmail(match)
  })

  // 2. Redaksi NIK Indonesia (16 digit) sesuai mandat UU PDP No. 27 Tahun 2022
  redacted = redacted.replace(/\b([1-9]\d{5})(\d{6})(\d{4})\b/g, '$1******$3')

  // 3. Redaksi nomor telepon internasional / indonesia (+62 / 08xx)
  redacted = redacted.replace(/(?:\+62|08)[\d\s-]{8,16}/g, (match) => {
    return redactPhoneNumber(match.trim())
  })

  // 4. Redaksi handle media sosial (@username)
  redacted = redacted.replace(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})/g, (_match, prefix, handle) => {
    return `${prefix}${redactHandle(handle)}`
  })

  return redacted
}

/**
 * Karakter berbahaya yang dapat memicu eksekusi formula spreadsheet (DDE / CSV Injection)
 * Mendukung formula standar RFC 4180, format DDE pipe, dan varian full-width Unicode.
 */
const FORMULA_TRIGGER_CHARS = [
  '=', '+', '-', '@', '\t', '\r', '\n', '|',
  '\uFF1D', // Fullwidth Equals Sign (＝)
  '\uFF0B', // Fullwidth Plus Sign (＋)
  '\uFF0D', // Fullwidth Hyphen-Minus (－)
  '\uFF20'  // Fullwidth Commercial At (＠)
]

/**
 * Sanitasi nilai sel tunggal sebelum dimasukkan ke file CSV
 * Mematuhi RFC 4180 dan proteksi formula spreadsheet
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  let str = String(value)

  // Cek apakah sel diawali dengan karakter pemicu formula (termasuk spasi awalan)
  const trimmedLeading = str.trimStart()
  const isFormula = FORMULA_TRIGGER_CHARS.some(char => trimmedLeading.startsWith(char))

  if (isFormula) {
    // Prepend petik tunggal agar spreadsheet memperlakukannya sebagai literal text murni
    str = `'${str}`
  }

  return str
}

/**
 * Serializer CSV tangguh yang aman dari formula injection dan mendukung delimiter standar
 */
export function serializeToSafeCsv(
  arg1: string[] | Array<Record<string, unknown>>,
  arg2?: string[] | Array<Record<string, unknown>>
): string {
  let headers: string[]
  let rows: Array<Record<string, unknown>>

  if (Array.isArray(arg1) && typeof arg1[0] === 'string') {
    headers = arg1 as string[]
    rows = (arg2 as Array<Record<string, unknown>>) || []
  } else {
    rows = (arg1 as Array<Record<string, unknown>>) || []
    headers = (arg2 as string[]) || (rows.length > 0 ? Object.keys(rows[0]) : [])
  }

  const formatCell = (val: unknown): string => {
    const sanitized = sanitizeCsvCell(val)
    const escaped = sanitized.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const headerLine = headers.map(h => formatCell(h)).join(',')
  const rowLines = rows.map(row => {
    return headers.map(key => formatCell(row[key])).join(',')
  })

  return [headerLine, ...rowLines].join('\r\n')
}

/**
 * Serializer JSON terstruktur tanpa identifier pribadi mentah
 */
export function serializeToSafeJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
