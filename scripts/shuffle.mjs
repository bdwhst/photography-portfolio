// 随机打乱 public/gallery.json 里照片的顺序（即「全部」的展示顺序）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/gallery.json');
const data = JSON.parse(await readFile(DATA, 'utf8'));
const a = data.photos || [];
for (let i = a.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [a[i], a[j]] = [a[j], a[i]];
}
await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
console.log(`已打乱 ${a.length} 张照片的顺序`);
