/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — FORENSIC AUDIT PRESET SCENARIOS
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Basis data preset kasus nyata untuk simulasi forensik postingan medsos
 * (Instagram, TikTok, Twitter/X, Facebook).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { SocialPostForensicResult } from './forensic-types.ts'
import { generateCounterNarratives } from './counter-narrative-generator.ts'

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
      isBuzzerAlarmActive: true,
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
          sampleHandles: ['@user892314', '@indo_merdeka99', '@satria_cyber01', '@rakyat_bersatu77', '@garuda_hitam'],
          memberIds: ['c1', 'c3']
        },
        {
          templateText: 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut tuntas!',
          occurrences: 122,
          percentageOfTotal: 9,
          sampleHandles: ['@bot_alutsista', '@prajurit_kecewa', '@reformasi_jilid2', '@mata_elang_ri', '@suara_bawah'],
          memberIds: ['c4']
        },
        {
          templateText: 'Prajurit jadi korban kebiadaban elite politik korup!',
          occurrences: 98,
          percentageOfTotal: 7,
          sampleHandles: ['@pejuang_keadilan_id', '@anti_oligarki88', '@merah_putih_kritis', '@silent_majority9', '@vocal_voice'],
          memberIds: []
        },
        {
          templateText: 'Siap-siap akun ini di-banned, admin hati-hati tetap kawal!',
          occurrences: 74,
          percentageOfTotal: 5,
          sampleHandles: ['@pejuang_subuh_ri', '@tni_bersama_rakyat', '@komando_moral', '@bela_negara_sejati', '@front_pembela_kebenaran'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'NETRALISIR_SEGERA',
      officialClarificationDraft: 'KLARIFIKASI RESMI DISPENAD: Narasi yang menyebutkan pengadaan tank rongsokan 24 Triliun adalah HOAKS TOTAL. Video yang ditampilkan merupakan dokumentasi latihan gabungan alutsista tahun 2012. Seluruh alutsista TNI AD diadakan melalui mekanisme audit ketat BPK dan Kementerian Pertahanan sesuai standar kelaikan militer internasional.',
      recommendedDispenadProtocol: '1. Rilis video kontra-narasi 60 detik di Instagram @tni_angkatan_darat dan @puspentni dengan watermark "FAKTA TERVERIFIKASI". 2. Kirim laporan terkoordinasi (Coordinated Inauthentic Behavior) ke Meta Indonesia untuk takedown akun penyebar klaster buzzer.',
      targetChannels: ['Instagram Reels', 'TikTok', 'WhatsApp Group Babinsa'],
      counterNarratives: generateCounterNarratives(
        'Pengadaan tank rongsokan fiktif 24 triliun TNI AD',
        {
          claim: 'Pengadaan tank rongsokan fiktif 24 Triliun',
          clarification: 'Video merupakan dokumentasi latihan tempur gabungan tahun 2012 yang dipelintir. Tidak ada pengadaan fiktif 24T; seluruh belanja alutsista diaudit BPK.',
          officialSource: 'Dispenad & Kemhan RI',
          sourceUrl: 'https://tniad.mil.id'
        },
        'INSTAGRAM'
      )
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
          sampleHandles: ['@anisafitri99', '@putra_jaksel', '@tiara_lestari', '@dian_pertiwi', '@bintang_timur'],
          memberIds: ['ct1']
        },
        {
          templateText: 'BMKG udah rilis resmi ya teman-teman, jangan anggap remeh siaga sekarang!',
          occurrences: 174,
          percentageOfTotal: 10,
          sampleHandles: ['@akun_panik1', '@info_siaga_id', '@berita_hot_indo', '@warga_depok', '@netizen_cemas'],
          memberIds: []
        },
        {
          templateText: 'Share ke grup WA keluarga cepetan sebelum mati lampu dan sinyal hilang!',
          occurrences: 156,
          percentageOfTotal: 9,
          sampleHandles: ['@wa_blaster', '@keluarga_cemara', '@update_gempa_24h', '@kabar_terdepan', '@viral_hari_ini'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'COUNTER_NARRATIVE_RESMI',
      officialClarificationDraft: 'KLARIFIKASI RESMI BMKG × PUSSIBERAD: Pesan yang menyatakan gempa megathrust akan terjadi malam ini pukul 23.00 WIB adalah HOAKS BERBAHAYA. Hingga saat ini tidak ada satupun teknologi di dunia yang dapat memprediksi waktu pasti (hari, jam, menit) terjadinya gempa bumi. Masyarakat diimbau tetap tenang dan hanya memantau kanal resmi @infobmkg.',
      recommendedDispenadProtocol: '1. Perintahkan jajaran Babinsa Kodam Jaya dan Kodam III/Siliwangi turun menenangkan warga di wilayah pesisir. 2. Sebarkan banner klarifikasi resmi di seluruh kanal radio daerah dan videotron kota.',
      targetChannels: ['TikTok FYP', 'Instagram Stories', 'Jaringan Babinsa'],
      counterNarratives: generateCounterNarratives(
        'Prediksi gempa megathrust jam 23.00 WIB BMKG',
        {
          claim: 'Gempa megathrust jam 23.00 WIB BMKG',
          clarification: 'BMKG tidak pernah merilis prediksi waktu spesifik gempa bumi. Sains seismologi dunia belum mampu memprediksi jam dan hari terjadinya gempa secara presisi.',
          officialSource: 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
          sourceUrl: 'https://bmkg.go.id'
        },
        'TIKTOK'
      )
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
        matchedTemplatePattern: 'Beneran ya Allah, merinding banget'
      },
      {
        id: 'ct2',
        authorHandle: '@edukasi_gempa',
        authorName: 'Edukasi Bencana',
        avatarLetter: 'E',
        avatarColor: '#10B981',
        timestamp: '1 menit lalu',
        content: 'HOAKS ini guys! BMKG udah berkali-kali bilang gempa ga bisa diprediksi jamnya. Tolong jangan bikin panik!',
        likes: 340,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 3. TWITTER / X — Disinformasi Pembakaran Kampung di Intan Jaya
  {
    id: 'preset-x-separatisme-papua',
    url: 'https://x.com/papua_merdeka_free/status/1812938102931',
    platform: 'TWITTER',
    analyzedAt: '2026-10-25 09:35 WIB',
    author: {
      handle: '@papua_merdeka_free',
      displayName: 'Voice of West Papua',
      isVerified: false,
      followersCount: 12400,
      accountAgeDays: 620,
      avatarLetter: 'V',
      avatarColor: '#10B981'
    },
    post: {
      publishedAt: '2026-10-24 16:30 WIB',
      caption: 'URGENT: Indonesian military forces allegedly burned down civilian houses in Intan Jaya, displacing hundreds of indigenous families into the forest. Stand with West Papua! Stop the genocide! #FreeWestPapua #PapuaMerdeka',
      likesCount: 5400,
      commentsCount: 890,
      sharesCount: 4200,
      viewsCount: 125000,
      mediaType: 'THREAD'
    },
    cognitiveVerdict: {
      status: 'DISINFORMASI_TERKOORDINASI',
      confidenceScore: 92,
      classificationBadge: 'NARASI SEPARATISME & RECYCLED MEDIA',
      summaryReason: 'Foto kebakaran yang diunggah terbukti merupakan arsip kebakaran di Sumba Timur NTT tahun 2021 yang digunakan ulang untuk memicu kemarahan internasional terhadap aparat TNI.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 18,
      neutralPercent: 12,
      provocativePercent: 70,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 31,
      burstVelocityPerMinute: 45,
      botAccountRatioPercent: 52,
      coordinationIndex: 82,
      swarmAnomalyDescription: 'Terdeteksi koordinasi botnet luar negeri (bot farm) yang meramaikan balasan dalam bahasa Inggris dengan kalimat identik "Stop human rights violations in West Papua".',
      detectedClusters: [
        {
          templateText: 'Stop human rights violations in West Papua! The world is watching your crimes!',
          occurrences: 124,
          percentageOfTotal: 14,
          sampleHandles: ['@papua_free_global', '@aus_activist_7', '@pacific_rights', '@humanity_now_nz', '@solidarity_melanesia'],
          memberIds: ['cx1']
        },
        {
          templateText: 'TNI jangan dzalim pada rakyat kecil, ingat sumpah prajurit pertanggungjawaban di akhirat!',
          occurrences: 92,
          percentageOfTotal: 10,
          sampleHandles: ['@suara_nurani_ri', '@umat_bangkit99', '@keadilan_sosial_id', '@pena_rakyat', '@nurani_bangsa'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'FACT CHECK KOGNITIF: Klaim pembakaran perkampungan di Intan Jaya adalah DISINFORMASI DENGAN GAMBAR DAUR ULANG (RECYCLED MEDIA). Foto yang disebarkan adalah kebakaran akibat korsleting di Kabupaten Sumba Timur pada 14 Oktober 2021. Situasi di Intan Jaya terpantau aman dan kondusif dalam pengamanan Kodim bersama warga.',
      recommendedDispenadProtocol: '1. Koordinasikan pengiriman laporan takedown cepat (Violent Incitement) ke Global Trust & Safety X. 2. Terbitkan rilis pers dwibahasa (ID/EN) oleh Kapuspen TNI untuk konsumsi atase pertahanan dan media internasional.',
      targetChannels: ['X / Twitter', 'Portal Berita Mabes TNI', 'Atase Pertahanan'],
      counterNarratives: generateCounterNarratives(
        'Tuduhan pembakaran perkampungan warga sipil oleh TNI di Intan Jaya Papua',
        {
          claim: 'TNI membakar perkampungan warga di Intan Jaya',
          clarification: 'Foto adalah dokumentasi kebakaran korsleting di Sumba Timur NTT tahun 2021. Wilayah Intan Jaya kondusif dalam pengamanan Babinsa dan Satgas Pamtas.',
          officialSource: 'Puspen TNI & Pendam XVII/Cenderawasih',
          sourceUrl: 'https://tni.mil.id'
        },
        'TWITTER'
      )
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
    url: 'https://www.facebook.com/groups/bansosindonesia/permalink/9182390123/',
    platform: 'FACEBOOK',
    analyzedAt: '2026-10-25 09:40 WIB',
    author: {
      handle: 'Info Bantuan Sosial Cepat',
      displayName: 'Info Bansos Cepat',
      isVerified: false,
      followersCount: 89000,
      accountAgeDays: 120,
      avatarLetter: 'I',
      avatarColor: '#3B82F6'
    },
    post: {
      publishedAt: '2026-10-24 14:00 WIB',
      caption: 'BANTUAN LANGSUNG TUNAI 5 JUTA RUPIAH BULAN INI! Pendaftaran khusus gelombang akhir untuk lansia, pekerja harian, dan ibu rumah tangga. Syarat cukup KTP dan KK. Klik link pendaftaran resmi di bawah ini sebelum kuota habis: https://bansos-kemensos-cair5jt.top/daftar. Sebarkan ke grup tetangga!',
      likesCount: 15400,
      commentsCount: 6200,
      sharesCount: 18200,
      viewsCount: 340000,
      mediaType: 'IMAGE'
    },
    cognitiveVerdict: {
      status: 'HOAKS_BERBAHAYA',
      confidenceScore: 99,
      classificationBadge: 'PHISHING DATA PRIBADI BERSKALA MASSIF',
      summaryReason: 'Pencatutan identitas Kemensos RI menggunakan situs phishing tiruan (.top) untuk mencuri data kependudukan (NIK, nomor KK, foto selfie KTP).',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 24,
      neutralPercent: 8,
      provocativePercent: 68,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 42,
      burstVelocityPerMinute: 95,
      botAccountRatioPercent: 65,
      coordinationIndex: 91,
      swarmAnomalyDescription: 'Anomali botnet ekstrem dengan 95 komentar/menit. Ditemukan puluhan akun kloning yang menulis testimoni palsu "Alhamdulillah cair 5 juta" untuk meyakinkan korban.',
      detectedClusters: [
        {
          templateText: 'Alhamdulillah barusan dicek saldo rekening nambah 5 juta, terima kasih Pak Presiden!',
          occurrences: 480,
          percentageOfTotal: 18,
          sampleHandles: ['Budi Santoso', 'Rina Wulandari', 'Agus Supriadi', 'Slamet Riyadi', 'Dewi Lestari'],
          memberIds: ['cfb1']
        },
        {
          templateText: 'Linknya beneran bisa guys, buruan daftar jangan sampai kehabisan kuota!',
          occurrences: 390,
          percentageOfTotal: 15,
          sampleHandles: ['Andi Wijaya', 'Sri Mulyani Fans', 'Yanto Berkah', 'Keluarga Bahagia', 'Sukses Bersama'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'PERINGATAN RESMI KEMENSOS & PUSSIBERAD: Tautan "bansos-kemensos-cair5jt.top" adalah SITUS PHISHING PENIPUAN PENCURIAN DATA PRIBADI. Kemensos tidak pernah menyalurkan bantuan Rp 5 juta dengan pendaftaran melalui tautan domain tidak resmi (.top/.xyz). Portal resmi bansos hanya melalui cekbansos.kemensos.go.id.',
      recommendedDispenadProtocol: '1. Mintakan pemblokiran domain darurat ke Ditjen Aptika Kominfo (TrustPositif). 2. Laporkan fanpage penipuan ke Meta Cyber Crime Unit untuk suspensi permanen.',
      targetChannels: ['Facebook Groups', 'Portal Resmi Kemensos', 'WhatsApp Warga'],
      counterNarratives: generateCounterNarratives(
        'Pencairan dana bansos tunai 5 juta pendaftaran via link phising',
        {
          claim: 'Pencairan bansos tunai 5 juta rupiah via link domain asing',
          clarification: 'Kemensos tidak pernah menyalurkan bansos melalui formulir link asing (.top/.xyz). Pengecekan bansos hanya melalui cekbansos.kemensos.go.id.',
          officialSource: 'Kementerian Sosial RI & Pussiberad',
          sourceUrl: 'https://cekbansos.kemensos.go.id'
        },
        'FACEBOOK'
      )
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

