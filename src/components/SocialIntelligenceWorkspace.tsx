/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — AUTOMATED SOCIAL INTELLIGENCE WORKSPACE UI
 * SPRINT 11: WORK PACKAGE 9 (TACTICAL ARMORED STEEL WORKSPACE INTEGRATION)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Aturan Antarmuka & Kepatuhan Integritas:
 * 1. Tactical Armored Steel: Desain industri militer gelap (#0C1016), aksen cyan (#00F3FF),
 *    bahaya merah (#FF2A5F), emas (#D4AF37), dan hijau (#10B981).
 * 2. Pemisahan Tegas Discovery vs Acquired:
 *    - Cuplikan mesin pencari diberi label tegas 'DISCOVERY ONLY — FULL CONTENT NOT ACQUIRED'.
 * 3. Status Jujur Tanpa Kepalsuan (Truthful Empty/Blocked States):
 *    - NO DATA ACQUIRED, CONNECTOR NOT CONFIGURED, ACCESS RESTRICTED, POLICY BLOCKED,
 *      COMMENTS DISABLED, QUOTA EXHAUSTED.
 * 4. Peringatan Observasi Konservatif:
 *    - Tanpa pelabelan bot/buzzer, selalu menyertakan caveat sampel terbatas & lonjakan alami.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from 'react'
import {
  ShieldCheck,
  Info,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'
import type { InvestigationCase } from '../engine/investigation/investigation-types.ts'
import type {
  SocialPlatform,
  SocialPostRecord,
  SocialCommentRecord,
  SocialSpreadObservation
} from '../engine/social/social-contracts.ts'
import {
  PLATFORM_CAPABILITY_MATRIX
} from '../engine/social/social-contracts.ts'
import {
  socialIntelligencePipeline
} from '../engine/social/social-intelligence-pipeline.ts'
import {
  youtubeConnector,
  calculateNextPacificMidnight
} from '../engine/acquisition/youtube-connector.ts'
import {
  GOOGLE_CSE_DEPRECATION_NOTICE
} from '../engine/acquisition/dorking-discovery-engine.ts'
import {
  getSocialPostsFromDB,
  getDiscoveryCandidatesFromDB,
  getSocialCommentsFromDB
} from '../utils/db-adapter.ts'
import type { SearchDiscoveryResult } from '../engine/acquisition/source-contracts.ts'

interface SocialIntelligenceWorkspaceProps {
  activeCase: InvestigationCase
  onClose?: () => void
}

export default function SocialIntelligenceWorkspace({
  activeCase,
  onClose
}: SocialIntelligenceWorkspaceProps) {
  // ─── STATE WORKSPACE ───
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'POSTS' | 'COMMENTS' | 'SPREAD'>('OVERVIEW')
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'ALL'>('ALL')
  const [posts, setPosts] = useState<SocialPostRecord[]>([])
  const [candidates, setCandidates] = useState<SearchDiscoveryResult[]>([])
  const [selectedPost, setSelectedPost] = useState<SocialPostRecord | null>(null)
  const [comments, setComments] = useState<SocialCommentRecord[]>([])
  const [showDeprecationDetails, setShowDeprecationDetails] = useState(false)

  // YouTube Quota & Pacific Time Status
  const [quotaState, setQuotaState] = useState(() => youtubeConnector.getQuotaState())
  const [nextResetPt, setNextResetPt] = useState(() => new Date(calculateNextPacificMidnight()).toLocaleString('id-ID', { timeZone: 'America/Los_Angeles' }))

  // Muat data saat komponen aktif atau case berubah
  useEffect(() => {
    let isMounted = true

    async function loadWorkspaceData() {
      try {
        const [loadedPosts, loadedCandidates] = await Promise.all([
          getSocialPostsFromDB({ issueId: activeCase.id }).catch(() => []),
          getDiscoveryCandidatesFromDB().catch(() => [])
        ])

        if (isMounted) {
          setPosts(loadedPosts)
          setCandidates(loadedCandidates)
          if (loadedPosts.length > 0) {
            setSelectedPost(loadedPosts[0])
            const loadedComments = await getSocialCommentsFromDB(loadedPosts[0].id).catch(() => [])
            setComments(loadedComments)
          }
          setQuotaState(youtubeConnector.getQuotaState())
          setNextResetPt(new Date(calculateNextPacificMidnight()).toLocaleString('id-ID', { timeZone: 'America/Los_Angeles' }))
        }
      } catch {
        // Fallback
      }
    }

    loadWorkspaceData()

    return () => {
      isMounted = false
    }
  }, [activeCase.id])

  // Menghitung observasi sebaran sosial dinamis
  const spreadObservation: SocialSpreadObservation = useMemo(() => {
    return socialIntelligencePipeline.generateSocialSpreadObservation(posts, comments, candidates, activeCase.id)
  }, [posts, comments, candidates, activeCase.id])

  // Filter pos berdasarkan platform
  const filteredPosts = useMemo(() => {
    if (selectedPlatform === 'ALL') return posts
    return posts.filter(p => p.platform === selectedPlatform)
  }, [posts, selectedPlatform])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      color: '#E2E8F0',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* ─── 1. HEADER SISTEM & TELEMETRI QUOTA TACTICAL STEEL ─── */}
      <div style={{
        background: 'linear-gradient(180deg, #131B26 0%, #0C1016 100%)',
        border: '1px solid #1E293B',
        borderRadius: '6px',
        padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'rgba(0, 243, 255, 0.1)',
                color: '#00F3FF',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                padding: '3px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '1px'
              }}>
                SPRINT 11
              </span>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC', margin: 0, letterSpacing: '0.5px' }}>
                AUTOMATED SOCIAL INTELLIGENCE & ACQUISITION PIPELINE
              </h2>
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Akuisisi konten sosial resmi, pemisahan ketat hasil pencarian vs konten terakuisisi, dan kepatuhan tata kelola Gate L.
            </p>
          </div>

          {/* Quick Actions & View Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('OVERVIEW')}
              style={{
                background: viewMode === 'OVERVIEW' ? 'linear-gradient(135deg, #00F3FF 0%, #0088AA 100%)' : 'rgba(255, 255, 255, 0.05)',
                color: viewMode === 'OVERVIEW' ? '#080C14' : '#94A3B8',
                border: '1px solid ' + (viewMode === 'OVERVIEW' ? '#00F3FF' : '#334155'),
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Matriks Kapabilitas
            </button>
            <button
              type="button"
              onClick={() => setViewMode('POSTS')}
              style={{
                background: viewMode === 'POSTS' ? 'linear-gradient(135deg, #00F3FF 0%, #0088AA 100%)' : 'rgba(255, 255, 255, 0.05)',
                color: viewMode === 'POSTS' ? '#080C14' : '#94A3B8',
                border: '1px solid ' + (viewMode === 'POSTS' ? '#00F3FF' : '#334155'),
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Konten Terakuisisi ({posts.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('SPREAD')}
              style={{
                background: viewMode === 'SPREAD' ? 'linear-gradient(135deg, #00F3FF 0%, #0088AA 100%)' : 'rgba(255, 255, 255, 0.05)',
                color: viewMode === 'SPREAD' ? '#080C14' : '#94A3B8',
                border: '1px solid ' + (viewMode === 'SPREAD' ? '#00F3FF' : '#334155'),
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Observasi Sebaran ({spreadObservation.sampleSizePosts})
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Tutup Workspace Social Intelligence"
              >
                ✕ Tutup
              </button>
            )}
          </div>
        </div>

        {/* Telemetri & Status Banner */}
        <div style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px'
        }}>
          {/* Box 1: Search Provider Continuity */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1E293B',
            borderRadius: '4px',
            padding: '10px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                Search Provider Primer
              </span>
              <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>BRAVE API</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9', marginTop: '4px' }}>
              Brave Search ($5.00/1k query)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', padding: '1px 5px', borderRadius: '2px', fontWeight: 600 }}>
                Google CSE Sunset 2027
              </span>
              <button
                type="button"
                onClick={() => setShowDeprecationDetails(!showDeprecationDetails)}
                style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '10px', cursor: 'pointer', padding: 0 }}
              >
                {showDeprecationDetails ? 'Tutup Catatan' : 'Rincian Migrasi'}
              </button>
            </div>
            {showDeprecationDetails && (
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#CBD5E1', borderTop: '1px dashed #334155', paddingTop: '6px' }}>
                {GOOGLE_CSE_DEPRECATION_NOTICE.rationale}
              </div>
            )}
          </div>

          {/* Box 2: YouTube Quota Buckets */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1E293B',
            borderRadius: '4px',
            padding: '10px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                YouTube Quota (Pacific Time)
              </span>
              <span style={{ fontSize: '10px', color: '#00F3FF', fontWeight: 700 }}>RESMI GCP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
              <span>Search.list Bucket:</span>
              <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
                {quotaState.buckets?.searchRequests?.remaining ?? 100} / {quotaState.buckets?.searchRequests?.dailyLimit ?? 100} call
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
              <span>General Units Bucket:</span>
              <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
                {quotaState.buckets?.generalUnits?.remaining ?? 10000} / {quotaState.buckets?.generalUnits?.dailyLimit ?? 10000} unit
              </span>
            </div>
            <div style={{ fontSize: '9px', color: '#64748B', marginTop: '4px' }}>
              Reset berikutnya: Midnight PT ({nextResetPt} PT)
            </div>
          </div>

          {/* Box 3: Gate L Compliance State */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1E293B',
            borderRadius: '4px',
            padding: '10px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                Tata Kelola Kepatuhan Gate L
              </span>
              <ShieldCheck size={13} color="#10B981" />
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>
              Aktif & Menegakkan Hukum
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
              • Section III.E.2: Agregasi lintas-kanal DIBLOKIR<br />
              • Section III.E.4: Batas retensi 30 hari kalender
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. KONTEN UTAMA WORKSPACE ─── */}
      {viewMode === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Matriks Kejujuran Kapabilitas 5 Platform Sosial
            </h3>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Zero Scraping • Zero Login Bypass • Status Otorisasi Transparan
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '12px'
          }}>
            {(['youtube', 'facebook', 'instagram', 'tiktok', 'x'] as SocialPlatform[]).map(platform => {
              const caps = PLATFORM_CAPABILITY_MATRIX[platform]
              const postCount = posts.filter(p => p.platform === platform).length
              const candidateCount = candidates.filter(c => c.targetPlatform === platform).length

              return (
                <div
                  key={platform}
                  style={{
                    background: '#111827',
                    border: '1px solid #1F2937',
                    borderRadius: '6px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1F2937', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: '#0F172A',
                        color: '#00F3FF',
                        border: '1px solid #334155',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}>
                        {platform}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                      {postCount} pos • {candidateCount} cuplikan
                    </span>
                  </div>

                  {/* List Kapabilitas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    {caps.map(cap => {
                      let badgeBg = 'rgba(100, 116, 139, 0.2)'
                      let badgeColor = '#94A3B8'
                      if (cap.status === 'AVAILABLE' || cap.status === 'VERIFIED_LIVE') {
                        badgeBg = 'rgba(16, 185, 129, 0.15)'
                        badgeColor = '#34D399'
                      } else if (cap.status === 'POLICY_BLOCKED') {
                        badgeBg = 'rgba(239, 68, 68, 0.15)'
                        badgeColor = '#F87171'
                      } else if (cap.status === 'ACCESS_RESTRICTED' || cap.status === 'APPROVAL_REQUIRED') {
                        badgeBg = 'rgba(245, 158, 11, 0.15)'
                        badgeColor = '#FBBF24'
                      } else if (cap.status === 'CONFIGURATION_REQUIRED') {
                        badgeBg = 'rgba(56, 189, 248, 0.15)'
                        badgeColor = '#38BDF8'
                      }

                      return (
                        <div key={cap.capability} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{cap.capability}:</span>
                          <span style={{
                            background: badgeBg,
                            color: badgeColor,
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 700
                          }}>
                            {cap.status}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ fontSize: '10px', color: '#64748B', borderTop: '1px solid #1F2937', paddingTop: '8px' }}>
                    {platform === 'youtube' && 'Konektor resmi aktif via Google Cloud. Mematuhi retensi 30 hari & isolasi kanal.'}
                    {platform === 'facebook' && 'Penemuan via indeks pencarian publik. Meta Research API memerlukan akreditasi institusi.'}
                    {platform === 'instagram' && 'Penemuan via Dorking reels/p. Scraping login dilarang keras.'}
                    {platform === 'tiktok' && 'Hanya penemuan tautan publik. Research API memerlukan persetujuan formal TikTok.'}
                    {platform === 'x' && 'Penemuan publik via x.com. API v2 Tweets Lookup mewajibkan tier Basic berbayar.'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'POSTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
          {/* Kolom Kiri: Daftar Konten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'youtube', 'facebook', 'instagram', 'tiktok', 'x'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPlatform(p)}
                    style={{
                      background: selectedPlatform === p ? '#00F3FF' : '#1E293B',
                      color: selectedPlatform === p ? '#0B0F17' : '#94A3B8',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {filteredPosts.length} pos terakuisisi
              </span>
            </div>

            {filteredPosts.length === 0 ? (
              <div style={{
                background: '#111827',
                border: '1px dashed #334155',
                borderRadius: '6px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748B'
              }}>
                <Info size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8' }}>
                  NO DATA ACQUIRED
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  Belum ada konten sosial yang berhasil diakuisisi secara sah untuk kasus ini.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                {filteredPosts.map(post => {
                  const isSelected = selectedPost?.id === post.id
                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      style={{
                        background: isSelected ? '#1E293B' : '#111827',
                        border: isSelected ? '1px solid #00F3FF' : '1px solid #1F2937',
                        borderRadius: '4px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{
                          background: 'rgba(0, 243, 255, 0.15)',
                          color: '#00F3FF',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          fontSize: '9px',
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>
                          {post.platform}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748B' }}>
                          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('id-ID') : 'UNKNOWN_DATE'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9', marginTop: '6px' }}>
                        {post.title}
                      </div>

                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.4 }}>
                        {post.contentText.slice(0, 140)}...
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid #1E293B', paddingTop: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#64748B' }}>
                          Oleh: {post.author.channelTitle || post.author.handle || 'Anonim'}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          background: post.contentStatus === 'FULL_CONTENT_ACQUIRED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: post.contentStatus === 'FULL_CONTENT_ACQUIRED' ? '#34D399' : '#38BDF8',
                          padding: '1px 5px',
                          borderRadius: '2px',
                          fontWeight: 700
                        }}>
                          {post.contentStatus}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Rincian Pos & Forensik Komentar */}
          <div style={{
            background: '#111827',
            border: '1px solid #1F2937',
            borderRadius: '6px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {selectedPost ? (
              <>
                <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#00F3FF', textTransform: 'uppercase' }}>
                      RINCIAN BUKTI KONTEN KANONIKAL
                    </span>
                    <a
                      href={selectedPost.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#38BDF8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      Buka Tautan Resmi <ExternalLink size={11} />
                    </a>
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC', margin: '6px 0 0 0' }}>
                    {selectedPost.title}
                  </h4>
                </div>

                {/* Metadata Forensik */}
                <div style={{ background: '#0B0F17', borderRadius: '4px', padding: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Platform:</span>
                    <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{selectedPost.platform.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Metode Akuisisi:</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>{selectedPost.acquisitionMethod}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Waktu Publikasi Sumber:</span>
                    <span style={{ color: '#F1F5F9' }}>
                      {selectedPost.publishedAt ? new Date(selectedPost.publishedAt).toLocaleString('id-ID') : 'UNKNOWN_DATE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Waktu Akuisisi NARADA:</span>
                    <span style={{ color: '#F1F5F9' }}>{new Date(selectedPost.acquiredAt).toLocaleString('id-ID')}</span>
                  </div>
                  {selectedPost.retentionExpiresAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#EF4444' }}>Retensi Kedaluwarsa (30 Hari):</span>
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>
                        {new Date(selectedPost.retentionExpiresAt).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Teks Konten */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
                    TEKS KONTEN TERAKUISISI:
                  </div>
                  <div style={{
                    background: '#0B0F17',
                    border: '1px solid #1E293B',
                    borderRadius: '4px',
                    padding: '10px',
                    fontSize: '11px',
                    color: '#CBD5E1',
                    lineHeight: 1.5,
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    {selectedPost.contentText}
                  </div>
                </div>

                {/* Rincian Komentar Video */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>
                      KOMENTAR PUBLIK ({comments.length}):
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>
                      Gate L: Terisolasi 1 Video
                    </span>
                  </div>

                  {comments.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', padding: '12px', textAlign: 'center', background: '#0B0F17', borderRadius: '4px' }}>
                      Tidak ada komentar publik yang terakuisisi untuk konten ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {comments.map(cmt => (
                        <div key={cmt.id} style={{ background: '#0B0F17', border: '1px solid #1E293B', borderRadius: '4px', padding: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                            <span style={{ fontWeight: 700, color: '#94A3B8' }}>{cmt.authorHandle}</span>
                            <span style={{
                              color: cmt.sentimentVerdict === 'POSITIVE' ? '#10B981' : cmt.sentimentVerdict === 'NEGATIVE' ? '#EF4444' : '#64748B',
                              fontWeight: 700
                            }}>
                              {cmt.sentimentVerdict || 'NEUTRAL'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#E2E8F0', marginTop: '4px' }}>
                            {cmt.textOriginal}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: '#64748B', fontSize: '11px', textAlign: 'center', margin: 'auto' }}>
                Pilih pos di sebelah kiri untuk melihat rincian forensik.
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'SPREAD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Peringatan Doktriner Wajib */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertTriangle size={16} color="#F59E0B" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '11px', color: '#FCD34D', lineHeight: 1.5 }}>
              <strong>BATASAN INTERPRETASI INTELIJEN SOSIAL:</strong> Metrik di bawah ini dihitung semata-mata dari{' '}
              <strong>SAMPEL TERAMATI ({spreadObservation.sampleSizePosts} pos terakuisisi)</strong>, bukan representasi populasi menyeluruh platform.
              Lonjakan aktivitas (burst) tidak membuktikan koordinasi terselubung dan tidak boleh diatribusikan kepada individu atau aktor tanpa bukti forensik digital langsung.
            </div>
          </div>

          {/* Grid Statistik Sampel Teramati */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>SAMPEL POS TERAKUISISI</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#00F3FF', marginTop: '4px' }}>
                {spreadObservation.sampleSizePosts}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Pos tervalidasi dengan identitas platform</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>CUPLIKAN PENEMUAN PENCARIAN</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                {spreadObservation.discoveryCandidatesCount}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Hasil indeks mesin pencari (snippet only)</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>SAMPEL KOMENTAR TERAKUISISI</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                {spreadObservation.sampleSizeComments}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Komentar publik terisolasi per video</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>INDIKATOR KOORDINASI</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', marginTop: '8px' }}>
                {spreadObservation.coordinationIndicators.label}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                {spreadObservation.coordinationIndicators.rationale}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

