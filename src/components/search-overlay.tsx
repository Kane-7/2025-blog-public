'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRevealStore } from '@/app/(home)/stores/reveal-store'
import { useSize } from '@/hooks/use-size'
import { REVEAL_EASE } from '@/lib/reveal-utils'

// ---------------- 引擎配置 ----------------
const GoogleIcon = (
	<svg viewBox='0 0 24 24' className='size-[17px]'>
		<path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
		<path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
		<path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' />
		<path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' />
	</svg>
)
const BaiduIcon = (
	<svg viewBox='0 0 24 24' className='size-[17px]'>
		<g fill='#2932E1'>
			<circle cx='12' cy='13.5' r='4.3' />
			<circle cx='5.4' cy='8.2' r='2.6' />
			<circle cx='10.6' cy='6.2' r='2.6' />
			<circle cx='16.8' cy='8.2' r='2.6' />
			<circle cx='19.2' cy='13.8' r='2.1' />
		</g>
	</svg>
)
const BingIcon = (
	<svg viewBox='0 0 24 24' className='size-[17px]'>
		<circle cx='12' cy='12' r='10.5' fill='#008373' />
		<path fill='#fff' d='M9 6.5v11l5.6-2.3c1-.4 1.4-1.5 1-2.5l-2.6-1.1c-1.1-.5-1.6-1.8-1.1-2.9L9 6.5z' />
	</svg>
)

const ENGINES = {
	google: { name: 'Google', url: 'https://www.google.com/search?q=%s', icon: GoogleIcon },
	baidu: { name: '百度', url: 'https://www.baidu.com/#ie=utf-8&wd=%s', icon: BaiduIcon },
	bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s', icon: BingIcon }
} as const

const ENGINE_KEYS = ['google', 'baidu', 'bing'] as const
type EngineKey = (typeof ENGINE_KEYS)[number]

const HISTORY_KEY = 'lemon-search-history'
const ENGINE_KEY = 'lemon-search-engine'
const MAX_HISTORY = 10

// ---------------- localStorage ----------------
function getHistory(): string[] {
	try {
		const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
		return Array.isArray(arr) ? arr : []
	} catch {
		return []
	}
}
function addHistory(text: string) {
	try {
		const arr = getHistory().filter(s => s !== text)
		arr.unshift(text)
		localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)))
	} catch {}
}
function clearHistory() {
	try {
		localStorage.removeItem(HISTORY_KEY)
	} catch {}
}
function getSavedEngine(): string {
	try {
		return localStorage.getItem(ENGINE_KEY) || ''
	} catch {
		return ''
	}
}

// ---------------- 联想请求 ----------------
function fetchJson(url: string, signal: AbortSignal): Promise<any> {
	return fetch(url, { signal }).then(res => {
		if (!res.ok) throw new Error('bad status')
		return res.json()
	})
}

function jsonp(url: string, timeout = 4000): Promise<any> {
	return new Promise((resolve, reject) => {
		const cb = 'ls_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e5)
		const script = document.createElement('script')
		let done = false
		const timer = setTimeout(() => {
			if (!done) {
				done = true
				cleanup()
				reject(new Error('timeout'))
			}
		}, timeout)
		function cleanup() {
			clearTimeout(timer)
			try {
				delete (window as any)[cb]
			} catch {}
			script.parentNode?.removeChild(script)
		}
		;(window as any)[cb] = (data: any) => {
			if (done) return
			done = true
			cleanup()
			resolve(data)
		}
		script.onerror = () => {
			if (done) return
			done = true
			cleanup()
			reject(new Error('jsonp error'))
		}
		script.src = url.replace('{cb}', cb)
		document.head.appendChild(script)
	})
}

