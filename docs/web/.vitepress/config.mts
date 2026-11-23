import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitepress";

// GitHub Pages 的项目站点挂在 /<repo>/ 下, 本地/自托管又应该在根路径。
// 用 DOCS_BASE 环境变量切换, 免得为部署单独维护一份配置。
const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  base,
  title: "Axon",
  description: "用 Python 写后端、用 Web 写界面的混合桌面框架",
  lang: "zh-CN",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "指南", link: "/guide/quickstart" },
      { text: "可交互示例", link: "/examples/call" },
      { text: "API", link: "/api/javascript" },
    ],
    sidebar: [
      {
        text: "开始",
        items: [
          { text: "快速开始", link: "/guide/quickstart" },
          { text: "架构与消息流", link: "/guide/architecture" },
          { text: "双模式（有/无 Python 后台）", link: "/guide/dual-mode" },
        ],
      },
      {
        text: "可交互示例",
        items: [
          { text: "调用 Python 方法", link: "/examples/call" },
          { text: "读写 Python 属性", link: "/examples/property" },
          { text: "从 Python 调 JS", link: "/examples/py-to-js" },
          { text: "事件", link: "/examples/event" },
          { text: "跨端 Store", link: "/examples/store" },
          { text: "魔法窗口（调 Qt UI）", link: "/examples/magicgui" },
          { text: "广播（发往所有窗口）", link: "/examples/broadcast" },
        ],
      },
      {
        text: "API",
        items: [
          { text: "JavaScript 端", link: "/api/javascript" },
          { text: "Python 端", link: "/api/python" },
        ],
      },
      {
        text: "附录",
        items: [
          { text: "接口验证记录", link: "/notes/verified" },
          { text: "已知坑与修复", link: "/notes/pitfalls" },
        ],
      },
    ],
    outline: { label: "本页目录", level: [2, 3] },
    docFooter: { prev: "上一页", next: "下一页" },
    darkModeSwitchLabel: "主题",
    sidebarMenuLabel: "目录",
    returnToTopLabel: "回到顶部",
    lastUpdated: { text: "最后更新" },
    search: { provider: "local" },
  },
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg` }],
  ],
  vite: {
    resolve: {
      alias: {
        // 直接吃 core-js 的 TS 源码: 改库不用先 build，文档即刻生效
        "axon-gui": fileURLToPath(
          new URL("../../../core-js/lib/index.ts", import.meta.url),
        ),
      },
    },
    // 源码在 docs/web 之外，dev server 要显式放行
    server: {
      fs: { allow: [fileURLToPath(new URL("../../..", import.meta.url))] },
    },
    optimizeDeps: {
      include: ["qwebchannel/qwebchannel.js", "promise-retry", "uuid"],
    },
  },
});
