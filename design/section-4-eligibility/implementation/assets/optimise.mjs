import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(folder, '../../../..');
const destination = path.join(project, 'frontend/public/images/eligibility');
const originals = 'C:/Users/422se/.codex/generated_images/01a10d7b-9010-7a01-9daa-701856239cc4';
const files = [
  ['notebook', 'exec-fa9d959c-8fb4-4db6-9817-3940db9df521.png'],
  ['certificate', 'exec-75790922-3d19-4422-889a-c2f8f8604591.png'],
  ['graduation', 'exec-5841a35f-3199-4dd7-9edd-5814844633c2.png'],
];
await mkdir(destination, { recursive: true });
const manifest = [];
for (const [id, name] of files) {
  const source = path.join(originals, name);
  const preserved = path.join(folder, `${id}-source.png`);
  await copyFile(source, preserved);
  const input = await sharp(preserved).metadata();
  const output = await sharp(preserved).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(path.join(destination, `${id}.webp`));
  manifest.push({ id, original: source, preserved: path.relative(project, preserved), asset: `frontend/public/images/eligibility/${id}.webp`, sourceHasAlpha: input.hasAlpha, width: output.width, height: output.height, bytes: output.size });
}
await writeFile(path.join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest));
