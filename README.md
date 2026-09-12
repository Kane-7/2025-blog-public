# Kane 的个人博客

一个简洁、优雅的个人博客网站，基于 Next.js 构建，支持桌面端 macOS Reveal Desktop 显露桌面效果与移动端自适应。

## 特性

- **显露桌面效果（桌面端）**：点击页面背景墙纸，全部 UI 组件平滑向四周滑出，露出完整背景图并唤出搜索框；再次点击背景，组件平滑归位
- **搜索框**：支持 Google / 百度 / Bing 切换、输入联想、搜索历史
- **响应式布局**：移动端自动禁用显露桌面与搜索框，保证体验
- **GitHub 管理内容**：通过 GitHub App 管理博客文章与站点内容
- **点赞功能**：自托管计数接口，支持每日限流

## 技术栈

- [Next.js](https://nextjs.org/) 16（Turbopack）
- React 19 + TypeScript
- [Zustand](https://github.com/pmndrs/zustand)（状态管理）
- [Framer Motion](https://motion.dev/)（动画）
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)（点赞计数存储）

## 本地开发

```bash
# 安装依赖（推荐使用 pnpm）
pnpm install

# 启动开发服务器（端口 2025）
pnpm dev
```

访问 http://localhost:2025 查看。

## 生产构建

```bash
pnpm build     # 构建
pnpm start     # 启动
```

## 点赞功能

点赞计数接口位于 `src/app/api/like/route.ts`，使用 Vercel KV 存储。需要构建时在 Vercel 上配置以下环境变量：

- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

未配置 KV 时，本地开发会降级为写入临时文件的计数方式，便于调试。

## 站点配置

站点内容与背景图等配置集中在 `src/config/site-content.json`。

## 版权

© 2026 Kane. 本仓库基于原作者项目改写，详见 LICENSE。