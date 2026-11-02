/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — UNIFIED THREAT CASE DOSSIER PDF GENERATOR
 * SPRINT 9: WORK PACKAGE D (UNIFIED CASE DOSSIER EXPORT & PRINT ARCHITECTURE)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Standar Desain Dokumen Intelijen Taktis A4:
 * - Layout A4 Vertikal (210 x 297 mm), Margin 14mm
 * - Tipografi presisi dengan pagination otomatis ("Halaman X dari Y")
 * - Mengintegrasikan:
 *   1. Identitas Kasus & Header Doktrinal
 *   2. Ringkasan Eksekutif Kasus
 *   3. Konteks Radar & Provenance Sumber Publikasi
 *   4. Hasil Asesmen Klaim & Analisis Kognitif
 *   5. Buku Besar Bukti Digital (Evidence Ledger) & Hash Integritas SHA-256
 *   6. Ringkasan Sintesis Comment Intelligence (Sentimen, Kemiripan, Burst, Koordinasi)
 *   7. Rekam Jejak Review & Keputusan Analis Lapangan
 *   8. Metodologi Analitis & Batasan Batas Penggunaan (Disclaimers)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { jsPDF } from 'jspdf'
import { fallbackSHA256 } from '../../utils/crypto.ts'
import type {
  InvestigationCase,
  EvidenceRecord,
  ClaimRecord,
  AssessmentRecord
} from '../investigation/investigation-types.ts'
import type {
  CommentBatch,
  CommentAnalysisRun,
  CommentReviewAnnotation
} from '../intelligence/comment-types.ts'
import type { DebunkKnowledgeEntry } from '../../types.ts'

export interface CaseDossierExportOptions {
  investigationCase: InvestigationCase
  evidenceRecords: EvidenceRecord[]
  claims?: ClaimRecord[]
  assessments?: AssessmentRecord[]
  commentBatches?: CommentBatch[]
  commentAnalysisRuns?: CommentAnalysisRun[]
  commentReviewAnnotations?: CommentReviewAnnotation[]
  radarItems?: DebunkKnowledgeEntry[]
  classificationLabel?: string // e.g., 'TERBATAS / TLP:AMBER'
  operatorIdentity?: string
  includeSections?: {
    summary?: boolean
    radarContext?: boolean
    claims?: boolean
    evidenceLedger?: boolean
    commentIntelligence?: boolean
    humanReview?: boolean
    methodology?: boolean
  }
}

export interface GeneratedDossierResult {
  pdfBytes: Uint8Array
  filename: string
  sha256: string
  pageCount: number
  generatedAt: string
}

