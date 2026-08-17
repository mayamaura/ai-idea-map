import { describe, expect, it } from 'vitest'
import { MAP_TEMPLATES, getMapTemplate } from './mapTemplates'

describe('mapTemplates', () => {
  it('テンプレートIDは一意で、getMapTemplate で引ける', () => {
    const ids = MAP_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of MAP_TEMPLATES) {
      expect(getMapTemplate(t.id)).toBe(t)
    }
    expect(getMapTemplate('unknown')).toBeUndefined()
  })

  it.each(MAP_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s: ノードIDが一意で、エッジは実在ノードのみを参照する',
    (_id, t) => {
      const nodeIds = new Set(t.nodes.map((n) => n.id))
      expect(nodeIds.size).toBe(t.nodes.length)
      const edgeIds = new Set(t.edges.map((e) => e.id))
      expect(edgeIds.size).toBe(t.edges.length)
      for (const e of t.edges) {
        expect(nodeIds.has(e.source)).toBe(true)
        expect(nodeIds.has(e.target)).toBe(true)
      }
    }
  )

  it.each(MAP_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s: ノード矩形（192x64想定）が重ならない',
    (_id, t) => {
      for (let i = 0; i < t.nodes.length; i++) {
        for (let j = i + 1; j < t.nodes.length; j++) {
          const a = t.nodes[i]
          const b = t.nodes[j]
          const overlaps = Math.abs(a.x - b.x) < 192 && Math.abs(a.y - b.y) < 64
          expect(overlaps, `${a.id} と ${b.id} が重なっている`).toBe(false)
        }
      }
    }
  )

  it('全ノードにタイトルと書き方の説明（body）がある', () => {
    for (const t of MAP_TEMPLATES) {
      for (const n of t.nodes) {
        expect(n.title.length).toBeGreaterThan(0)
        expect(n.body ?? '').not.toBe('')
      }
    }
  })
})
