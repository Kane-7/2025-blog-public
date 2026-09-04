'use client'

import { useRevealStore } from '@/app/(home)/stores/reveal-store'
import { useCenterStore } from '@/hooks/use-center'
import { useSize } from '@/hooks/use-size'

// 柔和减速曲线(easeOutQuint 风格)
export const REVEAL_EASE = [0.22, 1, 0.36, 1] as const

// 计算卡片向屏幕外飞出的偏移量:沿「卡片中心 → 屏幕中心」反方向推出
export function getRevealOffset(x: number, y: number, width: number, height: number | undefined, centerX: number, centerY: number) {
	const h = height ?? width
	const cardCenterX = x + width / 2
	const cardCenterY = y + h / 2
	// 卡片相对屏幕中心的方向向量
	let dx = cardCenterX - centerX
	let dy = cardCenterY - centerY
	const dist = Math.sqrt(dx * dx + dy * dy)
	if (dist < 1) {
		// 正中心位置:默认向上飞出
		dx = 0
		dy = -1
	} else {
		dx /= dist
		dy /= dist
	}
	// 出屏距离 = 屏幕半对角线 + 卡片半尺寸,确保完全离开视口
	const halfDiag = Math.sqrt(centerX * centerX + centerY * centerY)
	const cardHalf = Math.max(width, h) / 2
	const flyDist = halfDiag + cardHalf + 80
	return { offsetX: dx * flyDist, offsetY: dy * flyDist }
}

// 统一 hook:返回当前组件在 reveal 状态下的出屏偏移
export function useRevealOffset(x: number, y: number, width: number, height?: number) {
	const revealed = useRevealStore(state => state.revealed)
	const { x: centerX, y: centerY } = useCenterStore()
	const { maxSM } = useSize()
	const applyReveal = revealed && !maxSM
	return applyReveal ? getRevealOffset(x, y, width, height, centerX, centerY) : { offsetX: 0, offsetY: 0 }
}
