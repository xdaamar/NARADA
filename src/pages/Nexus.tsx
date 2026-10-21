import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Network, RefreshCw } from 'lucide-react'
import type { NetworkNode, NetworkLink, ThreatLevel } from '../types'

// ─── Demo Network Data ───
const DEMO_NODES: NetworkNode[] = [
  { id: 'n1', label: '@master_operator', type: 'account', threatLevel: 'critical', size: 20 },
  { id: 'n2', label: '@bot_001', type: 'account', threatLevel: 'high', size: 12 },
  { id: 'n3', label: '@bot_002', type: 'account', threatLevel: 'high', size: 12 },
  { id: 'n4', label: '@bot_003', type: 'account', threatLevel: 'high', size: 10 },
  { id: 'n5', label: '@amplifier_a', type: 'account', threatLevel: 'medium', size: 14 },
  { id: 'n6', label: '@amplifier_b', type: 'account', threatLevel: 'medium', size: 14 },
  { id: 'c1', label: 'Narasi: Anti-TNI', type: 'content', threatLevel: 'critical', size: 18 },
  { id: 'c2', label: 'Narasi: Hoaks Kebijakan', type: 'content', threatLevel: 'high', size: 15 },
  { id: 'c3', label: 'Konten: Provokasi', type: 'content', threatLevel: 'high', size: 13 },
  { id: 'cl1', label: 'Kluster Bot Utama', type: 'cluster', threatLevel: 'critical', size: 22 },
  { id: 'n7', label: '@normal_user', type: 'account', threatLevel: 'low', size: 10 },
  { id: 'n8', label: '@korban_spread', type: 'account', threatLevel: 'low', size: 10 },
]

const DEMO_LINKS: NetworkLink[] = [
  { source: 'cl1', target: 'n1', strength: 0.9, type: 'coordinated' },
  { source: 'n1', target: 'n2', strength: 0.85, type: 'coordinated' },
  { source: 'n1', target: 'n3', strength: 0.85, type: 'coordinated' },
  { source: 'n1', target: 'n4', strength: 0.8, type: 'coordinated' },
  { source: 'n2', target: 'c1', strength: 0.7, type: 'created' },
  { source: 'n3', target: 'c2', strength: 0.7, type: 'created' },
  { source: 'n4', target: 'c3', strength: 0.65, type: 'created' },
  { source: 'n5', target: 'c1', strength: 0.6, type: 'amplified' },
  { source: 'n5', target: 'c2', strength: 0.5, type: 'amplified' },
  { source: 'n6', target: 'c1', strength: 0.55, type: 'amplified' },
  { source: 'n6', target: 'c3', strength: 0.5, type: 'amplified' },
  { source: 'n1', target: 'n5', strength: 0.6, type: 'coordinated' },
  { source: 'n1', target: 'n6', strength: 0.6, type: 'coordinated' },
  { source: 'c1', target: 'n7', strength: 0.3, type: 'amplified' },
  { source: 'c2', target: 'n8', strength: 0.3, type: 'amplified' },
]

// ─── Node Colors ───
const THREAT_NODE_COLOR: Record<ThreatLevel, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
}

