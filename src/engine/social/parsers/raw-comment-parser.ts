/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RAW COMMENTS INGEST & CLIPBOARD PARSER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Parser masukan komentar mentah dari analis militer:
 * 1. Format baris per baris ("@username: komentar")
 * 2. Format baris terpisah (@username lalu komentar di baris berikutnya)
 * 3. Format JSON array ([{ username, text, likes, timestamp }])
 * 4. Format teks bebas baris tanpa username spesifik
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { AnalyzedCommentItem } from '../types/social-analysis-types.ts'

export function parseRawCommentsText(rawText: string): AnalyzedCommentItem[] {
  if (!rawText || !rawText.trim()) return []
  const trimmed = rawText.trim()

  // 1. Coba parse JSON jika diawali kurung siku
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item && (item.text || item.comment || item.content))
          .map((item, idx) => ({
            id: item.id || `raw-${idx + 1}`,
            authorUsername: item.authorUsername || item.username || item.author || item.user || `@user_${idx + 1}`,
            authorDisplayName: item.authorDisplayName || item.displayName || item.name,
            text: String(item.text || item.comment || item.content || '').trim(),
            likeCount: Number(item.likeCount || item.likes || item.diggCount || 0),
            publishedAt: item.publishedAt || item.timestamp || item.createTime || new Date().toISOString()
          }))
      }
    } catch {
      // Abaikan bila bukan JSON valid, lanjutkan ke parser teks
    }
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const result: AnalyzedCommentItem[] = []

  let currentUsername: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Format "@username: komentar" atau "username: komentar"
    const colonMatch = line.match(/^@?([a-zA-Z0-9_.-]+)\s*[:\-]\s*(.+)$/)
    if (colonMatch && colonMatch[2].length > 1) {
      result.push({
        id: `raw-${result.length + 1}`,
        authorUsername: colonMatch[1].startsWith('@') ? colonMatch[1] : `@${colonMatch[1]}`,
        text: colonMatch[2],
        likeCount: 0,
        publishedAt: new Date().toISOString()
      })
      continue
    }

    // Format baris username tersendiri (@username)
    if (/^@[a-zA-Z0-9_.-]+$/.test(line)) {
      currentUsername = line
      continue
    }

    if (currentUsername) {
      result.push({
        id: `raw-${result.length + 1}`,
        authorUsername: currentUsername,
        text: line,
        likeCount: 0,
        publishedAt: new Date().toISOString()
      })
      currentUsername = null
      continue
    }

    // Baris teks biasa tanpa username eksplisit
    result.push({
      id: `raw-${result.length + 1}`,
      authorUsername: `@analyst_sample_${result.length + 1}`,
      text: line,
      likeCount: 0,
      publishedAt: new Date().toISOString()
    })
  }

  return result
}

