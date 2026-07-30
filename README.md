# af_forum-frontend —— 二叉树树论坛（独立前端，纯 CSR）

从主站 `af_frontend`（`2x.nz`，React Router 7 服务端全站 SSR）里**整块搬出来**的论坛前端，
改写为**纯客户端渲染的单页应用**，只含论坛路由，可以独立部署到一个子域名上。

- 技术栈：Vite + React 19 + React Router 8（`createBrowserRouter`，库模式）+ Tailwind v4
- 后端**没搬也不用搬**：仍然是 `af_forum-backend`（`https://i.2x.nz`），浏览器直连
- 产物是一堆静态文件（`dist/`），任何静态托管都能放，不需要 Node 进程

---

## 一、先看这三件事

### 1. 后端同时认两个前端（2026-07-31 已配好）

论坛后端（`https://i.2x.nz`，不在本仓库）原先把 `https://2x.nz/forum/...` 写死在邮件、
通知和跳转里。现在它按一份**前端地址清单**工作：

```
FORUM_FRONTEND_BASES = "https://2x.nz/forum,https://bbs.acofork.com"
```

哪些是真「同时」、哪些只能选一个，这点要分清：

- **GitHub OAuth 回跳白名单**是真同时生效：清单里每个域名发起的登录都能跳回自己。
  部署到清单外的域名时，登录会被**静默**丢回默认地址 —— 不报错，只是回错站，很难查。
- **邮件 / QQ 通知 / 邮箱验证后的跳转只能指向一个域名**，用清单第一项。
  想把用户导向本站，就把本站挪到第一位。

由此产生的一条硬约定，写新代码时照着来：

> **站内路径一律写成 `/post/19`、`/auth/login`（不带 `/forum`）**，前缀由 base 提供。
> 在别处再拼一次 `/forum`，就会变成 `bbs.acofork.com/forum/post/19`。

另外，后端会把 OAuth 回跳地址补成**带尾斜杠**的 `/auth/login/`。本项目的路由匹配容忍
尾斜杠，`#token=` 能正常带回来（已实测）—— 别为了「URL 规范形态」去改后端那行，
当初加它就是为了防止跳转把 hash 里的 token 弄丢。

CORS 不需要任何配置：后端对所有接口回 `Access-Control-Allow-Origin: *`，鉴权走
`Authorization` 头而不是 Cookie，所以跨域直连没有额外条件。

### 2. 纯 CSR 相比原来的 SSR，确实丢了这些东西

不是 bug，是这次改造的必然代价，列在这里免得以后当成故障排查：

- **不执行 JS 的抓取工具只能看到 `index.html` 里那份兜底 meta**。原来每篇帖子的
  title / description / canonical / og:image / `DiscussionForumPosting` 结构化数据都是服务端直出的，
  现在全部由 `src/lib/seo/apply-seo.ts` 在浏览器里注入。Googlebot 会执行 JS，多数社交平台的
  抓取器不会 —— 分享链接的卡片会退化成站点默认图和默认描述。
- **首屏是一段 loading**（`HydrateFallback`），要等 JS 下载完 + 接口返回才有内容。
  原来 SSR 首屏就是完整 HTML。
- **禁用 JS 完全不可用**。原项目把「无 JS 可用性」当硬指标（分页是真链接、展开用 `<details>`、
  评论排序是链接而不是按钮），这些写法**都原样保留着** —— 有 JS 时它们仍然更好，
  哪天想加回 SSR 也不用重写 —— 但没有服务端渲染，首帧就没有 HTML，谈不上可用。
- **RSS / sitemap 从「实时生成」变成「构建期烘一份」**（`scripts/build-feeds.mjs`）。
  发新帖后不会自动更新，要重新构建/触发部署。介意的话在托管侧挂个定时重建。
- **404 的状态码永远是 200**：静态托管对所有路径回同一份 `index.html`，
  「不存在」是浏览器里的路由判定出来的。

### 3. 站内路径不带 `/forum` 前缀

