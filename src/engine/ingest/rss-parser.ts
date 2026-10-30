import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../../types.ts'
import { parseSourceDate, formatMilitaryDate, evaluateFreshness } from '../radar/freshness-engine.ts'
import type { SearchTrendSignal } from '../radar/radar-types.ts'

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

  // Cari segmen fakta/penjelasan
  const match = text.match(/(?:FAKTANYA|PENJELASAN|HASIL CEK FAKTA|KLARIFIKASI|Fakta Terverifikasi)[:\s]+([^]+?)(?:RUJUKAN|SUMBER|REFERENSI|KATEGORI|$)/i)
  let snippet = ''

  if (match && match[1] && match[1].trim().length > 20) {
    snippet = match[1].trim()
  } else {
    // Ambil kalimat pertama hingga ketiga yang substantif
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

  // 1. Kedaulatan & Alutsista Militer
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

  // 2. Bencana Darurat
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

  // 3. Penipuan & Bansos
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

  // 4. Kesehatan & Pangan
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

  // 5. Default Politik Negara / Isu Umum
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


/**
 * Penapis Intelijen Kognitif (Cognitive Threat & Virality Gatekeeper)
 * Membuang berita seremonial, humas instansi, beasiswa, dan kegiatan dinas rutin yang TIDAK berpotensi
 * memicu krisis kognitif atau penggiringan opini publik.
 */
export function isEligibleCognitiveRadarItem(title: string, sourceName = ''): boolean {
  const norm = (title + ' ' + sourceName).toLowerCase()

  // 1. BLACKLIST FILTER: Berita Humas Kampus/Daerah, Seremonial, Olahraga, & Rutinitas Dinas
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

  for (const b of ceremonialBlacklist) {
    if (norm.includes(b)) {
      return false
    }
  }

  // 2. WHITELIST TRIGGERS: Harus memiliki indikasi hoaks, kontroversi, polemik, aksi massa, atau penggiringan opini
  const threatTriggers = [
    'hoaks', 'hoax', 'disinformasi', 'palsu', 'bohong', 'fitnah', 'manipulasi',
    'viral', 'heboh', 'geger', 'kontroversi', 'polemik', 'debat', 'tuding', 'tuduhan',
    'desak', 'tuntut', 'kecam', 'protes', 'demo', 'unjuk rasa', 'mahasiswa', 'massa',
    'tolak', 'ricuh', 'bentrok', 'kericuhan', 'bakar', 'tangkap', 'gugur', 'serangan',
    'ditembak', 'penyanderaan', 'korban', 'opm', 'kkb', 'krisis', 'batal', 'dicopot',
    'pemakzulan', 'mundur', 'korupsi', 'skandal', 'bocoran', 'rahasia', 'sabotase',
    'perang terbuka', 'ijazah', 'mbg', 'bansos', 'ambalat', 'kapal perang'
  ]

  for (const t of threatTriggers) {
    if (norm.includes(t)) {
      return true
    }
  }

  return false
}

/**
 * Memformat tanggal dan jam unggah/terbit presisi militer (e.g. "27 Okt 2026, 14:22 WIB")
 * Menggunakan parseSourceDate deterministik tanpa fallback ke waktu saat ini.
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
 * Membersihkan nama platform/sumber pemantauan dari anomali scraper luar negeri
 * (Contoh: Menghapus "Get Spanish Football News" menjadi "Google Trends Indonesia" atau rujukan portal media terverifikasi)
 */
export function sanitizePlatformName(rawSource?: string, platformHint?: string): string {
  if (!rawSource || rawSource.trim() === '') {
    return platformHint === 'Google Trends' ? 'Google Trends Indonesia' : 'Portal Berita Terverifikasi'
  }

  let cleaned = cleanHtmlText(rawSource).trim()

  // Saring noise scraper aneh dari RSS Google Trends
  if (
    /spanish|football|soccer|premier league|chelsea|arsenal|la liga|liga 1/i.test(cleaned) ||
    /get spanish/i.test(cleaned)
  ) {
    return 'Google Trends Indonesia'
  }

  // Hapus karakter kurung pembuka/penutup yang tidak rapi
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
 * Catatan: Metrik engagement sosial fiktif (views/shares acak) telah dihapus 100%.
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
    engagement: undefined, // Tidak mengarang views atau shares
    viralVelocity: trafficStr ? `${trafficStr} penelusuran (Google Trends)` : undefined
  }
}

