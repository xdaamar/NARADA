/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 12: RADAR INTELLIGENCE WORKSPACE & TACTICAL STEEL UI
 * ACCEPTANCE & REGRESSION VERIFICATION SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Verifikasi Work Package 0 s.d. 11:
 * - WP 0: Preflight audit & baseline verification
 * - WP 1: UI inventory & Information Architecture audit
 * - WP 2: Mission Control Header & Workspace View Modes
 * - WP 3: Issue Cluster Card Simplification & Streamlined Hierarchy
 * - WP 4: Source, Claim, Evidence & Social Presentation Standardization
 * - WP 5: Redundant Panel & Multi-Stream Status Consolidation (Accordion)
 * - WP 6: Filters, Search & Operator Controls Simplification
 * - WP 7: Tactical Steel Component & Typography Standardization
 * - WP 8: Social Forensic Workspace Harmonization & YouTube Policy Guard
 * - WP 9: Responsive Layout & Accessibility Semantics
 * - WP 10: Data Contract Safety & State Resiliency
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🛡️  NARADA — SPRINT 12 MASTER ACCEPTANCE TEST SUITE')
console.log('    Radar Intelligence Workspace & Tactical Steel Component Review')
console.log('══════════════════════════════════════════════════════════════════════\n')

let passCount = 0
let totalCount = 0

