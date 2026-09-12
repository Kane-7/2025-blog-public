import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import fs from 'node:fs'
import path from 'node:path'
import siteContent from '@/config/site-content.json'

export const dynamic = 'force-dynamic'

const BLOG_SLUG_KEY = process.env.BLOG_SLUG_KEY || ''

// 每天同一 slug 的限流窗口（毫秒）。保留原后端一天一赞的行为。
const DAILY_WINDOW = 24 * 60 * 60 * 1000
// 限流次数记录 key，存「上次点赞时间戳」
const KEY_PREFIX = 'like:'
const LOCK_PREFIX = 'like:lock:'

interface LikeResult {
	count: number
	reason?: 'rate_limited'
}

function normalizeKey(slug: string): string {
	// 空 slug 走默认：站点 username
	const safeSlug = slug || siteContent.meta?.username || 'kane'
	return `${KEY_PREFIX}${BLOG_SLUG_KEY}${safeSlug}`
}

function normalizeLockKey(slug: string): string {
	return `${LOCK_PREFIX}${BLOG_SLUG_KEY}${slug}`
}

// ---- KV 是否可用（Vercel 上会注入 KV_URL 等环境变量）----
const kvConfigured = Boolean(process.env.KV_URL && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

// ---- 没有 KV 时的本地降级：写到一个临时文件，保证本地 dev 也能计数 ----
const TMP_FILE = path.join(process.cwd(), '.datalike-local.json')

function localRead(): Record<string, { count: number; lastAt: number }> {
	try {
		return JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'))
	} catch {
		return {}
	}
}

function localWrite(data: Record<string, { count: number; lastAt: number }>) {
	try {
		fs.writeFileSync(TMP_FILE, JSON.stringify(data), 'utf-8')
	} catch {
		// ignore
	}
}

async function getCount(slug: string): Promise<number> {
	if (kvConfigured) {
		const val = await kv.get<number>(normalizeKey(slug))
		return typeof val === 'number' ? val : 0
	}
	const data = localRead()
	return data[slug]?.count ?? 0
}

async function recordLike(slug: string): Promise<LikeResult> {
	const lockKey = normalizeLockKey(slug)
	const now = Date.now()

	if (kvConfigured) {
		// 限流检查：同 slug 24h 内只能赞一次
		const lastAt = await kv.get<number>(lockKey)
		if (lastAt && now - lastAt < DAILY_WINDOW) {
			const count = (await getCount(slug)) || 0
			return { count, reason: 'rate_limited' }
		}
		const prev = (await getCount(slug)) || 0
		const next = prev + 1
		await kv.set(normalizeKey(slug), next)
		await kv.set(lockKey, now)
		return { count: next }
	}

	// 本地降级
	const data = localRead()
	const rec = data[slug]
	if (rec && now - rec.lastAt < DAILY_WINDOW) {
		return { count: rec.count, reason: 'rate_limited' }
	}
	const next = (rec?.count ?? 0) + 1
	data[slug] = { count: next, lastAt: now }
	localWrite(data)
	return { count: next }
}

export async function GET(req: NextRequest) {
	const slug = decodeURIComponent(req.nextUrl.searchParams.get('slug') || '')
	const count = await getCount(slug || siteContent.meta?.username || 'kane')
	return NextResponse.json({ count })
}

export async function POST(req: NextRequest) {
	const slug = decodeURIComponent(req.nextUrl.searchParams.get('slug') || '')
	const result = await recordLike(slug || siteContent.meta?.username || 'kane')
	return NextResponse.json(result)
}