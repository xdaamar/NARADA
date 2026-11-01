/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — EVIDENCE BROWSER SECURITY & NAVIGATION POLICY (Sprint 7)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * 1. Hanya protokol publik terenkripsi/standar: http:// dan https:// (HTTPS diprioritaskan).
 * 2. Penolakan tegas skema berbahaya (javascript:, file:, data:, blob:, custom schemes).
 * 3. Pemblokiran target internal, localhost, loopback, private IP, dan cloud metadata.
 * 4. Pemblokiran akses ke port gateway loopback NARADA (5173, 5174, 5175, 5176).
 * 5. Penolakan kredensial tertanam dalam URL (username/password).
 * ══════════════════════════════════════════════════════════════════════════
 */

// Port terlarang milik sistem internal NARADA
const FORBIDDEN_PORTS = new Set(['5173', '5174', '5175', '5176', '8080', '3000'])

// Skema terlarang
const FORBIDDEN_SCHEMES = new Set([
  'javascript:',
  'file:',
  'data:',
  'blob:',
  'filesystem:',
  'chrome:',
  'devtools:',
  'about:',
  'ftp:',
  'ws:',
  'wss:',
  'gopher:',
  'ldap:'
])

/**
 * Memeriksa apakah suatu alamat IPv4 berada dalam jangkauan IP Privat / Loopback / Link-Local
 */
function isPrivateOrReservedIPv4(ip) {
  const parts = ip.split('.').map(p => parseInt(p, 10))
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false
  }

  const [a, b, c, d] = parts

  // 0.0.0.0/8
  if (a === 0) return true
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true
  // 10.0.0.0/8 (Private)
  if (a === 10) return true
  // 172.16.0.0/12 (Private 172.16 - 172.31)
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true
  // 169.254.0.0/16 (Link-local / AWS / GCP / Azure Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true
  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true

  return false
}

/**
 * Validasi dan normalisasi URL navigasi untuk browser bukti digital
 */
function validateNavigationUrl(rawUrl, options = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, rejectionReason: 'URL tidak boleh kosong' }
  }

  let trimmed = rawUrl.trim()

  // Tolak karakter kontrol dan CRLF
  if (/[\r\n\x00-\x1f\x7f]/.test(trimmed)) {
    return { isValid: false, rejectionReason: 'Karakter kontrol dilarang dalam URL' }
  }

  // Jika input berupa domain tanpa skema (misal 'antaranews.com'), normalisasi ke https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    trimmed = 'https://' + trimmed
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch (err) {
    return { isValid: false, rejectionReason: 'Sintaks URL tidak valid: ' + err.message }
  }

  const protocol = parsed.protocol.toLowerCase()

  // Hanya http dan https yang diizinkan
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      isValid: false,
      rejectionReason: `Protokol '${protocol}' dilarang. Hanya HTTP dan HTTPS yang diizinkan.`
    }
  }

  // Tolak kredensial tertanam (username / password dalam URL)
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      rejectionReason: 'Penyematan kredensial (username/password) dalam URL dilarang demi keamanan'
    }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (!hostname) {
    return { isValid: false, rejectionReason: 'Hostname URL kosong' }
  }

  // Blokir localhost dan loopback string
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    return {
      isValid: false,
      rejectionReason: `Akses ke alamat loopback '${hostname}' dilarang keras.`
    }
  }

  // Cek apakah hostname adalah IPv4 literal
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return {
        isValid: false,
        rejectionReason: `Akses ke alamat IP privat/reserved '${hostname}' dilarang demi keamanan jaringan.`
      }
    }
  }

  // Blokir IPv6 loopback / local literal
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const inner = hostname.slice(1, -1).toLowerCase()
    if (inner === '::1' || inner.startsWith('fe80:') || inner.startsWith('fc00:') || inner.startsWith('fd00:')) {
      return {
        isValid: false,
        rejectionReason: `Akses ke IPv6 privat/loopback '${hostname}' dilarang.`
      }
    }
  }

  // Blokir port loopback NARADA & port sistem sensitif
  const port = parsed.port
  if (port && FORBIDDEN_PORTS.has(port)) {
    return {
      isValid: false,
      rejectionReason: `Akses ke port internal NARADA (${port}) dilarang.`
    }
  }

  return {
    isValid: true,
    normalizedUrl: parsed.href,
    protocol,
    hostname,
    port: port || (protocol === 'https:' ? '443' : '80')
  }
}

module.exports = {
  validateNavigationUrl,
  isPrivateOrReservedIPv4,
  FORBIDDEN_PORTS,
  FORBIDDEN_SCHEMES
}
