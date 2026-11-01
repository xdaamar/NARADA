import type { EventCluster, IssueActivityAssessment, IssueActivityState, IssueActivitySnapshot } from './radar-types.ts'

/**
 * Menilai status aktivitas dan momentum pemberitaan pada sebuah EventCluster (Sprint 6 & 6.1 WP4)
 * Kontrak Etis:
 * 1. Mengharuskan sampel minimum (>= 3 artikel dan >= 2 domain penerbit) untuk menyatakan RISING / SUSTAINED.
 * 2. isSocialViralityMeasured SELALU FALSE (Zero Fake Social Virality).
 * 3. Menjelaskan secara transparan alasan status pada assessmentReason.
 * 4. Zero-baseline rule: Tidak pernah membagi dengan artificial 1 saat baseline 30-60 menit sebelumnya 0.
 * 5. Time basis: Membedakan PUBLISHED_AT vs OBSERVED_AT fallback jika tanggal terbit tidak valid.
 */
export function assessIssueActivity(cluster: EventCluster, now = Date.now()): IssueActivityAssessment {
  const members = cluster.memberItems || []
  const sampleSize = members.length
  const distinctPublishers = cluster.sourceCoverage?.distinctPublisherDomainCount || 1

  const firstObservedAt = cluster.firstObservedAt || now
  const latestObservedAt = cluster.latestObservedAt || now
  const ageMinutes = Math.max(0, Math.floor((now - firstObservedAt) / (60 * 1000)))
  const minutesSinceLatest = Math.max(0, Math.floor((now - latestObservedAt) / (60 * 1000)))

  // Evaluasi timeBasis: jika ada member yang tanggal publikasinya tidak valid / tidak ada, gunakan observedAt dan tandai OBSERVED_AT
  let hasFallbackObserved = false
  const getMemberTimestamp = (m: any): number => {
    if (m.publishedAt && typeof m.publishedAt === 'number' && !isNaN(m.publishedAt) && m.publishedAt > 0) {
      return m.publishedAt
    }
    hasFallbackObserved = true
    return m.firstObservedAt || m.observedAt || firstObservedAt
  }

  const w3h = now - 3 * 3600 * 1000
  const w12h = now - 12 * 3600 * 1000
  const w24h = now - 24 * 3600 * 1000
  const windowCounts = {
    last3hCount: members.filter(m => getMemberTimestamp(m) >= w3h).length,
    last12hCount: members.filter(m => getMemberTimestamp(m) >= w12h).length,
    last24hCount: members.filter(m => getMemberTimestamp(m) >= w24h).length
  }

  const timeBasis: 'PUBLISHED_AT' | 'OBSERVED_AT' = hasFallbackObserved ? 'OBSERVED_AT' : 'PUBLISHED_AT'

  // 1. Evaluasi Ambang Batas Minimum Sampel (WP4: sampleSize >= 3 & distinctPublishers >= 2)
  if (sampleSize < 3 || distinctPublishers < 2) {
    if (ageMinutes <= 60) {
      const reason = `Isu baru muncul (${ageMinutes} menit lalu, ${sampleSize} artikel dari ${distinctPublishers} domain pers), sampel masih berkembang.`
      return {
        state: 'NEW',
        sampleSize,
        distinctPublishers,
        growthRate: null,
        firstObservedAt,
        latestObservedAt,
        isSocialViralityMeasured: false,
        timeBasis,
        assessmentReason: reason,
        stateReason: reason,
        windowCounts
      }
    }

    const reason = `Sampel belum mencukupi ambang batas minimum (memerlukan >= 3 artikel & >= 2 domain penerbit; saat ini: ${sampleSize} artikel, ${distinctPublishers} domain).`
    return {
      state: 'INSUFFICIENT_DATA',
      sampleSize,
      distinctPublishers,
      growthRate: null,
      firstObservedAt,
      latestObservedAt,
      isSocialViralityMeasured: false,
      timeBasis,
      assessmentReason: reason,
      stateReason: reason,
      windowCounts
    }
  }

  // 2. Evaluasi Aktivitas Berdasarkan Jendela Waktu (Window Momentum)
  // Window T1: 0 - 30 menit terakhir
  // Window T2: 30 - 60 menit sebelumnya
  const window30m = now - 30 * 60 * 1000
  const window60m = now - 60 * 60 * 1000

  const countRecent30m = members.filter(m => getMemberTimestamp(m) >= window30m).length
  const countPrior30m = members.filter(m => {
    const t = getMemberTimestamp(m)
    return t >= window60m && t < window30m
  }).length

  // Zero-Baseline Rule (WP4 / S61-22):
  // RISING wajib memiliki baseline pembanding aktual (countPrior30m > 0) dan pertumbuhan riil.
  // Jika countPrior30m === 0, tidak boleh membagi dengan 1.0!
  let growthRate: number | null = null
  let state: IssueActivityState = 'SUSTAINED'
  let assessmentReason = ''

  if (countPrior30m === 0) {
    growthRate = null
    if (ageMinutes <= 60) {
      state = 'NEW'
      assessmentReason = `Isu baru berkembang (${ageMinutes} menit lalu, ${countRecent30m} artikel terbaru dalam 30 menit tanpa baseline pembanding sebelumnya).`
    } else if (countRecent30m === 0 && minutesSinceLatest > 180) {
      state = 'COOLING'
      assessmentReason = `Aktivitas pemberitaan mereda. Tidak ada artikel baru dalam ${Math.floor(minutesSinceLatest / 60)} jam terakhir (${sampleSize} artikel total).`
    } else {
      state = 'INSUFFICIENT_DATA'
      assessmentReason = `Tidak terdapat baseline aktivitas pembanding pada jendela 30-60 menit sebelumnya untuk mengukur laju pertumbuhan.`
    }
  } else {
    growthRate = parseFloat((countRecent30m / countPrior30m).toFixed(2))

    if (minutesSinceLatest > 180) {
      // Tidak ada publikasi baru dalam > 3 jam
      state = 'COOLING'
      assessmentReason = `Aktivitas pemberitaan mereda. Tidak ada artikel baru dalam ${Math.floor(minutesSinceLatest / 60)} jam terakhir (${sampleSize} artikel total).`
    } else if (growthRate >= 1.5 && countRecent30m >= 2) {
      state = 'RISING'
      assessmentReason = `Lonjakan pelaporan terdeteksi (${growthRate}x kecepatan, ${countRecent30m} artikel baru dalam 30 menit) dari ${distinctPublishers} domain pers.`
    } else if (growthRate < 0.8 && minutesSinceLatest > 60) {
      state = 'COOLING'
      assessmentReason = `Pemberitaan melandai (${sampleSize} artikel dari ${distinctPublishers} domain, pembaruan terakhir ${minutesSinceLatest} menit lalu).`
    } else {
      state = 'SUSTAINED'
      assessmentReason = `Pemberitaan berlangsung stabil (${sampleSize} artikel terdistribusi pada ${distinctPublishers} domain pers).`
    }
  }

  return {
    state,
    sampleSize,
    distinctPublishers,
    growthRate,
    firstObservedAt,
    latestObservedAt,
    isSocialViralityMeasured: false,
    timeBasis,
    assessmentReason,
    stateReason: assessmentReason,
    windowCounts
  }
}

/**
 * Menyematkan asesmen aktivitas issue ke setiap EventCluster dalam array
 */
export function attachIssueActivityToClusters(clusters: EventCluster[], now = Date.now()): EventCluster[] {
  return clusters.map(cluster => {
    const activity = assessIssueActivity(cluster, now)
    return {
      ...cluster,
      activityAssessment: activity,
      issueActivity: activity
    }
  })
}

/**
 * Membuat entri snapshot aktivitas isu yang terisolasi untuk disimpan ke IndexedDB (WP4 / S61-24)
 */
export function createIssueActivitySnapshot(
  cluster: EventCluster,
  assessment: IssueActivityAssessment,
  now = Date.now()
): IssueActivitySnapshot {
  return {
    id: `snap-${cluster.id}-${now}`,
    clusterId: cluster.id,
    timestamp: now,
    state: assessment.state,
    sampleSize: assessment.sampleSize,
    distinctPublishers: assessment.distinctPublishers,
    growthRate: assessment.growthRate,
    windowCounts: assessment.windowCounts || {
      last3hCount: 0,
      last12hCount: 0,
      last24hCount: 0
    },
    timeBasis: assessment.timeBasis || 'PUBLISHED_AT',
    assessmentReason: assessment.assessmentReason
  }
}
