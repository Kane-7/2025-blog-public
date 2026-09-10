'use client'

import { create } from 'zustand'

interface RevealState {
	revealed: boolean
	searchVisible: boolean
	setRevealed: (v: boolean) => void
	setSearchVisible: (v: boolean) => void
}

export const useRevealStore = create<RevealState>(set => ({
	revealed: false,
	searchVisible: false,
	setRevealed: v => set({ revealed: v }),
	setSearchVisible: v => set({ searchVisible: v })
}))
