import type { AccountProfile } from '../types'

// ─── Bot Scoring Engine ───

interface AccountInput {
  username: string
  followersCount?: number
  followingCount?: number
  postsPerDay?: number
  accountAgeDays?: number
  likesPerPost?: number
  contentText?: string
  activeHoursStr?: string  // e.g. "02:00-05:00,14:00-15:00"
  bio?: string
}

function scoreFollowerRatio(followers: number, following: number): number {
  if (following === 0) return 0
  const ratio = followers / following
  // Bot accounts often have very low follow-ratio or very high following
  if (ratio < 0.1 && following > 500) return 70  // mass following, few followers
  if (ratio > 50 && followers > 10000) return 0   // celebrity-like, organic
  if (ratio < 0.5 && following > 200) return 40
  return 10
}

function scorePostingFrequency(postsPerDay: number): number {
  // Abnormal high posting = bot behavior
  if (postsPerDay > 50) return 90
  if (postsPerDay > 20) return 70
  if (postsPerDay > 10) return 40
  if (postsPerDay > 5) return 20
  return 5
}

function scoreAccountAge(ageDays: number, postsPerDay: number): number {
  // New account with high activity is suspicious
  if (ageDays < 30 && postsPerDay > 5) return 80
  if (ageDays < 90 && postsPerDay > 10) return 60
  if (ageDays < 180 && postsPerDay > 15) return 40
  return 5
}

function scoreLikeRatio(likes: number, posts: number): number {
  // Very low engagement on many posts = bot
  const ratio = posts > 0 ? likes / posts : 0
  if (ratio < 1 && posts > 100) return 70
  if (ratio < 3 && posts > 50) return 40
  return 5
}

function scoreAbnormalHours(activeHoursStr: string): number {
  // Significant posting in late night hours (01-05 AM) = suspicious
  if (!activeHoursStr) return 10
  const suspiciousHours = ['01', '02', '03', '04', '05']
  const mentioned = suspiciousHours.filter(h => activeHoursStr.includes(h + ':'))
  return mentioned.length * 15
}

function scoreBioSuspicion(bio: string): number {
  if (!bio || bio.trim() === '') return 30  // empty bio = suspicious
  const suspiciousPatterns = ['bot', 'auto', 'api', 'script', 'official', 'verified', 'real']
  const lower = bio.toLowerCase()
  return suspiciousPatterns.some(p => lower.includes(p)) ? 20 : 5
}

export function analyzeAccount(input: AccountInput): AccountProfile {
  const scores: number[] = []
  const indicators: string[] = []
  const flags: string[] = []

  // Follower ratio
  if (input.followersCount !== undefined && input.followingCount !== undefined) {
    const s = scoreFollowerRatio(input.followersCount, input.followingCount)
    scores.push(s)
    if (s > 50) {
      indicators.push(`Rasio followers/following tidak normal (${input.followersCount}/${input.followingCount})`)
      flags.push('ANOMALI_RATIO')
    }
  }

  // Posting frequency
  if (input.postsPerDay !== undefined) {
    const s = scorePostingFrequency(input.postsPerDay)
    scores.push(s)
    if (s > 40) {
      indicators.push(`Frekuensi posting sangat tinggi: ${input.postsPerDay} post/hari`)
      flags.push('HIGH_FREQUENCY')
    }
  }

  // Account age
  if (input.accountAgeDays !== undefined && input.postsPerDay !== undefined) {
    const s = scoreAccountAge(input.accountAgeDays, input.postsPerDay)
    scores.push(s)
    if (s > 50) {
      indicators.push(`Akun baru (${input.accountAgeDays} hari) dengan aktivitas tinggi`)
      flags.push('NEW_ACCOUNT')
    }
  }

  // Like ratio
  if (input.likesPerPost !== undefined && input.postsPerDay !== undefined) {
    const s = scoreLikeRatio(input.likesPerPost, input.postsPerDay)
    scores.push(s)
    if (s > 40) {
      indicators.push(`Engagement ratio rendah: ${input.likesPerPost} likes per post`)
      flags.push('LOW_ENGAGEMENT')
    }
  }

  // Abnormal hours
  const hourScore = scoreAbnormalHours(input.activeHoursStr || '')
  scores.push(hourScore)
  if (hourScore > 30) {
    indicators.push('Aktivitas aktif di jam tidak wajar (dini hari)')
    flags.push('NOCTURNAL_ACTIVITY')
  }

  // Bio
  const bioScore = scoreBioSuspicion(input.bio || '')
  scores.push(bioScore)
  if (bioScore > 20) {
    indicators.push('Bio akun kosong atau mengandung kata mencurigakan')
    flags.push('SUSPICIOUS_BIO')
  }

  // Aggregate score
  const avgScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 30
  const botScore = Math.min(99, Math.round(avgScore + (flags.length * 5)))
  const authenticityScore = Math.max(1, 100 - botScore)

  // Posting pattern
  let postingPattern: AccountProfile['postingPattern'] = 'normal'
  if (flags.includes('HIGH_FREQUENCY') && flags.includes('NOCTURNAL_ACTIVITY')) postingPattern = 'scheduled'
  else if (flags.includes('HIGH_FREQUENCY')) postingPattern = 'burst'
  else if (flags.includes('ANOMALI_RATIO') && flags.includes('LOW_ENGAGEMENT')) postingPattern = 'coordinated'

  return {
    id: `PROF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    username: input.username,
    botScore,
    authenticityScore,
    suspiciousIndicators: indicators,
    postingPattern,
    activityHours: [],
    contentSimilarity: flags.includes('COORDINATED') ? 75 : 0,
    flags,
  }
}

export function analyzeBatch(accounts: AccountInput[]): AccountProfile[] {
  return accounts.map(a => analyzeAccount(a))
}
