import { create } from 'zustand'

export interface FocusEntry {
  id: string
  name: string
}

const MAX_ENTRIES = 20

interface HistoryState {
  trail: FocusEntry[]
  /** Registra o foco atual. Voltar a alguem que ja esta na trilha corta o que veio depois dela. */
  visit: (entry: FocusEntry) => void
  clear: () => void
}

export const useFocusHistory = create<HistoryState>((set) => ({
  trail: [],
  visit: (entry) =>
    set(({ trail }) => {
      const at = trail.findIndex((e) => e.id === entry.id)
      if (at >= 0) {
        const next = trail.slice(0, at + 1)
        next[at] = entry
        return { trail: next }
      }
      return { trail: [...trail, entry].slice(-MAX_ENTRIES) }
    }),
  clear: () => set({ trail: [] }),
}))
