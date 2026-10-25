import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { compressionRatio, createImagePipeline, IMAGE_LIMITS, ImageError, loadSharp, prepareImage } from '../src/lib/image-pipeline.js';
import { withTimeout } from '../src/scraper/worker.js';

const sharp = await loadSharp();

// Smooth, photograph-like content: lossless PNG in, so the WebP the pipeline writes has to earn
// its place. Per-pixel noise would be unlike any real photo and would grow under lossy encoding.
async function photo(width, height, { alpha = false } = {}) {
  const channels = alpha ? 4 : 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        pixels[at + channel] = channel === 3 ? 160 : Math.round(127 + 120 * Math.sin(x / 40 + channel) * Math.cos(y / 55));
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

const upload = (calls) => async (buffer, options) => {
  calls.push({ bytes: buffer.byteLength, ...options });
  return { secure_url: `https://res.cloudinary.com/demo/image/upload/${options.folder}/${options.publicId}.webp`, width: 1600, height: 900, bytes: buffer.byteLength };
};
const downloadOf = (body, contentType = 'image/png') => async () => ({ contentType, body });

describe('image pipeline: prepare', () => {
  test('decodes, resizes, strips metadata and re-encodes a photograph as WebP', async () => {
    const original = await photo(2400, 1400);
    const prepared = await prepareImage(original, { kind: 'photo' });
    assert.equal(prepared.format, 'webp');
    assert.equal(prepared.width, IMAGE_LIMITS.maxWidth);
    assert.equal(prepared.height, Math.round((1400 * IMAGE_LIMITS.maxWidth) / 2400));
    assert.ok(prepared.data.byteLength < original.byteLength, `${prepared.data.byteLength} >= ${original.byteLength}`);
    const meta = await sharp(prepared.data).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, IMAGE_LIMITS.maxWidth);
    assert.ok(!meta.exif && !meta.icc && !meta.iptc, 'metadata survived');
  });

  test('rejects images that are too small, the wrong shape, or not decodable', async () => {
    await assert.rejects(prepareImage(await photo(300, 200), { kind: 'photo' }), (error) => error instanceof ImageError && error.code === 'too-small');
    await assert.rejects(prepareImage(await photo(1000, 900), { kind: 'photo' }), (error) => error.code === 'shape');
    await assert.rejects(prepareImage(await photo(1600, 400), { kind: 'photo' }), (error) => error.code === 'shape', 'a wide banner strip is not a photograph');
    await assert.rejects(prepareImage(Buffer.from('<html>not an image</html>')), (error) => error.code === 'decode');
  });

  test('an EXIF-rotated portrait is judged on what the viewer sees', async () => {
    // A real crawl stored a 1080×1620 portrait: the file is landscape, the EXIF tag turns it.
    const upright = await sharp(await photo(1500, 1000)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    assert.equal((await sharp(upright).metadata()).orientation, 6);
    await assert.rejects(prepareImage(upright, { kind: 'photo' }), (error) => error.code === 'shape');
    const landscape = await prepareImage(await photo(1500, 1000), { kind: 'photo' });
    assert.equal(landscape.width, 1500, 'the same pixels without the tag are a perfectly good photo');
  });

  test('a logo with transparency stays PNG and skips the photo shape rules', async () => {
    const logo = await prepareImage(await photo(300, 300, { alpha: true }), { kind: 'logo' });
    assert.equal(logo.format, 'png');
    assert.equal((await sharp(logo.data).metadata()).hasAlpha, true);
    const flat = await prepareImage(await photo(300, 300), { kind: 'logo' });
    assert.equal(flat.format, 'webp', 'only transparency justifies PNG');
  });
});

describe('image pipeline: store', () => {
  test('uploads under <folder>/universities/<slug>/<kind>-<n> and records the compression', async () => {
    const calls = [];
    const original = await photo(2000, 1200);
    const pipeline = createImagePipeline({ download: downloadOf(original), upload: upload(calls), enabled: true });
    const stored = await pipeline.process({ url: 'https://x.ac.in/img/campus.jpg', slug: 'green-valley-university', index: 3, caption: 'Main block', sourcePage: 'https://x.ac.in/campus' });
    assert.match(calls[0].folder, /\/universities\/green-valley-university$/);
    assert.equal(calls[0].publicId, 'photo-3');
    assert.equal(calls[0].overwrite, true);
    assert.equal(stored.credit, 'official website');
    assert.equal(stored.caption, 'Main block');
    assert.equal(stored.sourcePage, 'https://x.ac.in/campus');
    assert.match(stored.url, /^https:\/\/res\.cloudinary\.com\//);
    assert.deepEqual([pipeline.stats.uploaded, pipeline.stats.failed, pipeline.stats.skipped], [1, 0, 0]);
    assert.equal(pipeline.stats.originalBytes, original.byteLength);
    assert.ok(compressionRatio(pipeline.stats) < 1);
  });

  test('a bad download, a wrong content type or a broken file is skipped, never thrown', async () => {
    const lines = [];
    const log = (line) => lines.push(line);
    const failing = createImagePipeline({ download: async () => { throw new ImageError('HTTP 404', 'download'); }, upload: upload([]), enabled: true, log });
    assert.equal(await failing.process({ url: 'https://x.ac.in/a.jpg', slug: 'a' }), null);
    assert.equal(failing.stats.failed, 1);

    const wrongType = createImagePipeline({ download: downloadOf(Buffer.from('%PDF-1.4'), 'application/pdf'), upload: upload([]), enabled: true, log });
    assert.equal(await wrongType.process({ url: 'https://x.ac.in/a.pdf', slug: 'a' }), null);
    assert.equal(wrongType.stats.skipped, 1);

    const broken = createImagePipeline({ download: downloadOf(Buffer.from('not an image at all'), 'image/png'), upload: upload([]), enabled: true, log });
    assert.equal(await broken.process({ url: 'https://x.ac.in/a.png', slug: 'a' }), null);
    assert.deepEqual(broken.stats.reasons, { decode: 1 });
    assert.equal(lines.length, 3);

    const off = createImagePipeline({ download: downloadOf(Buffer.alloc(0)), enabled: false });
    assert.equal(await off.process({ url: 'https://x.ac.in/a.jpg', slug: 'a' }), null);
    assert.deepEqual(off.stats, { attempted: 0, uploaded: 0, skipped: 1, failed: 0, originalBytes: 0, compressedBytes: 0, reasons: { disabled: 1 } });
  });

  test('a site that never finishes is given up on, not held for ever', async () => {
    // A real run stalled a worker lane on a site that answered every request just inside the
    // per-request timeout; only a whole-job budget bounds that.
    const slow = new Promise((resolve) => { setTimeout(() => resolve('too late'), 300); });
    await assert.rejects(withTimeout(slow, 20), (error) => error.code === 'network' && !error.permanent);
    assert.equal(await slow, 'too late', 'the abandoned crawl finishes into nothing');
    assert.equal(await withTimeout(Promise.resolve('done'), 5000), 'done');
  });

  test('processMany numbers the images and stops at the wanted count', async () => {
    const calls = [];
    const big = await photo(1200, 700);
    const small = await photo(200, 150);
    const pipeline = createImagePipeline({
      download: async (url) => ({ contentType: 'image/png', body: url.includes('small') ? small : big }),
      upload: upload(calls), enabled: true,
    });
    const candidates = ['a', 'small-b', 'c', 'd', 'e'].map((name) => ({ url: `https://x.ac.in/${name}.png`, sourcePage: 'https://x.ac.in/campus' }));
    const stored = await pipeline.processMany(candidates, { slug: 'demo', want: 3 });
    assert.equal(stored.length, 3);
    assert.deepEqual(calls.map((call) => call.publicId), ['photo-1', 'photo-2', 'photo-3'], 'a rejected image must not leave a gap');
    assert.equal(pipeline.stats.skipped, 1);
    let checks = 0;
    const bounded = await pipeline.processMany(candidates.filter((item) => !item.url.includes('small')), {
      slug: 'bounded', want: 4, shouldContinue: () => checks++ < 2,
    });
    assert.equal(bounded.length, 2, 'a job deadline can stop the image loop between downloads');
  });
});
