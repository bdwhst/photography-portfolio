# 个人摄影作品网站 · 设计方案

## 1. 目标

- 展示个人摄影作品，风格简约现代，以照片为绝对主角。
- **排布方式可自定义**：不改代码即可调整布局模式、列数、间距、单张照片的大小与顺序。
- 轻量：页面为原生 HTML / CSS / JS，用 Vite 做开发与打包，产物是纯静态文件，任何静态托管（GitHub Pages、Vercel、Netlify、自家服务器）直接可用。

## 2. 技术选型

| 项目 | 选择 | 理由 |
|---|---|---|
| 框架 | 无框架，原生 HTML/CSS/JS + Vite | 摄影站内容简单，原生最轻；Vite 提供热更新与打包 |
| 数据 | `data/gallery.json` | 一个文件管理全部作品与布局配置 |
| 布局 | CSS Grid + 自写 Masonry/Justified 算法 | 四种布局模式全部由 JSON 控制 |
| 字体 | 系统字体栈（-apple-system / PingFang / Inter 回退） | 不依赖外网，加载快 |
| 图片处理 | sharp（Node 脚本） | 导入照片时自动读尺寸、生成缩略图与 WebP |
| 预览 | `npm run dev` (Vite) | 热更新 |

## 3. 目录结构

```
photography_portfolio/
├── index.html              入口页（单页：作品 / 关于 / 联系）
├── src/
│   ├── style.css           全部样式，含深浅色主题
│   ├── main.js             入口：加载数据、筛选、灯箱、编辑器
│   ├── layout.js           布局引擎（四种模式）
│   ├── lightbox.js         灯箱
│   └── editor.js           可视化布局编辑器 + 导出 JSON
├── public/
│   ├── gallery.json        站点信息 + 布局配置 + 作品列表
│   └── photos/
│       ├── full/           展示图（脚本生成，长边 1600px，带水印，JPEG）
│       └── thumb/          缩略图（脚本生成，长边 800px，JPEG）
├── photos-src/             JPEG / PNG 源图，按分类文件夹放（不发布、不进 git）
├── scripts/
│   ├── import-photos.mjs   扫描 photos-src/ → 生成 full/thumb → 补全 gallery.json
│   └── make-samples.mjs    生成示例图（首次预览用）
├── package.json
└── vite.config.js
```

## 4. 自定义排布的设计

### 4.1 全局布局（gallery.json → `layout`）

```json
"layout": {
  "mode": "masonry",        // masonry | grid | justified | column
  "columns": 3,             // masonry / grid 列数（桌面端）
  "gap": 16,                // 间距 px
  "rowHeight": 320,         // justified 模式目标行高
  "radius": 0,              // 圆角
  "maxWidth": 1400          // 内容最大宽度
}
```

四种模式：

- **masonry** 瀑布流：按列堆叠，保持原始比例，适合混合横竖图。
- **grid** 网格：等宽格子，单张可通过 `span` 占 2 列 / 2 行，做主次节奏。
- **justified** 等高行：同一行高度一致、两端对齐（Flickr 风格），最有"画廊感"。
- **column** 单列：逐张大图，适合作品集精选页。

### 4.2 单张照片（gallery.json → `photos[]`）

```json
{
  "src": "photos/001.jpg",
  "title": "雾中山脊",
  "caption": "2025 · 四川",
  "tags": ["landscape"],
  "w": 3000, "h": 2000,     // 原始尺寸，用于布局计算与防跳动
  "span": { "col": 2, "row": 1 }   // 可选，仅 grid 模式生效
}
```

数组顺序即展示顺序。`tags` 用于顶部筛选（系列 / 主题）。

### 4.3 可视化编辑器（仅开发模式，只有站主能用）

`npm run dev` 下按 `E` 或访问 `?edit` 进入编辑模式：

- 面板中切换模式、拖滑块调列数 / 间距 / 行高，页面实时响应。
- 拖拽照片卡片调整顺序。
- 点一张照片打开标签框：点选 / 新建标签，grid 模式下选 span。
- 改动经 Vite 开发服务器的 `POST /__gallery` 自动写回 `public/gallery.json`。

编辑器通过 `import.meta.env.DEV` 守卫动态加载，打包时被整体剔除；保存接口只在开发服务器里存在。线上站点是纯静态文件，访客无从编辑。

### 4.4 分类文件夹与自动导入

照片直接放在 `photos-src/`，标签在网页里点选。Vite 插件在启动与打包前扫描一次，开发期间监听文件夹：新增 → 生成展示图并追加条目并刷新页面；删除 → 移除条目与生成图。子文件夹仍可作为自动标签使用。标签的中英文名放在 `gallery.json` 的 `categories`。按文件内容 SHA-1 去重：同一张图在多个文件夹只保留一个条目，`sources` 记录所有副本路径，来自文件夹的标签每次按副本位置重算（`autoTags`），手工标签保留。

### 4.5 版权保护

源图只留在 `photos-src/`（已 gitignore，不打包）。发布图由脚本生成：长边限制（默认 1600px）、右下角文字水印、EXIF 只写 Copyright / Artist 并剔除原图其他元数据、默认 JPEG。前端禁用图片右键与拖拽。`output` 配置变化时通过 hash 比对自动重新生成全部图片。

### 4.6 中英文

界面文案在 `src/i18n.js`；数据字段支持 `"字符串"` 或 `{ "zh": "...", "en": "..." }` 两种写法，取值时按当前语言回退。语言默认跟随浏览器，切换后记在 localStorage，`?lang=en` 可强制。

## 5. 视觉设计

- **配色**：浅色 `#fafafa` 底 / `#111` 字；深色 `#0e0e0e` 底 / `#e8e8e8` 字。跟随系统，可手动切换，记忆在 localStorage。
- **排版**：标题细字重、大字距；正文 15px；大量留白。导航固定顶部，毛玻璃半透明。
- **图片**：无边框、无阴影，hover 轻微提亮 + 显示标题；`loading="lazy"`；用 `aspect-ratio` 占位避免布局跳动。
- **灯箱**：全屏黑底，左右键 / 滑动切换，`Esc` 关闭，底部显示标题与说明。
- **响应式**：≥1200px 用配置列数；768–1200px 减 1 列；<768px 固定 1–2 列；justified 模式在手机上退化为单列。

## 6. 页面结构

1. 顶部导航：站名 / 作品 / 关于 / 主题切换
2. 标签筛选条（全部 / 风景 / 人像 / 街头 …，自动从 tags 生成）
3. 作品区（由布局引擎渲染）
4. 关于：头像 + 一段自述 + 联系方式 / 社交链接
5. 页脚：版权

## 7. 日常使用流程

1. 把原图放进 `photos-src/`
2. 运行 `npm run import`：自动生成大图 + 缩略图，并把新照片追加到 `gallery.json`
3. 在 `gallery.json` 里填标题 / 说明 / 标签，或在浏览器按 `E` 拖拽排布后导出
4. `npm run dev` 预览，`npm run build` 得到 `dist/` 部署

## 8. 实施步骤

1. `npm init` + 安装 vite、sharp
2. 写 `gallery.json` 结构与示例数据，`make-samples.mjs` 生成示例图
3. 写 `index.html` + `style.css`（主题、导航、栅格、灯箱、编辑器面板）
4. 写 `layout.js`（四模式）、`lightbox.js`、`editor.js`、`main.js`
5. 写 `import-photos.mjs`
6. 本地预览验证四种模式、编辑器、移动端；`npm run build` 验证打包
