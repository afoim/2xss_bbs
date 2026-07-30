/**
 * 构建期生成 `dist/rss.xml` 与 `dist/sitemap.xml`。
 *
 * 主站是 SSR，这两份东西由 `/forum/rss.xml`、`/forum/sitemap.xml` 两条路由**实时**
 * 生成。纯 CSR 没有服务端，只能退到构建期烘一份静态文件 —— 代价是**发新帖后
 * 不会自动更新，要重新构建（或重新触发部署）**。这是从 SSR 换成 CSR 必然要付的
 * 一笔账，不是 bug；接受不了就得在托管侧加一个定时重建。
 *
 * 取数走**公网 API**（主站那两条路由走的是 127.0.0.1:8787，本机才通）。
 * 失败时打印警告并正常退出：CI 里后端偶尔抽风不该把整个部署卡死，
 * 大不了这次少两个文件。
 *
 * 用法：node scripts/build-feeds.mjs   （在 vite build 之后跑，写进 dist/）
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// .env 里的值不会自动进 process.env（那是 Vite 在自己进程里做的事），
// 这里自己读一遍，保证 feeds 里的域名与页面里烘进去的是同一套
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const API = (process.env.VITE_FORUM_API_BASE || "https://i.2x.nz").replace(/\/+$/, "");
const SITE = (process.env.VITE_SITE_URL || "https://bbs.acofork.com").replace(/\/+$/, "");
const BASE = (process.env.VITE_BASE_PATH || "").replace(/\/+$/, "");
const OUT = "dist";
const LIMIT = 200;

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 从 markdown 榨取纯文本摘要（与主站 forum.rss.xml.server.ts 同一套规则） */
const plain = (md, max = 500) =>
  String(md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>~|_-]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const postUrl = (id) => `${SITE}${BASE}/post/${id}`;

async function main() {
  const res = await fetch(`${API}/api/posts?sort_by=time&limit=${LIMIT}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const posts = data.posts || [];

  const items = posts
    .slice(0, 50)
    .map((p) => {
      const link = postUrl(p.id);
      const pubDate = p.created_at ? `\n      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>` : "";
      const author = p.author_name ? `\n      <author>${esc(p.author_name)}</author>` : "";
      const category = p.category_name ? `\n      <category>${esc(p.category_name)}</category>` : "";
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>${pubDate}${author}${category}
      <description>${esc(plain(p.excerpt || p.content))}</description>
    </item>`;
    })
    .join("\n");

  // content-type 由托管商按扩展名给（多半是 application/xml），
  // 订阅的自动发现靠页面里的 <link rel="alternate">，与响应头无关
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>二叉树树论坛</title>
    <link>${esc(SITE + BASE)}/</link>
    <description>二叉树树论坛 - 最新帖子</description>
    <language>zh-CN</language>
    <atom:link href="${esc(SITE + BASE)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  const urls = [
    `  <url>\n    <loc>${esc(SITE + BASE)}/</loc>\n  </url>`,
    ...posts.map((p) => {
      const lm = p.created_at ? `\n    <lastmod>${String(p.created_at).slice(0, 10)}</lastmod>` : "";
      return `  <url>\n    <loc>${esc(postUrl(p.id))}</loc>${lm}\n  </url>`;
    }),
  ].join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "rss.xml"), rss);
  writeFileSync(join(OUT, "sitemap.xml"), sitemap);
  console.log(`[feeds] ${posts.length} 篇帖子 → dist/rss.xml + dist/sitemap.xml`);
}

main().catch((e) => {
  console.warn(`[feeds] 生成失败（跳过，不阻断构建）：${e.message}`);
});
