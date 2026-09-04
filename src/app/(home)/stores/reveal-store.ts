'use client'

import { create } from 'zustand'

interface RevealState {
	revealed: boolean
	toggle: () => void
	setRevealed: (v: boolean) => void
}

export const useRevealStore = create<RevealState>((set, get) => ({
	revealed: false,
	toggle: () => set({ revealed: !get().revealed }),
	setRevealed: v => set({ revealed: v })
}))
