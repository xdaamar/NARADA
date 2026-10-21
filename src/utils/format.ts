import type { ContentCategory, ThreatLevel } from '../types'

/**
 * Format tanggal dalam format resmi militer (e.g. 21-OKT-2026 19:30 WIB)
 */
export function formatMilitaryDate(timestamp: number | Date = Date.now()): string {
  const d = new Date(timestamp)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
  
  const day = String(d.getDate()).padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')

  return `${day}-${month}-${year} ${hours}:${mins} WIB`
}

/**
 * Mendapatkan konfigurasi visual badge tingkat ancaman (Threat Level)
 */
export function getThreatBadge(level: ThreatLevel): {
  label: string
  color: string
  bgColor: string
  borderColor: string
} {
  switch (level) {
    case 'critical':
      return {
        label: 'CRITICAL',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
      }
    case 'high':
      return {
        label: 'HIGH',
        color: '#F97316',
        bgColor: 'rgba(249, 115, 22, 0.15)',
        borderColor: 'rgba(249, 115, 22, 0.4)',
      }
    case 'medium':
      return {
        label: 'MEDIUM',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
      }
    case 'low':
    default:
      return {
        label: 'LOW',
        color: '#22C55E',
        bgColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.4)',
      }
  }
}

/**
 * Mendapatkan warna dan label kategori ancaman kognitif
 */
export function getCategoryBadge(category: ContentCategory): {
  label: string
  color: string
  bgColor: string
} {
  switch (category) {
    case 'HOAKS':
      return { label: 'HOAKS', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.12)' }
    case 'PROPAGANDA':
      return { label: 'PROPAGANDA', color: '#F97316', bgColor: 'rgba(249, 115, 22, 0.12)' }
    case 'BUZZER':
      return { label: 'BUZZER', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.12)' }
    case 'DISINFORMASI':
      return { label: 'DISINFORMASI', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.12)' }
    case 'NETRAL':
    default:
      return { label: 'NETRAL', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.12)' }
  }
}

/**
 * Memotong teks panjang dengan elipsis (...)
 */
export function truncateText(text: string, maxLen = 120): string {
  if (!text || text.length <= maxLen) return text
  return text.substring(0, maxLen).trim() + '...'
}

/**
 * Format angka persentase confidence score
 */
export function formatConfidence(score: number): string {
  const rounded = Math.min(100, Math.max(0, Math.round(score)))
  return `${rounded}%`
}
