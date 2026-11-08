import { XMLParser } from 'fast-xml-parser'
import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../../types.ts'
import { parseSourceDate, formatMilitaryDate, evaluateFreshness } from '../radar/freshness-engine.ts'
import type { SearchTrendSignal, RadarTaxonomyDomain } from '../radar/radar-types.ts'
import { normalizeUrl } from '../radar/clustering-engine.ts'
import { classifyTaxonomyDomain } from '../radar/radar-assessment.ts'

// Inisialisasi parser XML aman dengan fast-xml-parser
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  cdataPropName: false // CDATA digabung langsung ke nilai teks
})

/**
 * Helper untuk normalisasi elemen tunggal atau array dari parser XML
 */
function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

/**
 * Ekstraksi teks dari node parser XML yang mungkin berupa string, number, atau objek dengan #text
 */
function extractNodeText(node: any): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (typeof node === 'object') {
    if (typeof node['#text'] === 'string') return node['#text']
    if (typeof node['__cdata'] === 'string') return node['__cdata']
    if (typeof node['_text'] === 'string') return node['_text']
    // Jika tidak ada #text, cek apakah node memiliki nilai string pertama
    const keys = Object.keys(node)
    for (const k of keys) {
      if (!k.startsWith('@_') && typeof node[k] === 'string') {
        return node[k]
      }
    }
  }
  return ''
}

/**
 * Ekstraksi link URL dari node (mendukung RSS 2.0 <link> dan Atom <link href="..."/>)
 */
function extractLink(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node.trim()
  if (typeof node === 'object') {
    if (node['@_href']) return String(node['@_href']).trim()
    if (node['#text']) return String(node['#text']).trim()
  }
  return ''
}

/**
 * Implementasi Standar FIPS 180-4 / RFC 6234 SHA-256 murni JavaScript
 * Berjalan deterministik dan sinkron di seluruh lingkungan (Browser, Node, Worker, Electron)
 */
export function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount))
  }

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]

  const utf8: number[] = []
  for (let i = 0; i < ascii.length; i++) {
    let c = ascii.charCodeAt(i)
    if (c < 128) {
      utf8.push(c)
    } else if (c < 2048) {
      utf8.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    } else if (c < 55296 || c >= 57344) {
      utf8.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    } else {
      i++
      c = 65536 + (((c & 1023) << 10) | (ascii.charCodeAt(i) & 1023))
      utf8.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      )
    }
  }

  const bitLen = utf8.length * 8
  utf8.push(0x80)
  while ((utf8.length % 64) !== 56) {
    utf8.push(0)
  }

  for (let b = 7; b >= 0; b--) {
    utf8.push((bitLen / Math.pow(2, b * 8)) & 0xff)
  }

  for (let s = 0; s < utf8.length; s += 64) {
    const w = new Array(64)
    for (let t = 0; t < 16; t++) {
      w[t] =
        (utf8[s + t * 4] << 24) |
        (utf8[s + t * 4 + 1] << 16) |
        (utf8[s + t * 4 + 2] << 8) |
        (utf8[s + t * 4 + 3])
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (((w[t - 16] + s0) | 0) + ((w[t - 7] + s1) | 0)) | 0
    }

    let [a, b, c, d, e, f, g, h0] = hash
    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ ((~e) & g)
      const temp1 = ((((h0 + S1) | 0) + ((ch + k[t]) | 0)) | 0) + w[t] | 0
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0

      h0 = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }

    hash[0] = (hash[0] + a) | 0
    hash[1] = (hash[1] + b) | 0
    hash[2] = (hash[2] + c) | 0
    hash[3] = (hash[3] + d) | 0
    hash[4] = (hash[4] + e) | 0
    hash[5] = (hash[5] + f) | 0
    hash[6] = (hash[6] + g) | 0
    hash[7] = (hash[7] + h0) | 0
  }

  return hash.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('')
}

/**
 * Menghasilkan ID publikasi stabil berbasis SHA-256 dari canonical URL yang telah dinormalisasi
 */
export function generateStablePublicationId(canonicalUrl: string): string {
  const normalized = normalizeUrl(canonicalUrl)
  return `PUB-${sha256Hex(normalized).slice(0, 16)}`
}

/**
 * Membersihkan entitas HTML, XML CDATA, dan tag markup dari teks mentah
 */
export function cleanHtmlText(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ekstraksi intisari penjelasan/fakta sebenarnya dari deskripsi artikel TurnBackHoax
 */
export function extractClarificationFromDesc(descText: string): string {
  const text = cleanHtmlText(descText)
  if (!text) return 'Klarifikasi resmi telah diterbitkan oleh Mafindo; konten dikategorikan manipulatif/hoaks.'

  const match = text.match(/(?:FAKTANYA|PENJELASAN|HASIL CEK FAKTA|KLARIFIKASI|Fakta Terverifikasi)[:\s]+([^]+?)(?:RUJUKAN|SUMBER|REFERENSI|KATEGORI|$)/i)
  let snippet = ''

  if (match && match[1] && match[1].trim().length > 20) {
    snippet = match[1].trim()
  } else {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 25)
    snippet = sentences.slice(0, 2).join(' ') || text
  }

  if (snippet.length > 280) {
    const cut = snippet.substring(0, 280)
    const lastPeriod = cut.lastIndexOf('.')
    if (lastPeriod > 100) {
      snippet = cut.substring(0, lastPeriod + 1)
    } else {
      snippet = cut + '...'
    }
  }

  return snippet
}

