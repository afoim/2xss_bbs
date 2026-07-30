import { createBrowserRouter } from "react-router";
import RootLayout, { RootErrorBoundary, HydrateFallback } from "./root-layout";
import { ROUTER_BASENAME } from "./lib/base-path";

/**
 * 路由表 —— **只有论坛**，没有博客/工具/生图那些路由。
 *
 * 全部走浏览器端数据路由（`createBrowserRouter`）：loader 跑在浏览器里，
 * 不存在服务端渲染，但 `<Link>`、`<Form method="get">`、`useNavigation()`
 * 这些数据路由 API 全部照旧可用 —— 页面组件因此几乎原样搬了过来，
 * 翻页/搜索/排序仍然是真链接和 GET 表单，只是这回由客户端 loader 取数。
 *
 * 路径一律**不带部署前缀**，前缀由 basename 统一补（见 lib/base-path.ts）。
 *
 * 懒加载的模块导出的是「路由模块」形状（`Component` / `loader` / `ErrorBoundary`），
 * 这样每条路由一个 chunk，管理页、个人中心、编辑器不会压在首屏里。
 */
export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: RootLayout,
      ErrorBoundary: RootErrorBoundary,
      HydrateFallback,
      children: [
        { index: true, lazy: () => import("./pages/forum-list") },
        // /post/new 必须排在 /post/:id 前面，否则 "new" 会被当成帖子 id
        { path: "post/new", lazy: () => import("./pages/post-new") },
        { path: "post/:id", lazy: () => import("./pages/post-detail") },
        { path: "auth/login", lazy: () => import("./pages/auth-login") },
        { path: "auth/register", lazy: () => import("./pages/auth-register") },
        { path: "auth/forgot-password", lazy: () => import("./pages/auth-forgot-password") },
        { path: "auth/reset-password", lazy: () => import("./pages/auth-reset-password") },
        { path: "me", lazy: () => import("./pages/me") },
        { path: "u", lazy: () => import("./pages/user") },
        { path: "admin", lazy: () => import("./pages/admin") },
        { path: "*", lazy: () => import("./pages/not-found") },
      ],
    },
  ],
  { basename: ROUTER_BASENAME },
);
