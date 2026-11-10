/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — PRELOADED HIGH-FIDELITY SOCIAL TEST SCENARIOS
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Dataset skenario pengujian realistis untuk simulasi dan audit forensik
 * postingan media sosial (YouTube, TikTok, Instagram, Threads).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { PreloadedTestScenario } from '../types/social-analysis-types.ts'

export const PRELOADED_TEST_SCENARIOS: PreloadedTestScenario[] = [
  {
    id: 'demo-yt-01',
    title: '[YouTube] Klarifikasi Pengadaan Alutsista Siber — Lonjakan Copypasta',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=kYJ892XMN01',
    description: 'Postingan video resmi dengan serangan botnet pembelaan terkoordinasi (3 kluster template identik).',
    mockResult: {
      post: {
        platform: 'youtube',
        url: 'https://www.youtube.com/watch?v=kYJ892XMN01',
        canonicalUrl: 'https://www.youtube.com/watch?v=kYJ892XMN01',
        postId: 'kYJ892XMN01',
        title: 'Konferensi Pers: Penjelasan Resmi Terkait Dokumen Sistem Pertahanan Siber Nasional',
        caption: 'Pusat Informasi Siber memberikan keterangan komprehensif mengenai langkah penguatan firewall militer serta menjawab disinformasi publik.',
        authorName: 'Pusat Penerangan Pertahanan',
        authorHandle: '@puspen_pertahanan',
        authorFollowersCount: 845000,
        publishedAt: '2026-11-08T09:00:00Z',
        viewCount: 142300,
        likeCount: 8940,
        commentCount: 420,
        commentsDisabled: false,
        acquisitionMethod: 'OFFICIAL_API',
        dataSourceNotice: 'Data diuji menggunakan skenario validasi presisi tinggi PUSSIBERAD.'
      },
      totalCommentsAnalyzed: 45,
      topComments: [
        {
          id: 'c-top-1',
          authorUsername: '@dr_haryo_siber',
          authorDisplayName: 'Dr. Haryo Wicaksono (Pakar Kriptografi)',
          text: 'Pemberian klarifikasi secara terbuka ini sangat penting agar masyarakat tidak terjebak framing disinformasi. Protokol enkripsi yang dijelaskan sudah memenuhi standar militer.',
          likeCount: 1420,
          publishedAt: '2026-11-08T09:12:00Z'
        },
        {
          id: 'c-top-2',
          authorUsername: '@wargabijak_id',
          authorDisplayName: 'Warga Kritis Indonesia',
          text: 'Terima kasih atas transparansinya. Yang perlu diawasi ke depan adalah audit berkala dari lembaga independen agar anggaran benar-benar akuntabel.',
          likeCount: 890,
          publishedAt: '2026-11-08T09:18:00Z'
        },
        {
          id: 'c-top-3',
          authorUsername: '@alutsista_observer',
          authorDisplayName: 'Indo Defense Observer',
          text: 'Poin nomor 3 sangat krusial: kedaulatan server data intelijen harus 100% berada di teritorial domestik tanpa celah cloud asing.',
          likeCount: 654,
          publishedAt: '2026-11-08T09:25:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
          commentCount: 22,
          percentageOfTotal: 49,
          accountsInvolved: [
            '@budi_satria99', '@user9812401', '@garuda_perkasa88', '@merahputih_nkri',
            '@rizky_pratama01', '@rahmat_hidayat77', '@dimas_anjasmara', '@agus_wibowo92'
          ],
          sampleComments: [
            {
              id: 'c-bot-1',
              authorUsername: '@budi_satria99',
              text: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
              likeCount: 2,
              publishedAt: '2026-11-08T09:04:12Z'
            },
            {
              id: 'c-bot-2',
              authorUsername: '@user9812401',
              text: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
              likeCount: 1,
              publishedAt: '2026-11-08T09:04:28Z'
            }
          ],
          similarityScore: 0.98,
          temporalSpanSeconds: 154
        },
        {
          clusterId: 'cluster-2',
          templateText: 'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!',
          commentCount: 11,
          percentageOfTotal: 24,
          accountsInvolved: ['@user440192', '@user778102', '@pejuang_subuh88', '@anton_jkt'],
          sampleComments: [
            {
              id: 'c-bot-3',
              authorUsername: '@user440192',
              text: 'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!',
              likeCount: 0,
              publishedAt: '2026-11-08T09:06:05Z'
            }
          ],
          similarityScore: 0.91,
          temporalSpanSeconds: 98
        }
      ],
      buzzerPattern: {
        coordinationScore: 88,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi indikasi injeksi komentar terkoordinasi berskala TINGGI (88%). Sebanyak 33 dari 45 komentar (73%) memuat teks templat identik. Narasi difokuskan pada penolakan provokator dan pujian seragam tanpa substansi teknis.',
        dominantKeywords: ['provokator', 'dukung', 'bangsa', 'mantap', 'langkah', 'pertahanan'],
        burstVelocityCommentPerMinute: 17.5,
        temporalWindowSeconds: 240,
        sampleAccounts: ['@budi_satria99', '@user9812401', '@garuda_perkasa88', '@user440192'],
        sampleQuotes: [
          'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
          'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!'
        ],
        evidenceRationale: 'Sebanyak 22 komentar identik diposting serentak dalam rentang waktu 154 detik oleh akun-akun berformat nama acak.'
      },
      analyzedAt: '2026-11-08T09:30:00Z'
    }
  },
  {
    id: 'demo-tt-01',
    title: '[TikTok] Kampanye Astroturfing Tagar Viral Kebijakan Anggaran',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
    description: 'Postingan TikTok video pendek dengan 18 komentar template copypasta cepat.',
    mockResult: {
      post: {
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
        canonicalUrl: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
        postId: '7391829482019283712',
        title: 'Bahas Tuntas Kebocoran Data Sektor Finansial yang Lagi Rame!',
        caption: 'Bahas Tuntas Kebocoran Data Sektor Finansial yang Lagi Rame! Jangan sampai saldo rekening kalian jadi korban kebocoran sistem.',
        authorName: 'Suara Kritis ID',
        authorHandle: '@suarakritis_id',
        authorFollowersCount: 312000,
        publishedAt: '2026-11-08T11:20:00Z',
        viewCount: 89400,
        likeCount: 6510,
        commentCount: 210,
        commentsDisabled: false,
        acquisitionMethod: 'OEMBED_PUBLIC',
        dataSourceNotice: 'Metadata divalidasi via oEmbed resmi; komentar diolah via Ingest Teks.'
      },
      totalCommentsAnalyzed: 30,
      topComments: [
        {
          id: 'tt-top-1',
          authorUsername: '@fintech_security',
          authorDisplayName: 'Fintech Sec ID',
          text: 'Harus ganti password m-banking berkala dan jangan klik link APK undangan pernikahan di WA!',
          likeCount: 940,
          publishedAt: '2026-11-08T11:35:00Z'
        },
        {
          id: 'tt-top-2',
          authorUsername: '@sarah_wijaya',
          authorDisplayName: 'Sarah W.',
          text: 'Bank harus tanggung jawab kalau ada kebocoran dari sistem internal mereka, bukan nasabah yang disalahin.',
          likeCount: 512,
          publishedAt: '2026-11-08T11:42:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!',
          commentCount: 14,
          percentageOfTotal: 47,
          accountsInvolved: ['@user81920', '@user99102', '@user10293', '@user77123', '@user66401'],
          sampleComments: [
            {
              id: 'tt-c-1',
              authorUsername: '@user81920',
              text: 'Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!',
              likeCount: 0,
              publishedAt: '2026-11-08T11:22:10Z'
            }
          ],
          similarityScore: 0.95,
          temporalSpanSeconds: 84
        }
      ],
      buzzerPattern: {
        coordinationScore: 78,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi upaya terorganisir membela institusi perbankan dengan menyalahkan pengguna (victim-blaming) melalui templat komentar yang diposting 14 kali dalam rentang 84 detik.',
        dominantKeywords: ['kelalaian', 'pengguna', 'perbankan', 'keamanannya', 'murni'],
        burstVelocityCommentPerMinute: 12.0,
        temporalWindowSeconds: 150,
        sampleAccounts: ['@user81920', '@user99102', '@user10293'],
        sampleQuotes: ['Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!'],
        evidenceRationale: 'Sebanyak 14 komentar copypasta diposting serentak dalam 84 detik pasca video rilis.'
      },
      analyzedAt: '2026-11-08T12:00:00Z'
    }
  },
  {
    id: 'demo-ig-01',
    title: '[Instagram] Isu Sentimen Hoaks Kebijakan Medis Baru',
    platform: 'instagram',
    url: 'https://www.instagram.com/p/DB102938475/',
    description: 'Postingan foto carousel edukasi kesehatan yang dibanjiri komentar spam terkoordinasi.',
    mockResult: {
      post: {
        platform: 'instagram',
        url: 'https://www.instagram.com/p/DB102938475/',
        canonicalUrl: 'https://www.instagram.com/p/DB102938475/',
        postId: 'DB102938475',
        title: 'Fakta Ilmiah Mengenai Uji Klinis Terbuka Vaksinasi Generasi Baru',
        caption: 'Simak 5 poin penting hasil penelaahan tim dokter spesialis terkait keamanan formula pencegahan penyakit menular terbaru.',
        authorName: 'Edukasi Kesehatan Publik',
        authorHandle: '@edukasi_kesehatan',
        authorFollowersCount: 520000,
        publishedAt: '2026-11-08T14:00:00Z',
        viewCount: 45000,
        likeCount: 3890,
        commentCount: 180,
        commentsDisabled: false,
        acquisitionMethod: 'DIRECT_INGEST',
        dataSourceNotice: 'Diproses via konsol Ingest Komentar Taktis NARADA.'
      },
      totalCommentsAnalyzed: 25,
      topComments: [
        {
          id: 'ig-top-1',
          authorUsername: '@dr_bambang_sp',
          authorDisplayName: 'dr. Bambang Sp.PD',
          text: 'Data jurnal Lancet terlampir sangat jelas menunjukkan efikasi di atas 92%. Jangan termakan mitos tanpa dasar riset.',
          likeCount: 780,
          publishedAt: '2026-11-08T14:15:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!',
          commentCount: 10,
          percentageOfTotal: 40,
          accountsInvolved: ['@anti_konspirasi1', '@merdeka_sehat', '@pejuang_rakyat99', '@warga_waspada'],
          sampleComments: [
            {
              id: 'ig-c-1',
              authorUsername: '@anti_konspirasi1',
              text: 'Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!',
              likeCount: 1,
              publishedAt: '2026-11-08T14:05:00Z'
            }
          ],
          similarityScore: 0.94,
          temporalSpanSeconds: 110
        }
      ],
      buzzerPattern: {
        coordinationScore: 72,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi kampanye penyebaran teori konspirasi anti-sains terkoordinasi (40% komentar berformat templat identik).',
        dominantKeywords: ['konspirasi', 'kelinci', 'percobaan', 'berbahaya', 'global'],
        burstVelocityCommentPerMinute: 8.5,
        temporalWindowSeconds: 180,
        sampleAccounts: ['@anti_konspirasi1', '@merdeka_sehat', '@pejuang_rakyat99'],
        sampleQuotes: ['Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!'],
        evidenceRationale: '10 komentar identik memuat kata kunci konspirasi elit global diposting dalam tempo 110 detik.'
      },
      analyzedAt: '2026-11-08T14:30:00Z'
    }
  },
  {
    id: 'demo-th-01',
    title: '[Threads] Diskusi Publik Kebijakan Perlindungan Data Pribadi',
    platform: 'threads',
    url: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
    description: 'Postingan Threads dengan perdebatan organik (koordinasi rendah/organik).',
    mockResult: {
      post: {
        platform: 'threads',
        url: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
        canonicalUrl: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
        postId: 'C-r89281726',
        title: 'UU PDP sudah berlaku penuh: Seberapa siap instansi publik dan swasta?',
        caption: 'Banyak lembaga masih belum memiliki Data Protection Officer (DPO). Bagaimana menurut teman-teman di ranah industri teknologi?',
        authorName: 'Klinik Hukum Digital',
        authorHandle: '@hukum_digital',
        authorFollowersCount: 45000,
        publishedAt: '2026-11-08T16:00:00Z',
        viewCount: 12000,
        likeCount: 420,
        commentCount: 35,
        commentsDisabled: false,
        acquisitionMethod: 'OEMBED_PUBLIC',
        dataSourceNotice: 'Metadata resmi Threads; komentar diolah via Ingest Analis.'
      },
      totalCommentsAnalyzed: 20,
      topComments: [
        {
          id: 'th-top-1',
          authorUsername: '@ciso_indo',
          authorDisplayName: 'CISO Indonesia Club',
          text: 'Tantangan terbesar ada di sertifikasi SDM DPO yang masih sangat minim di daerah.',
          likeCount: 145,
          publishedAt: '2026-11-08T16:12:00Z'
        },
        {
          id: 'th-top-2',
          authorUsername: '@advokat_siber',
          authorDisplayName: 'Gerry SH LLM',
          text: 'Sanksi denda administratifnya cukup berat, bisa sampai miliaran rupiah jika terbukti lalai.',
          likeCount: 98,
          publishedAt: '2026-11-08T16:25:00Z'
        }
      ],
      copypastaClusters: [],
      buzzerPattern: {
        coordinationScore: 12,
        coordinationLevel: 'RENDAH',
        narrativeSummary: 'Pola koordinasi tergolong RENDAH / ORGANIK (12%). Variasi leksikal tinggi, tidak terdeteksi lonjakan templat duplikasi signifikan dalam rentang waktu observasi.',
        dominantKeywords: ['dpo', 'sanksi', 'sertifikasi', 'tantangan', 'sdm'],
        burstVelocityCommentPerMinute: 1.2,
        temporalWindowSeconds: 980,
        sampleAccounts: [],
        sampleQuotes: [],
        evidenceRationale: 'Diskusi berlangsung secara natural tanpa templat copypasta atau anomali lonjakan waktu.'
      },
      analyzedAt: '2026-11-08T17:00:00Z'
    }
  }
]