/**
 * Deteksi institusi otoritatif rujukan verifikasi
 */
export function extractOfficialSourceFromText(text: string): string {
  const norm = text.toUpperCase()
  if (norm.includes('BMKG')) return 'BMKG (Badan Meteorologi Klimatologi Geofisika)'
  if (norm.includes('BNPB')) return 'BNPB (Badan Penanggulangan Bencana)'
  if (norm.includes('SETWAPRES') || norm.includes('WAKIL PRESIDEN')) return 'Setwapres RI'
  if (norm.includes('KEMENSOS') || norm.includes('KEMENTERIAN SOSIAL')) return 'Kementerian Sosial RI'
  if (norm.includes('BPOM')) return 'Badan Pengawas Obat dan Makanan (BPOM)'
  if (norm.includes('KEMENKES')) return 'Kementerian Kesehatan RI'
  if (norm.includes('KEMHAN') || norm.includes('KEMENTERIAN PERTAHANAN')) return 'Kementerian Pertahanan RI'
  if (norm.includes('TNI AD') || norm.includes('DISPENAD') || norm.includes('PUSSIBERAD')) return 'Dispenad / Pussiberad TNI AD'
  if (norm.includes('TNI AU')) return 'Dispenau TNI AU'
  if (norm.includes('TNI AL')) return 'Dispenal TNI AL'
  if (norm.includes('POLRI') || norm.includes('DIVHUMAS')) return 'Divhumas Polri'
  if (norm.includes('KOMINFO') || norm.includes('BSSN')) return 'Kementerian Kominfo / BSSN'
  if (norm.includes('KPU')) return 'Komisi Pemilihan Umum (KPU)'
  if (norm.includes('BAWASLU')) return 'Bawaslu RI'
  if (norm.includes('PERTAMINA')) return 'PT Pertamina (Persero)'

  return 'TurnBackHoax.ID & MAFINDO'
}

/**
 * Pemetaan klaster spektrum ancaman kognitif nasional
 */
export function classifyCluster(title: string, body: string): ThreatSpectrumCluster {
  const norm = (title + ' ' + body).toLowerCase()

  if (
    norm.includes('tni') ||
    norm.includes('militer') ||
    norm.includes('alutsista') ||
    norm.includes('kemhan') ||
    norm.includes('kopassus') ||
    norm.includes('kodim') ||
    norm.includes('koramil') ||
    norm.includes('papua') ||
    norm.includes('opm') ||
    norm.includes('kkb') ||
    norm.includes('natuna') ||
    norm.includes('pangkalan militer') ||
    norm.includes('senjata') ||
    norm.includes('intelijen')
  ) {
    return 'KEDAULATAN_MILITER'
  }

  if (
    norm.includes('gempa') ||
    norm.includes('tsunami') ||
    norm.includes('megathrust') ||
    norm.includes('katulampa') ||
    norm.includes('bendung') ||
    norm.includes('merapi') ||
    norm.includes('erupsi') ||
    norm.includes('banjir') ||
    norm.includes('bmkg') ||
    norm.includes('bnpb')
  ) {
    return 'BENCANA_DARURAT'
  }

  if (
    norm.includes('bansos') ||
    norm.includes('blt') ||
    norm.includes('kemensos') ||
    norm.includes('bit.ly') ||
    norm.includes('s.id') ||
    norm.includes('kuota') ||
    norm.includes('apk') ||
    norm.includes('tilang') ||
    norm.includes('loker') ||
    norm.includes('undian') ||
    norm.includes('pendaftaran bantuan') ||
    norm.includes('pemulihan korban')
  ) {
    return 'PENIPUAN_BANSOS'
  }

  if (
    norm.includes('beras plastik') ||
    norm.includes('vaksin') ||
    norm.includes('penculikan anak') ||
    norm.includes('obat sirup') ||
    norm.includes('racun') ||
    norm.includes('telur palsu') ||
    norm.includes('bpom') ||
    norm.includes('kemenkes')
  ) {
    return 'KESEHATAN_PANGAN'
  }

  return 'POLITIK_NEGARA'
}

/**
 * Ekstraksi kata kunci utama
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !['yang', 'untuk', 'dengan', 'dalam', 'tidak', 'adalah', 'pada', 'dari'].includes(w))
    .slice(0, 8)
}

export interface PublicationEligibilityResult {
  isEligible: boolean
  exclusionReason?: 'IRRELEVANT_TOPIC' | 'NO_CHECKABLE_CLAIM' | 'INSUFFICIENT_CONTEXT' | 'DUPLICATE_PUBLICATION' | 'ALREADY_ASSESSED'
  reasonExplanation?: string
  matchedDomain?: RadarTaxonomyDomain
}

/**
 * Mendeteksi apakah teks hanya berupa nama institusi/organisasi/publisher mandiri
 * tanpa klaim, peristiwa, atau predikat berita yang dapat diuji faktanya.
 * Mencegah masuknya data non-berita/dummy hasil crawling indeks homepage seperti:
 * "Kementerian Komunikasi dan Digital", "Kementerian Pertahanan RI", dsb.
 */
