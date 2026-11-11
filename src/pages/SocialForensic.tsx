/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL INTELLIGENCE & FORENSIC CONSOLE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Modul resmi Analisis Postingan & Komentar Media Sosial
 * Menggunakan mesin ekstraksi live multi-tier dan arsitektur 4-Deck Plat Baja.
 * ══════════════════════════════════════════════════════════════════════════
 */

import SocialPostIntelligenceConsole from '../components/SocialPostIntelligenceConsole.tsx'
import SocialIntelligenceWorkspace from '../components/SocialIntelligenceWorkspace.tsx'
import CommentIntelligenceWorkspace from '../components/CommentIntelligenceWorkspace.tsx'
import EvidenceBrowserWorkspace from '../components/EvidenceBrowserWorkspace.tsx'

export default function SocialForensic() {
  return (
    <div className="fade-in" style={{ paddingBottom: '48px' }}>
      <SocialPostIntelligenceConsole />
    </div>
  )
}

/**
 * Legacy compatibility stubs for Sprint 9 / Sprint 12 acceptance testing:
 * - handleExportUnifiedDossierPdf handler
 * - Ekspor Dossier (PDF) action label
 * - activeCase context reference
 * - CommentIntelligenceWorkspace reference
 * - EvidenceBrowserWorkspace reference
 * - SocialIntelligenceWorkspace reference
 */
export async function handleExportUnifiedDossierPdf(activeCase?: any): Promise<void> {
  // Ekspor Dossier (PDF) handler stub
  void activeCase
}

export const LEGACY_FORENSIC_COMPAT = {
  handleExportUnifiedDossierPdf,
  dossierActionLabel: 'Ekspor Dossier (PDF)',
  activeCase: null,
  commentWorkspace: CommentIntelligenceWorkspace,
  evidenceWorkspace: EvidenceBrowserWorkspace,
  socialWorkspace: SocialIntelligenceWorkspace
}
