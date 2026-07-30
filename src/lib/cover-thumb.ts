/**
 * 论坛配图（头像 / 帖子封面）的缩略图 URL 改写。
 *
 * 后端把 S3 上的裸 key 重写成公开 URL 后，头像原图动辄一两百 KB，却只显示成
 * 20~28 像素；帖子封面同理（抽样 8 张合计 721KB，显示成 112×84）。真正的缩放
 * 由**主站 VPS 上的 thumbs.js** 做（`/thumb/<宽度>?u=<原图URL>` + 磁盘缓存）。
 *
 * 与主站版本的唯一差别：这里必须拼**绝对地址**。主站上 `/thumb` 与页面同源，
 * 独立子域名上没有这个端点，写成相对路径就是 404。地址由 `VITE_THUMB_BASE`
 * 给出；留空则关闭改写、直接用原图（功能不受影响，只是流量大）。
 *
 * 宽度白名单在服务端（thumbs.js 的 `WIDTHS`），**两边必须一致** ——
 * 不在白名单里会被 302 回原图，白改一场。
 * 域名白名单也在服务端（`REMOTE_HOSTS`）：前端校验挡不住直接构造请求的人，
 * 真正的防线只有服务端那一道；不在名单里的 URL 服务端回 400，所以这里保持
 * 原样返回、不改写更安全。
 */

const THUMB_BASE = (import.meta.env.VITE_THUMB_BASE || '').replace(/\/+$/, '');

/** 与 thumbs.js 的 WIDTHS 白名单对应 */
export type ThumbWidth = 64 | 192 | 288;

const REMOTE_THUMB_HOSTS = ['ny-1s.enzonix.com'];

export function remoteThumb(url: string, width: ThumbWidth = 288): string {
  if (!THUMB_BASE) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !REMOTE_THUMB_HOSTS.includes(u.hostname)) return url;
    return `${THUMB_BASE}/thumb/${width}?u=${encodeURIComponent(url)}`;
  } catch {
    return url; // 相对路径或畸形 URL，原样返回
  }
}