export function isPureInstitutionOrPublisherName(title: string, sourceName = ''): boolean {
  if (!title || typeof title !== 'string') return true
  const tNorm = title.trim().toLowerCase()
  const sNorm = (sourceName || '').trim().toLowerCase()

  // 1. Identik langsung dengan nama sumber / platform penerbit
  if (sNorm && (tNorm === sNorm || tNorm.replace(/\s+/g, '') === sNorm.replace(/\s+/g, ''))) {
    return true
  }

  // 2. Format judul homepage portal redundan: "Nama Institusi - Nama Institusi" atau "X | X"
  const delimiterParts = title.split(/\s*[-–—|/]\s*/).map(p => p.trim().toLowerCase()).filter(Boolean)
  if (delimiterParts.length >= 2 && delimiterParts[0] === delimiterParts[1]) {
    return true
  }

  // 3. Jika setelah membuang nama sumber tidak tersisa kata berita
  if (sNorm && tNorm.length > 0) {
    const escapedSource = sNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const stripped = tNorm.replace(new RegExp(`\\s*[-–—|]?\\s*${escapedSource}\\s*$`, 'i'), '').trim()
    if (!stripped || stripped === sNorm) {
      return true
    }
  }

  // 4. Deteksi apakah seluruh token substantif hanya terdiri dari kata nama instansi / organisasi
  const orgNouns = new Set([
    'kementerian', 'kemen', 'kemhan', 'kemenkes', 'kemensos', 'kominfo', 'komdigi',
    'pertahanan', 'kesehatan', 'sosial', 'keuangan', 'agama', 'hukum', 'ham', 'komunikasi',
    'digital', 'perhubungan', 'pertanian', 'kelautan', 'perikanan', 'pupr', 'bumn',
    'badan', 'lembaga', 'dewan', 'direktorat', 'jenderal', 'dinas', 'pemprov', 'pemkot',
    'pemkab', 'pemerintah', 'provinsi', 'kabupaten', 'kota', 'ri', 'indonesia', 'republik',
    'tni', 'polri', 'ad', 'al', 'au', 'mabes', 'kodam', 'korem', 'kodim', 'koramil',
    'kejaksaan', 'agung', 'mahkamah', 'konstitusi', 'bawaslu', 'kpu', 'bnpb', 'bmkg',
    'portal', 'berita', 'nasional', 'pers', 'media', 'news', 'harian', 'pusat', 'penerangan',
    'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'ikatan', 'konsultan', 'pajak', 'sekretariat',
    'negara', 'kantor', 'staf', 'presiden', 'ksp'
  ])

  const clean = tNorm.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = clean.split(' ').filter(w => w.length >= 2)

  // Jika panjang kata 1 s.d. 6 dan SEMUA kata adalah kata nama instansi
  if (words.length >= 1 && words.length <= 6) {
    if (words.every(w => orgNouns.has(w))) {
      return true
    }
  }

  return false
}

/**
 * Penapis Intelijen Kognitif Terbuka (Radar Recall & Cognitive Gatekeeper — Sprint 6)
 * Membuka ruang penemuan topik strategis nasional (kebijakan negara, ekonomi digital, hankam, dll.)
 * tanpa bergantung pada gating viralitas sempit ("viral", "heboh", "polemik", "hoaks").
 */
