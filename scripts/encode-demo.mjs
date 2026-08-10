// Encodes the recorded walkthrough into the two assets the README needs:
//
//   docs/demo/walkthrough.gif  — autoplays inline on GitHub, no click required
//   docs/demo/walkthrough.mp4  — better quality, for links and social posts
//
// The GIF is the one that has to earn its size: GitHub will happily serve a 20MB gif
// and it will simply never finish loading before a recruiter scrolls past. Target <5MB.
//
//   node scripts/encode-demo.mjs

import ffmpegPkg from '@ffmpeg-installer/ffmpeg';
import { execFileSync } from 'node:child_process';
import { statSync, rmSync } from 'node:fs';

const FF = ffmpegPkg.path;
const SRC = 'docs/demo/walkthrough.webm';
const MP4 = 'docs/demo/walkthrough.mp4';
const GIF = 'docs/demo/walkthrough.gif';
const PALETTE = 'docs/demo/.palette.png';

const DURATION = 15.5; // hard cap — the whole premise is a ~15 second watch
const GIF_FPS = 12;
const GIF_WIDTH = 268; // phone aspect keeps this tall; wider blows up the file fast
const RADIUS = 26;

const run = (args) => execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);

// Rounded-corner alpha mask, then flatten onto the app's own background colour so the
// GIF needs no transparency (transparent GIF + dithering = fringing).
const rounded = (w, h, r) =>
  `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(` +
  `gt(abs(W/2-X),W/2-${r})*gt(abs(H/2-Y),H/2-${r})*` +
  `gt(pow(abs(W/2-X)-(W/2-${r}),2)+pow(abs(H/2-Y)-(H/2-${r}),2),pow(${r},2))` +
  `,0,255)',pad=${w + 24}:${h + 24}:12:12:color=0x0E131B@0,` +
  `format=rgba`;

console.log('encoding mp4…');
run([
  '-i', SRC,
  '-t', String(DURATION),
  '-vf',
  `scale=390:-2,${rounded(390, 844, RADIUS)},` +
    `split[a][b];[b]drawbox=color=0x0E131B:t=fill[bg];[bg][a]overlay=0:0,format=yuv420p`,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '23',
  '-movflags', '+faststart',
  '-an',
  MP4,
]);
console.log(`  ${MP4} — ${mb(MP4)} MB`);

// Two-pass palette gives dramatically better gradients than ffmpeg's default 216-colour
// web palette, which posterises this dark UI badly.
console.log('generating gif palette…');
const gifFilters =
  `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos,` +
  `${rounded(GIF_WIDTH, Math.round((844 / 390) * GIF_WIDTH), 20)},` +
  `split[a][b];[b]drawbox=color=0x0E131B:t=fill[bg];[bg][a]overlay=0:0,format=rgb24`;

run(['-i', SRC, '-t', String(DURATION), '-vf', `${gifFilters},palettegen=max_colors=192:stats_mode=diff`, PALETTE]);

console.log('encoding gif…');
run([
  '-i', SRC,
  '-i', PALETTE,
  '-t', String(DURATION),
  '-lavfi', `${gifFilters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
  '-loop', '0',
  GIF,
]);
rmSync(PALETTE, { force: true });

const size = Number(mb(GIF));
console.log(`  ${GIF} — ${size} MB`);
if (size > 5) {
  console.warn(`  ! gif is ${size} MB; drop GIF_FPS or GIF_WIDTH before committing`);
}
