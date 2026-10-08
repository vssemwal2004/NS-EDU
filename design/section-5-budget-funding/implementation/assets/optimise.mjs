import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(folder, '../../../..');
const original = 'C:/Users/422se/.codex/generated_images/01a10d7b-9010-7a01-9daa-701856239cc4/exec-66488ee1-4f6d-4404-90ac-2e26cd483eb9.png';
const preserved = path.join(folder, 'desk-source.png');
const destination = path.join(project, 'frontend/public/images/budget');
await mkdir(destination, { recursive: true });
await copyFile(original, preserved);
const input = await sharp(preserved).metadata();
const output = await sharp(preserved).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 6 }).toFile(path.join(destination, 'desk.webp'));
const manifest = { generatedWith: 'built-in image_gen', original, preserved: path.relative(project, preserved), asset: 'frontend/public/images/budget/desk.webp', sourceHasAlpha: input.hasAlpha, width: output.width, height: output.height, bytes: output.size, promptSet: 'prompts.json', note: 'Only this small asset ships; full mockup PNGs remain design references.' };
await writeFile(path.join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest));