// ─── D3 Network Graph ───
function D3Network({ nodes, links }: { nodes: NetworkNode[]; links: NetworkLink[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const w = containerRef.current.clientWidth
    const h = 480

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', w).attr('height', h)

    // Background grid
    const defs = svg.append('defs')
    const pattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 30).attr('height', 30)
      .attr('patternUnits', 'userSpaceOnUse')

    pattern.append('path')
      .attr('d', 'M 30 0 L 0 0 0 30')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.03)')
      .attr('stroke-width', 1)

    svg.append('rect').attr('width', w).attr('height', h).attr('fill', 'url(#grid)')

    // Arrowhead marker
    defs.append('marker')
      .attr('id', 'arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 25).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', 'rgba(255,255,255,0.2)')
      .attr('d', 'M0,-5L10,0L0,5')

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom as any)

    // Force simulation
    const simNodes = nodes.map(n => ({ ...n, x: w/2 + (Math.random()-0.5)*200, y: h/2 + (Math.random()-0.5)*200 }))
    const simLinks = links.map(l => ({ ...l }))

    const simulation = d3.forceSimulation(simNodes as any)
      .force('link', d3.forceLink(simLinks as any).id((d: any) => d.id).distance((d: any) => 100 / d.strength))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(w/2, h/2))
      .force('collision', d3.forceCollide().radius((d: any) => (d.size || 12) + 10))

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d: any) => d.type === 'coordinated' ? '#EF4444' : d.type === 'created' ? '#F97316' : '#3B82F6')
      .attr('stroke-opacity', (d: any) => d.strength * 0.6)
      .attr('stroke-width', (d: any) => d.strength * 2)
      .attr('stroke-dasharray', (d: any) => d.type === 'amplified' ? '4,2' : 'none')
      .attr('marker-end', 'url(#arrow)')

    // Node groups
    const node = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )

    // Glow circles
    node.append('circle')
      .attr('r', (d: any) => (d.size || 12) + 6)
      .attr('fill', (d: any) => THREAT_NODE_COLOR[d.threatLevel as ThreatLevel])
      .attr('opacity', 0.12)

    // Main circles
    node.append('circle')
      .attr('r', (d: any) => d.size || 12)
      .attr('fill', (d: any) => {
        const c = THREAT_NODE_COLOR[d.threatLevel as ThreatLevel]
        return d.type === 'cluster' ? `${c}40` : `${c}25`
      })
      .attr('stroke', (d: any) => THREAT_NODE_COLOR[d.threatLevel as ThreatLevel])
      .attr('stroke-width', (d: any) => d.type === 'cluster' ? 2.5 : 1.5)

    // Node type icons (text)
    node.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', (d: any) => THREAT_NODE_COLOR[d.threatLevel as ThreatLevel])
      .attr('font-size', (d: any) => (d.size || 12) * 0.7)
      .text((d: any) => d.type === 'cluster' ? '◈' : d.type === 'content' ? '◉' : '◎')

    // Labels
    node.append('text')
      .attr('y', (d: any) => (d.size || 12) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.55)')
      .attr('font-size', 9)
      .attr('font-family', '"JetBrains Mono", monospace')
      .text((d: any) => d.label.length > 18 ? d.label.substring(0, 16) + '…' : d.label)

    // Tick update
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [nodes, links])

  return (
    <div ref={containerRef} className="graph-container">
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// ─── Nexus Page ───
export default function Nexus() {
  const [loaded, setLoaded] = useState(false)
  const [selectedType, setSelectedType] = useState<'all' | 'critical' | 'high'>('all')

  const filteredNodes = selectedType === 'all' 
    ? DEMO_NODES 
    : DEMO_NODES.filter(n => n.threatLevel === selectedType || n.threatLevel === 'critical')

  const filteredLinks = DEMO_LINKS.filter(l => 
    filteredNodes.some(n => n.id === l.source) && filteredNodes.some(n => n.id === l.target)
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          NARADA Nexus
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Peta jaringan interaktif — visualisasi hubungan aktor, konten, dan narasi ancaman
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'critical', 'high'] as const).map(t => (
            <button
              key={t}
              className={`btn btn-sm ${selectedType === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedType(t); setLoaded(false); setTimeout(() => setLoaded(true), 100) }}
            >
              {t === 'all' ? 'Semua Node' : `Level ${t.toUpperCase()}`}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { setLoaded(false); setTimeout(() => setLoaded(true), 100) }}>
          <RefreshCw size={12} />
          Reset Layout
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Scroll = zoom · Drag = pan · Drag node = reposisi
          </span>
        </div>
      </div>

      {/* Graph */}
      {!loaded ? (
        <div className="card" style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="loading-dots" style={{ marginBottom: '12px' }}><span /><span /><span /></div>
            <button className="btn btn-primary" onClick={() => setLoaded(true)}>
              <Network size={14} />
              Tampilkan Peta Jaringan
            </button>
          </div>
        </div>
      ) : (
        <D3Network nodes={filteredNodes} links={filteredLinks} />
      )}

      {/* Legend */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-body" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label" style={{ marginBottom: '8px' }}>TIPE NODE</div>
            {[
              { symbol: '◈', label: 'Kluster Bot', color: '#EF4444' },
              { symbol: '◎', label: 'Akun', color: '#F59E0B' },
              { symbol: '◉', label: 'Konten/Narasi', color: '#3B82F6' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: l.color, fontSize: '14px' }}>{l.symbol}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="stat-label" style={{ marginBottom: '8px' }}>LEVEL ANCAMAN NODE</div>
            {[
              { color: '#EF4444', label: 'Critical' },
              { color: '#F97316', label: 'High' },
              { color: '#F59E0B', label: 'Medium' },
              { color: '#22C55E', label: 'Low' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="stat-label" style={{ marginBottom: '8px' }}>TIPE LINK</div>
            {[
              { color: '#EF4444', dash: 'none', label: 'Koordinasi' },
              { color: '#F97316', dash: '4,2', label: 'Pembuatan Konten' },
              { color: '#3B82F6', dash: '4,2', label: 'Amplifikasi' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <svg width="24" height="8">
                  <line x1="0" y1="4" x2="24" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash} />
                </svg>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="stat-label" style={{ marginBottom: '8px' }}>STATISTIK</div>
            {[
              { label: 'Total Node', value: filteredNodes.length },
              { label: 'Total Link', value: filteredLinks.length },
              { label: 'Node Kritis', value: filteredNodes.filter(n => n.threatLevel === 'critical').length },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