async function getSuggest(engine: EngineKey, q: string, signal: AbortSignal): Promise<string[]> {
	switch (engine) {
		case 'google': {
			const d = await fetchJson(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`, signal)
			return Array.isArray(d) && Array.isArray(d[1]) ? d[1] : []
		}
		case 'baidu': {
			const d = await jsonp(`https://suggestion.baidu.com/su?wd=${encodeURIComponent(q)}&ie=utf-8&cb={cb}`)
			return d && Array.isArray(d.s) ? d.s : []
		}
		case 'bing': {
			const d = await fetchJson(`https://api.bing.com/qsonhs.aspx?q=${encodeURIComponent(q)}`, signal)
			return d?.AS?.Results?.[0] ? (d.AS.Results[0].Suggests || []).map((s: any) => s.Txt) : []
		}
	}
}

// ---------------- 组件 ----------------
export default function SearchOverlay() {
	const revealed = useRevealStore(s => s.revealed)
	const searchVisible = useRevealStore(s => s.searchVisible)
	const setSearchVisible = useRevealStore(s => s.setSearchVisible)
	const { maxSM } = useSize()

	const [engine, setEngine] = useState<EngineKey>('google')
	const [query, setQuery] = useState('')
	const [items, setItems] = useState<string[]>([])
	const [activeIndex, setActiveIndex] = useState(-1)
	const [showMenu, setShowMenu] = useState(false)
	const [isHistory, setIsHistory] = useState(false)

	const inputRef = useRef<HTMLInputElement>(null)
	const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const requestSeq = useRef(0)
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	// 进入：UI 飞完(0.7s)后显示搜索框；回退时由 layout 控制 setSearchVisible(false)
	useEffect(() => {
		if (revealed && !maxSM) {
			const t = setTimeout(() => setSearchVisible(true), 400)
			return () => clearTimeout(t)
		} else {
			setSearchVisible(false)
		}
	}, [revealed, maxSM, setSearchVisible])

	// 初始化引擎偏好
	useEffect(() => {
		const saved = getSavedEngine()
		if (saved && (ENGINE_KEYS as readonly string[]).includes(saved)) setEngine(saved as EngineKey)
	}, [])

	// 搜索框出现后自动聚焦
	useEffect(() => {
		if (searchVisible) {
			closeTimer.current = setTimeout(() => inputRef.current?.focus(), 120)
		} else {
			setQuery('')
			setItems([])
			setActiveIndex(-1)
			setShowMenu(false)
		}
		return () => clearTimeout(closeTimer.current!)
	}, [searchVisible])

	const showHistory = useCallback(() => {
		const hist = getHistory()
		setIsHistory(true)
		setItems(hist)
		setActiveIndex(-1)
	}, [])

	const fetchSuggest = useCallback(
		(q: string) => {
			if (suggestTimer.current) clearTimeout(suggestTimer.current)
			abortRef.current?.abort()
			if (q.trim().length < 2) {
				showHistory()
				return
			}
			suggestTimer.current = setTimeout(async () => {
				const seq = ++requestSeq.current
				const ac = new AbortController()
				abortRef.current = ac
				try {
					const results = await getSuggest(engine, q, ac.signal)
					if (seq !== requestSeq.current) return
					setIsHistory(false)
					setItems(results.slice(0, 10))
				} catch {
					if (seq !== requestSeq.current) return
					setItems([])
				}
			}, 300)
		},
		[engine, showHistory]
	)

	const switchEngine = useCallback(
		(key: EngineKey, focus = true) => {
			setEngine(key)
			try {
				localStorage.setItem(ENGINE_KEY, key)
			} catch {}
			if (focus) inputRef.current?.focus()
			if (query.trim().length >= 2) fetchSuggest(query)
		},
		[query, fetchSuggest]
	)

	const doSearch = useCallback(
		(text?: string) => {
			const q = (text || query).trim()
			if (!q) {
				inputRef.current?.focus()
				return
			}
			addHistory(q)
			const url = ENGINES[engine].url.replace('%s', encodeURIComponent(q))
			window.open(url, '_blank', 'noopener,noreferrer')
			setQuery('')
			setItems([])
			setActiveIndex(-1)
		},
		[query, engine]
	)

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			if (items.length) setActiveIndex(i => (i + 1) % items.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			if (items.length) setActiveIndex(i => (i - 1 + items.length) % items.length)
		} else if (e.key === 'Tab') {
			e.preventDefault()
			const idx = ENGINE_KEYS.indexOf(engine)
			switchEngine(ENGINE_KEYS[(idx + 1) % ENGINE_KEYS.length])
		} else if (e.key === 'Escape') {
			setItems([])
			setActiveIndex(-1)
			setShowMenu(false)
		} else if (e.key === 'Enter') {
			const active = activeIndex >= 0 ? items[activeIndex] : undefined
			doSearch(active)
		}
	}

	// 移动端不渲染（与显露桌面一致禁用）
	if (maxSM) return null

	return (
		<AnimatePresence>
			{revealed && (
				<motion.div
					data-search-overlay
					className='pointer-events-none fixed inset-0 z-30 flex items-center justify-center'
					initial={{ opacity: 0 }}
					animate={{ opacity: searchVisible ? 1 : 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}>
					<motion.div
						className='pointer-events-auto w-[min(500px,85vw)]'
						initial={{ opacity: 0, y: -80 }}
						animate={searchVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -280 }}
						transition={searchVisible ? { duration: 0.4, ease: REVEAL_EASE } : { duration: 0.4, ease: REVEAL_EASE }}
						onClick={e => e.stopPropagation()}
						onMouseDown={e => e.stopPropagation()}>
						{/* 搜索框主体 */}
						<div className='flex items-center gap-1 rounded-full border border-white/60 bg-white/70 py-1 pl-1.5 pr-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] backdrop-blur-xl'>
							{/* 引擎切换按钮 */}
							<button
								type='button'
								title='切换搜索引擎'
								onClick={e => {
									e.stopPropagation()
									setShowMenu(v => !v)
								}}
								className='flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/80'>
								{ENGINES[engine].icon}
							</button>
							{/* 输入框 */}
							<input
								ref={inputRef}
								value={query}
								onChange={e => {
									setQuery(e.target.value)
									fetchSuggest(e.target.value)
								}}
								onKeyDown={onKeyDown}
								onFocus={() => {
									setShowMenu(false)
									if (query.trim().length >= 2) fetchSuggest(query)
									else showHistory()
								}}
								placeholder='输入关键词，回车搜索（Tab 切换引擎）'
								className='flex-1 bg-transparent text-center text-[15px] text-primary outline-none transition-[text-align] duration-200 placeholder:text-secondary [&:not(:placeholder-shown)]:text-left [&:focus]:text-left'
							/>
							{/* 提交按钮 */}
							<button
								type='button'
								title='搜索'
								onClick={e => {
									e.stopPropagation()
									const active = activeIndex >= 0 ? items[activeIndex] : undefined
									doSearch(active)
								}}
								className='flex size-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-white/80'>
								<svg viewBox='0 0 24 24' className='size-[17px]' style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}>
									<circle cx='11' cy='11' r='7' />
									<path d='M21 21 L16.5 16.5' />
								</svg>
							</button>
						</div>

						{/* 引擎菜单 */}
						<AnimatePresence>
							{showMenu && (
								<motion.div
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.15 }}
									className='mt-2 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] backdrop-blur-xl'>
									{ENGINE_KEYS.map(k => (
										<button
											key={k}
											type='button'
											onClick={e => {
												e.stopPropagation()
												switchEngine(k)
												setShowMenu(false)
											}}
											className={`flex w-full items-center justify-between rounded-xl px-4 py-2 text-xs transition-colors ${
												k === engine ? 'bg-black/5 text-primary' : 'text-primary hover:bg-black/5'
											}`}>
											<span className='flex items-center gap-2.5'>
												<span className='flex size-[15px] items-center justify-center'>{ENGINES[k].icon}</span>
												{ENGINES[k].name}
											</span>
											{k === engine && <span className='text-[10px] text-secondary'>当前</span>}
										</button>
									))}
									<div className='mt-1 flex h-5 items-center justify-center gap-1 text-[10px] text-secondary'>
										按 <kbd className='rounded border border-current px-1 text-[9px] leading-tight'>Tab</kbd> 切换引擎
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						{/* 联想 / 历史面板 */}
						<AnimatePresence>
							{items.length > 0 && (
								<motion.div
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.15 }}
									className='mt-2 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] backdrop-blur-xl'>
									{items.map((text, i) => (
										<button
											key={text + i}
											type='button'
											onMouseDown={e => {
												e.preventDefault()
												e.stopPropagation()
												doSearch(text)
											}}
											onMouseEnter={() => setActiveIndex(i)}
											className={`block w-full overflow-hidden truncate px-7 py-2 text-left text-[13px] transition-[padding] duration-200 ${
												i === activeIndex ? 'pl-10 bg-black/5 text-primary' : 'text-primary hover:bg-black/5'
											}`}>
											{text}
										</button>
									))}
									{isHistory && (
										<button
											type='button'
											onClick={e => {
												e.stopPropagation()
												clearHistory()
												setItems([])
											}}
											className='flex w-full items-center justify-center gap-1.5 py-2 text-xs text-secondary transition-colors hover:bg-black/5'>
											<svg viewBox='0 0 24 24' className='size-3' style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}>
												<path d='M3 6 L5 6 L21 6' />
												<path d='M8 6 V4 H16 V6' />
												<path d='M19 6 L18 19 H6 L5 6' />
												<path d='M10 10 V15' />
												<path d='M14 10 V15' />
											</svg>
											清空搜索历史
										</button>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
