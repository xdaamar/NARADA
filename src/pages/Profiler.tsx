import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserSearch, Plus, Trash2, AlertTriangle, CheckCircle, ShieldAlert, Network } from 'lucide-react'
import { analyzeAccount } from '../engine/profiler'
import type { AccountProfile } from '../types'

// ─── Sample Account Data ───
const SAMPLE_ACCOUNTS = [
  { username: '@patriot_indonesia99', followersCount: 45, followingCount: 4800, postsPerDay: 67, accountAgeDays: 12, likesPerPost: 2, activeHoursStr: '02:00-04:00', bio: '' },
  { username: '@beritabenarkita', followersCount: 120, followingCount: 3200, postsPerDay: 42, accountAgeDays: 28, likesPerPost: 1, activeHoursStr: '01:00-03:00', bio: 'Kebenaran untuk rakyat' },
  { username: '@normal_user2024', followersCount: 850, followingCount: 420, postsPerDay: 3, accountAgeDays: 730, likesPerPost: 45, activeHoursStr: '09:00-21:00', bio: 'Pecinta kuliner Indonesia' },
]

// ─── Score Bar ───
function ScoreBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color }}>{value}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Account Card ───
function AccountCard({ profile, onRemove }: { profile: AccountProfile; onRemove: () => void }) {
  const isSuspicious = profile.botScore >= 50
  const isCritical = profile.botScore >= 75

  const botColor = isCritical ? '#EF4444' : isSuspicious ? '#F97316' : '#F59E0B'
  const authColor = profile.authenticityScore >= 70 ? '#22C55E' : profile.authenticityScore >= 50 ? '#F59E0B' : '#EF4444'

  const patternLabels: Record<string, { label: string; color: string }> = {
    normal: { label: 'Normal', color: '#22C55E' },
    burst: { label: 'Burst Posting', color: '#F59E0B' },
    scheduled: { label: 'Terjadwal/Bot', color: '#EF4444' },
    coordinated: { label: 'Terkoordinasi', color: '#8B5CF6' },
  }

  const pattern = patternLabels[profile.postingPattern] || patternLabels.normal

  return (
    <div className="card fade-in" style={{ 
      borderColor: isCritical ? 'rgba(239,68,68,0.3)' : isSuspicious ? 'rgba(249,115,22,0.2)' : 'var(--bg-border)'
    }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: isCritical ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
            border: `2px solid ${botColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '700', color: botColor,
            fontFamily: 'var(--font-mono)'
          }}>
            {profile.username[1]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {profile.username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ 
                fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 6px',
                background: `${pattern.color}15`, color: pattern.color,
                border: `1px solid ${pattern.color}25`, borderRadius: '3px'
              }}>
                {pattern.label}
              </span>
              {isCritical && (
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#EF4444' }}>
                  ⚠ TERINDIKASI BOT
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onRemove}>
          <Trash2 size={13} />
        </button>
      </div>

      <div className="card-body">
        {/* Score Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <ScoreBar value={profile.botScore} color={botColor} label="Skor Bot (tinggi = bot)" />
          <ScoreBar value={profile.authenticityScore} color={authColor} label="Skor Keaslian Akun" />
        </div>

        {/* Flags */}
        {profile.flags.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              FLAG TERDETEKSI
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {profile.flags.map((f: string) => (
                <span key={f} style={{
                  padding: '2px 8px', background: 'rgba(239,68,68,0.1)',
                  color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '3px', fontSize: '9px', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.5px'
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suspicious Indicators */}
        {profile.suspiciousIndicators.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              INDIKATOR KECURIGAAN
            </div>
            {profile.suspiciousIndicators.map((ind: string, i: number) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '7px',
                padding: '6px 0', borderBottom: i < profile.suspiciousIndicators.length - 1 ? '1px solid var(--bg-border)' : 'none'
              }}>
                <AlertTriangle size={11} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{ind}</span>
              </div>
            ))}
          </div>
        )}

        {profile.suspiciousIndicators.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--threat-low)', fontSize: '12px' }}>
            <CheckCircle size={13} />
            Tidak ada indikator mencurigakan yang signifikan
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Form Input Field ───
function FormField({ label, id, type = 'text', placeholder, value, onChange }: {
  label: string; id: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// ─── Profiler Page ───
export default function Profiler() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState<AccountProfile[]>(() => {
    try {
      const stored = sessionStorage.getItem('narada_profiler_accounts')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Form state
  const [username, setUsername] = useState('')
  const [followers, setFollowers] = useState('')
  const [following, setFollowing] = useState('')
  const [ppd, setPpd] = useState('')
  const [ageDays, setAgeDays] = useState('')
  const [likes, setLikes] = useState('')
  const [activeHours, setActiveHours] = useState('')
  const [bio, setBio] = useState('')

  // Tangkap param query username jika dialihkan dari Analyzer/Nexus
  useEffect(() => {
    const queryUser = searchParams.get('username')
    if (queryUser) {
      const clean = queryUser.startsWith('@') ? queryUser : `@${queryUser}`
      setUsername(clean)
    }
  }, [searchParams])

  const handleAnalyze = () => {
    if (!username.trim()) return
    setIsAnalyzing(true)
    setTimeout(() => {
      const result = analyzeAccount({
        username: username.startsWith('@') ? username : `@${username}`,
        followersCount: followers ? parseInt(followers) : undefined,
        followingCount: following ? parseInt(following) : undefined,
        postsPerDay: ppd ? parseFloat(ppd) : undefined,
        accountAgeDays: ageDays ? parseInt(ageDays) : undefined,
        likesPerPost: likes ? parseFloat(likes) : undefined,
        activeHoursStr: activeHours,
        bio,
      })
      setProfiles(prev => {
        const updated = [result, ...prev]
        sessionStorage.setItem('narada_profiler_accounts', JSON.stringify(updated))
        return updated
      })
      setIsAnalyzing(false)
      // Reset form
      setUsername(''); setFollowers(''); setFollowing(''); setPpd('')
      setAgeDays(''); setLikes(''); setActiveHours(''); setBio('')
    }, 600)
  }

  const handleLoadSample = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      const results = SAMPLE_ACCOUNTS.map(a => analyzeAccount(a))
      setProfiles(results)
      sessionStorage.setItem('narada_profiler_accounts', JSON.stringify(results))
      setIsAnalyzing(false)
    }, 800)
  }

  const handleRemoveProfile = (index: number) => {
    setProfiles(prev => {
      const updated = prev.filter((_, idx) => idx !== index)
      sessionStorage.setItem('narada_profiler_accounts', JSON.stringify(updated))
      return updated
    })
  }

  const stats = {
    total: profiles.length,
    bot: profiles.filter(p => p.botScore >= 75).length,
    suspicious: profiles.filter(p => p.botScore >= 50 && p.botScore < 75).length,
    authentic: profiles.filter(p => p.botScore < 50).length,
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          NARADA Profiler
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Analisis pola akun untuk mendeteksi bot, buzzer, dan koordinasi artifisial
        </p>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '360px 1fr', alignItems: 'start', gap: '20px' }}>
        {/* Input Form */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <UserSearch size={12} style={{ display: 'inline', marginRight: '6px' }} />
                Input Data Akun
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FormField label="Username Akun *" id="username" placeholder="@namaakun" value={username} onChange={setUsername} />
              
              <div className="grid-2">
                <FormField label="Jumlah Followers" id="followers" type="number" placeholder="0" value={followers} onChange={setFollowers} />
                <FormField label="Jumlah Following" id="following" type="number" placeholder="0" value={following} onChange={setFollowing} />
              </div>

              <div className="grid-2">
                <FormField label="Post Per Hari" id="ppd" type="number" placeholder="0" value={ppd} onChange={setPpd} />
                <FormField label="Umur Akun (hari)" id="agedays" type="number" placeholder="0" value={ageDays} onChange={setAgeDays} />
              </div>

              <FormField label="Avg Likes Per Post" id="likes" type="number" placeholder="0" value={likes} onChange={setLikes} />
              <FormField label="Jam Aktif (contoh: 02:00-04:00)" id="hours" placeholder="02:00-04:00" value={activeHours} onChange={setActiveHours} />

              <div className="form-group">
                <label className="form-label" htmlFor="bio">Bio Profil</label>
                <textarea
                  id="bio"
                  className="form-control"
                  placeholder="Bio akun (kosong jika tidak ada)"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                  style={{ minHeight: 'unset', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  disabled={!username.trim() || isAnalyzing}
                  style={{ flex: 1 }}
                >
                  <Plus size={14} />
                  Analisis Akun
                </button>
                <button className="btn btn-secondary" onClick={handleLoadSample} disabled={isAnalyzing}>
                  Demo
                </button>
              </div>
            </div>
          </div>

          {/* Stats & Integrasi ke Nexus */}
          {profiles.length > 0 && (
            <div className="card" style={{ marginTop: '16px' }}>
              <div className="card-header">
                <div className="card-title">Ringkasan Analisis</div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Total Akun', value: stats.total, color: 'var(--text-primary)' },
                  { label: '⚠ Terindikasi Bot', value: stats.bot, color: '#EF4444' },
                  { label: '⚡ Mencurigakan', value: stats.suspicious, color: '#F97316' },
                  { label: '✓ Otentik', value: stats.authentic, color: '#22C55E' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bg-border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--font-display)', fontWeight: '700', color: s.color }}>{s.value}</span>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: '#60A5FA',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '8px 12px'
                  }}
                  onClick={() => {
                    sessionStorage.setItem('narada_profiler_accounts', JSON.stringify(profiles))
                    navigate('/nexus')
                  }}
                >
                  <Network size={14} />
                  🕸️ Kirim Jaringan Akun ke Nexus Graph ({profiles.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {profiles.length === 0 && !isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 20px' }}>
                <ShieldAlert size={40} className="empty-icon" />
                <div className="empty-title">Belum Ada Data Akun</div>
                <div className="empty-desc">
                  Masukkan data akun di form kiri untuk dianalisis, atau klik tombol "Demo" untuk melihat contoh hasil analisis
                </div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 20px' }}>
                <div className="loading-dots" style={{ marginBottom: '16px' }}><span /><span /><span /></div>
                <div className="empty-title">Menganalisis Akun</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profiles.map((p, i) => (
              <AccountCard
                key={p.id}
                profile={p}
                onRemove={() => handleRemoveProfile(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
