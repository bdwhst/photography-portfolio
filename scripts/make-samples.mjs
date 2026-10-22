// 生成一组不同比例的示例图作为源图放进 photos-src/ 的分类文件夹，再走正常导入流程（含缩放、水印）
//   npm run samples              生成
//   npm run samples -- --remove  删除示例图（源图与生成图一起清掉）
import sharp from 'sharp';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { importPhotos, SRC } from './import-photos.mjs';

const DATA = path.resolve(path.dirname(SRC), 'public/gallery.json');

const samples = [
  { id: 'sample-01', cat: 'landscape',  ratio: [3, 2],  title: { zh: '雾中山脊', en: 'Ridge in Fog' },     caption: { zh: '2025 · 四川', en: '2025 · Sichuan' },   c: ['#5b6b7a', '#d9dee3'] },
  { id: 'sample-02', cat: 'portrait',   ratio: [2, 3],  title: { zh: '清晨的窗', en: 'Morning Window' },   caption: { zh: '2025 · 上海', en: '2025 · Shanghai' },  c: ['#b89a7a', '#f2e8dc'], span: { col: 1, row: 2 } },
  { id: 'sample-03', cat: 'landscape',  ratio: [1, 1],  title: { zh: '海平线', en: 'Horizon' },            caption: { zh: '2024 · 青岛', en: '2024 · Qingdao' },   c: ['#2f4858', '#86a8b8'] },
  { id: 'sample-04', cat: 'street',     ratio: [16, 9], title: { zh: '傍晚街口', en: 'Evening Corner' },   caption: { zh: '2024 · 东京', en: '2024 · Tokyo' },     c: ['#3a3340', '#c89b7b'], span: { col: 2, row: 1 } },
  { id: 'sample-05', cat: 'still-life', ratio: [4, 5],  title: { zh: '静物 I', en: 'Still Life I' },       caption: { zh: '2024 · 工作室', en: '2024 · Studio' },  c: ['#e9e4dc', '#8c8378'] },
  { id: 'sample-06', cat: 'landscape',  ratio: [3, 2],  title: { zh: '雪后', en: 'After Snow' },           caption: { zh: '2024 · 长白山', en: '2024 · Changbai' },c: ['#dfe6ec', '#6d7f8c'] },
  { id: 'sample-07', cat: 'street',     ratio: [2, 3],  title: { zh: '背影', en: 'From Behind' },          caption: { zh: '2023 · 京都', en: '2023 · Kyoto' },     c: ['#4b3f3a', '#b7a089'], tags: ['street', 'portrait'] },
  { id: 'sample-08', cat: 'landscape',  ratio: [3, 1],  title: { zh: '沙丘', en: 'Dunes' },                caption: { zh: '2023 · 敦煌', en: '2023 · Dunhuang' },  c: ['#d8b98a', '#f3e5c8'], span: { col: 2, row: 1 } },
  { id: 'sample-09', cat: 'street',     ratio: [3, 2],  title: { zh: '雨夜', en: 'Rainy Night' },          caption: { zh: '2023 · 香港', en: '2023 · Hong Kong' }, c: ['#1d2430', '#5e6f8a'] },
  { id: 'sample-10', cat: 'still-life', ratio: [4, 3],  title: { zh: '静物 II', en: 'Still Life II' },     caption: { zh: '2023 · 工作室', en: '2023 · Studio' },  c: ['#cfc5b8', '#5a524a'] },
  { id: 'sample-11', cat: 'street',     ratio: [1, 1],  title: { zh: '台阶', en: 'Steps' },                caption: { zh: '2022 · 里斯本', en: '2022 · Lisbon' },  c: ['#f0ece4', '#a89f93'] },
  { id: 'sample-12', cat: 'landscape',  ratio: [2, 3],  title: { zh: '树影', en: 'Tree Shadows' },         caption: { zh: '2022 · 杭州', en: '2022 · Hangzhou' },  c: ['#2e3b2f', '#9fb59a'] },
];
const srcPath = (s) => path.join(SRC, s.cat, `${s.id}.jpg`);
const srcRel = (s) => `${s.cat}/${s.id}.jpg`;

function svg(w, h, [a, b], seed) {
  const rnd = (n) => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) * n; };
  const circles = Array.from({ length: 4 }, () =>
    `<circle cx="${rnd(w)}" cy="${rnd(h)}" r="${w * (0.15 + rnd(0.25))}" fill="white" opacity="${0.04 + rnd(0.08)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>${circles}
    <path d="M0 ${h * 0.78} Q ${w * 0.25} ${h * 0.6} ${w * 0.5} ${h * 0.72} T ${w} ${h * 0.62} V ${h} H0 Z" fill="black" opacity="0.12"/>
  </svg>`;
}

if (process.argv.includes('--remove')) {
  for (const s of samples) await rm(srcPath(s), { force: true });
  const r = await importPhotos({ log: () => {} });
  console.log(`示例图已移除，剩余 ${r.total} 张`);
  process.exit(0);
}

for (const [i, s] of samples.entries()) {
  const [rw, rh] = s.ratio, long = 2400;
  const w = rw >= rh ? long : Math.round(long * rw / rh);
  const h = rw >= rh ? Math.round(long * rh / rw) : long;
  await mkdir(path.dirname(srcPath(s)), { recursive: true });
  await sharp(Buffer.from(svg(w, h, s.c, i + 7))).jpeg({ quality: 90 }).toFile(srcPath(s));
}
await importPhotos({ log: () => {} });

// 补上双语标题、说明与网格占位
const data = JSON.parse(await readFile(DATA, 'utf8'));
const bySource = new Map(data.photos.flatMap((p) => (p.sources || []).map((r) => [r, p])));
for (const s of samples) {
  const p = bySource.get(srcRel(s));
  if (!p) continue;
  Object.assign(p, { title: s.title, caption: s.caption, tags: s.tags || [s.cat], sample: true, ...(s.span ? { span: s.span } : {}) });
}
if (!data.site.about?.zh && !data.site.about?.en) {
  data.site.about = {
    zh: '在这里写一段关于你的介绍：你拍什么、为什么拍、用什么拍。保持简短。',
    en: 'A short note about who you are, what you shoot, and why.',
  };
}
await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
console.log(`已生成 ${samples.length} 张示例图（源图在 photos-src/ 各分类文件夹，文件名 sample-xx.jpg）`);
