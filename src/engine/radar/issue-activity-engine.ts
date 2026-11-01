import type { EventCluster, IssueActivityAssessment, IssueActivityState } from './radar-types.ts'

/**
 * Menilai status aktivitas dan momentum pemberitaan pada sebuah EventCluster (Sprint 6)
 * Kontrak Etis:
 * 1. Mengharuskan sampel minimum (>= 3 artikel dan >= 2 domain penerbit) untuk menyatakan RISING / SUSTAINED.
 * 2. isSocialViralityMeasured SELALU FALSE (Zero Fake Social Virality).
 * 3. Menjelaskan secara transparan alasan status pada assessmentReason.
 */
export function assessIssueActivity(cluster: EventCluster, now = Date.now()): IssueActivityAssessment {
  const members = cluster.memberItems || []
  const sampleSize = members.length
  const distinctPublishers = cluster.sourceCoverage?.distinctPublisherDomainCount || 1

  const firstObservedAt = cluster.firstObservedAt || now
  const latestObservedAt = cluster.latestObservedAt || now
  const ageMinutes = Math.max(0, Math.floor((now - firstObservedAt) / (60 * 1000)))
  const minutesSinceLatest = Math.max(0, Math.floor((now - latestObservedAt) / (60 * 1000)))

  const w3h = now - 3 * 3600 * 1000
  const w12h = now - 12 * 3600 * 1000
  const w24h = now - 24 * 3600 * 1000
  const windowCounts = {
    last3hCount: members.filter(m => (m.publishedAt || m.observedAt) >= w3h).length,
    last12hCount: members.filter(m => (m.publishedAt || m.observedAt) >= w12h).length,
    last24hCount: members.filter(m => (m.publishedAt || m.observedAt) >= w24h).length
  }

  // 1. Evaluasi Ambang Batas Minimum Sampel
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

  const countRecent30m = members.filter(m => (m.publishedAt || m.observedAt) >= window30m).length
  const countPrior30m = members.filter(m => {
    const t = m.publishedAt || m.observedAt
    return t >= window60m && t < window30m
  }).length

  let growthRate: number | null = null
  if (countPrior30m > 0) {
    growthRate = parseFloat((countRecent30m / countPrior30m).toFixed(2))
  } else if (countRecent30m > 0) {
    growthRate = parseFloat((countRecent30m / 1.0).toFixed(2))
  } else {
    growthRate = 0.0
  }

  // 3. Penentuan State Momentum
  let state: IssueActivityState = 'SUSTAINED'
  let assessmentReason = ''

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

  return {
    state,
    sampleSize,
    distinctPublishers,
    growthRate,
    firstObservedAt,
    latestObservedAt,
    isSocialViralityMeasured: false,
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
      activityAssessment: activity
    }
  })
}
