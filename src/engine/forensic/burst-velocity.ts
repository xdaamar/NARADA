// ─── KALKULATOR BURST VELOCITY & INDEKS KOORDINASI BOTNET SWARM ───
// SPRINT 7C: Deteksi Anomali Temporal & Frekuensi Injeksi Komentar
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

export interface TimeCommentItem {
  id: string
  timestamp: string
  authorHandle: string
  isSuspiciousBot?: boolean
  isCopypastaTemplate?: boolean
}

export interface BurstVelocityResult {
  burstVelocityPerMinute: number
  botAccountRatioPercent: number
  coordinationIndex: number
  swarmAnomalyDescription: string
  isBurstAnomalyActive: boolean
}

/**
 * Mengonversi representasi string timestamp umum media sosial menjadi perkiraan menit dari waktu analisis
 */
export function parseRelativeMinutes(timeStr: string): number {
  if (!timeStr) return 60
  const lower = timeStr.toLowerCase().trim()

  // Format "x detik lalu" / "x sec ago"
  const secMatch = lower.match(/(\d+)\s*(detik|sec|s)\s*lalu/i)
  if (secMatch) return Math.max(0.1, parseInt(secMatch[1], 10) / 60)

  // Format "x menit lalu" / "x min ago"
  const minMatch = lower.match(/(\d+)\s*(menit|min|m)\s*lalu/i)
  if (minMatch) return parseInt(minMatch[1], 10)

  // Format "x jam lalu" / "x hour ago"
  const hourMatch = lower.match(/(\d+)\s*(jam|hour|h)\s*lalu/i)
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60

  // Format tanggal eksplisit / default fallback
  return 30
}

/**
 * Menghitung Burst Velocity dan Indeks Koordinasi (Coordination Index)
 * @param comments - Daftar komentar yang diuji
 * @param copypastaPercent - Persentase komentar dalam klaster template
 */
export function calculateBurstVelocity(
  comments: TimeCommentItem[],
  copypastaPercent: number
): BurstVelocityResult {
  if (!comments || comments.length === 0) {
    return {
      burstVelocityPerMinute: 0,
      botAccountRatioPercent: 0,
      coordinationIndex: 0,
      swarmAnomalyDescription: 'Tidak ada data komentar yang tersedia.',
      isBurstAnomalyActive: false
    }
  }

  // 1. Hitung rasio akun bot terduga (misal nama acak, tanpa avatar, umur muda)
  const botCount = comments.filter(c => {
    if (c.isSuspiciousBot) return true
    const handle = c.authorHandle.toLowerCase()
    // Pola nama akun botnet umum: ada 4+ digit angka di akhir
    return /\d{4,}/.test(handle) || handle.includes('bot') || handle.includes('user')
  }).length

  const botAccountRatioPercent = Math.min(100, Math.round((botCount / comments.length) * 100))

  // 2. Analisis distribusi waktu untuk menghitung lonjakan komentar per menit
  const relativeMinutes = comments.map(c => parseRelativeMinutes(c.timestamp))
  const minMinute = Math.min(...relativeMinutes)
  const maxMinute = Math.max(...relativeMinutes)
  const timeSpanMinutes = Math.max(1, maxMinute - minMinute)

  // Rata-rata komentar per menit dalam rentang waktu tersebut
  let rawBurstVelocity = comments.length / timeSpanMinutes

  // Jika terdeteksi copypasta masif dalam waktu singkat, kalibrasikan burst velocity
  if (copypastaPercent >= 20 && timeSpanMinutes <= 15) {
    rawBurstVelocity = Math.max(rawBurstVelocity, 45 + Math.round(copypastaPercent * 0.8))
  } else if (copypastaPercent >= 15) {
    rawBurstVelocity = Math.max(rawBurstVelocity, 30)
  }

  const burstVelocityPerMinute = Math.min(200, Math.round(rawBurstVelocity))
  const isBurstAnomalyActive = burstVelocityPerMinute >= 40

  // 3. Formula Indeks Koordinasi (0 - 100):
  // 45% bobot Copypasta + 35% bobot Kecepatan Lonjakan + 20% bobot Rasio Akun Bot
  const burstNormalized = Math.min(100, (burstVelocityPerMinute / 60) * 100)
  const coordinationIndex = Math.min(
    100,
    Math.round(0.45 * copypastaPercent + 0.35 * burstNormalized + 0.20 * botAccountRatioPercent)
  )

  // 4. Deskripsi Anomali Berdasarkan Skor Taktis
  let swarmAnomalyDescription = 'Pola postingan dan komentar berada dalam rentang aktivitas organik normal.'
  if (coordinationIndex >= 75 || copypastaPercent >= 30) {
    swarmAnomalyDescription = `Terdeteksi lonjakan ${burstVelocityPerMinute} komentar/menit dengan anomali ${copypastaPercent}% kalimat template copypasta identik dan ${botAccountRatioPercent}% akun tanpa identitas terverifikasi (Indeks Koordinasi: ${coordinationIndex}/100 - SIAGA MERAH).`
  } else if (coordinationIndex >= 40 || isBurstAnomalyActive) {
    swarmAnomalyDescription = `Terpantau aktivitas akselerasi komentar ${burstVelocityPerMinute} komentar/menit dengan kecurigaan astroturfing moderat (${copypastaPercent}% copypasta, Indeks Koordinasi: ${coordinationIndex}/100).`
  }

  return {
    burstVelocityPerMinute,
    botAccountRatioPercent,
    coordinationIndex,
    swarmAnomalyDescription,
    isBurstAnomalyActive
  }
}
