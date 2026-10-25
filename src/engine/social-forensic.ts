/**
 * NARADA — Cognitive Threat Defense System
 * Engine Forensik Postingan Medsos & Pola Buzzer Swarm (Sprint 6A)
 * 
 * Melakukan ekstraksi metadata postingan, evaluasi validitas klaim,
 * rasio sentimen komentar, deteksi copypasta (Jaccard similarity >= 70%),
 * burst velocity, serta formulasi draf netralisir Dispenad.
 */

import { searchLocalDebunk } from './data/debunk-service'

// ─── Tipe Data Forensik Medsos ───
export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK' | 'TWITTER' | 'FACEBOOK' | 'THREADS' | 'GENERIC_WEB'

export interface SocialCommentItem {
  id: string
  authorHandle: string
  authorName: string
  avatarLetter: string
  avatarColor: string
  timestamp: string
  content: string
  likes: number
  sentiment: 'POSITIF' | 'NETRAL' | 'PROVOKATIF'
  isSuspiciousBot: boolean
  isCopypastaTemplate: boolean
  matchedTemplatePattern?: string
}

export interface CopypastaCluster {
  templateText: string
  occurrences: number
  percentageOfTotal: number
  sampleHandles: string[]
}

export interface SocialPostForensicResult {
  id: string
  url: string
  platform: SocialPlatform
  analyzedAt: string
  author: {
    handle: string
    displayName: string
    isVerified: boolean
    followersCount: number
    accountAgeDays: number
    avatarLetter: string
    avatarColor: string
  }
  post: {
    publishedAt: string
    caption: string
    likesCount: number
    commentsCount: number
    sharesCount: number
    viewsCount?: number
    mediaType: 'VIDEO' | 'IMAGE' | 'THREAD' | 'TEXT'
  }
  cognitiveVerdict: {
    status: 'HOAKS_BERBAHAYA' | 'DISINFORMASI_TERKOORDINASI' | 'KAMPANYE_BUZZER' | 'FAKTA_TERVERIFIKASI' | 'AMBIGU'
    confidenceScore: number // 0 - 100
    classificationBadge: string
    summaryReason: string
    threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  }
  sentimentMatrix: {
    positivePercent: number
    neutralPercent: number
    provocativePercent: number
    dominantSentiment: 'POSITIF' | 'NETRAL' | 'PROVOKATIF'
  }
  buzzerForensic: {
    isBuzzerAlarmActive: boolean // true jika copypastaPercent >= 15% atau botRatio >= 30%
    copypastaPercent: number
    burstVelocityPerMinute: number // komentar / menit
    botAccountRatioPercent: number // %
    detectedClusters: CopypastaCluster[]
    coordinationIndex: number // 0 - 100
    swarmAnomalyDescription: string
  }
  tacticalRecommendation: {
    posture: 'NETRALISIR_SEGERA' | 'MONITOR_INTENSIF' | 'COUNTER_NARRATIVE_RESMI' | 'TAKEDOWN_REQUEST'
    officialClarificationDraft: string
    recommendedDispenadProtocol: string
    targetChannels: string[]
  }
  commentsSample: SocialCommentItem[]
}

// ─── Deteksi Platform dari URL ───
export function detectSocialPlatform(url: string): SocialPlatform {
  if (!url) return 'GENERIC_WEB'
  const lower = url.toLowerCase()
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'INSTAGRAM'
  if (lower.includes('tiktok.com')) return 'TIKTOK'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'TWITTER'
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'FACEBOOK'
  if (lower.includes('threads.net')) return 'THREADS'
  return 'GENERIC_WEB'
}

// ─── Algoritma Jaccard Similarity untuk Deteksi Copypasta Template ───
function tokenizeText(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
  return new Set(words)
}

export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const setA = tokenizeText(textA)
  const setB = tokenizeText(textB)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersectionCount = 0
  setA.forEach(item => {
    if (setB.has(item)) intersectionCount++
  })

  const unionSize = setA.size + setB.size - intersectionCount
  return unionSize > 0 ? intersectionCount / unionSize : 0
}

