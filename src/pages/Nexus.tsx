import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import {
  RefreshCw,
  Sparkles,
  Info,
  Filter,
  X,
  Target,
  FileText,
  Radio,
  UserSearch
} from 'lucide-react'
import type { AnalysisResult, ThreatLevel, ContentCategory, NexusNodeType, NexusLinkType } from '../types'
import { getStoredAnalyses } from '../utils/storage'
import { getThreatBadge, getCategoryBadge, truncateText } from '../utils/format'

// ─── D3 Type-Safe Graph Node & Link Interfaces (No 'any') ───
interface D3GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: NexusNodeType
  threatLevel: ThreatLevel
  confidence?: number
  size: number
  category?: ContentCategory
  details?: string
  rawContent?: string
  entities?: string[]
}

interface D3GraphLink extends d3.SimulationLinkDatum<D3GraphNode> {
  source: string | D3GraphNode
  target: string | D3GraphNode
  strength: number
  type: NexusLinkType
}

// ─── Warna Node Berdasarkan Tingkat Ancaman ───
const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
}

// ─── Dataset Demo: Klaster Jaringan Buzzer & Bot Terkoordinasi ───
const BUZZER_DEMO_NODES: D3GraphNode[] = [
  { id: 'b_master', label: '@master_operator_x', type: 'account', threatLevel: 'critical', size: 22, category: 'BUZZER', details: 'Akun pengendali utama (bot master) pengatur jadwal posting serentak.' },
  { id: 'b_cluster', label: 'Klaster Botnet Cyber 01', type: 'cluster', threatLevel: 'critical', size: 26, category: 'BUZZER', details: 'Kumpulan 40+ akun bot anonim dengan kesamaan waktu posting (<3 detik).' },
  { id: 'b_001', label: '@relawan_militan_01', type: 'account', threatLevel: 'high', size: 13, category: 'BUZZER', details: 'Bot amplifikasi tagar #DukungAksiRakyat.' },
  { id: 'b_002', label: '@relawan_militan_02', type: 'account', threatLevel: 'high', size: 13, category: 'BUZZER', details: 'Bot replikasi komentar otomatis.' },
  { id: 'b_003', label: '@suara_rakyat_bebas', type: 'account', threatLevel: 'high', size: 12, category: 'BUZZER', details: 'Akun boneka penyebar tautan selebaran.' },
  { id: 'c_hoax', label: 'Isu: Alutsista Fiktif', type: 'narrative', threatLevel: 'critical', size: 20, category: 'HOAKS', rawContent: 'Dokumen palsu pengadaan alutsista senilai Rp 24 triliun.', entities: ['Kemhan RI', 'TNI AD'] },
  { id: 'c_papua', label: 'Isu: Boikot Teritorial', type: 'narrative', threatLevel: 'critical', size: 18, category: 'PROPAGANDA', rawContent: 'Ajakan pembangkangan sipil terhadap Kodam XVII.', entities: ['Kodam XVII/Cenderawasih'] },
  { id: 'c_post_1', label: 'Konten: Flyer Fitnah WA', type: 'content', threatLevel: 'critical', size: 14, category: 'HOAKS', rawContent: 'Beredar selebaran dokumen rahasia pembelian alutsista fiktif.' },
  { id: 'c_post_2', label: 'Konten: Video Potongan', type: 'content', threatLevel: 'medium', size: 13, category: 'DISINFORMASI', rawContent: 'Video arsip 2019 diklaim baku tembak baru kemarin.' },
  { id: 's_media', label: 'Domain: forum-rakyat.org', type: 'source', threatLevel: 'high', size: 16, category: 'PROPAGANDA', details: 'Situs blog anonim yang kerap mereplikasi selebaran gelap.' },
  { id: 'u_user', label: '@netizen_terprovokasi', type: 'account', threatLevel: 'low', size: 11, category: 'NETRAL', details: 'Akun pengguna sipil asli yang meretweet narasi tanpa menyadari hoaks.' },
  { id: 'u_news', label: 'Portal: detik.com/news', type: 'source', threatLevel: 'low', size: 14, category: 'NETRAL', details: 'Media pers resmi yang merilis berita klarifikasi Dispenad.' },
]

