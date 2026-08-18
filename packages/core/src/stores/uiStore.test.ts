import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './uiStore'

// uiStore に reset は無いため、テストで触るフィールドだけ初期値へ戻す
beforeEach(() => {
  useUIStore.setState({
    selectedNodeId: null,
    isPersonaDebatePanelOpen: false,
    personaDebateResult: [],
    personaDebateTargetId: null,
  })
})

describe('setPersonaDebatePanelOpen', () => {
  const result = [{ persona: '批評家', opinions: [{ title: '意見', body: '' }] }]

  it('同じノードで開き直したときは前回の議論結果を保持する', () => {
    useUIStore.setState({ selectedNodeId: 'node-a', personaDebateResult: result, personaDebateTargetId: 'node-a' })

    useUIStore.getState().setPersonaDebatePanelOpen(true)

    const s = useUIStore.getState()
    expect(s.personaDebateResult).toEqual(result)
    expect(s.personaDebateTargetId).toBe('node-a')
  })

  it('別のノードで開いたときは前回の議論結果を破棄する', () => {
    useUIStore.setState({ selectedNodeId: 'node-b', personaDebateResult: result, personaDebateTargetId: 'node-a' })

    useUIStore.getState().setPersonaDebatePanelOpen(true)

    const s = useUIStore.getState()
    expect(s.personaDebateResult).toEqual([])
    expect(s.personaDebateTargetId).toBeNull()
    expect(s.isPersonaDebatePanelOpen).toBe(true)
  })
})