/**
 * 1. Parser Live RSS Feed TurnBackHoax (MAFINDO)
 * Menghasilkan entri klarifikasi fakta resmi dengan CANONICAL ARTICLE URL
 */
export function parseTurnBackHoaxRss(xmlText: string): DebunkKnowledgeEntry[] {
  if (!xmlText || !xmlText.includes('<item>')) return []

  const itemsRaw = xmlText.split('<item>').slice(1)
  const entries: DebunkKnowledgeEntry[] = []

  itemsRaw.forEach((itemBlock, idx) => {
    try {
      const rawTitle = (itemBlock.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || ''
      const rawLink = (itemBlock.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || ''
      const rawDesc = (itemBlock.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || ''
      const rawPubDate = (itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''

      const cleanTitle = cleanHtmlText(rawTitle)
      const cleanLink = rawLink.trim()
      if (!cleanTitle || !cleanLink) return

      // Tentukan vonis awal berdasarkan tag judul Mafindo
      let verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' = 'HOAKS'
      if (cleanTitle.includes('[DISINFORMASI]') || cleanTitle.includes('[MANIPULASI]') || cleanTitle.includes('[MISLEADING]')) {
        verdict = 'DISINFORMASI'
      } else if (cleanTitle.includes('[PROPAGANDA]')) {
        verdict = 'PROPAGANDA'
      }

      // Bersihkan judul dari tag prefix
      const claim = cleanTitle
        .replace(/^\[(SALAH|HOAKS|DISINFORMASI|PENIPUAN|KLARIFIKASI|MANIPULASI|MISLEADING)\]\s*/i, '')
        .replace(/^["'“]/, '')
        .replace(/["'”]$/, '')
        .trim()

      const clarification = extractClarificationFromDesc(rawDesc)
      const officialSource = extractOfficialSourceFromText(cleanTitle + ' ' + rawDesc)
      const cluster = classifyCluster(cleanTitle, rawDesc)
      const keywords = extractKeywords(claim)

      // Format tanggal dan jam unggah presisi menggunakan Freshness Engine
      const dateMatch = rawDesc.match(/\b(202\d[-/]\d{2}[-/]\d{2})\b/)
      const rawDateToParse = rawPubDate || (dateMatch ? dateMatch[1] : undefined)
      const { timestamp: pubTimestamp } = parseSourceDate(rawDateToParse)
      const publishedDate = formatMilitaryDate(pubTimestamp)
      const freshness = evaluateFreshness(pubTimestamp)
      const isBreakingRecent = freshness.status === 'BREAKING'

      entries.push({
        id: `TBH-CANONICAL-${idx + 1}-${Date.now().toString().slice(-4)}`,
        claim,
        normalizedQuery: claim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: cluster === 'KEDAULATAN_MILITER' || cluster === 'POLITIK_NEGARA' ? 'critical' : 'high',
        clarification,
        officialSource,
        sourceUrl: cleanLink, // Rujukan verifikasi resmi Mafindo
        originalPlatform: 'Media Sosial & Pesan Berantai (X / TikTok / WA)',
        originalSourceUrl: cleanLink, // Arsip tangkapan layar & bukti di Mafindo
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
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}

/**
 * 2. Parser Live RSS Feed Google News (Hankam & Isu Nasional Tertarget)
 * Menyaring secara ketat agar HANYA isu kontroversial, polemik, atau potensi ancaman yang lolos
 */
export function parseGoogleNewsRss(xmlText: string): DebunkKnowledgeEntry[] {
  if (!xmlText || !xmlText.includes('<item>')) return []

  const itemsRaw = xmlText.split('<item>').slice(1)
  const entries: DebunkKnowledgeEntry[] = []

  itemsRaw.forEach((itemBlock, idx) => {
    try {
      const rawTitle = (itemBlock.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || ''
      const rawLink = (itemBlock.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || ''
      const rawPubDate = (itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
      const sourceMatch = itemBlock.match(/<source url="([^"]*)">([\s\S]*?)<\/source>/)

      const cleanTitle = cleanHtmlText(rawTitle)
      const cleanLink = rawLink.trim()
      if (!cleanTitle || !cleanLink) return

      const rawSourceName = sourceMatch ? cleanHtmlText(sourceMatch[2]) : 'Portal Berita Nasional'
      const sourceName = sanitizePlatformName(rawSourceName, 'Google News')
      const cleanClaim = cleanTitle.replace(new RegExp(`\\s*-\\s*${rawSourceName}\\s*$`, 'i'), '').trim()

      // PENAPIS INTELIJEN KOGNITIF: Buang berita humas/seremonial kampus/TMMD!
      if (!isEligibleCognitiveRadarItem(cleanClaim, sourceName)) {
        return
      }

      const cluster = classifyCluster(cleanTitle, '')
      const keywords = extractKeywords(cleanClaim)

      // Deteksi apakah berita berasal dari instansi resmi (TNI, Kemhan, BMKG, Bawaslu)
      const isOfficial = sourceName.toUpperCase().includes('TNI') || 
                         sourceName.toUpperCase().includes('KEMHAN') || 
                         sourceName.toUpperCase().includes('BMKG') ||
                         sourceName.toUpperCase().includes('BAWASLU')

      const isHoaxInTitle = cleanTitle.toLowerCase().includes('hoaks') || cleanTitle.toLowerCase().includes('hoax')
      const verdict: DebunkKnowledgeEntry['verdict'] = isHoaxInTitle ? 'HOAKS' : isOfficial ? 'FAKTA' : 'UNVERIFIED'

      const { timestamp: pubTimestamp } = parseSourceDate(rawPubDate)
      const publishedDate = formatMilitaryDate(pubTimestamp)
      const freshness = evaluateFreshness(pubTimestamp)
      const isBreakingRecent = freshness.status === 'BREAKING'

      entries.push({
        id: `GNEWS-${idx + 1}-${Date.now().toString().slice(-4)}`,
        claim: cleanClaim,
        normalizedQuery: cleanClaim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: isHoaxInTitle || cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: isOfficial 
          ? `Pernyataan dan rilis resmi langsung dari ${sourceName}. Isi berita merupakan informasi terkonfirmasi kedinasan.`
          : isHoaxInTitle
          ? `Judul berita mengonfirmasi indikasi hoaks/disinformasi yang sedang beredar luas di media daring.`
          : `Isu polemik/kontroversial sedang bergulir di ranah publik via ${sourceName}. Memerlukan verifikasi silang terhadap dokumen intelijen dan otoritas terkait.`,
        officialSource: sourceName,
        sourceUrl: cleanLink, // CANONICAL REDIRECT LANGSUNG KE ARTIKEL PERS!
        originalPlatform: sourceName,
        originalSourceUrl: cleanLink, // Tempat artikel pertama kali dipantau
        interceptedAt: formatMilitaryDate(Date.now()),
        keywords,
        tacticalResponseCivilian: isOfficial
          ? `Informasi resmi dari ${sourceName} mengenai: "${cleanClaim}". Gunakan rujukan resmi ini sebagai acuan.`
          : `Isu "${cleanClaim}" sedang ramai diberitakan. Masyarakat dihimbau menunggu konfirmasi resmi dan tidak terpancing spekulasi.`,
        tacticalResponseMilitary: `Pantau pergerakan narasi "${cleanClaim}" yang dipublikasikan oleh ${sourceName}. Waspadai upaya framing asimetris.`,
        isLive: true,
        publishedDate,
        isBreakingRecent,
        cognitiveScore: isHoaxInTitle ? 85 : isOfficial ? 30 : 70,
        viralityReason: isBreakingRecent
          ? '🔥 BREAKING NEWS LAPANGAN (<3 JAM)'
          : isHoaxInTitle 
          ? '🚨 ADUAN MASIF: Terindikasi Hoaks Media Daring'
          : isOfficial 
          ? '📢 KLARIFIKASI RESMI: Pernyataan Otoritas Kedinasan'
          : '⚠️ POLEMIK OPINI: Kontroversi Kebijakan / Hankam'
      })
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}

/**
 * 3. Parser Live RSS Feed Google Trends Indonesia sebagai SearchTrendSignal (Sprint 1B)
 * Menghasilkan sinyal minat penelusuran publik agregat (Left-of-Bang Early Warning),
 * BUKAN entitas artikel berita, BUKAN bukti klaim, dan BUKAN metrik media sosial.
 */
export function parseGoogleTrendsRssAsSignals(xmlText: string): SearchTrendSignal[] {
  if (!xmlText || !xmlText.includes('<item>')) return []

  const itemsRaw = xmlText.split('<item>').slice(1)
  const signals: SearchTrendSignal[] = []
  const now = Date.now()

  itemsRaw.forEach((itemBlock, idx) => {
    try {
      const rawTrendTitle = (itemBlock.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || ''
      const traffic = (itemBlock.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1] || ''
      const rawNewsUrl = (itemBlock.match(/<ht:news_item_url>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:news_item_url>/) || [])[1] || ''
      const rawNewsSource = (itemBlock.match(/<ht:news_item_source>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:news_item_source>/) || [])[1] || ''
      const rawPubDate = (itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''

      const trendTitle = cleanHtmlText(rawTrendTitle)
      if (!trendTitle) return

      const cleanPlatform = sanitizePlatformName(rawNewsSource, 'Google Trends')
      const canonicalUrl = rawNewsUrl ? cleanHtmlText(rawNewsUrl) : 'https://trends.google.com/trending?geo=ID'

      let startedAt: string | undefined = undefined
      let timestampStatus: 'VALID' | 'UNKNOWN_DATE' | 'INVALID_TIMESTAMP' = 'UNKNOWN_DATE'

      if (rawPubDate && rawPubDate.trim()) {
        const parsed = parseSourceDate(rawPubDate)
        if (parsed.status === 'VALID' && parsed.timestamp !== null) {
          startedAt = new Date(parsed.timestamp).toISOString()
          timestampStatus = 'VALID'
        } else {
          timestampStatus = parsed.status === 'INVALID' ? 'INVALID_TIMESTAMP' : 'UNKNOWN_DATE'
        }
      }

      signals.push({
        id: `SIG-GTREND-${idx + 1}-${now.toString().slice(-4)}`,
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
    } catch {
      // Lewati item yang korup
    }
  })

  return signals
}

/**
 * 3b. Parser Legacy Google Trends untuk kompatibilitas mundur
 */
export function parseGoogleTrendsRss(xmlText: string): DebunkKnowledgeEntry[] {
  if (!xmlText || !xmlText.includes('<item>')) return []

  const itemsRaw = xmlText.split('<item>').slice(1)
  const entries: DebunkKnowledgeEntry[] = []

  itemsRaw.forEach((itemBlock, idx) => {
    try {
      const rawTrendTitle = (itemBlock.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || ''
      const traffic = (itemBlock.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1] || 'Viral'
      const rawNewsTitle = (itemBlock.match(/<ht:news_item_title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:news_item_title>/) || [])[1] || ''
      const rawNewsUrl = (itemBlock.match(/<ht:news_item_url>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:news_item_url>/) || [])[1] || ''
      const rawNewsSource = (itemBlock.match(/<ht:news_item_source>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:news_item_source>/) || [])[1] || ''
      const rawPubDate = (itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''

      const trendTitle = cleanHtmlText(rawTrendTitle)
      if (!trendTitle) return

      const newsTitle = cleanHtmlText(rawNewsTitle)
      const cleanPlatform = sanitizePlatformName(rawNewsSource, 'Google Trends')
      const canonicalUrl = rawNewsUrl ? cleanHtmlText(rawNewsUrl) : 'https://trends.google.com/trending?geo=ID'

      const claim = newsTitle || `Lonjakan Minat Penelusuran Google: "${trendTitle}"`
      const cluster = classifyCluster(trendTitle, newsTitle)
      const keywords = [trendTitle.toLowerCase(), ...extractKeywords(claim)]

      // Gunakan tanggal publikasi asli jika tersedia, jika tidak tandai tidak tersedia (tanpa Date.now() palsu)
      let publishedDate = 'Waktu Publikasi Tidak Tersedia'
      if (rawPubDate && rawPubDate.trim()) {
        const parsed = parseSourceDate(rawPubDate)
        if (parsed.status === 'VALID' && parsed.timestamp !== null) {
          publishedDate = formatMilitaryDate(parsed.timestamp)
        }
      }

      entries.push({
        id: `GTREND-${idx + 1}-${Date.now().toString().slice(-4)}`,
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
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}