代码里一律写裸路径（`/post/19`、`/auth/login`、`/me`），部署前缀由
`VITE_BASE_PATH` + React Router 的 `basename` 统一补（见 `src/lib/base-path.ts`）。

- 默认空 → 部署在子域名根：`bbs.acofork.com/post/19`
- 设成 `/forum` → 与主站老 URL 完全一致：`example.com/forum/post/19`

绕过路由的地方（`window.location.href`、发给后端的 OAuth 绝对回跳地址）要用
`withBase()` / `absUrl()` 手动补 —— 已经补好了，新增代码时别忘。

---

## 二、跑起来

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # → dist/
npm run preview    # 本地验产物
npm run typecheck
```

`dev` / `build` 都会先跑 `scripts/build-icon-subset.mjs`：它扫源码里出现的图标名，
从 `@iconify-json/*` 抽出一份离线子集（`src/lib/icons/subset.json`，已 gitignore）。
**不要改成运行时向 Iconify API 拉图标** —— 那正是当初图标全空的原因。

### 环境变量（`.env`，全部会被打进前端产物，不要放密钥）

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_BASE_PATH` | 空 | 部署基路径。同时决定 Vite 的 `base` 和路由的 `basename`，**只有这一个开关** |
| `VITE_SITE_URL` | `https://bbs.acofork.com` | 本站对外地址，用于 canonical / og:url / JSON-LD / feeds。**部署前必须改成真实域名** |
| `VITE_FORUM_API_BASE` | `https://i.2x.nz` | 论坛后端。本地联调后端时可改成 `http://127.0.0.1:8787` |
| `VITE_THUMB_BASE` | `https://2x.nz` | 头像/封面缩略图服务（主站 VPS 上的 `thumbs.js`）。留空 = 不改写，直接用原图 |
| `VITE_OG_IMAGE` | 主站官方图 | 分享卡片默认图 |

> Git Bash 里传 `VITE_BASE_PATH=/forum` 记得 `export MSYS_NO_PATHCONV=1`，
> 否则 MSYS 会把 `/forum` 改写成 `C:/Users/.../forum`，构建出来的资源路径全是错的。

---

## 三、部署

产物是纯静态文件，**唯一的硬要求是 SPA 回退**：任何未命中静态文件的路径都返回
`index.html`（状态码 200）。少了它，直接访问 `/post/19` 或按 F5 就是托管商的 404 ——
首页能开、深链全挂，是这类站最典型的翻车方式。

- **Cloudflare Pages / Netlify**：`public/_redirects` 已经写好，直接用
- **nginx**：`location / { try_files $uri /index.html; }`
- **Caddy**：`try_files {path} /index.html`
- **EdgeOne / 其它 CDN**：找「SPA 回退 / 404 重写到 /index.html（200）」那个开关

另外两条建议：

- `assets/` 下是带内容哈希的文件，可以 `immutable` 长缓存；`index.html`、`rss.xml`、
  `sitemap.xml` 必须短缓存或不缓存，否则发了新版访客还拿着旧的 HTML 引用已删掉的 chunk。
- 别在 CDN 侧构建。同一份提交在本地能构建、在托管商的构建器上挂掉的事发生过，
  日志还是 minified 的，定位成本极高 —— 放到 GitHub Actions 里构建，把 `dist/` 推上去。

---

## 四、目录结构（以及每样东西是从哪儿搬来的）

```
index.html                  首帧兜底 meta（爬虫只看得到这一份）
src/
  main.tsx                  入口：createRoot + RouterProvider
  router.tsx                路由表（只有论坛路由，全部 lazy 分包）
  root-layout.tsx           外壳：ThemeProvider + ForumAuthProvider + Toaster + 页脚
                            + HydrateFallback（首屏 loading）+ ErrorBoundary（404/报错页）
  pages/                    ★ 本项目新写的一层：路由模块（loader + Component + SEO）
    forum-list.tsx            列表页 loader（原 app/routes/forum_.server.ts，搬进浏览器）
    post-detail.tsx           详情页 loader（原 app/routes/forum.post.$id.server.ts）
    ...                       其余页面都是薄包装：useSeo() + 复用下面的原版组件
  app/forum/                原样搬自主站 src/app/forum/**，UI 一行没改
    page.tsx                  列表页（搜索/分类/排序/分页仍是 GET 表单和真链接）
    post/post-content.tsx     帖子正文 + 评论树 + 编辑/删除/点赞
    me/ admin/ auth/ u/       个人中心、管理面板、登录注册找回重置、用户主页占位
  components/               只搬了论坛用得到的：ui/*、markdown 编辑器、图片灯箱、
                            mermaid、分页、返回列表、TOC、TOTP 弹窗、环境切换器…
  lib/
    base-path.ts            ★ 新增：部署前缀的唯一来源
    forum/                  原样搬自主站 src/lib/forum/**（API client / 类型 / 映射 / 鉴权 store）
    seo/                    route-meta.ts 按论坛裁剪过；apply-seo.ts 原样
    render-markdown.ts      markdown-it + highlight.js，按需动态加载
scripts/
  build-icon-subset.mjs     构建期图标子集
  build-feeds.mjs           构建期生成 dist/rss.xml + dist/sitemap.xml
```

### 相对主站版本，代码上真正改动的地方

只有这几处，其余都是原样搬运：

1. **路径去掉 `/forum` 前缀**，改由 `basename` 补（`src/lib/base-path.ts`）。
2. **API 不再走同源代理**。主站在 `root.tsx` 里往 `localStorage` 写过
   `forum-api-base-url = '/forum'`（走 `/forum/api/* → 127.0.0.1:8787` 的反代）。
   这里 `getBaseUrl()` 会**丢弃路径形式的旧值**，只认 `http(s)://` 开头的 —— 不这么做的话，
   老用户浏览器里那条残留会让所有接口打到本站不存在的 `/forum/api/...` 上。
3. **缩略图改成绝对地址**（`src/lib/cover-thumb.ts`）：`/thumb` 端点在主站 VPS 上，
   子域名下写相对路径就是 404。博客封面用的 `coverThumb()` 与论坛无关，没搬。
4. **两个 loader 从服务端搬进浏览器**：列表页、详情页。详情页的正文 HTML 现在在 loader 里
   就渲染好 —— 目录侧栏要先有 HTML 才能抽标题，留给组件渲染的话首帧目录永远是空的。
   评论则不预渲染，`CommentItem` 用同一个（已缓存的）渲染器自己渲。
5. **SEO 从路由 `meta()` 换成 `useSeo()` 副作用**（`src/lib/seo/use-seo.ts`）。
6. **没有全局导航栏**，理由见 `root-layout.tsx` 里的注释：列表页自己就带标题和用户菜单，
   再来一个 header 只会多出一份重复的登录 UI。

### 没搬 / 搬了但没接线的

- `post-like-button.tsx`：SSR 时代的补丁（服务端拿不到登录态，水合后补拉点赞状态）。
  CSR 下 loader 自带鉴权头，`liked` 一次就是对的，没用了 —— **已删**。
- `use-comment-stream.ts`（SSE 实时评论）：后端 `SSEHub` Durable Object 是真的存在且在跑的，
  但主站前端从来没接线。**搬过来了，仍未接线**，想做实时评论直接用它，别重写后端。
- 主站的 `/forum/api/*` 反向代理路由：CSR 直连后端，不需要。
- 主站 `SiteHeader` / `Footer` / Cookie 横幅 / Umami 脚本注入：那些是站点级设施。
  `src/lib/track.ts` 搬过来了（论坛的发帖/评论/点赞/搜索埋点都挂在 API client 上），
  但**没有引入 umami 的 script.js** —— 没有它时 `track()` 会静静排队 10 秒然后放弃，
  不报错。要埋点就在 `index.html` 里加上那行 script。