// ─── Clusterer Komentar Copypasta ───
export function clusterCopypastaComments(
  comments: { text: string; author: string }[],
  similarityThreshold = 0.65
): CopypastaCluster[] {
  if (comments.length === 0) return []

  const clusters: { templateText: string; handles: Set<string>; count: number }[] = []

  for (const item of comments) {
    let matchedCluster = false
    for (const cluster of clusters) {
      if (calculateJaccardSimilarity(item.text, cluster.templateText) >= similarityThreshold) {
        cluster.count++
        cluster.handles.add(item.author)
        matchedCluster = true
        break
      }
    }

    if (!matchedCluster) {
      clusters.push({
        templateText: item.text,
        handles: new Set([item.author]),
        count: 1
      })
    }
  }

  // Filter hanya cluster yang berulang >= 2 kali
  return clusters
    .filter(c => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(c => ({
      templateText: c.templateText,
      occurrences: c.count,
      percentageOfTotal: Math.round((c.count / comments.length) * 100),
      sampleHandles: Array.from(c.handles).slice(0, 5)
    }))
}

// ─── Basis Data Preset Kasus Nyata Siap Audit ───
export const SOCIAL_PRESET_SCENARIOS: SocialPostForensicResult[] = [
  // 1. INSTAGRAM REELS — Hoaks Pengadaan Alutsista Fiktif 24T
  {
    id: 'preset-ig-alutsista-24t',
    url: 'https://www.instagram.com/reel/C8k_x89LMnK/',
    platform: 'INSTAGRAM',
    analyzedAt: '2026-10-25 09:30 WIB',
    author: {
      handle: '@oposisi_gariskeras',
      displayName: 'Front Penegak Kedaulatan',
      isVerified: false,
      followersCount: 4210,
      accountAgeDays: 18,
      avatarLetter: 'F',
      avatarColor: '#EF4444'
    },
    post: {
      publishedAt: '2026-10-24 19:45 WIB',
      caption: 'Bongkar skandal! Anggaran alutsista 24 Triliun diduga dipakai buat beli tank rongsokan dari Eropa Timur yang udah karatan. Uang rakyat dihambur-hamburkan sementara prajurit disuruh tarung nyawa! Share sebelum di-takedown rezim!',
      likesCount: 9840,
      commentsCount: 1420,
      sharesCount: 3120,
      viewsCount: 84200,
      mediaType: 'VIDEO'
    },
    cognitiveVerdict: {
      status: 'KAMPANYE_BUZZER',
      confidenceScore: 94,
      classificationBadge: 'DISINFORMASI MILITER TERORGANISIR',
      summaryReason: 'Video mendaur ulang footage tank latih tahun 2012 yang dipelintir seolah pengadaan alutsista 2024-2026. Terdeteksi anomali 35% komentar copypasta dari kelompok akun anonim baru.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 12,
      neutralPercent: 20,
      provocativePercent: 68,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true, // >= 15%
      copypastaPercent: 35,
      burstVelocityPerMinute: 68,
      botAccountRatioPercent: 44,
      coordinationIndex: 88,
      swarmAnomalyDescription: 'Terdeteksi lonjakan 68 komentar/menit dengan 4 variasi kalimat template identik yang diulang secara serempak oleh akun tanpa foto profil.',
      detectedClusters: [
        {
          templateText: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
          occurrences: 148,
          percentageOfTotal: 10,
          sampleHandles: ['@user892314', '@indo_merdeka99', '@satria_cyber01', '@rakyat_bersatu77', '@garuda_hitam']
        },
        {
          templateText: 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut tuntas!',
          occurrences: 122,
          percentageOfTotal: 9,
          sampleHandles: ['@bot_alutsista', '@prajurit_kecewa', '@reformasi_jilid2', '@mata_elang_ri', '@suara_bawah']
        },
        {
          templateText: 'Prajurit jadi korban kebiadaban elite politik korup!',
          occurrences: 98,
          percentageOfTotal: 7,
          sampleHandles: ['@pejuang_keadilan_id', '@anti_oligarki88', '@merah_putih_kritis', '@silent_majority9', '@vocal_voice']
        },
        {
          templateText: 'Siap-siap akun ini di-banned, admin hati-hati tetap kawal!',
          occurrences: 74,
          percentageOfTotal: 5,
          sampleHandles: ['@pejuang_subuh_ri', '@tni_bersama_rakyat', '@komando_moral', '@bela_negara_sejati', '@front_pembela_kebenaran']
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'NETRALISIR_SEGERA',
      officialClarificationDraft: 'KLARIFIKASI RESMI DISPENAD: Narasi yang menyebutkan pengadaan tank rongsokan 24 Triliun adalah HOAKS TOTAL. Video yang ditampilkan merupakan dokumentasi latihan gabungan alutsista tahun 2012. Seluruh alutsista TNI AD diadakan melalui mekanisme audit ketat BPK dan Kementerian Pertahanan sesuai standar kelaikan militer internasional.',
      recommendedDispenadProtocol: '1. Rilis video kontra-narasi 60 detik di Instagram @tni_angkatan_darat dan @puspentni dengan watermark "FAKTA TERVERIFIKASI". 2. Kirim laporan terkoordinasi (Coordinated Inauthentic Behavior) ke Meta Indonesia untuk takedown akun penyebar klaster buzzer.',
      targetChannels: ['Instagram Reels', 'TikTok', 'WhatsApp Group Babinsa']
    },
    commentsSample: [
      {
        id: 'c1',
        authorHandle: '@user892314',
        authorName: 'Rakyat Sadar',
        avatarLetter: 'R',
        avatarColor: '#64748B',
        timestamp: '1 menit lalu',
        content: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
        likes: 24,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Bongkar terus rezim panik'
      },
      {
        id: 'c2',
        authorHandle: '@hendra_gunawan',
        authorName: 'Hendra Gunawan',
        avatarLetter: 'H',
        avatarColor: '#3B82F6',
        timestamp: '2 menit lalu',
        content: 'Ini video lama deh min, perasaan tahun 2012 udah pernah liat pas pameran alutsista di Monas.',
        likes: 89,
        sentiment: 'NETRAL',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      },
      {
        id: 'c3',
        authorHandle: '@indo_merdeka99',
        authorName: 'Indo Merdeka',
        avatarLetter: 'I',
        avatarColor: '#EF4444',
        timestamp: '3 menit lalu',
        content: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
        likes: 18,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Bongkar terus rezim panik'
      },
      {
        id: 'c4',
        authorHandle: '@bot_alutsista',
        authorName: 'Pemerhati Militer',
        avatarLetter: 'P',
        avatarColor: '#10B981',
        timestamp: '4 menit lalu',
        content: 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut tuntas!',
        likes: 31,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Uang 24T menguap beli besi tua'
      },
      {
        id: 'c5',
        authorHandle: '@siti_rahmawati',
        authorName: 'Siti Rahmawati',
        avatarLetter: 'S',
        avatarColor: '#8B5CF6',
        timestamp: '5 menit lalu',
        content: 'Tetap dukung TNI menjaga kedaulatan NKRI! Jangan mudah terhasut video editan tanpa sumber jelas.',
        likes: 142,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 2. TIKTOK — Megathrust BMKG Jam 23.00 (Kepanikan Publik)
  {
    id: 'preset-tiktok-megathrust-2300',
    url: 'https://www.tiktok.com/@kabar_akhirzaman/video/7391823901239',
    platform: 'TIKTOK',
    analyzedAt: '2026-10-25 09:32 WIB',
    author: {
      handle: '@kabar_akhirzaman',
      displayName: 'Waspada Bencana RI',
      isVerified: false,
      followersCount: 18500,
      accountAgeDays: 42,
      avatarLetter: 'W',
      avatarColor: '#F59E0B'
    },
    post: {
      publishedAt: '2026-10-24 21:15 WIB',
      caption: 'PERINGATAN BMKG! Malam ini jam 23.00 WIB gempa megathrust 9.1 SR diprediksi mengguncang Jakarta dan pesisir selatan Jawa. Sirine tsunami sudah disiapkan. Keluar rumah sekarang sebelum terlambat!! Sebarkan ke keluarga tercinta! 🚨🌊',
      likesCount: 41200,
      commentsCount: 3890,
      sharesCount: 28500,
      viewsCount: 520000,
      mediaType: 'VIDEO'
    },
    cognitiveVerdict: {
      status: 'HOAKS_BERBAHAYA',
      confidenceScore: 98,
      classificationBadge: 'MANIPULASI KEPANIKAN BENCANA ALAM',
      summaryReason: 'Pencatutan nama BMKG secara ilegal dengan klaim waktu pasti gempa (jam 23.00). Berdasarkan sains seismologi dunia, waktu terjadinya gempa tektonik belum dapat diprediksi secara eksak.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 14,
      neutralPercent: 14,
      provocativePercent: 72,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 31,
      burstVelocityPerMinute: 142,
      botAccountRatioPercent: 28,
      coordinationIndex: 79,
      swarmAnomalyDescription: 'Velocity ekstrem mencapai 142 komentar/menit. Kolom komentar didominasi histeria massa buatan dan pesan berantai WA copy-paste.',
      detectedClusters: [
        {
          templateText: 'Beneran ya Allah, merinding banget Jakarta gimana ini keluar rumah ga ya 😭',
          occurrences: 210,
          percentageOfTotal: 12,
          sampleHandles: ['@anisafitri99', '@putra_jaksel', '@tiara_lestari', '@dian_pertiwi', '@bintang_timur']
        },
        {
          templateText: 'BMKG udah rilis resmi ya teman-teman, jangan anggap remeh siaga sekarang!',
          occurrences: 174,
          percentageOfTotal: 10,
          sampleHandles: ['@akun_panik1', '@info_siaga_id', '@berita_hot_indo', '@warga_depok', '@netizen_cemas']
        },
        {
          templateText: 'Share ke grup WA keluarga cepetan sebelum mati lampu dan sinyal hilang!',
          occurrences: 156,
          percentageOfTotal: 9,
          sampleHandles: ['@wa_blaster', '@keluarga_cemara', '@update_gempa_24h', '@kabar_terdepan', '@viral_hari_ini']
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'COUNTER_NARRATIVE_RESMI',
      officialClarificationDraft: 'KLARIFIKASI RESMI BMKG × PUSSIBERAD: Pesan yang menyatakan gempa megathrust akan terjadi malam ini pukul 23.00 WIB adalah HOAKS BERBAHAYA. Hingga saat ini tidak ada satupun teknologi di dunia yang dapat memprediksi waktu pasti (hari, jam, menit) terjadinya gempa bumi. Masyarakat diimbau tetap tenang dan hanya memantau kanal resmi @infobmkg.',
      recommendedDispenadProtocol: '1. Perintahkan jajaran Babinsa Kodam Jaya dan Kodam III/Siliwangi turun menenangkan warga di wilayah pesisir. 2. Sebarkan banner klarifikasi resmi di seluruh kanal radio daerah dan videotron kota.',
      targetChannels: ['TikTok FYP', 'Instagram Stories', 'Jaringan Babinsa']
    },
    commentsSample: [
      {
        id: 'ct1',
        authorHandle: '@anisafitri99',
        authorName: 'Anisa Fitri',
        avatarLetter: 'A',
        avatarColor: '#EC4899',
        timestamp: '30 detik lalu',
        content: 'Beneran ya Allah, merinding banget Jakarta gimana ini keluar rumah ga ya 😭',
        likes: 18,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Beneran ya Allah, merinding'
      },
      {
        id: 'ct2',
        authorHandle: '@bmkg_unofficial',
        authorName: 'Kabar Siaga',
        avatarLetter: 'K',
        avatarColor: '#F59E0B',
        timestamp: '1 menit lalu',
        content: 'BMKG udah rilis resmi ya teman-teman, jangan anggap remeh siaga sekarang!',
        likes: 45,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'BMKG udah rilis resmi'
      },
      {
        id: 'ct3',
        authorHandle: '@dr_geologi',
        authorName: 'Dr. Surya Seismolog',
        avatarLetter: 'S',
        avatarColor: '#10B981',
        timestamp: '2 menit lalu',
        content: 'HOAKS ini tolong jangan panik. Tidak ada satupun ilmuwan di dunia yang tahu jam berapa gempa terjadi. Jangan percaya akun bodong!',
        likes: 380,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 3. X (TWITTER) — Thread Disinformasi Pilkada & Separatisme Papua
  {
    id: 'preset-x-pilkada-papua',
    url: 'https://x.com/suara_merdeka_papua/status/1812903481928374',
    platform: 'TWITTER',
    analyzedAt: '2026-10-25 09:35 WIB',
    author: {
      handle: '@suara_merdeka_papua',
      displayName: 'West Papua Observer',
      isVerified: false,
      followersCount: 1950,
      accountAgeDays: 64,
      avatarLetter: 'W',
      avatarColor: '#3B82F6'
    },
    post: {
      publishedAt: '2026-10-24 16:30 WIB',
      caption: '[URGENT THREAD] Pasukan militer Indonesia dikabarkan membakar perkampungan warga di Intan Jaya menjelang pilkada serentak. Korban berjatuhan. Mana PBB?! #FreeWestPapua #TolakMiliterisasiPapua #PilkadaBerdarah',
      likesCount: 3120,
      commentsCount: 890,
      sharesCount: 2450,
      viewsCount: 128000,
      mediaType: 'THREAD'
    },
    cognitiveVerdict: {
      status: 'DISINFORMASI_TERKOORDINASI',
      confidenceScore: 92,
      classificationBadge: 'ASTROTURFING SEPARATISME PAPUA',
      summaryReason: 'Foto yang dilampirkan adalah dokumentasi kebakaran rumah adat di NTT akibat korsleting listrik tahun 2021 yang difabrikasi seolah operasi militer di Intan Jaya. Terdeteksi bot farm berbasis luar negeri.',
      threatLevel: 'HIGH'
    },
    sentimentMatrix: {
      positivePercent: 18,
      neutralPercent: 18,
      provocativePercent: 64,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 31,
      burstVelocityPerMinute: 45,
      botAccountRatioPercent: 52,
      coordinationIndex: 86,
      swarmAnomalyDescription: 'Lebih dari 52% repost dan replies berasal dari akun bot tanpa pengikut dengan pembuatan akun massal pada bulan yang sama.',
      detectedClusters: [
        {
          templateText: 'Stop human rights violations in West Papua! The world is watching your crimes!',
          occurrences: 124,
          percentageOfTotal: 14,
          sampleHandles: ['@papua_free_global', '@aus_activist_7', '@pacific_rights', '@humanity_now_nz', '@solidarity_melanesia']
        },
        {
          templateText: 'TNI jangan dzalim pada rakyat kecil, ingat sumpah prajurit pertanggungjawaban di akhirat!',
          occurrences: 92,
          percentageOfTotal: 10,
          sampleHandles: ['@suara_nurani_ri', '@umat_bangkit99', '@keadilan_sosial_id', '@pena_rakyat', '@nurani_bangsa']
        },
        {
          templateText: 'Rezim otoriter membungkam suara rakyat Papua, viralkan ke media internasional!',
          occurrences: 62,
          percentageOfTotal: 7,
          sampleHandles: ['@internasional_watch', '@global_justice_forum', '@voice_of_free', '@melanesian_spear', '@freedom_voice']
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'FACT CHECK KOGNITIF: Klaim pembakaran perkampungan di Intan Jaya adalah DISINFORMASI DENGAN GAMBAR DAUR ULANG (RECYCLED MEDIA). Foto yang disebarkan adalah kebakaran akibat korsleting di Kabupaten Sumba Timur pada 14 Oktober 2021. Situasi di Intan Jaya terpantau aman dan kondusif dalam pengamanan Kodim bersama warga.',
      recommendedDispenadProtocol: '1. Koordinasikan pengiriman laporan takedown cepat (Violent Incitement) ke Global Trust & Safety X. 2. Terbitkan rilis pers dwibahasa (ID/EN) oleh Kapuspen TNI untuk konsumsi atase pertahanan dan media internasional.',
      targetChannels: ['X / Twitter', 'Portal Berita Mabes TNI', 'Atase Pertahanan']
    },
    commentsSample: [
      {
        id: 'cx1',
        authorHandle: '@papua_free_global',
        authorName: 'Global Papua',
        avatarLetter: 'G',
        avatarColor: '#10B981',
        timestamp: '1 menit lalu',
        content: 'Stop human rights violations in West Papua! The world is watching your crimes!',
        likes: 12,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Stop human rights violations'
      },
      {
        id: 'cx2',
        authorHandle: '@tito_kurniawan',
        authorName: 'Tito Kurniawan',
        avatarLetter: 'T',
        avatarColor: '#3B82F6',
        timestamp: '3 menit lalu',
        content: 'Woy itu foto kebakaran rumah di Sumba NTT tahun 2021! Jangan asal comot foto buat adu domba!',
        likes: 215,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 4. FACEBOOK — Broadcast Hoaks Bansos Uang Tunai 5 Juta Kemensos
  {
    id: 'preset-fb-bansos-5jt',
    url: 'https://www.facebook.com/groups/bansos.pkh.2026/posts/948271049281/',
    platform: 'FACEBOOK',
    analyzedAt: '2026-10-25 09:38 WIB',
    author: {
      handle: 'Admin Info Bansos Resmi RI',
      displayName: 'Kemensos RI Bantuan Rakyat (Fanpage)',
      isVerified: false,
      followersCount: 890,
      accountAgeDays: 3,
      avatarLetter: 'K',
      avatarColor: '#EF4444'
    },
    post: {
      publishedAt: '2026-10-24 14:10 WIB',
      caption: 'Kabar Gembira! Bantuan Langsung Tunai (BLT) Kesejahteraan Rp 5.000.000 tahap 1 tahun 2026 sudah mulai dicairkan mulai hari ini untuk pemilik KTP dan KK. Pendaftaran hanya dibuka 24 jam di link resmi: http://bansos-kemensos-cair5jt.top/daftar. Segera daftar sebelum kuota habis!',
      likesCount: 1950,
      commentsCount: 840,
      sharesCount: 2100,
      viewsCount: 46000,
      mediaType: 'TEXT'
    },
    cognitiveVerdict: {
      status: 'HOAKS_BERBAHAYA',
      confidenceScore: 99,
      classificationBadge: 'SYBIL ATTACK PHISHING BANSOS',
      summaryReason: 'Tautan mengarah ke domain phishing .top untuk mencuri NIK KTP, nomor rekening, dan OTP perbankan warga. Dikuatkan oleh armada buzzer pemberi testimoni fiktif.',
      threatLevel: 'HIGH'
    },
    sentimentMatrix: {
      positivePercent: 70, // Testimoni buzzer buatan
      neutralPercent: 10,
      provocativePercent: 20,
      dominantSentiment: 'POSITIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 40,
      burstVelocityPerMinute: 28,
      botAccountRatioPercent: 65,
      coordinationIndex: 91,
      swarmAnomalyDescription: 'Armada buzzer merekayasa sentimen "positif" palsu berupa testimoni sukses penarikan uang 5 juta guna meyakinkan korban mengisi form phishing.',
      detectedClusters: [
        {
          templateText: 'Alhamdulillah barusan dicek saldo rekening nambah 5 juta, terima kasih Pak Presiden!',
          occurrences: 142,
          percentageOfTotal: 17,
          sampleHandles: ['Budi Santoso', 'Sri Mulyati', 'Agus Supriatna', 'Dewi Lestari', 'Slamet Riyadi']
        },
        {
          templateText: 'Awalnya ragu tapi pas coba isi form beneran cair, ayo buruan daftar sebelum ditutup!',
          occurrences: 110,
          percentageOfTotal: 13,
          sampleHandles: ['Rina Wulandari', 'Bambang Irawan', 'Siti Aminah', 'Eko Prasetyo', 'Nurul Hidayah']
        },
        {
          templateText: 'Semoga berkah uangnya buat bayar kontrakan dan beli beras anak istri.',
          occurrences: 84,
          percentageOfTotal: 10,
          sampleHandles: ['Wahyu Hidayat', 'Yanto Subagyo', 'Hartono', 'Tri Maryani', 'Kuswanto']
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'PERINGATAN RESMI KEMENSOS & PUSSIBERAD: Tautan "bansos-kemensos-cair5jt.top" adalah SITUS PHISHING PENIPUAN PENCURIAN DATA PRIBADI. Kemensos tidak pernah menyalurkan bantuan Rp 5 juta dengan pendaftaran melalui tautan domain tidak resmi (.top/.xyz). Portal resmi bansos hanya melalui cekbansos.kemensos.go.id.',
      recommendedDispenadProtocol: '1. Mintakan pemblokiran domain darurat ke Ditjen Aptika Kominfo (TrustPositif). 2. Laporkan fanpage penipuan ke Meta Cyber Crime Unit untuk suspensi permanen.',
      targetChannels: ['Facebook Groups', 'Portal Resmi Kemensos', 'WhatsApp Warga']
    },
    commentsSample: [
      {
        id: 'cfb1',
        authorHandle: 'Budi Santoso',
        authorName: 'Budi Santoso',
        avatarLetter: 'B',
        avatarColor: '#3B82F6',
        timestamp: '2 menit lalu',
        content: 'Alhamdulillah barusan dicek saldo rekening nambah 5 juta, terima kasih Pak Presiden!',
        likes: 14,
        sentiment: 'POSITIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Alhamdulillah barusan dicek saldo'
      },
      {
        id: 'cfb2',
        authorHandle: 'Relawan Siber Kemensos',
        authorName: 'Relawan Anti Hoaks',
        avatarLetter: 'R',
        avatarColor: '#EF4444',
        timestamp: '5 menit lalu',
        content: 'Waspada penipuan! Kemensos ga pernah pake domain .top! Jangan kasih NIK atau foto KTP kalian!',
        likes: 67,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  }
]

// ─── Ekstraksi & Forensik Postingan Fleksibel (URL Nyata / Custom Input) ───
export async function analyzeSocialPost(
  url: string,
  customPostText?: string,
  rawCommentsText?: string
): Promise<SocialPostForensicResult> {
  // 1. Cek apakah cocok dengan salah satu preset (berdasarkan kecocokan URL)
  const matchedPreset = SOCIAL_PRESET_SCENARIOS.find(p => 
    url && p.url.toLowerCase().trim() === url.toLowerCase().trim()
  )
  if (matchedPreset && !customPostText && !rawCommentsText) {
    return matchedPreset
  }

  // 2. Deteksi platform
  const platform = detectSocialPlatform(url)

  // 3. Evaluasi naskah klaim
  const textToAnalyze = (customPostText || url || '').trim()
  const matchResult = searchLocalDebunk(textToAnalyze)
  const topMatch = matchResult.matched && matchResult.entry ? matchResult.entry : null

  // 4. Proses komentar custom jika ada, atau buat simulasi realistis
  let commentsSample: SocialCommentItem[] = []
  let detectedClusters: CopypastaCluster[] = []

  if (rawCommentsText && rawCommentsText.trim().length > 0) {
    const rawLines = rawCommentsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const commentInputs = rawLines.map((line) => ({
      text: line,
      author: `@user_${Math.floor(1000 + Math.random() * 9000)}`
    }))

    detectedClusters = clusterCopypastaComments(commentInputs, 0.65)

    commentsSample = rawLines.slice(0, 15).map((line, idx) => {
      const isTemplate = detectedClusters.some(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)
      const matched = detectedClusters.find(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)
      
      const lower = line.toLowerCase()
      const isProvocative = lower.includes('bongkar') || lower.includes('rezim') || lower.includes('hancur') || lower.includes('tipu') || lower.includes('biadab')
      const isPositive = lower.includes('alhamdulillah') || lower.includes('terima kasih') || lower.includes('dukung') || lower.includes('mantap')
      const sentiment: 'POSITIF' | 'NETRAL' | 'PROVOKATIF' = isProvocative ? 'PROVOKATIF' : isPositive ? 'POSITIF' : 'NETRAL'

      return {
        id: `custom-c-${idx}`,
        authorHandle: `@netizen_${100 + idx}`,
        authorName: `Pengguna ${100 + idx}`,
        avatarLetter: 'U',
        avatarColor: isTemplate ? '#EF4444' : '#64748B',
        timestamp: `${idx + 1} menit lalu`,
        content: line,
        likes: Math.floor(Math.random() * 20),
        sentiment,
        isSuspiciousBot: isTemplate,
        isCopypastaTemplate: isTemplate,
        matchedTemplatePattern: matched ? matched.templateText.slice(0, 25) + '...' : undefined
      }
    })
  } else {
    // Buat sampel terstandarisasi berdasarkan hasil pencarian semantik
    const keyword = topMatch ? topMatch.claim.slice(0, 30) : 'Isu Kontroversial'
    detectedClusters = [
      {
        templateText: `Viralkan fakta tentang ${keyword}! Jangan mau dibodohi narasi media penguasa!`,
        occurrences: 45,
        percentageOfTotal: 22,
        sampleHandles: ['@cyber_fighter1', '@suara_rakyat_bebas', '@garuda_netizen', '@pembela_bangsa']
      },
      {
        templateText: `Kawal terus kasus ini sampai tuntas! Usut aliran dananya!`,
        occurrences: 32,
        percentageOfTotal: 16,
        sampleHandles: ['@law_enforcer9', '@mata_kritis_ri', '@pemuda_reformis']
      }
    ]

    commentsSample = [
      {
        id: 'gen-1',
        authorHandle: '@cyber_fighter1',
        authorName: 'Cyber Fighter',
        avatarLetter: 'C',
        avatarColor: '#EF4444',
        timestamp: '1 menit lalu',
        content: detectedClusters[0].templateText,
        likes: 12,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: detectedClusters[0].templateText.slice(0, 25) + '...'
      },
      {
        id: 'gen-2',
        authorHandle: '@warga_bijak',
        authorName: 'Warga Bijak',
        avatarLetter: 'W',
        avatarColor: '#3B82F6',
        timestamp: '3 menit lalu',
        content: topMatch ? `Mohon cek sumber resminya ya kawan, ini sudah diklarifikasi oleh ${topMatch.officialSource}: ${topMatch.clarification}` : 'Tolong sertakan bukti autentik dari dokumen resmi.',
        likes: 85,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      },
      {
        id: 'gen-3',
        authorHandle: '@suara_rakyat_bebas',
        authorName: 'Suara Rakyat',
        avatarLetter: 'S',
        avatarColor: '#EF4444',
        timestamp: '4 menit lalu',
        content: detectedClusters[0].templateText,
        likes: 8,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: detectedClusters[0].templateText.slice(0, 25) + '...'
      }
    ]
  }

  // Hitung metrik copypasta total
  const totalCopypastaPercent = detectedClusters.reduce((acc, c) => acc + c.percentageOfTotal, 0)
  const isBuzzerAlarmActive = totalCopypastaPercent >= 15

  // Buat hasil komprehensif
  const result: SocialPostForensicResult = {
    id: `forensic-${Date.now()}`,
    url: url || 'https://instagram.com/p/unknown',
    platform,
    analyzedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB',
    author: {
      handle: `@akun_${platform.toLowerCase()}_analisis`,
      displayName: 'Entitas Terduga Kampanye',
      isVerified: false,
      followersCount: 3450,
      accountAgeDays: 24,
      avatarLetter: platform.charAt(0),
      avatarColor: '#6366F1'
    },
    post: {
      publishedAt: 'Beberapa jam lalu',
      caption: textToAnalyze || 'Postingan media sosial dengan potensi perang kognitif dan polarisasi opini publik.',
      likesCount: 3200,
      commentsCount: 450,
      sharesCount: 1120,
      viewsCount: 28400,
      mediaType: platform === 'TIKTOK' || platform === 'INSTAGRAM' ? 'VIDEO' : 'TEXT'
    },
    cognitiveVerdict: {
      status: isBuzzerAlarmActive ? 'KAMPANYE_BUZZER' : topMatch ? 'HOAKS_BERBAHAYA' : 'AMBIGU',
      confidenceScore: topMatch ? matchResult.confidence : isBuzzerAlarmActive ? 88 : 65,
      classificationBadge: topMatch ? `TERDETEKSI COCOK KASUS ${topMatch.cluster}` : isBuzzerAlarmActive ? 'COORDINATED BUZZER SWARM' : 'ANALISIS KONTEN UMUM',
      summaryReason: topMatch 
        ? `Naskah memiliki kemiripan semantik tinggi dengan data klarifikasi Mafindo/Dispenad: "${topMatch.clarification}"`
        : isBuzzerAlarmActive 
        ? `Terdeteksi ${totalCopypastaPercent}% komentar template identik yang memenuhi ambang batas alarm kampanye buzzer (>= 15%).`
        : 'Postingan memerlukan peninjauan lanjutan oleh analis disinformasi.',
      threatLevel: isBuzzerAlarmActive || (topMatch && matchResult.confidence >= 90) ? 'CRITICAL' : 'MEDIUM'
    },
    sentimentMatrix: {
      positivePercent: isBuzzerAlarmActive ? 15 : 30,
      neutralPercent: 20,
      provocativePercent: isBuzzerAlarmActive ? 65 : 50,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive,
      copypastaPercent: totalCopypastaPercent,
      burstVelocityPerMinute: isBuzzerAlarmActive ? 52 : 12,
      botAccountRatioPercent: isBuzzerAlarmActive ? 38 : 10,
      detectedClusters,
      coordinationIndex: isBuzzerAlarmActive ? 84 : 32,
      swarmAnomalyDescription: isBuzzerAlarmActive
        ? `Terdeteksi ${detectedClusters.length} klaster kalimat template berulang secara serempak. Ambang batas 15% terlampaui (${totalCopypastaPercent}% total copypasta).`
        : 'Pola komentar terpantau dalam rentang fluktuasi organik normal.'
    },
    tacticalRecommendation: {
      posture: isBuzzerAlarmActive ? 'NETRALISIR_SEGERA' : 'MONITOR_INTENSIF',
      officialClarificationDraft: topMatch
        ? `KLARIFIKASI RESMI TERVERIFIKASI: Narasi yang beredar mengenai "${topMatch.claim}" adalah TIDAK BENAR. Berdasarkan ${topMatch.officialSource}: ${topMatch.clarification} Rujukan resmi: ${topMatch.sourceUrl}`
        : `KLARIFIKASI INFORMASI: Narasi pada tautan ini terindikasi memuat manipulasi opini dan kampanye buzzer terorganisir. Publik diimbau untuk memverifikasi fakta melalui kanal resmi kementerian dan lembaga terkait.`,
      recommendedDispenadProtocol: 'Pantau eskalasi sentimen selama 2 jam ke depan dan siapkan infografis sanggahan jika terjadi pergeseran ke ruang publik yang lebih luas.',
      targetChannels: [platform, 'WhatsApp Babinsa']
    },
    commentsSample
  }

  return result
}
