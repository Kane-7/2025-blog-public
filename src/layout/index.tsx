'use client'
import { PropsWithChildren, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCenterInit } from '@/hooks/use-center'
import BlurredBubblesBackground from './backgrounds/blurred-bubbles'
import NavCard from '@/components/nav-card'
import { Toaster } from 'sonner'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useSize, useSizeInit } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useRevealStore } from '@/app/(home)/stores/reveal-store'
import { ScrollTopButton } from '@/components/scroll-top-button'
import MusicCard from '@/components/music-card'
import SearchOverlay from '@/components/search-overlay'

export default function Layout({ children }: PropsWithChildren) {
	useCenterInit()
	useSizeInit()
	const { cardStyles, siteContent, regenerateKey } = useConfigStore()
	const { maxSM, init } = useSize()
	const setRevealed = useRevealStore(state => state.setRevealed)
	const setSearchVisible = useRevealStore(state => state.setSearchVisible)
	const pathname = usePathname()
	const isHome = pathname === '/'

	// 切换页面时退出「显露桌面」状态,避免状态跨页面残留
	useEffect(() => {
		setRevealed(false)
	}, [pathname, setRevealed])

	const backgroundImages = (siteContent.backgroundImages ?? []) as Array<{ id: string; url: string }>
	const currentBackgroundImageId = siteContent.currentBackgroundImageId
	const currentBackgroundImage =
		currentBackgroundImageId && currentBackgroundImageId.trim() ? backgroundImages.find(item => item.id === currentBackgroundImageId) : null

	return (
		<>
			<Toaster
				position='bottom-right'
				richColors
				icons={{
					success: <CircleCheckIcon className='size-4' />,
					info: <InfoIcon className='size-4' />,
					warning: <TriangleAlertIcon className='size-4' />,
					error: <OctagonXIcon className='size-4' />,
					loading: <Loader2Icon className='size-4 animate-spin' />
				}}
				style={
					{
						'--border-radius': '12px'
					} as React.CSSProperties
				}
			/>
			{currentBackgroundImage && (
				<div
					className='fixed inset-0 z-0 overflow-hidden'
					style={{
						backgroundImage: `url(${currentBackgroundImage.url})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					}}
				/>
			)}
			<BlurredBubblesBackground colors={siteContent.backgroundColors} regenerateKey={regenerateKey} />

			<main
				className='relative z-10 h-full'
				onClick={e => {
					if (maxSM || !isHome) return
					// 点击落在任意卡片内则不触发,只有点空白背景才「显露桌面」
					if ((e.target as HTMLElement).closest('.card')) return
					// 点击搜索框本体不触发回退（组件内已 stopPropagation,此处为双保险）
					if ((e.target as HTMLElement).closest('[data-search-overlay]')) return
					const { revealed } = useRevealStore.getState()
					if (!revealed) {
						// 进入:UI 飞走,搜索框延迟 0.7s 后由组件自动显示
						setRevealed(true)
					} else {
						// 回退:搜索框先向上滑出,0.4s 后 UI 平滑回来
						setSearchVisible(false)
						window.setTimeout(() => setRevealed(false), 400)
					}
				}}>
					{children}
					<NavCard />

					{!maxSM && cardStyles.musicCard?.enabled !== false && <MusicCard />}
				<SearchOverlay />
			</main>

			{maxSM && init && <ScrollTopButton className='bg-brand/20 fixed right-6 bottom-8 z-50 shadow-md' />}
		</>
	)
}