export function evaluatePublicationEligibility(
  title: string, 
  sourceName = '',
  domainHint?: string
): PublicationEligibilityResult {
  // 0. Penolakan nama institusi / publisher mandiri tanpa klaim berita faktual
  if (isPureInstitutionOrPublisherName(title, sourceName)) {
    return {
      isEligible: false,
      exclusionReason: 'NO_CHECKABLE_CLAIM',
      reasonExplanation: 'Judul hanya memuat nama institusi atau penerbit tanpa klaim faktual yang dapat diuji'
    }
  }

  const norm = (title + ' ' + sourceName).toLowerCase()

  // 1. Batas minimum panjang karakter
  if (title.trim().length < 15) {
    return {
      isEligible: false,
      exclusionReason: 'INSUFFICIENT_CONTEXT',
      reasonExplanation: 'Judul terlalu pendek untuk memuat klaim faktual yang dapat diuji'
    }
  }

  // 2. Pemicu Taksonomi Strategis 7 Domain NARADA
  const strategicTriggers = [
    // National Policy & State Dynamics
    'prabowo', 'gibran', 'jokowi', 'presiden', 'wapres', 'pemerintah', 'dpr', 'mpr',
    'kementerian', 'menteri', 'kebijakan', 'regulasi', 'perpres', 'uu', 'apbn', 'anggaran',
    'ikn', 'kpk', 'kejagung', 'mahkamah', 'mk', 'kpu', 'bawaslu', 'bkn', 'sidang', 'putusan',
    'dorong', 'terbitkan', 'resmikan', 'tinjau', 'tetapkan',
    // Digital Economy & Fiscal
    'pajak digital', 'transaksi digital', 'ekonomi digital', 'fintech', 'marketplace',
    'pph 22', 'pph', 'ppn', 'bank digital', 'qris', 'kripto', 'e-commerce', 'hashim',
    'fiskal', 'ojk', 'bank indonesia', 'devisa', 'investasi', 'tarif', 'pajak', 'finansial',
    // Defense & National Security
    'tni', 'alutsista', 'kemhan', 'papua', 'kkb', 'opm', 'ambalat', 'natuna', 'perbatasan',
    'kedaulatan', 'keamanan', 'kapal perang', 'pesawat tempur', 'marinir', 'kopassus', 'pussiberad',
    'kodam', 'korem', 'kodim', 'babinsa', 'intelijen', 'militer', 'operasi', 'gugur', 'serangan',
    // Civic Dynamics & Demonstrations
    'demo', 'unjuk rasa', 'aksi massa', 'protes', 'penolakan', 'bentrok', 'ricuh', 'kericuhan',
    'pemakzulan', 'buruh', 'mahasiswa', 'tuntut', 'desak', 'petisi', 'mogok',
    // Public Crisis & Disasters
    'bencana', 'darurat', 'gempa', 'tsunami', 'megathrust', 'banjir', 'longsor', 'erupsi',
    'merapi', 'pangan', 'beras', 'bbm', 'solar', 'pertalite', 'lpg', 'listrik', 'pln',
    'kesehatan', 'obat', 'bpom', 'bnpb', 'bmkg', 'kelangkaan', 'wabah', 'krisis',
    // Information Integrity & Disinformation
    'hoaks', 'hoax', 'disinformasi', 'misinformasi', 'palsu', 'bohong', 'fitnah', 'manipulasi',
    'cek fakta', 'klarifikasi', 'bantah', 'meluruskan',
    // Cyber & Public Critical Infrastructure
    'kebocoran data', 'serangan siber', 'ransomware', 'hacker', 'peretasan', 'pdns', 'bssn',
    'malware', 'keamanan siber', 'sistem down', 'server down',
    // Peristiwa Dinamis & Polemik Umum
    'viral', 'heboh', 'geger', 'kontroversi', 'polemik', 'skandal', 'korupsi', 'bocoran'
  ]

  const hasStrategicMatch = strategicTriggers.some(t => norm.includes(t))

  // 3. Blacklist Filter: Olahraga & Rutinitas Dinas / Seremonial Murni
  // Hanya menolak bila TIDAK memuat pemicu strategis di atas
  const ceremonialBlacklist = [
    'kuliah', 'beasiswa', 'lldikti', 'politeknik', 'wisuda', 'mahasiswa kkn', 'pelajar magang',
    'tmmd', 'tni manunggal', 'bakti tni', 'sinergi pemda dan tni', 'tim wasev',
    'kunjungan kerja', 'terima perwakilan', 'audiensi', 'lepas sambut', 'sertijab', 'ziarah',
    'futsal', 'sepak bola', 'kejuaraan', 'turnamen', 'gowes', 'senam bersama', 'lomba',
    'panen raya', 'tanam jagung', 'tanam padi', 'bibit', 'buka jalan 25 pemuda', 'baksos donor darah',
    'peringatan hut', 'upacara bendera 17', 'apel pagi', 'berbaur dalam latihan',
    'serie a', 'la liga', 'premier league', 'liga inggris', 'liga champion', 'acl two',
    'kitchee', 'frosinone', 'lecce', 'bellingham', 'kroos', 'el clasico', 'chelsea', 'liverpool',
    'prediksi skor', 'skor dan lineup', 'rumah hantu'
  ]

  if (!hasStrategicMatch) {
    for (const b of ceremonialBlacklist) {
      if (norm.includes(b)) {
        return {
          isEligible: false,
          exclusionReason: 'IRRELEVANT_TOPIC',
          reasonExplanation: `Memuat topik seremonial/olahraga non-strategis (${b})`
        }
      }
    }
  }

  const VALID_DOMAINS = new Set([
    'NATIONAL_POLICY', 'DIGITAL_ECONOMY', 'DEFENSE_SECURITY', 'CIVIC_DYNAMICS',
    'PUBLIC_CRISIS', 'INFORMATION_INTEGRITY', 'CYBER_PUBLIC_IMPACT',
    'KEDAULATAN_MILITER', 'POLITIK_NEGARA', 'BENCANA_DARURAT', 'PENIPUAN_BANSOS', 'KESEHATAN_PANGAN', 'MILITARY_DEFENSE', 'EKONOMI_DIGITAL'
  ])

  const isValidDomainHint = Boolean(domainHint && VALID_DOMAINS.has(domainHint))

  // Jika memuat salah satu pemicu strategis atau diberi hint domain taksonomi yang sah
  if (hasStrategicMatch || isValidDomainHint) {
    const matchedDomain = classifyTaxonomyDomain(title, sourceName, (isValidDomainHint ? domainHint : 'NATIONAL_POLICY') as any)
    return { isEligible: true, matchedDomain }
  }

  return {
    isEligible: false,
    exclusionReason: 'NO_CHECKABLE_CLAIM',
    reasonExplanation: 'Tidak memuat indikasi peristiwa faktual atau dinamika strategis yang relevan'
  }
}

export function isEligibleCognitiveRadarItem(title: string, sourceName = ''): boolean {
  return evaluatePublicationEligibility(title, sourceName).isEligible
}

/**
 * Memformat tanggal dan jam unggah/terbit presisi militer (e.g. "27 Okt 2026, 14:22 WIB")
 */
export function formatMilitaryDateTime(rawDateStr?: string | null): string {
  if (!rawDateStr) return 'Waktu Publikasi Tidak Tersedia'
  if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{2}:\d{2}\s+WIB/.test(rawDateStr)) {
    return rawDateStr
  }

  const { timestamp, status } = parseSourceDate(rawDateStr)
  if (status !== 'VALID' || timestamp === null) {
    return 'Waktu Publikasi Tidak Tersedia'
  }

  return formatMilitaryDate(timestamp)
}

/**
 * Membersihkan nama platform/sumber pemantauan dari anomali scraper
 */
