import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../../types'

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

      // Coba ekstrak tanggal artikel dari deskripsi jika ada format YYYY-MM-DD
      const dateMatch = rawDesc.match(/\b(202\d[-/]\d{2}[-/]\d{2})\b/)
      const publishedDate = dateMatch ? dateMatch[1] : new Date().toISOString().substring(0, 10)

      entries.push({
        id: `TBH-CANONICAL-${idx + 1}-${Date.now().toString().slice(-4)}`,
        claim,
        normalizedQuery: claim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: cluster === 'KEDAULATAN_MILITER' || cluster === 'POLITIK_NEGARA' ? 'critical' : 'high',
        clarification,
        officialSource,
        sourceUrl: cleanLink, // CANONICAL URL LANGSUNG KE ARTIKEL!
        keywords,
        tacticalResponseCivilian: `Informasi mengenai "${claim}" telah dikonfirmasi sebagai ${verdict}. Rujukan resmi dari ${officialSource}: ${clarification}`,
        tacticalResponseMilitary: `Atensi Teritorial: Narasi "${claim}" terkonfirmasi ${verdict}. Segera aktifkan pengawasan opini publik di wilayah binaan.`,
        isLive: true,
        publishedDate,
        cognitiveScore: 85
      })
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}

/**
 * 2. Parser Live RSS Feed Google News (Hankam & Isu Nasional)
 * Menghasilkan isu viral/berita terpanas yang sedang bergulir sebelum terbukti hoaks atau fakta
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

      const sourceName = sourceMatch ? cleanHtmlText(sourceMatch[2]) : 'Portal Berita Nasional'
      const cleanClaim = cleanTitle.replace(new RegExp(`\\s*-\\s*${sourceName}\\s*$`, 'i'), '').trim()

      const cluster = classifyCluster(cleanTitle, '')
      const keywords = extractKeywords(cleanClaim)

      // Deteksi apakah berita berasal dari instansi resmi (TNI, Kemhan, BMKG, Bawaslu)
      const isOfficial = sourceName.toUpperCase().includes('TNI') || 
                         sourceName.toUpperCase().includes('KEMHAN') || 
                         sourceName.toUpperCase().includes('BMKG') ||
                         sourceName.toUpperCase().includes('BAWASLU')

      const verdict: DebunkKnowledgeEntry['verdict'] = isOfficial ? 'FAKTA' : 'UNVERIFIED'

      const dateStr = rawPubDate ? new Date(rawPubDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10)

      entries.push({
        id: `GNEWS-${idx + 1}-${Date.now().toString().slice(-4)}`,
        claim: cleanClaim,
        normalizedQuery: cleanClaim.toLowerCase(),
        cluster,
        verdict,
        threatLevel: cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: isOfficial 
          ? `Pernyataan dan rilis resmi langsung dari ${sourceName}. Isi berita merupakan informasi terkonfirmasi kedinasan.`
          : `Isu sedang bergulir di ranah publik via ${sourceName}. Memerlukan verifikasi silang terhadap dokumen intelijen dan otoritas terkait.`,
        officialSource: sourceName,
        sourceUrl: cleanLink, // CANONICAL REDIRECT LANGSUNG KE ARTIKEL PERS!
        keywords,
        tacticalResponseCivilian: isOfficial
          ? `Informasi resmi dari ${sourceName} mengenai: "${cleanClaim}". Gunakan rujukan resmi ini sebagai acuan.`
          : `Isu "${cleanClaim}" sedang ramai diberitakan. Masyarakat dihimbau menunggu konfirmasi resmi dan tidak terpancing spekulasi.`,
        tacticalResponseMilitary: `Pantau pergerakan narasi "${cleanClaim}" yang dipublikasikan oleh ${sourceName}. Waspadai upaya framing asimetris.`,
        isLive: true,
        publishedDate: dateStr,
        cognitiveScore: isOfficial ? 30 : 65
      })
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}

/**
 * 3. Parser Live RSS Feed Google Trends Indonesia
 * Menghasilkan lonjakan narasi pencarian viral masyarakat (Left-of-Bang Early Warning)
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

      const trendTitle = cleanHtmlText(rawTrendTitle)
      if (!trendTitle) return

      const newsTitle = cleanHtmlText(rawNewsTitle)
      const newsSource = cleanHtmlText(rawNewsSource) || 'Media Arus Utama'
      const canonicalUrl = rawNewsUrl ? cleanHtmlText(rawNewsUrl) : 'https://trends.google.com/trending?geo=ID'

      const claim = newsTitle || `Lonjakan Pencarian Viral Publik: "${trendTitle}"`
      const cluster = classifyCluster(trendTitle, newsTitle)
      const keywords = [trendTitle.toLowerCase(), ...extractKeywords(claim)]

      entries.push({
        id: `GTREND-${idx + 1}-${Date.now().toString().slice(-4)}`,
        claim,
        normalizedQuery: trendTitle.toLowerCase(),
        cluster,
        verdict: 'UNVERIFIED',
        threatLevel: cluster === 'KEDAULATAN_MILITER' ? 'critical' : 'medium',
        clarification: `Topik "${trendTitle}" mengalami lonjakan pencarian publik (+${traffic} penelusuran). Dilaporkan oleh ${newsSource}. Status narasi masih berkembang di media sosial.`,
        officialSource: `Google Trends ID & ${newsSource}`,
        sourceUrl: canonicalUrl, // CANONICAL URL BERITA ASLI TERKAIT TREN!
        keywords,
        tacticalResponseCivilian: `Topik "${trendTitle}" saat ini sedang viral di internet dengan lonjakan tinggi. Pastikan menyaring informasi sebelum membagikan.`,
        tacticalResponseMilitary: `Deteksi Sinyal Lemah: Terjadi lonjakan penelusuran masyarakat mengenai "${trendTitle}" (+${traffic}). Antisipasi potensi penggiringan narasi.`,
        isLive: true,
        publishedDate: new Date().toISOString().substring(0, 10),
        trendTraffic: `+${traffic} pencarian`,
        cognitiveScore: 60
      })
    } catch {
      // Lewati item yang korup
    }
  })

  return entries
}
