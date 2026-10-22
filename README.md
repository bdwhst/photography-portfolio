# Han Yang · 杨焓 摄影作品集

简约现代风格的静态作品站，中英双语。照片按文件夹分类自动导入，布局由 `public/gallery.json` 控制，也可以在浏览器里可视化调整后导出。设计说明见 [DESIGN.md](DESIGN.md)。

## 快速开始

```bash
npm install
npm run dev        # 本地预览，自动打开浏览器
npm run build      # 打包到 dist/，可部署到任意静态托管
```

## 添加照片：拖进一个文件夹即可

把 JPEG / PNG 直接放进 `photos-src/`（也支持 webp / tiff，HEIC 请先转 JPG）。不需要放原尺寸图，源文件只留在本机，网站只发布缩小后的版本。

- `npm run dev` 运行期间会监听这个文件夹：拖入照片几秒后页面自动刷新，删掉照片也会同步移除。
- `npm run build` 打包前也会自动扫描一次。不开服务器时可以手动 `npm run import`。
- 按文件内容去重，同一张图放两份只算一张；改名、移动都能认出来，标签不会丢。
- 也可以用子文件夹：文件夹名会作为自动标签加上，移出文件夹时摘掉；网页里点选的标签不受影响。

导入时会自动按 EXIF 方向校正，生成展示图（默认长边 1600px）和缩略图（长边 800px），默认 JPEG，并把条目追加到 `public/gallery.json`。默认标题是文件名，可以在 JSON 里改成中英文。已经写好的标题、说明、标签、顺序、span 不会被后续导入覆盖。

`npm run import -- --force` 强制重新生成全部图片。`npm run samples` 生成一组示例图，`npm run samples -- --remove` 移除它们。

## 打标签、排序：在网页里点选（只有你能用）

运行 `npm run dev` 后，按 `E`（或访问 `?edit`，或点页脚「编辑排布」）进入编辑模式：

- **点一张照片**，左下角出现标签框：点亮或点灭标签；填中英文名可新建标签；网格模式下还能选占位大小。
- **拖拽照片**调整顺序。
- 右下角面板切换布局、调列数 / 间距 / 行高 / 圆角 / 最大宽度。
- 所有改动**自动保存**到 `public/gallery.json`，面板底部会显示「已保存」。「还原」重新读文件，「清理未使用标签」删掉没有照片的标签。

编辑功能只存在于本机开发服务器里：打包产物不包含编辑器代码，也没有保存接口，所以线上访客看不到、也用不了。标签的中英文名之后想改，在 `gallery.json` 的 `categories` 里改。

## 版权保护

网站从头到尾只用 `public/photos/` 里脚本生成的缩小版，源图目录 `photos-src/` 不会被打包，也已加入 `.gitignore`，不会进仓库。生成时还会：

- 把长边限制在 `maxSize`（默认 1600px），灯箱里也只有这个尺寸
- 右下角烧入文字水印（默认 `© Han Yang`），字号随图片宽度缩放
- EXIF 里只写入 Copyright 和 Artist，原图的 GPS、相机、拍摄参数一律不保留
- 前端禁用图片右键和拖拽保存（`"protect": true`）

这些都在 `gallery.json` 的 `output` 里改，改完下次导入时所有图片会自动重新生成：

```json
"output": {
  "format": "jpeg",            // jpeg | webp
  "quality": 82,
  "maxSize": 1600,             // 展示图长边
  "thumbSize": 800,            // 缩略图长边
  "watermark": "© Han Yang",   // 留空 "" 则不加水印
  "watermarkOpacity": 0.45,
  "copyright": "© Han Yang",   // 写入 EXIF
  "artist": "Han Yang"
},
"protect": true                // 禁用右键 / 拖拽保存
```

要说明的是，右键禁用只能挡住普通访客，截图是挡不住的。真正起作用的是小尺寸、水印和 EXIF 版权信息。

## 中英文

导航右侧「EN / 中文」切换，默认跟随浏览器语言，选择会记住。`gallery.json` 里任何文字字段都可以写成两种形式：

```json
"title": "Dunes"                               // 两种语言显示同样的文字
"title": { "zh": "沙丘", "en": "Dunes" }        // 按语言显示
```

照片的 `title`、`caption`，站点的 `title`、`subtitle`、`about`、`copyright`，链接的 `label`，以及 `categories` 的分类名都支持。

## 自定义排布

### 方式一：改 `gallery.json`

```json
"layout": {
  "mode": "masonry",   // masonry 瀑布流 | grid 网格 | justified 等高行 | column 单列
  "columns": 3,        // 列数（masonry / grid）
  "gap": 16,           // 间距 px
  "rowHeight": 320,    // 目标行高（justified）
  "radius": 0,         // 圆角 px
  "maxWidth": 1400     // 内容最大宽度 px
}
```

- `photos` 数组的顺序就是展示顺序
- 单张照片加 `"span": { "col": 2, "row": 1 }` 可在网格模式下占多格
- `tags` 是标签 key，顶部筛选条按 `categories` 的顺序生成，只显示有照片的标签；一张照片可以有多个 tag
- `sources` 是这张照片在 `photos-src/` 里的所有副本路径，`hash` 是内容指纹，这两个字段由脚本维护，不用手改

### 方式二：浏览器里点选（见上面「打标签、排序」）

`npm run dev` 下按 `E` 进入编辑模式，切换布局、拖滑块、拖拽排序、点选标签，改动自动保存。

另外，`?mode=grid` 可以临时预览某种布局，不会改动文件。

## 站点信息

`gallery.json` 的 `site` 字段：

| 字段 | 说明 |
|---|---|
| `title` / `subtitle` | 站名与副标题，已填 `杨焓 / Han Yang` |
| `about` | 关于页的一段自述 |
| `email` | 显示为邮件链接 |
| `links` | `[{ "label": "Instagram", "url": "..." }]` |
| `copyright` | 页脚版权 |

## 部署

`npm run build` 后把 `dist/` 整个目录上传即可。部署在子路径（例如 GitHub Pages 的 `/仓库名/`）时，把 `vite.config.js` 里的 `base` 改成 `'/仓库名/'`。

## 目录

```
index.html            页面骨架
src/main.js           入口：加载数据、筛选、主题、语言、编辑器接线
src/i18n.js           界面文案与多语言取值
src/layout.js         布局引擎（四种模式）
src/lightbox.js       灯箱（键盘 / 滑动切换）
src/editor.js         可视化编辑器（布局 / 排序 / 标签），仅开发模式加载
src/style.css         样式，含深浅色主题
public/gallery.json   站点信息 + 布局 + 作品列表
public/photos/        脚本生成的展示图（缩小、带水印），网站只用这里的图
photos-src/           你的 JPEG / PNG 源图（不打包、不进 git）
scripts/              导入与示例图脚本
vite.config.js        自动导入插件（启动时扫描 + 监听文件夹）+ 开发时的保存接口
```