const BUZZER_DEMO_LINKS: D3GraphLink[] = [
  { source: 'b_cluster', target: 'b_master', strength: 0.9, type: 'coordinated' },
  { source: 'b_master', target: 'b_001', strength: 0.85, type: 'coordinated' },
  { source: 'b_master', target: 'b_002', strength: 0.85, type: 'coordinated' },
  { source: 'b_master', target: 'b_003', strength: 0.8, type: 'coordinated' },
  { source: 'b_001', target: 'c_hoax', strength: 0.75, type: 'amplified' },
  { source: 'b_002', target: 'c_hoax', strength: 0.7, type: 'amplified' },
  { source: 'b_003', target: 'c_papua', strength: 0.7, type: 'amplified' },
  { source: 'c_hoax', target: 'c_post_1', strength: 0.8, type: 'similarity' },
  { source: 's_media', target: 'c_post_1', strength: 0.65, type: 'same_source' },
  { source: 's_media', target: 'c_post_2', strength: 0.6, type: 'same_source' },
  { source: 'c_post_1', target: 'u_user', strength: 0.4, type: 'amplified' },
  { source: 'b_master', target: 's_media', strength: 0.5, type: 'coordinated' },
  { source: 'c_hoax', target: 'u_news', strength: 0.35, type: 'similarity' },
  { source: 'b_001', target: 'b_002', strength: 0.6, type: 'coordinated' },
  { source: 'c_papua', target: 'c_post_2', strength: 0.45, type: 'similarity' },
]

/**
 * Membangun node dan link secara dinamis dari riwayat analisis sesi
 */