export function sanitizePlatformName(rawSource?: string, platformHint?: string): string {
  if (!rawSource || rawSource.trim() === '') {
    return platformHint === 'Google Trends' ? 'Google Trends Indonesia' : 'Portal Berita Terverifikasi'
  }

  let cleaned = cleanHtmlText(rawSource).trim()

  if (
    /spanish|football|soccer|premier league|chelsea|arsenal|la liga|liga 1/i.test(cleaned) ||
    /get spanish/i.test(cleaned)
  ) {
    return 'Google Trends Indonesia'
  }

  cleaned = cleaned.replace(/^[({\["'\s]+|[)}\]"'\s]+$/g, '').trim()

  if (platformHint === 'Google Trends') {
    if (cleaned.toLowerCase().includes('google trends')) {
      return cleaned
    }
    return `Google Trends ID • ${cleaned}`
  }

  return cleaned || 'Portal Berita Nasional'
}

/**
 * Helper metadata audit penangkapan vs verifikasi nyata (Zero Fake Data)
 */
export function createViralAuditMeta(trafficStr?: string, minutesAgo = 18, _baseVelocity = '+140%/jam') {
  const now = Date.now()
  const interceptTime = new Date(now - minutesAgo * 60 * 1000)

  const formatWib = (d: Date) => 
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`

  const interceptedAt = formatWib(interceptTime)

  return {
    interceptedAt,
    verifiedAt: undefined,
    engagement: undefined,
    viralVelocity: trafficStr ? `${trafficStr} penelusuran (Google Trends)` : undefined
  }
}

/**
 * 1. Parser Live RSS Feed TurnBackHoax (MAFINDO)
 * Menghasilkan entri klarifikasi fakta resmi dengan CANONICAL ARTICLE URL dan stable ID
 */
/**
 * Ekstraktor tanggal publikasi verifikasi cek fakta TurnBackHoax (MAFINDO).
 * Mendukung ekstraksi pola tanggal Indonesia (DD/MM/YYYY, DD NamaBulan YYYY, YYYY-MM-DD)
 * dari deskripsi artikel apabila pubDate tidak disertakan pada feed.
 */
export function extractTurnBackHoaxPublicationTimestamp(rawPubDate?: string | null, rawDesc?: string | null): number | null {
  if (rawPubDate && rawPubDate.trim()) {
    const { timestamp, status } = parseSourceDate(rawPubDate)
    if (status === 'VALID' && timestamp !== null && timestamp > 0) return timestamp
  }
  if (!rawDesc || typeof rawDesc !== 'string') return null

  const INDO_MONTHS_LOWER = [
    'januari', 'februari', 'maret', 'april', 'mei', 'juni',
    'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
  ]

  let bestTs: number | null = null

  // 1. Pola DD/MM/YYYY atau DD-MM-YYYY (misal "6/11/2026", "21/10/2026")
  const dmyMatches = [...rawDesc.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](202\d)\b/g)]
  for (const m of dmyMatches) {
    const d = parseInt(m[1], 10)
    const mon = parseInt(m[2], 10) - 1
    const y = parseInt(m[3], 10)
    if (mon >= 0 && mon < 12 && d >= 1 && d <= 31) {
      const ts = Date.UTC(y, mon, d, 12 - 7, 0, 0)
      if (!bestTs || ts > bestTs) bestTs = ts
    }
  }

  // 2. Pola DD [Nama Bulan] YYYY (misal "29 Oktober 2026")
  const nameMatches = [...rawDesc.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(202\d)\b/gi)]
  for (const m of nameMatches) {
    const d = parseInt(m[1], 10)
    const monName = m[2].toLowerCase()
    const y = parseInt(m[3], 10)
    const monIdx = INDO_MONTHS_LOWER.findIndex(im => monName.startsWith(im.slice(0, 3)))
    if (monIdx !== -1 && d >= 1 && d <= 31) {
      const ts = Date.UTC(y, monIdx, d, 12 - 7, 0, 0)
      if (!bestTs || ts > bestTs) bestTs = ts
    }
  }

  // 3. Pola YYYY-MM-DD atau YYYY/MM/DD
  const ymdMatches = [...rawDesc.matchAll(/\b(202\d)[/-](\d{1,2})[/-](\d{1,2})\b/g)]
  for (const m of ymdMatches) {
    const y = parseInt(m[1], 10)
    const mon = parseInt(m[2], 10) - 1
    const d = parseInt(m[3], 10)
    if (mon >= 0 && mon < 12 && d >= 1 && d <= 31) {
      const ts = Date.UTC(y, mon, d, 12 - 7, 0, 0)
      if (!bestTs || ts > bestTs) bestTs = ts
    }
  }

  return bestTs
}

export function parseTurnBackHoaxRss(xmlText: string, maxItems = 25): DebunkKnowledgeEntry[] {
  if (!xmlText || typeof xmlText !== 'string' || !xmlText.trim()) return []

  try {
    const parsed = xmlParser.parse(xmlText)
    const channel = parsed?.rss?.channel || parsed?.feed
    if (!channel) return []

    const items = toArray(channel.item || channel.entry || [])
    const entries: DebunkKnowledgeEntry[] = []

    for (const item of items) {
      if (entries.length >= maxItems) break

      const rawTitle = extractNodeText(item.title)
      const rawLink = extractLink(item.link || item.guid)
      const rawDesc = extractNodeText(item.description || item['content:encoded'])
      const rawPubDate = extractNodeText(item.pubDate || item.published || item.updated)

      const cleanTitle = cleanHtmlText(rawTitle)
      const cleanLink = cleanHtmlText(rawLink)
      if (!cleanTitle || !cleanLink) continue

      let verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' = 'HOAKS'
      if (cleanTitle.includes('[DISINFORMASI]') || cleanTitle.includes('[MANIPULASI]') || cleanTitle.includes('[MISLEADING]')) {
        verdict = 'DISINFORMASI'
      } else if (cleanTitle.includes('[PROPAGANDA]')) {
        verdict = 'PROPAGANDA'
      }

      const claim = cleanTitle
        .replace(/^\[(SALAH|HOAKS|DISINFORMASI|PENIPUAN|KLARIFIKASI|MANIPULASI|MISLEADING)\]\s*/i, '')
        .replace(/^["'“]/, '')
        .replace(/["'”]$/, '')
        .trim()

      const clarification = extractClarificationFromDesc(rawDesc)
      const officialSource = extractOfficialSourceFromText(cleanTitle + ' ' + rawDesc)
      const cluster = classifyCluster(cleanTitle, rawDesc)
      const keywords = extractKeywords(claim)

      const pubTimestamp = extractTurnBackHoaxPublicationTimestamp(rawPubDate, rawDesc)
      const publishedDate = formatMilitaryDate(pubTimestamp)
      const freshness = evaluateFreshness(pubTimestamp)
      const isBreakingRecent = freshness.status === 'BREAKING'
      const stableId = generateStablePublicationId(cleanLink)

      entries.push({
        id: stableId,
        claim,
        normalizedQuery: claim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: cluster === 'KEDAULATAN_MILITER' || cluster === 'POLITIK_NEGARA' ? 'critical' : 'high',
        clarification,
        officialSource,
        sourceUrl: cleanLink,
        originalPlatform: 'Media Sosial & Pesan Berantai (X / TikTok / WA)',
        originalSourceUrl: cleanLink,
        interceptedAt: formatMilitaryDate(Date.now()),
        verifiedAt: formatMilitaryDate(pubTimestamp),
        keywords,
        tacticalResponseCivilian: `Informasi mengenai "${claim}" telah dikonfirmasi sebagai ${verdict}. Rujukan resmi dari ${officialSource}: ${clarification}`,
        tacticalResponseMilitary: `Atensi Teritorial: Narasi "${claim}" terkonfirmasi ${verdict}. Segera aktifkan pengawasan opini publik di wilayah binaan.`,
        isLive: true,
        publishedDate,
        isBreakingRecent,
        cognitiveScore: 85,
        viralityReason: isBreakingRecent 
          ? '🔥 KLARIFIKASI HOAKS TERKINI (<3 JAM)'
          : '🚨 LAPORAN MAFINDO: Isu Disinformasi Terverifikasi'
      })
    }

    return entries
  } catch {
    return []
  }
}

/**
 * 2. Parser Live RSS Feed Google News (Profil Isu Nasional Terakreditasi)
 * Menghasilkan entri publikasi pers dengan ID stabil dan status awal UNVERIFIED
 */
export function parseGoogleNewsRss(xmlText: string, maxItems = 25): DebunkKnowledgeEntry[] {
  if (!xmlText || typeof xmlText !== 'string' || !xmlText.trim()) return []

  try {
    const parsed = xmlParser.parse(xmlText)
    const channel = parsed?.rss?.channel || parsed?.feed
    if (!channel) return []

    const items = toArray(channel.item || channel.entry || [])
    const entries: DebunkKnowledgeEntry[] = []

    for (const item of items) {
      if (entries.length >= maxItems) break

      const rawTitle = extractNodeText(item.title)
      const rawLink = extractLink(item.link || item.guid)
      const rawPubDate = extractNodeText(item.pubDate || item.published || item.updated)
      const sourceNode = item.source
      const rawSourceName = extractNodeText(sourceNode) || 'Portal Berita Nasional'

      const cleanTitle = cleanHtmlText(rawTitle)
      const cleanLink = cleanHtmlText(rawLink)
      if (!cleanTitle || !cleanLink) continue

      const sourceName = sanitizePlatformName(rawSourceName, 'Google News')
      const cleanClaim = cleanTitle.replace(new RegExp(`\\s*-\\s*${rawSourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim()

      if (!cleanClaim || isPureInstitutionOrPublisherName(cleanClaim, sourceName) || isPureInstitutionOrPublisherName(cleanTitle, rawSourceName)) {
        continue
      }

      if (!isEligibleCognitiveRadarItem(cleanClaim, sourceName)) {
        continue
      }

      const cluster = classifyCluster(cleanTitle, '')
      const keywords = extractKeywords(cleanClaim)

      const isOfficial = sourceName.toUpperCase().includes('TNI') || 
                         sourceName.toUpperCase().includes('KEMHAN') || 
                         sourceName.toUpperCase().includes('BMKG') ||
                         sourceName.toUpperCase().includes('BAWASLU')

      const verdict: DebunkKnowledgeEntry['verdict'] = 'UNVERIFIED'

      const { timestamp: pubTimestamp } = parseSourceDate(rawPubDate)
      const publishedDate = formatMilitaryDate(pubTimestamp)
      const freshness = evaluateFreshness(pubTimestamp)
      const isBreakingRecent = freshness.status === 'BREAKING'
      const stableId = generateStablePublicationId(cleanLink)

      entries.push({
        id: stableId,
        claim: cleanClaim,
        normalizedQuery: cleanClaim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: isOfficial 
          ? `Pernyataan dan rilis dari ${sourceName}. Isi berita memerlukan penelusuran klaim kedinasan.`
          : `Isu sedang dipantau di ranah publik via ${sourceName}. Menunggu verifikasi silang dan data pembanding.`,
        officialSource: sourceName,
        sourceUrl: cleanLink,
        originalPlatform: sourceName,
        originalSourceUrl: cleanLink,
        interceptedAt: formatMilitaryDate(Date.now()),
        keywords,
        tacticalResponseCivilian: `Isu "${cleanClaim}" sedang dipantau. Masyarakat diimbau menunggu konfirmasi resmi dan tidak terpancing spekulasi.`,
        tacticalResponseMilitary: `Pantau pergerakan narasi "${cleanClaim}" yang dipublikasikan oleh ${sourceName}. Lakukan verifikasi faktual.`,
        isLive: true,
        publishedDate,
        isBreakingRecent,
        cognitiveScore: isOfficial ? 40 : 65,
        viralityReason: isBreakingRecent
          ? '🔥 LAPORAN BARU (<3 JAM): Menunggu Verifikasi Fakta'
          : isOfficial 
          ? '📢 PUBLIKASI KEDINASAN: Memerlukan Pemantauan Narasi'
          : '📡 RADAR BERITA: Klaim Belum Terverifikasi'
      })
    }

    return entries
  } catch {
    return []
  }
}

/**
 * 2b. Parser Live RSS Feed ANTARA News (Kantor Berita Nasional LKBN ANTARA)
 */
export function parseAntaraRss(xmlText: string, maxItems = 25): DebunkKnowledgeEntry[] {
  if (!xmlText || typeof xmlText !== 'string' || !xmlText.trim()) return []

  try {
    const parsed = xmlParser.parse(xmlText)
    const channel = parsed?.rss?.channel || parsed?.feed
    if (!channel) return []

    const items = toArray(channel.item || channel.entry || [])
    const entries: DebunkKnowledgeEntry[] = []

    for (const item of items) {
      if (entries.length >= maxItems) break

      const rawTitle = extractNodeText(item.title)
      const rawLink = extractLink(item.link || item.guid)
      const rawDesc = extractNodeText(item.description || item.summary)
      const rawPubDate = extractNodeText(item.pubDate || item.published || item.updated)

      const cleanTitle = cleanHtmlText(rawTitle)
      const cleanLink = cleanHtmlText(rawLink)
      if (!cleanTitle || !cleanLink) continue

      const sourceName = 'ANTARA News'
      if (isPureInstitutionOrPublisherName(cleanTitle, sourceName) || !isEligibleCognitiveRadarItem(cleanTitle, sourceName)) {
        continue
      }

      const cluster = classifyCluster(cleanTitle, rawDesc)
      const keywords = extractKeywords(cleanTitle)
      const { timestamp: pubTimestamp } = parseSourceDate(rawPubDate)
      const publishedDate = formatMilitaryDate(pubTimestamp)
      const freshness = evaluateFreshness(pubTimestamp)
      const isBreakingRecent = freshness.status === 'BREAKING'
      const stableId = generateStablePublicationId(cleanLink)

      entries.push({
        id: stableId,
        claim: cleanTitle,
        normalizedQuery: cleanTitle.toLowerCase(),
        cluster,
        verdict: 'UNVERIFIED',
        threatLevel: cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: `Laporan Kantor Berita Nasional ANTARA: ${extractClarificationFromDesc(rawDesc)}`,
        officialSource: 'LKBN ANTARA',
        sourceUrl: cleanLink,
        originalPlatform: sourceName,
        originalSourceUrl: cleanLink,
        interceptedAt: formatMilitaryDate(Date.now()),
        keywords,
        tacticalResponseCivilian: `Laporan kantor berita nasional ANTARA mengenai "${cleanTitle}". Pantau perkembangan lebih lanjut.`,
        tacticalResponseMilitary: `Pantau publikasi nasional LKBN ANTARA terkait "${cleanTitle}".`,
        isLive: true,
        publishedDate,
        isBreakingRecent,
        cognitiveScore: 50,
        viralityReason: isBreakingRecent
          ? '🔥 ANTARA TERKINI (<3 JAM): Menunggu Verifikasi Fakta'
          : '📡 LKBN ANTARA: Kantor Berita Nasional'
      })
    }

    return entries
  } catch {
    return []
  }
}

/**
 * 3. Parser Live RSS Feed Google Trends Indonesia sebagai SearchTrendSignal (Sprint 1B)
 * Menghasilkan sinyal minat penelusuran publik agregat (Left-of-Bang Early Warning),
 * BUKAN entitas artikel berita, BUKAN bukti klaim, dan BUKAN metrik media sosial.
 */
export function parseGoogleTrendsRssAsSignals(xmlText: string, maxItems = 20): SearchTrendSignal[] {
  if (!xmlText || typeof xmlText !== 'string' || !xmlText.trim()) return []

  try {
    const parsed = xmlParser.parse(xmlText)
    const channel = parsed?.rss?.channel || parsed?.feed
    if (!channel) return []

    const items = toArray(channel.item || channel.entry || [])
    const signals: SearchTrendSignal[] = []
    const now = Date.now()

    for (const item of items) {
      if (signals.length >= maxItems) break

      const rawTrendTitle = extractNodeText(item.title)
      const traffic = extractNodeText(item['ht:approx_traffic'])
      const rawNewsUrl = extractNodeText(item['ht:news_item_url'])
      const rawNewsSource = extractNodeText(item['ht:news_item_source'])
      const rawPubDate = extractNodeText(item.pubDate)

      const trendTitle = cleanHtmlText(rawTrendTitle)
      if (!trendTitle) continue

      const cleanPlatform = sanitizePlatformName(rawNewsSource, 'Google Trends')
      const canonicalUrl = rawNewsUrl ? cleanHtmlText(rawNewsUrl) : 'https://trends.google.com/trending?geo=ID'

      let startedAt: string | undefined = undefined
      let timestampStatus: 'VALID' | 'UNKNOWN_DATE' | 'INVALID_TIMESTAMP' = 'UNKNOWN_DATE'

      if (rawPubDate && rawPubDate.trim()) {
        const parsedDate = parseSourceDate(rawPubDate)
        if (parsedDate.status === 'VALID' && parsedDate.timestamp !== null) {
          startedAt = new Date(parsedDate.timestamp).toISOString()
          timestampStatus = 'VALID'
        } else {
          timestampStatus = parsedDate.status === 'INVALID' ? 'INVALID_TIMESTAMP' : 'UNKNOWN_DATE'
        }
      }

      const stableId = `SIG-GTREND-${sha256Hex(trendTitle).slice(0, 16)}`

      signals.push({
        id: stableId,
        sourceId: 'src-gtrends-id',
        query: trendTitle,
        searchVolumeBand: traffic || undefined,
        startedAt,
        observedAt: now,
        retrievedAt: now,
        trendStatus: 'ACTIVE',
        sourceUrl: canonicalUrl,
        sourceLabel: cleanPlatform,
        timestampStatus,
        limitations: [
          'Agregat volume penelusuran Google Search saja',
          'Bukan volume percakapan media sosial',
          'Bukan bukti kebenaran atau kepalsuan klaim narasi'
        ]
      })
    }

    return signals
  } catch {
    return []
  }
}

/**
 * 3b. Parser Legacy Google Trends untuk kompatibilitas mundur
 */
export function parseGoogleTrendsRss(xmlText: string, maxItems = 20): DebunkKnowledgeEntry[] {
  if (!xmlText || typeof xmlText !== 'string' || !xmlText.trim()) return []

  try {
    const parsed = xmlParser.parse(xmlText)
    const channel = parsed?.rss?.channel || parsed?.feed
    if (!channel) return []

    const items = toArray(channel.item || channel.entry || [])
    const entries: DebunkKnowledgeEntry[] = []

    for (const item of items) {
      if (entries.length >= maxItems) break

      const rawTrendTitle = extractNodeText(item.title)
      const traffic = extractNodeText(item['ht:approx_traffic']) || 'Viral'
      const rawNewsTitle = extractNodeText(item['ht:news_item_title'])
      const rawNewsUrl = extractNodeText(item['ht:news_item_url'])
      const rawNewsSource = extractNodeText(item['ht:news_item_source'])
      const rawPubDate = extractNodeText(item.pubDate)

      const trendTitle = cleanHtmlText(rawTrendTitle)
      if (!trendTitle) continue

      const newsTitle = cleanHtmlText(rawNewsTitle)
      const cleanPlatform = sanitizePlatformName(rawNewsSource, 'Google Trends')
      const canonicalUrl = rawNewsUrl ? cleanHtmlText(rawNewsUrl) : 'https://trends.google.com/trending?geo=ID'

      const claim = newsTitle || `Lonjakan Minat Penelusuran Google: "${trendTitle}"`
      const cluster = classifyCluster(trendTitle, newsTitle)
      const keywords = [trendTitle.toLowerCase(), ...extractKeywords(claim)]

      let publishedDate = 'Waktu Publikasi Tidak Tersedia'
      if (rawPubDate && rawPubDate.trim()) {
        const parsedDate = parseSourceDate(rawPubDate)
        if (parsedDate.status === 'VALID' && parsedDate.timestamp !== null) {
          publishedDate = formatMilitaryDate(parsedDate.timestamp)
        }
      }

      const stableId = `GTREND-${sha256Hex(trendTitle).slice(0, 16)}`

      entries.push({
        id: stableId,
        claim,
        normalizedQuery: trendTitle.toLowerCase(),
        cluster,
        verdict: 'UNVERIFIED',
        threatLevel: cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: `Topik "${trendTitle}" mengalami peningkatan penelusuran publik (${traffic} pencarian Google Indonesia). Sinyal minat pencarian agregat, bukan bukti viralitas media sosial.`,
        officialSource: cleanPlatform,
        sourceUrl: canonicalUrl,
        originalPlatform: cleanPlatform,
        originalSourceUrl: canonicalUrl,
        interceptedAt: formatMilitaryDate(Date.now()),
        viralVelocity: `${traffic} penelusuran (Google Search)`,
        keywords,
        tacticalResponseCivilian: `Topik "${trendTitle}" mengalami peningkatan pencarian di Google. Tetap verifikasi sumber sebelum menyebarkan.`,
        tacticalResponseMilitary: `Indikator Sinyal Lemah: Terdeteksi tren pencarian Google untuk "${trendTitle}" (${traffic}).`,
        isLive: true,
        publishedDate,
        trendTraffic: `${traffic} penelusuran Google Search`,
        cognitiveScore: 50,
        viralityReason: `📊 TREN PENELUSURAN GOOGLE: ${traffic}`
      })
    }

    return entries
  } catch {
    return []
  }
}
