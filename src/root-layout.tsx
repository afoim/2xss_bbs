import { Outlet, ScrollRestoration, isRouteErrorResponse, useRouteError, Link } from "react-router";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ForumAuthProvider } from "@/lib/forum/stores/auth";
import { Toaster } from "@/components/ui/sonner";
import { CodeCopyListener } from "@/components/code-copy-listener";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SITE_TITLE } from "@/lib/seo/route-meta";
import { useSeo } from "@/lib/seo/use-seo";

declare const __BUILD_LABEL__: string;

/**
 * 全站外壳。
 *
 * **没有全局导航栏是刻意的**：论坛列表页自己就带标题 + 登录/用户菜单，详情页
 * 左上角有「返回论坛」，个人中心和管理页各自带回链。主站那个 SiteHeader 装的是
 * 博客/工具/生图的入口，搬过来只会多出一份重复的登录 UI。
 *
 * ForumAuthProvider 必须包住所有路由：useForumAuth 在列表页、详情页、发帖页、
 * 个人中心里都用得到，少一层就直接抛错（SSR 时代论坛 layout 就栽过这个坑）。
 */
export default function RootLayout() {
  return (
    <ThemeProvider>
      <ForumAuthProvider>
        <div className="flex-1">
          <Outlet />
        </div>
        <SiteFooter />
        <Toaster />
        <CodeCopyListener />
        <ScrollRestoration />
      </ForumAuthProvider>
    </ThemeProvider>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-8 border-t pt-6 pb-8">
      <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} 二叉树树 ·{" "}
          <a href="https://2x.nz" className="underline hover:text-foreground transition-colors">
            返回主站
          </a>
        </p>
        {/* 不要再降透明度：/60 时对比度只有 3.3:1，达不到 WCAG AA 的 4.5:1 */}
        <small className="text-xs">构建时间：{__BUILD_LABEL__}</small>
      </div>
    </footer>
  );
}

/**
 * 首次加载时（根路由的 loader 还没回来）显示的东西。
 *
 * 不给这个组件的话，React Router 会在控制台警告
 * 「No `HydrateFallback` element provided」，页面则是**纯白一片**直到接口返回 ——
 * 这正是 CSR 相对 SSR 最难受的一段，至少要让用户看到「在加载」。
 */
export function HydrateFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        loading forum
      </p>
    </div>
  );
}

/**
 * 路由级错误边界。纯 CSR 下没有服务端渲染 404 这回事：所有未知路径都由
 * `*` 路由接住，这里只处理 loader 抛出的 Response（帖子不存在）和运行时异常。
 */
export function RootErrorBoundary() {
  const error = useRouteError();
  // 错误页不经过任何路由的 useSeo()，标题会停在上一页 —— 自己补一下
  useSeo({ title: "页面出错", description: "请求的页面不存在或加载失败。", noindex: true });
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const message = is404
    ? "这个帖子不存在，或者已经被删除了。"
    : error instanceof Error
      ? error.message
      : "页面出错了，刷新试试。";

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-mono text-5xl font-bold">{is404 ? "404" : "错误"}</h1>
      <p className="mt-4 text-muted-foreground">{message}</p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="outline" size="sm">← 返回{SITE_TITLE}</Button>
      </Link>
    </main>
  );
}
