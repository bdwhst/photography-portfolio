import { defineConfig } from 'vite';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { importPhotos, SRC, DATA } from './scripts/import-photos.mjs';

// 1) 启动与打包前自动导入 photos-src/ 里的照片；开发时监听文件夹，拖入 / 删除照片后自动刷新
// 2) 开发时提供 POST /__gallery，网页编辑模式的改动直接写回 public/gallery.json
//    打包产物里没有编辑器代码，也没有这个接口，所以线上访客无法编辑
function photosPlugin() {
  let timer;
  const run = async (reason) => {
    try {
      const r = await importPhotos({ log: () => {} });
      if (r.added || r.removed || r.regenerated || r.merged) console.log(`[photos] ${reason}: +${r.added} -${r.removed} ~${r.regenerated} 合并${r.merged}，共 ${r.total} 张`);
      return r;
    } catch (e) { console.error('[photos] 导入失败:', e.message); }
  };
  return {
    name: 'photos',
    async buildStart() { await run('扫描'); },
    configureServer(server) {
      server.watcher.add(SRC);
      const onChange = (file) => {
        if (!path.resolve(file).startsWith(SRC)) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const r = await run('文件夹变动');
          if (r && (r.added || r.removed || r.regenerated || r.merged)) server.ws.send({ type: 'full-reload' });
        }, 600);
      };
      for (const ev of ['add', 'unlink', 'change', 'addDir', 'unlinkDir']) server.watcher.on(ev, onChange);

      server.middlewares.use('/__gallery', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          res.setHeader('content-type', 'application/json');
          try {
            const data = JSON.parse(body);
            if (!data || !Array.isArray(data.photos) || typeof data.site !== 'object') throw new Error('bad payload');
            await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // 部署到子路径（如 GitHub Pages 的 /repo/）时改成 '/repo/'
  base: './',
  build: { outDir: 'dist' },
  server: {
    open: true,
    // 编辑器保存 gallery.json 时不要整页刷新
    watch: { ignored: ['**/public/gallery.json'] },
  },
  plugins: [photosPlugin()],
});
