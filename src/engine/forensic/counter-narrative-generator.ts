// ─── GENERATOR DRAF KONTRANARASI 4 KANAL DISPENAD & BABINSA ───
// SPRINT 7C: Formulasi Rilis Bantahan Terstruktur Lintas Matra & Media
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

export interface CounterNarrativeChannels {
  dispenadOfficial: string
  babinsaTerritorial: string
  whatsappCivilian: string
  socialTactical: string
}

export interface MatchedDebunkInfo {
  claim?: string
  clarification?: string
  officialSource?: string
  sourceUrl?: string
  cluster?: string
}

/**
 * Menghasilkan naskah penanggulangan adaptif pada 4 kanal komunikasi strategis
 * @param caption - Naskah atau klaim yang sedang viral
 * @param matchedDebunk - Data klarifikasi resmi terverifikasi jika cocok
 * @param platform - Nama platform media sosial asal
 */
export function generateCounterNarratives(
  caption: string,
  matchedDebunk?: MatchedDebunkInfo,
  platform = 'MEDIA SOSIAL'
): CounterNarrativeChannels {
  const claimSummary = matchedDebunk?.claim || caption.slice(0, 120).trim() + (caption.length > 120 ? '...' : '')
  const clarificationBody = matchedDebunk?.clarification || 
    'Seluruh informasi dan tuduhan yang beredar pada konten tersebut tidak sesuai dengan fakta lapangan serta tidak memiliki dasar verifikasi resmi kedinasan.'
  const sourceRef = matchedDebunk?.officialSource || 'Dinas Penerangan TNI Angkatan Darat (Dispenad)'
  const sourceLink = matchedDebunk?.sourceUrl || 'https://tniad.mil.id'

  // ─── 1. KANAL 1: SIARAN PERS FORMAL DISPENAD (Format Dinas Komando) ───
  const dispenadOfficial = `SIARAN PERS RESMI DISPENAD
Nomor: SP-PENG/08/X/2026/Siber

MENANGGAPI NARASI VIRAL TENTANG "${claimSummary.toUpperCase()}"

1. Berkenaan dengan maraknya peredaran konten disinformasi dan kampanye provokatif di ruang digital (${platform}) yang menarasikan bahwa: "${claimSummary}", Dinas Penerangan TNI Angkatan Darat menegaskan bahwa narasi tersebut adalah HOAKS dan TIDAK BERDASAR.

2. Fakta yang sebenarnya: ${clarificationBody} Seluruh operasional satuan, pembinaan personel, dan pengadaan sarana pertahanan dilaksanakan secara akuntabel, transparan, serta berpedoman pada Undang-Undang Republik Indonesia Nomor 34 Tahun 2004 tentang Tentara Nasional Indonesia.

3. Pimpinan TNI AD mengimbau seluruh lapisan masyarakat untuk tidak mudah terprovokasi oleh narasi manipulatif yang diorkestrasi oleh sindikat buzzer anonim demi memecah belah kemanunggalan TNI dengan rakyat. Rujukan resmi kementerian/lembaga: ${sourceLink}.

Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
Kepala Dinas Penerangan TNI Angkatan Darat`

  // ─── 2. KANAL 2: PANDUAN KOMSOS BABINSA (Tatap Muka Teritorial) ───
  const babinsaTerritorial = `PANDUAN KOMUNIKASI SOSIAL (KOMSOS) BABINSA
Satuan: Koramil / Kodim Jajaran Teritorial
Sasaran: Warga Binaan Balai RT/RW, Tokoh Masyarakat, & Karang Taruna

POIN BICARA (TALKING POINTS):
• Sapaan Awal: "Bapak-Ibu sekalian, belakangan ini di HP kita sering masuk video atau postingan medsos yang menyebutkan: '${claimSummary}'."
• Penegasan Fakta: "Kami selaku Babinsa ingin menyampaikan langsung bahwa kabar tersebut sudah dipastikan BOHONG/HOAKS. Faktanya: ${clarificationBody}"
• Himbauan Bijak: "Jangan langsung percaya atau ikut menyebarkan ke grup-grup pengajian atau arisan. Mari kita jaga kerukunan warga di lingkungan kita agar tidak terpancing kabar bohong yang sengaja disebar pihak tak bertanggung jawab."
• Rujukan Aduan: "Bila menemukan kabar serupa, segera konfirmasi ke Koramil atau tanyakan langsung ke Babinsa setempat."`

  // ─── 3. KANAL 3: PESAN SIAP FORWARD WHATSAPP WARGA (Civilian Debunk) ───
  const whatsappCivilian = `*KLARIFIKASI FAKTA & HIMBAUAN SIBER* 🇮🇩

Bapak, Ibu, dan Sahabat sekalian, mohon izin meluruskan informasi yang sedang ramai beredar mengenai:
👉 _"${claimSummary}"_

Kabar di atas dipastikan *HOAKS / TIDAK BENAR*.

*FAKTA RESMI DARI ${sourceRef.toUpperCase()}:*
✅ ${clarificationBody}
🔗 Selengkapnya silakan cek rujukan resmi: ${sourceLink}

Yuk kita budayakan *Saring Sebelum Sharing* demi menjaga ketenangan dan kerukunan keluarga serta lingkungan kita. Terima kasih! 🙏🇮🇩`

  // ─── 4. KANAL 4: NASKAH SANGGAHAN MEDSOS TAKTIS (<280 Karakter) ───
  const tacticalSnippet = clarificationBody.length > 150 ? clarificationBody.slice(0, 147) + '...' : clarificationBody
  const socialTactical = `[FAKTA RESMI] Narasi mengenai "${claimSummary.slice(0, 50)}..." dipastikan HOAKS!

Fakta: ${tacticalSnippet}

Rujukan resmi: ${sourceLink}
#TNIADBersamaRakyat #SaringSebelumSharing #TangkalHoaks`

  return {
    dispenadOfficial,
    babinsaTerritorial,
    whatsappCivilian,
    socialTactical
  }
}