export async function generateCaseDossierPdf(
  options: CaseDossierExportOptions
): Promise<GeneratedDossierResult> {
  const {
    investigationCase,
    evidenceRecords = [],
    claims = [],
    assessments = [],
    commentBatches = [],
    commentAnalysisRuns = [],
    commentReviewAnnotations = [],
    radarItems = [],
    classificationLabel = 'TERBATAS / TLP:AMBER (KARTIKA HACKATHON 2026)',
    operatorIdentity = investigationCase.createdByLocalOperator || 'Analis Pussiberad TNI AD',
    includeSections = {
      summary: true,
      radarContext: true,
      claims: true,
      evidenceLedger: true,
      commentIntelligence: true,
      humanReview: true,
      methodology: true
    }
  } = options

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Palet Warna Doktrinal Taktis
  const COLOR_HEADER_BG = [12, 16, 22]       // Dark tactical navy
  const COLOR_GOLD = [212, 175, 55]          // Pussiberad Gold
  const COLOR_TEXT_DARK = [15, 23, 42]       // Slate 900
  const COLOR_TEXT_MUTED = [100, 116, 139]   // Slate 500
  const COLOR_BOX_BG = [248, 250, 252]       // Light slate background
  const COLOR_BORDER = [226, 232, 240]       // Border slate

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 15) {
      doc.addPage()
      y = margin + 10
      drawRunningHeader()
    }
  }

  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
    doc.text('NARADA COGNITIVE THREAT DEFENSE SYSTEM — LAPORAN DOSSIER KASUS', margin, margin)
    doc.text(investigationCase.caseNumber || investigationCase.id, pageWidth - margin, margin, { align: 'right' })
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
    doc.setLineWidth(0.3)
    doc.line(margin, margin + 2, pageWidth - margin, margin + 2)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. COVER / HEADER SECTION
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
  doc.rect(margin, y, contentWidth, 32, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2])
  doc.text('PUSSIBERAD TNI AD × CODEPOLITAN', margin + 6, y + 8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('NARADA — DOSSIER INVESTIGASI SIBER SOSIAL', margin + 6, y + 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Klasifikasi: ${classificationLabel} | Waktu Ekspor: ${new Date().toLocaleString('id-ID')} WIB`, margin + 6, y + 25)

  y += 36

  // Meta Box Kasus
  doc.setFillColor(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2])
  doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
  doc.rect(margin, y, contentWidth, 24, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
  doc.text(`NOMOR KASUS : ${investigationCase.caseNumber || investigationCase.id}`, margin + 4, y + 6)
  doc.text(`STATUS KASUS: ${investigationCase.status} (${investigationCase.mode})`, margin + 110, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const caseTitleLines = doc.splitTextToSize(`JUDUL: ${investigationCase.title}`, contentWidth - 8)
  doc.text(caseTitleLines, margin + 4, y + 13)

  doc.setFontSize(8)
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
  doc.text(`Operator: ${operatorIdentity} | Dibuat: ${new Date(investigationCase.createdAt).toLocaleString('id-ID')}`, margin + 4, y + 20)

  y += 28

  // ══════════════════════════════════════════════════════════════════════════
  // 2. RINGKASAN EKSEKUTIF KASUS
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.summary) {
    checkPageBreak(35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text('I. RINGKASAN EKSEKUTIF KASUS', margin, y)
    y += 5

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
    const summaryText = investigationCase.summary || 'Tidak ada ringkasan deskriptif yang dicatat untuk kasus ini.'
    const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 8)
    const boxHeight = Math.max(16, summaryLines.length * 4.5 + 8)

    doc.rect(margin, y, contentWidth, boxHeight, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
    doc.text(summaryLines, margin + 4, y + 6)
    y += boxHeight + 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. KONTEKS RADAR & PROVENANCE SUMBER PUBLIKASI
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.radarContext && radarItems.length > 0) {
    checkPageBreak(35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text(`II. KONTEKS RADAR BERITA & PROVENANCE SUMBER (${radarItems.length} Publikasi)`, margin, y)
    y += 5

    for (const item of radarItems.slice(0, 5)) {
      checkPageBreak(18)
      doc.setFillColor(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2])
      doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
      doc.rect(margin, y, contentWidth, 16, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
      const claimText = item.claim || (item as unknown as { title?: string }).title || 'Untitled Publication'
      const title = doc.splitTextToSize(`[${item.cluster || 'RADAR'}] ${claimText}`, contentWidth - 8)
      doc.text(title[0] || '', margin + 3, y + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
      const publisher = item.officialSource || (item as unknown as { source?: string }).source || 'Independen'
      const verdict = item.verdict || 'UNVERIFIED'
      const observedDate = item.publishedDate || (item as unknown as { fetchedAt?: string }).fetchedAt || item.detectedAt
      const provInfo = `Penerbit: ${publisher} | Vonis Awal: ${verdict} | First Observed: ${observedDate ? new Date(observedDate).toLocaleString('id-ID') : 'Terkurasi'}`
      doc.text(provInfo, margin + 3, y + 11)
      y += 18
    }
    y += 3
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. ASESMEN KLAIM & ANALISIS KOGNITIF
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.claims) {
    checkPageBreak(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text(`III. ASESMEN KLAIM & ANALISIS KOGNITIF (${claims.length} Klaim, ${assessments.length} Asesmen)`, margin, y)
    y += 5

    if (claims.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
      doc.text('Belum ada klaim atomik terdaftar untuk investigasi ini.', margin, y + 4)
      y += 10
    } else {
      for (const clm of claims.slice(0, 5)) {
        checkPageBreak(20)
        const relAssessments = assessments.filter(a => a.claimId === clm.id)
        const verdictStr = relAssessments.length > 0 ? relAssessments.map(a => a.verdict).join(', ') : clm.status

        doc.setFillColor(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2])
        doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
        doc.rect(margin, y, contentWidth, 18, 'FD')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
        const claimLine = doc.splitTextToSize(`[${clm.id}] ${clm.claimText}`, contentWidth - 8)
        doc.text(claimLine[0] || '', margin + 3, y + 5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
        const assessmentSummary = relAssessments.length > 0
          ? `Vonis: ${verdictStr} | Penilai: ${relAssessments[0].assessedBy || 'Analis'} | Rationale: ${relAssessments[0].rationale || 'N/A'}`
          : `Status: ${clm.status} | Ekstraksi: ${clm.extractionMethod}`
        const metaLine = doc.splitTextToSize(assessmentSummary, contentWidth - 8)
        doc.text(metaLine[0] || '', margin + 3, y + 12)
        y += 21
      }
      y += 2
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. BUKU BESAR BUKTI DIGITAL (EVIDENCE LEDGER) & INTEGRITAS FORENSIK
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.evidenceLedger) {
    checkPageBreak(35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text(`IV. BUKU BESAR BUKTI DIGITAL FORENSIK (${evidenceRecords.length} Berkas Bukti)`, margin, y)
    y += 5

    if (evidenceRecords.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
      doc.text('Belum ada berkas bukti digital yang terhubung ke kasus investigasi ini.', margin, y + 4)
      y += 10
    } else {
      // Header Tabel Bukti
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, y, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
      doc.text('ID BUKTI', margin + 2, y + 5)
      doc.text('METODE INGESTI', margin + 28, y + 5)
      doc.text('WAKTU PENCEGATAN', margin + 68, y + 5)
      doc.text('STATUS INTEGRITAS', margin + 112, y + 5)
      doc.text('SHA-256 DIGEST (MANIFEST)', margin + 145, y + 5)
      y += 8

      for (const ev of evidenceRecords) {
        checkPageBreak(12)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])

        doc.text(ev.id, margin + 2, y + 4)
        doc.text(ev.extractionMethod || 'MANUAL', margin + 28, y + 4)
        const ts = ev.submittedAt || ev.createdAt || ev.observedAt || new Date().toISOString()
        doc.text(new Date(ts).toLocaleString('id-ID'), margin + 68, y + 4)

        const statusLabel = ev.verificationStatus || 'UNVERIFIED'
        if (statusLabel === 'VERIFIED') {
          doc.setTextColor(16, 185, 129) // Emerald green
        } else if (statusLabel === 'REJECTED') {
          doc.setTextColor(239, 68, 68) // Red
        } else {
          doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
        }
        doc.text(statusLabel, margin + 112, y + 4)

        doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
        const digest = ev.contentHashNormalized || ev.contentHashOriginal || (ev.hashes && ev.hashes[0]?.digest) || 'NONE'
        const shortHash = digest.length > 16 ? `${digest.slice(0, 16)}...` : digest
        doc.text(shortHash, margin + 145, y + 4)

        doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
        doc.setLineWidth(0.15)
        doc.line(margin, y + 6, pageWidth - margin, y + 6)
        y += 7
      }

      // Disclaimer Integritas Hash
      checkPageBreak(10)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
      doc.text('Catatan Integritas: Kesesuaian SHA-256 membuktikan integritas byte tangkapan layar dan teks sumber, bukan kebenaran faktual konten klaim.', margin, y + 4)
      y += 9
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. SINTESIS COMMENT INTELLIGENCE (ANALISIS MEDIA SOSIAL)
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.commentIntelligence && commentAnalysisRuns.length > 0) {
    checkPageBreak(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text(`V. SINTESIS COMMENT INTELLIGENCE (${commentAnalysisRuns.length} Riwayat Analisis)`, margin, y)
    y += 5

    const latestRun = commentAnalysisRuns[0]
    const batch = commentBatches.find(b => b.id === latestRun.batchId)

    doc.setFillColor(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2])
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
    doc.rect(margin, y, contentWidth, 26, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
    doc.text(`RUN ID: ${latestRun.id} | BATCH: ${batch?.batchLabel || latestRun.batchId}`, margin + 3, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Sampel Masuk: ${latestRun.inputCount} komentar | Berhasil Dianalisis: ${latestRun.analyzedCount} komentar`, margin + 3, y + 12)
    doc.text(`Versi Algoritma: ${latestRun.algorithmVersion} (Leksikon Bahasa Indonesia Offline)`, margin + 3, y + 17)

    const sent = latestRun.sentimentSummary
    const sentSummary = sent
      ? `Distribusi Sentimen: POSITIF ${Math.round((sent.positiveRatio || 0) * 100)}% | NETRAL ${Math.round((sent.neutralRatio || 0) * 100)}% | NEGATIF ${Math.round((sent.negativeRatio || 0) * 100)}% | MIXED/UNCERTAIN ${Math.round(((sent.mixedRatio || 0) + (sent.uncertainRatio || 0)) * 100)}%`
      : 'Distribusi Sentimen: Data tidak tersedia'
    doc.text(sentSummary, margin + 3, y + 22)

    y += 30

    // Metrik Kemiripan, Lonjakan Temporal & Pola Koordinasi
    checkPageBreak(25)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
    doc.rect(margin, y, contentWidth, 20, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
    doc.text('METRIK DETEKSI ANOMALI:', margin + 3, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`• Kluster Copypasta / Near-Duplicate: ${latestRun.similarityGroups.length} grup terdeteksi`, margin + 5, y + 10)
    const burstStatus = latestRun.burstAnalysis?.status || 'N/A'
    const maxBurstRatio = latestRun.burstAnalysis?.detectedBursts?.[0]?.concentrationRatio || 1.0
    doc.text(`• Analisis Temporal (Burst): Status ${burstStatus} (Konsentrasi Rasio: ${maxBurstRatio.toFixed(1)}x)`, margin + 5, y + 14)
    const coordPattern = latestRun.coordinationIndicator?.indicator || latestRun.coordinationIndicator?.summaryRationale || 'TIDAK DITEMUKAN POLA ANOMALI JELAS'
    doc.text(`• Indikator Pola Terkoordinasi: ${coordPattern}`, margin + 5, y + 18)

    y += 24
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. REKAM JEJAK REVIEW & KEPUTUSAN ANALIS
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.humanReview && commentReviewAnnotations.length > 0) {
    checkPageBreak(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text(`VI. REKAM JEJAK REVIEW & KEPUTUSAN ANALIS (${commentReviewAnnotations.length} Catatan)`, margin, y)
    y += 5

    for (const ann of commentReviewAnnotations.slice(0, 5)) {
      checkPageBreak(14)
      doc.setFillColor(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2])
      doc.rect(margin, y, contentWidth, 12, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2])
      doc.text(`[${ann.reviewStatus}] Target: ${ann.targetId}`, margin + 3, y + 4)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
      doc.text(`Catatan Analis: ${ann.reviewerNote || 'Tidak ada catatan'} (${new Date(ann.reviewedAt).toLocaleString('id-ID')})`, margin + 3, y + 9)
      y += 14
    }
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. METODOLOGI & BATASAN PENGGUNAAN
  // ══════════════════════════════════════════════════════════════════════════
  if (includeSections.methodology) {
    checkPageBreak(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2])
    doc.text('VI. BATASAN METODOLOGI & PERNYATAAN KEPATUHAN ETIKA', margin, y)
    y += 4

    const disclaimers = [
      '1. Local-First & Zero Social Scraping: Seluruh analisis komentar dieksekusi secara lokal dan offline dari berkas yang diimpor secara sah. Sistem tidak melakukan scraping otomatis akun media sosial.',
      '2. Anti-Atribusi Parsial: Indikator koordinasi temporal dan copypasta bersifat probabilistik dan tidak boleh dijadikan dasar penetapan identitas pelaku jahat atau aktor botnet secara sepihak.',
      '3. Human-In-The-Loop: Hasil keluaran intelijen kognitif ini merupakan alat bantu asesmen taktis. Setiap tindakan mitigasi wajib divalidasi oleh analis manusia berwenang.'
    ]

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
    for (const d of disclaimers) {
      checkPageBreak(8)
      const lines = doc.splitTextToSize(d, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 3.5 + 1.5
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER & NOMOR HALAMAN LINTAS SELURUH DOKUMEN
  // ══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2])
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2])
    doc.setLineWidth(0.2)
    doc.line(margin, pageHeight - margin + 2, pageWidth - margin, pageHeight - margin + 2)

    doc.text('NARADA COGNITIVE THREAT DEFENSE — DOKUMEN INTELIJEN TERKLASIFIKASI', margin, pageHeight - margin + 6)
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - margin + 6, { align: 'right' })
  }

  // Ekstrak Bytes PDF & Hitung Hash Integritas SHA-256
  const arrayBuffer = doc.output('arraybuffer')
  const pdfBytes = new Uint8Array(arrayBuffer)
  const sha256 = fallbackSHA256(pdfBytes)
  const safeCaseNum = (investigationCase.caseNumber || investigationCase.id).replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `NARADA-Dossier-${safeCaseNum}-${Date.now().toString(36).toUpperCase()}.pdf`

  return {
    pdfBytes,
    filename,
    sha256,
    pageCount: totalPages,
    generatedAt: new Date().toISOString()
  }
}