function buildGraphFromAnalyses(analyses: AnalysisResult[]): { nodes: D3GraphNode[]; links: D3GraphLink[] } {
  if (analyses.length === 0) {
    return { nodes: [], links: [] }
  }

  const nodes: D3GraphNode[] = []
  const links: D3GraphLink[] = []
  const sourcesMap = new Map<string, string>()
  const entitiesMap = new Map<string, string[]>()

  // 1. Buat node konten dari setiap analisis
  analyses.forEach((a) => {
    const nodeSize = a.threatLevel === 'critical' ? 18 : a.threatLevel === 'high' ? 15 : 12

    nodes.push({
      id: a.id,
      label: a.title ? truncateText(a.title, 22) : truncateText(a.input, 20),
      type: 'content',
      threatLevel: a.threatLevel,
      confidence: a.confidence,
      size: nodeSize,
      category: a.category,
      rawContent: a.input,
      entities: a.targetedEntities,
    })

    // Catat entitas untuk klaster narasi
    if (a.targetedEntities && a.targetedEntities.length > 0) {
      a.targetedEntities.forEach((ent) => {
        const list = entitiesMap.get(ent) || []
        list.push(a.id)
        entitiesMap.set(ent, list)
      })
    }

    // Catat sumber media (URL/siteName)
    if (a.sourceMeta?.siteName) {
      const site = a.sourceMeta.siteName
      const sourceId = `src_${site.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

      if (!sourcesMap.has(site)) {
        sourcesMap.set(site, sourceId)
        nodes.push({
          id: sourceId,
          label: site,
          type: 'source',
          threatLevel: a.threatLevel === 'critical' ? 'high' : 'medium',
          size: 14,
          details: `Sumber portal media: ${site}`,
        })
      }

      links.push({
        source: a.id,
        target: sourceId,
        strength: 0.6,
        type: 'same_source',
      })
    }
  })

  // 2. Buat node klaster narasi (jika >= 2 konten menargetkan entitas pertahanan yang sama)
  entitiesMap.forEach((contentIds, entityName) => {
    if (contentIds.length >= 2) {
      const clusterId = `cluster_${entityName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

      nodes.push({
        id: clusterId,
        label: `Isu: ${entityName}`,
        type: 'narrative',
        threatLevel: 'critical',
        size: 22,
        details: `Klaster narasi terarah menargetkan institusi pertahanan ${entityName}`,
        entities: [entityName],
      })

      contentIds.forEach((cId) => {
        links.push({
          source: cId,
          target: clusterId,
          strength: 0.75,
          type: 'similarity',
        })
      })
    }
  })

  // 3. Hubungkan konten yang memiliki kesamaan kata kunci (keyword overlap)
  for (let i = 0; i < analyses.length; i++) {
    for (let j = i + 1; j < analyses.length; j++) {
      const a = analyses[i]
      const b = analyses[j]

      const setA = new Set(a.keywords.map(k => k.toLowerCase()))
      const setB = new Set(b.keywords.map(k => k.toLowerCase()))

      let overlapCount = 0
      setA.forEach((kw) => {
        if (setB.has(kw)) overlapCount++
      })

      const totalUnique = new Set([...setA, ...setB]).size
      const similarityScore = totalUnique > 0 ? overlapCount / totalUnique : 0

      // Jika overlap > 25% atau kategori sama dan memuat kata kunci sama
      if (similarityScore >= 0.25 || (overlapCount >= 1 && a.category === b.category && a.category !== 'NETRAL')) {
        links.push({
          source: a.id,
          target: b.id,
          strength: Math.min(0.9, Math.max(0.4, similarityScore * 1.5)),
          type: 'similarity',
        })
      }
    }
  }

  // 4. Integrasi Jaringan Akun Profiler dari sesi
  try {
    const profilerRaw = sessionStorage.getItem('narada_profiler_accounts')
    if (profilerRaw) {
      const profilerAccounts = JSON.parse(profilerRaw)
      if (Array.isArray(profilerAccounts)) {
        profilerAccounts.forEach((acc: { username: string; botScore: number; postingPattern?: string; flags?: string[]; bio?: string; postsPerDay?: number }) => {
          const accId = `prof_${acc.username.replace(/[^a-zA-Z0-9]/g, '_')}`
          if (!nodes.some(n => n.id === accId)) {
            const tLevel: ThreatLevel = acc.botScore >= 75 ? 'critical' : acc.botScore >= 50 ? 'high' : 'medium'
            nodes.push({
              id: accId,
              label: acc.username,
              type: 'account',
              threatLevel: tLevel,
              size: 14,
              category: 'BUZZER',
              details: `Akun Profiler: Skor Bot ${acc.botScore}%, Pola: ${acc.postingPattern || 'normal'}, Flags: ${acc.flags?.join(', ') || 'None'}`,
              rawContent: acc.bio || `Aktivitas ${acc.postsPerDay || 0} post/hari`,
            })

            // Hubungkan ke klaster narasi terdekat atau node ancaman tertinggi
            const target = nodes.find(n => n.type === 'narrative' || (n.type === 'content' && n.threatLevel === 'critical'))
            if (target) {
              links.push({
                source: accId,
                target: target.id,
                strength: 0.75,
                type: 'coordinated',
              })
            }
          }
        })
      }
    }
  } catch {
    // Abaikan jika parsing gagal
  }

  return { nodes, links }
}

export default function Nexus() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'high_critical'>('all')
  const [useDemoMode, setUseDemoMode] = useState<boolean>(false)
  const [selectedNode, setSelectedNode] = useState<D3GraphNode | null>(null)
  const [analyses, setAnalyses] = useState<AnalysisResult[]>(() => getStoredAnalyses())

  // Hotkey Escape untuk menutup Tactical Inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Dengarkan pembaruan storage
  useEffect(() => {
    const handleUpdate = () => {
      setAnalyses(getStoredAnalyses())
    }
    window.addEventListener('narada:analyses-updated', handleUpdate)
    return () => window.removeEventListener('narada:analyses-updated', handleUpdate)
  }, [])

  // Tentukan nodes dan links aktif
  const { rawNodes, rawLinks } = useMemo(() => {
    if (useDemoMode || analyses.length === 0) {
      return { rawNodes: BUZZER_DEMO_NODES, rawLinks: BUZZER_DEMO_LINKS }
    }
    return {
      rawNodes: buildGraphFromAnalyses(analyses).nodes,
      rawLinks: buildGraphFromAnalyses(analyses).links,
    }
  }, [useDemoMode, analyses])

  // Filter berdasarkan tingkat ancaman
  const filteredNodes = useMemo(() => {
    if (filterLevel === 'all') return rawNodes
    if (filterLevel === 'critical') return rawNodes.filter(n => n.threatLevel === 'critical')
    return rawNodes.filter(n => n.threatLevel === 'critical' || n.threatLevel === 'high')
  }, [rawNodes, filterLevel])

  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    return rawLinks.filter(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target
      return nodeIds.has(srcId) && nodeIds.has(tgtId)
    })
  }, [rawLinks, filteredNodes])

  // D3.js Force Simulation Render
  const renderGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return

    const width = containerRef.current.clientWidth || 800
    const height = 520

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Background Grid
    const defs = svg.append('defs')
    const pattern = defs.append('pattern')
      .attr('id', 'nexus-grid')
      .attr('width', 28)
      .attr('height', 28)
      .attr('patternUnits', 'userSpaceOnUse')

    pattern.append('path')
      .attr('d', 'M 28 0 L 0 0 0 28')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.03)')
      .attr('stroke-width', 1)

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#nexus-grid)')

    // Glow Filter
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Arrow markers
    defs.append('marker')
      .attr('id', 'arrow-head')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 24)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', 'rgba(255,255,255,0.3)')
      .attr('d', 'M0,-5L10,0L0,5')

    const mainGroup = svg.append('g')

    // Zoom & Pan Behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        mainGroup.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior)

    // Salin nodes dan links agar terisolasi dalam simulasi D3
    const simulationNodes: D3GraphNode[] = filteredNodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 240,
      y: height / 2 + (Math.random() - 0.5) * 240,
    }))

    const simulationLinks: D3GraphLink[] = filteredLinks.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
    }))

    // Inisialisasi D3 Force Simulation
    const simulation = d3.forceSimulation<D3GraphNode>(simulationNodes)
      .force('link', d3.forceLink<D3GraphNode, D3GraphLink>(simulationLinks).id(d => d.id).distance(d => 110 / d.strength))
      .force('charge', d3.forceManyBody<D3GraphNode>().strength(-260))
      .force('center', d3.forceCenter<D3GraphNode>(width / 2, height / 2))
      .force('collide', d3.forceCollide<D3GraphNode>().radius(d => d.size + 16))

    // Render Edges (Links)
    const linkSelection = mainGroup.append('g')
      .selectAll('line')
      .data(simulationLinks)
      .join('line')
      .attr('stroke', (d) => {
        if (d.type === 'coordinated') return '#EF4444'
        if (d.type === 'similarity') return '#3B82F6'
        if (d.type === 'amplified') return '#F59E0B'
        return 'rgba(255,255,255,0.2)'
      })
      .attr('stroke-width', d => Math.max(1, d.strength * 2.5))
      .attr('stroke-dasharray', d => d.type === 'same_source' || d.type === 'amplified' ? '4,3' : 'none')
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrow-head)')

    // Render Nodes Group
    const nodeSelection = mainGroup.append('g')
      .selectAll<SVGGElement, D3GraphNode>('g')
      .data(simulationNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: D3GraphNode) => {
        setSelectedNode(d)
      })

    // Drag behavior dengan penanganan strict type
    const dragBehavior = d3.drag<SVGGElement, D3GraphNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, D3GraphNode, D3GraphNode>, d: D3GraphNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, D3GraphNode, D3GraphNode>, d: D3GraphNode) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, D3GraphNode, D3GraphNode>, d: D3GraphNode) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeSelection.call(dragBehavior)

    // Outer Glow Circle
    nodeSelection.append('circle')
      .attr('r', d => d.size + 6)
      .attr('fill', d => THREAT_COLORS[d.threatLevel])
      .attr('opacity', 0.15)
      .attr('filter', 'url(#glow)')

    // Main Circle / Polygon
    nodeSelection.append('circle')
      .attr('r', d => d.size)
      .attr('fill', (d) => {
        const c = THREAT_COLORS[d.threatLevel]
        return d.type === 'cluster' || d.type === 'narrative' ? `${c}50` : `${c}25`
      })
      .attr('stroke', d => THREAT_COLORS[d.threatLevel])
      .attr('stroke-width', d => d.type === 'cluster' || d.type === 'narrative' ? 2.5 : 1.5)

    // Simbol Ikon Tengah
    nodeSelection.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', d => THREAT_COLORS[d.threatLevel])
      .attr('font-size', d => d.size * 0.75)
      .attr('font-weight', '700')
      .text((d) => {
        if (d.type === 'cluster' || d.type === 'narrative') return '◈'
        if (d.type === 'source') return '◆'
        if (d.type === 'account') return '◎'
        return '◉'
      })

    // Label Node Teks
    nodeSelection.append('text')
      .attr('y', d => d.size + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', 9)
      .attr('font-family', 'var(--font-mono)')
      .text(d => truncateText(d.label, 16))

    // Tick listener
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => {
          const src = d.source as D3GraphNode
          return src.x ?? 0
        })
        .attr('y1', (d) => {
          const src = d.source as D3GraphNode
          return src.y ?? 0
        })
        .attr('x2', (d) => {
          const tgt = d.target as D3GraphNode
          return tgt.x ?? 0
        })
        .attr('y2', (d) => {
          const tgt = d.target as D3GraphNode
          return tgt.y ?? 0
        })

      nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [filteredNodes, filteredLinks])

  useEffect(() => {
    const cleanup = renderGraph()
    return () => {
      if (cleanup) cleanup()
    }
  }, [renderGraph])

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── Header Halaman ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: 'var(--narada-red-subtle)',
              color: 'var(--narada-red)',
              border: '1px solid rgba(200, 16, 46, 0.3)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase'
            }}>
              KOGNITIF NETWORK TOPOLOGY
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              D3.JS FORCE SIMULATION
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: '800',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)'
          }}>
            Nexus Narrative & Actor Graph
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Pemetaan jejaring topologi narasi, klaster astroturfing buzzer, dan relasi penyebaran konten disinformasi.
          </p>
        </div>

        {/* Toolbar Tombol Aksi */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${useDemoMode || analyses.length === 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setUseDemoMode(!useDemoMode)}
          >
            <Sparkles size={12} />
            {useDemoMode || analyses.length === 0 ? '✓ Mode Simulasi Buzzer Aktif' : 'Simulasi Jaringan Buzzer'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => renderGraph()}
            title="Reset Fisika Graf"
          >
            <RefreshCw size={12} /> Atur Ulang Posisi
          </button>
        </div>
      </div>

      {/* ─── Kontrol Filter & Statistik Node Bar ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--bg-border)',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Filter Tombol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Filter size={12} /> FILTER ANCAMAN:
          </span>

          <button
            type="button"
            className={`btn btn-sm ${filterLevel === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterLevel('all')}
          >
            Semua ({rawNodes.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterLevel === 'critical' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterLevel('critical')}
          >
            Hanya Kritis ({rawNodes.filter(n => n.threatLevel === 'critical').length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterLevel === 'high_critical' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterLevel('high_critical')}
          >
            Tinggi & Kritis
          </button>
        </div>

        {/* Counter Aktif */}
        <div style={{
          display: 'flex',
          gap: '14px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)'
        }}>
          <span>Nodes: <strong style={{ color: 'var(--text-primary)' }}>{filteredNodes.length}</strong></span>
          <span>Edges: <strong style={{ color: 'var(--accent-blue)' }}>{filteredLinks.length}</strong></span>
          <span>Sumber Data: <strong style={{ color: useDemoMode || analyses.length === 0 ? 'var(--threat-high)' : 'var(--threat-low)' }}>
            {useDemoMode || analyses.length === 0 ? 'SIMULASI BUZZER' : 'SESI ANALISIS NYATA'}
          </strong></span>
        </div>
      </div>

      {/* ─── Kanvas Graf D3 & Sidebar Inspeksi Detail ─── */}
      <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
        {/* Kanvas D3 */}
        <div
          ref={containerRef}
          className="graph-container"
          style={{
            flex: 1,
            height: '520px',
            background: 'var(--bg-base)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Quick Helper Overlay di Pojok Kiri Bawah Kanvas */}
          <div style={{
            position: 'absolute',
            left: '14px',
            bottom: '14px',
            background: 'rgba(10, 14, 26, 0.85)',
            border: '1px solid var(--bg-border)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}>
            🖱 Drag node untuk reposisi · Scroll untuk Zoom in/out · Klik node untuk detail
          </div>
        </div>

        {/* Sidebar Inspeksi Node (Muncul Saat Node Diklik) */}
        {selectedNode && (
          <div
            className="card fade-in"
            style={{
              width: '320px',
              height: '520px',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card)',
              border: `1px solid ${THREAT_COLORS[selectedNode.threatLevel]}40`,
              boxShadow: 'var(--shadow-elevated)'
            }}
          >
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <div style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                letterSpacing: '1px',
                color: THREAT_COLORS[selectedNode.threatLevel],
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Radio size={13} />
                DETAIL SIMPUL (NODE INSPECTOR)
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedNode(null)}
                style={{ padding: '2px 6px' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* Header Label Node */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  color: 'var(--text-muted)',
                  marginBottom: '4px'
                }}>
                  IDENTIFIER / LABEL
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  lineHeight: '1.3'
                }}>
                  {selectedNode.label}
                </div>
              </div>

              {/* Badges Tipe & Ancaman */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase'
                }}>
                  Tipe: {selectedNode.type}
                </span>

                <span
                  className="threat-badge"
                  style={{
                    fontSize: '9px',
                    background: getThreatBadge(selectedNode.threatLevel).bgColor,
                    color: getThreatBadge(selectedNode.threatLevel).color,
                    border: `1px solid ${getThreatBadge(selectedNode.threatLevel).borderColor}`,
                    padding: '2px 8px'
                  }}
                >
                  {selectedNode.threatLevel.toUpperCase()}
                </span>

                {selectedNode.category && (
                  <span
                    className="category-badge"
                    style={{
                      background: getCategoryBadge(selectedNode.category).bgColor,
                      color: getCategoryBadge(selectedNode.category).color,
                      border: `1px solid ${getCategoryBadge(selectedNode.category).color}30`
                    }}
                  >
                    {selectedNode.category}
                  </span>
                )}
              </div>

              {/* Konten Teks / Deskripsi */}
              {(selectedNode.rawContent || selectedNode.details) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <FileText size={11} /> DESKRIPSI KONTEN:
                  </div>
                  <div style={{
                    background: 'var(--bg-elevated)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--bg-border)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6'
                  }}>
                    {selectedNode.rawContent || selectedNode.details}
                  </div>
                </div>
              )}

              {/* Entitas Sasaran */}
              {selectedNode.entities && selectedNode.entities.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Target size={11} color="var(--threat-high)" /> ENTITAS PERTAHANAN SASARAN:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedNode.entities.map(ent => (
                      <span
                        key={ent}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#F87171',
                          border: '1px solid rgba(239, 68, 68, 0.25)'
                        }}
                      >
                        {ent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Score jika ada */}
              {typeof selectedNode.confidence === 'number' && (
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Tingkat Keyakinan AI:
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700',
                    color: THREAT_COLORS[selectedNode.threatLevel]
                  }}>
                    {selectedNode.confidence}%
                  </span>
                </div>
              )}

              {/* ─── Tombol Aksi Taktis Lintas-Alat ─── */}
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '11px', gap: '6px' }}
                  onClick={() => navigate('/reports')}
                >
                  <FileText size={12} />
                  📄 Buat Laporan Intelijen Khusus Node Ini
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '11px', gap: '6px' }}
                  onClick={() => {
                    const raw = selectedNode.label.replace(/^Isu:\s*/i, '').replace(/^Konten:\s*/i, '').replace(/^Domain:\s*/i, '')
                    const targetUser = raw.startsWith('@') ? raw : `@${raw.replace(/\s+/g, '_').toLowerCase()}`
                    navigate(`/profiler?username=${encodeURIComponent(targetUser)}`)
                  }}
                >
                  <UserSearch size={12} />
                  👤 Selidiki Akun di Profiler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Legenda Visual Elemen Graf (Bawah) ─── */}
      <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
        <div style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '1.5px',
          color: 'var(--text-muted)',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Info size={12} /> PANDUAN SIMBOLOGI TOPOLOGI NEXUS
        </div>

        <div className="grid-2" style={{ gap: '16px' }}>
          {/* Bentuk Node */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '6px' }}>
              Bentuk Simpul (Node Types):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: 'var(--narada-red)' }}>◈ Hexagon / Klaster:</strong> Klaster Isu / Kelompok Narasi</span>
              <span><strong style={{ color: 'var(--accent-blue)' }}>◉ Lingkaran:</strong> Naskah Konten Dianalisis</span>
              <span><strong style={{ color: 'var(--threat-medium)' }}>◆ Diamond:</strong> Sumber Portal Berita / Media</span>
              <span><strong style={{ color: 'var(--text-muted)' }}>◎ Cincin:</strong> Akun Media Sosial / Buzzer</span>
            </div>
          </div>

          {/* Garis Edge */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '6px' }}>
              Relasi Penghubung (Edge Links):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: '#3B82F6' }}>─── Garis Solid Biru:</strong> Kesamaan Leksikal / Keyword Overlap</span>
              <span><strong style={{ color: '#EF4444' }}>─── Garis Merah Tebal:</strong> Pola Koordinasi Amplifikasi Buzzer</span>
              <span><strong style={{ color: 'var(--text-muted)' }}>- - - Garis Putus-putus:</strong> Bersumber dari Domain yang Sama</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