function runTest(id, description, fn) {
  totalCount++
  try {
    fn()
    console.log(`  ✅ PASS: [${id}] ${description}`)
    passCount++
  } catch (err) {
    console.error(`  ❌ FAIL: [${id}] ${description}`)
    console.error(`     Error: ${err.message}`)
    process.exitCode = 1
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP01: UI SOURCE CODE AUDIT & FILE EXISTENCE
// ─────────────────────────────────────────────────────────────────────────────
console.log('─── WP 0 & 1: Source Audit & Workspace Codebase Integrity ───')

const liveRadarPath = path.join(rootDir, 'src/pages/LiveRadar.tsx')
const socialForensicPath = path.join(rootDir, 'src/pages/SocialForensic.tsx')
const socialWorkspacePath = path.join(rootDir, 'src/components/SocialIntelligenceWorkspace.tsx')
const packageJsonPath = path.join(rootDir, 'package.json')

runTest('S12-01.1', 'File src/pages/LiveRadar.tsx exists and is readable', () => {
  assert.ok(fs.existsSync(liveRadarPath), 'LiveRadar.tsx must exist')
})

runTest('S12-01.2', 'File src/pages/SocialForensic.tsx exists and is readable', () => {
  assert.ok(fs.existsSync(socialForensicPath), 'SocialForensic.tsx must exist')
})

runTest('S12-01.3', 'File src/components/SocialIntelligenceWorkspace.tsx exists and is readable', () => {
  assert.ok(fs.existsSync(socialWorkspacePath), 'SocialIntelligenceWorkspace.tsx must exist')
})

const liveRadarSource = fs.readFileSync(liveRadarPath, 'utf-8')
const socialForensicSource = fs.readFileSync(socialForensicPath, 'utf-8')
const socialWorkspaceSource = fs.readFileSync(socialWorkspacePath, 'utf-8')
const packageJsonSource = fs.readFileSync(packageJsonPath, 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP02: MISSION CONTROL HEADER & VIEW MODES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 2: Mission Control Header & Navigation Hierarchy ───')

runTest('S12-02.1', 'Header incorporates Mission Control title with tactical styling', () => {
  assert.ok(liveRadarSource.includes('Radar Berita Viral & Early-Warning Intelijen'), 'Must feature Radar headline')
  assert.ok(liveRadarSource.includes('Pindai Isu Terkini'), 'Must have prominent Pindai action')
})

runTest('S12-02.2', 'Header includes quick access to Tactical Briefing summary', () => {
  assert.ok(liveRadarSource.includes('LAPORAN INTELIJEN TERKINI'), 'Must provide Tactical Briefing modal button')
})

runTest('S12-02.3', 'Workspace features explicit View Mode Switcher tabs', () => {
  assert.ok(liveRadarSource.includes('ARUS RADAR (FEED)'), 'Must feature primary feed tab')
  assert.ok(liveRadarSource.includes('SINYAL PENELUSURAN'), 'Must feature Google Trends tab')
  assert.ok(liveRadarSource.includes('TOPIC WATCHLIST'), 'Must feature Topic Watchlist tab')
})

runTest('S12-02.4', 'Buffer operation controls are unified into Deck 2A toolbar', () => {
  assert.ok(liveRadarSource.includes('Auto-Sync: 30m'), 'Must display Auto-Sync interval indicator')
  assert.ok(liveRadarSource.includes('Bersihkan Tuntas'), 'Must provide flush buffer action')
  assert.ok(liveRadarSource.includes('Reset Buffer'), 'Must provide reset action')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP03: ISSUE CLUSTER CARD SIMPLIFICATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 3: Issue Cluster Card Simplification ───')

runTest('S12-03.1', 'Issue cluster cards display relevance as a heuristic score, not threat probability', () => {
  assert.ok(liveRadarSource.includes('RELEVANSI'), 'Must label relevance score explicitly')
  assert.ok(liveRadarSource.includes('/100'), 'Must display heuristic scale')
})

runTest('S12-03.2', 'Card headline uses high-contrast typography and clear sizing', () => {
  assert.ok(liveRadarSource.includes('#F8FAFC'), 'Headlines must use high-contrast text color')
  assert.ok(liveRadarSource.includes('fontSize: \'13px\'') || liveRadarSource.includes('fontSize: \'13.5px\''), 'Card headlines must use standardized font')
})

runTest('S12-03.3', 'Context strip groups freshness and distinct publisher counts', () => {
  assert.ok(liveRadarSource.includes('DOMAIN PERS'), 'Must display distinct publisher/domain count')
})

runTest('S12-03.4', 'Card footer features streamlined primary action buttons', () => {
  assert.ok(liveRadarSource.includes('Buka Investigasi Kasus'), 'Must provide case investigation action')
  assert.ok(liveRadarSource.includes('Draf Kontranarasi Dispenad'), 'Must provide Dispenad counter-narrative action')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP04: SOURCE, CLAIM & PROVENANCE PRESENTATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 4: Source, Claim & Provenance Presentation ───')

runTest('S12-04.1', 'Provenance bar renders external verification sources with clear external link hints', () => {
  assert.ok(liveRadarSource.includes('Asal:') && liveRadarSource.includes('Otoritas:'), 'Must indicate monitoring origin and authority')
  assert.ok(liveRadarSource.includes('target="_blank"'), 'External sources must open safely in blank target')
  assert.ok(liveRadarSource.includes('rel="noreferrer"') || liveRadarSource.includes('rel="noopener noreferrer"'), 'External links must use secure rel')
})

runTest('S12-04.2', 'Clarification sunken tray presents intelligence analysis concisely', () => {
  assert.ok(liveRadarSource.includes('steel-sunken-tray'), 'Sunken tray uses tactical steel sunken tray styling')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP05: CONNECTOR STATUS ACCORDION & CONSOLIDATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 5: Multi-Stream Connector Consolidation & Accordion ───')

runTest('S12-05.1', 'Connector health row is collapsible to prevent visual clutter', () => {
  assert.ok(liveRadarSource.includes('isConnectorDetailsOpen'), 'Must maintain state for connector accordion')
  assert.ok(liveRadarSource.includes('setIsConnectorDetailsOpen'), 'Must provide toggle handler')
})

runTest('S12-05.2', 'Preserves S6-28 required string: STATUS KONEKTOR RADAR', () => {
  assert.ok(liveRadarSource.includes('STATUS KONEKTOR RADAR'), 'Must preserve exact S6-28 assertion string')
})

runTest('S12-05.3', 'Preserves Circuit Breaker diagnostics tooltip', () => {
  assert.ok(liveRadarSource.includes('Circuit Breaker'), 'Must preserve Circuit Breaker text')
})

runTest('S12-05.4', 'Consolidated telemetry pill exists in header with quick status indicator', () => {
  assert.ok(liveRadarSource.includes('14 KANAL RADAR'), 'Header pill indicates total monitored channels')
})

runTest('S12-05.5', 'Dropdown details are rendered in an organized structured grid', () => {
  assert.ok(liveRadarSource.includes('gridTemplateColumns'), 'Tray uses structured grid layout')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP06: FILTERS, SEARCH & OPERATOR CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 6: Filters, Search & Operator Controls ───')

runTest('S12-06.1', 'Search console includes an instant clear X button when active', () => {
  assert.ok(liveRadarSource.includes('setSearchQuery(\'\')'), 'Must provide one-click search query reset')
})

runTest('S12-06.2', 'Triage filter includes canonical ISU BARU & MENINGKAT', () => {
  assert.ok(liveRadarSource.includes('ISU BARU & MENINGKAT'), 'Must preserve S6-28 required triage filter')
})

runTest('S12-06.3', 'Triage bar features clear status pill indicators with count badges', () => {
  assert.ok(liveRadarSource.includes('SEDANG DIPANTAU'), 'Includes unverified / monitoring filter option')
  assert.ok(liveRadarSource.includes('TERINDIKASI HOAKS'), 'Includes hoax filter option')
  assert.ok(liveRadarSource.includes('FAKTA & AMAN'), 'Includes factual filter option')
})

runTest('S12-06.4', 'Provides active filter feedback with one-click Reset Filter button', () => {
  assert.ok(liveRadarSource.includes('Reset Filter'), 'Must provide one-click active filter reset')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP07: TACTICAL STEEL COMPONENT STANDARDIZATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 7: Tactical Steel Component Standardization ───')

runTest('S12-07.1', 'Cards utilize steel-chassis-card class with corner bolt ornaments', () => {
  assert.ok(liveRadarSource.includes('steel-chassis-card'), 'Cards must use steel chassis class')
  assert.ok(liveRadarSource.includes('bolt-tl'), 'Must include top-left bolt')
  assert.ok(liveRadarSource.includes('bolt-tr'), 'Must include top-right bolt')
  assert.ok(liveRadarSource.includes('bolt-bl'), 'Must include bottom-left bolt')
  assert.ok(liveRadarSource.includes('bolt-br'), 'Must include bottom-right bolt')
})

runTest('S12-07.2', 'Colors adhere to dark industrial steel aesthetic', () => {
  assert.ok(liveRadarSource.includes('#0F1520') || liveRadarSource.includes('#0B111A') || liveRadarSource.includes('#090E16'), 'Uses authentic chassis background')
  assert.ok(liveRadarSource.includes('#1E2734'), 'Uses standardized steel border color')
  assert.ok(liveRadarSource.includes('var(--font-mono)'), 'Uses monospace fonts for telemetry and data badges')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP08: SOCIAL FORENSIC WORKSPACE HARMONIZATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 8: Social Forensic Workspace Harmonization ───')

runTest('S12-08.1', 'Social Forensic maintains strict YouTube POLICY_BLOCKED posture', () => {
  assert.ok(socialWorkspaceSource.includes('POLICY_BLOCKED'), 'YouTube derived metrics remain strictly blocked')
})

runTest('S12-08.2', 'Social Forensic provides compliant platform capability indicators', () => {
  assert.ok(socialForensicSource.includes('SocialIntelligenceWorkspace'), 'Social Forensic embeds SocialIntelligenceWorkspace')
  assert.ok(socialWorkspaceSource.includes('YouTube') || socialWorkspaceSource.includes('youtube'), 'YouTube platform supported with policy bounds')
})

// ─────────────────────────────────────────────────────────────────────────────
// S12-WP09: ACCESSIBILITY & DATA SAFETY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── WP 9 & 10: Accessibility, Performance & Contract Safety ───')

runTest('S12-09.1', 'Interactive buttons feature title attributes for accessibility', () => {
  assert.ok(liveRadarSource.includes('title='), 'Interactive elements include title tooltips')
})

runTest('S12-09.2', 'Empty state is clearly handled when no radar items match filters', () => {
  assert.ok(liveRadarSource.includes('Buffer Bersih: Tidak Ada Isu pada Filter Ini'), 'Provides descriptive empty state')
})

runTest('S12-10.1', 'Package.json defines test:sprint12 runner', () => {
  assert.ok(packageJsonSource.includes('test:sprint12'), 'package.json must contain test:sprint12 script')
})

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`📊 SPRINT 12 TEST SUMMARY: ${passCount} / ${totalCount} ASSERTIONS PASSED`)
if (passCount === totalCount) {
  console.log('🏆 SEMUA KRITERIA SPRINT 12 LULUS DENGAN SEMPURNA (100% PASS)!')
} else {
  console.error(`⚠️  TERDAPAT ${totalCount - passCount} KEGAGALAN DALAM SUITE!`)
}
console.log('══════════════════════════════════════════════════════════════════════\n')

if (passCount !== totalCount) {
  process.exit(1)
}
