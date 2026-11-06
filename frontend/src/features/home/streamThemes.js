// A visual identity per field of study for the homepage stream cards: two tones for the scene's
// gradient, a background texture, and a line-art scene of the field's real-world tools. Fields are
// matched by name (catalogue `field`), so a new field added by an admin falls back to the brand
// wine theme with the graduation scene — it never breaks, it just looks generic until themed here.

export const STREAM_THEMES = {
  arts: { from: '#6E2440', to: '#B4566F', texture: 'paper', scene: 'arts' },
  science: { from: '#123F57', to: '#2C8AAE', texture: 'dots', scene: 'science' },
  commerce: { from: '#5C4112', to: '#B88A3A', texture: 'ledger', scene: 'commerce' },
  management: { from: '#3F2753', to: '#7D5596', texture: 'dots', scene: 'management' },
  computing: { from: '#1E2563', to: '#4F63C9', texture: 'grid', scene: 'computing' },
  engineering: { from: '#26323F', to: '#5E7489', texture: 'blueprint', scene: 'engineering' },
  education: { from: '#2F4A22', to: '#6B8F46', texture: 'chalk', scene: 'education' },
  pharmacy: { from: '#14584A', to: '#35A184', texture: 'dots', scene: 'pharmacy' },
  medical: { from: '#7A1A28', to: '#C9484F', texture: 'dots', scene: 'medical' },
  healthcare: { from: '#7A1A28', to: '#C9484F', texture: 'dots', scene: 'medical' },
  dentistry: { from: '#1B5568', to: '#4AA3B8', texture: 'dots', scene: 'medical' },
  law: { from: '#3A2717', to: '#80603D', texture: 'paper', scene: 'law' },
  design: { from: '#7E3412', to: '#D27639', texture: 'grid', scene: 'design' },
  agriculture: { from: '#2F521B', to: '#6BA243', texture: 'dots', scene: 'agriculture' },
  hospitality: { from: '#5E2E1A', to: '#B26A3F', texture: 'paper', scene: 'hospitality' },
};
const FALLBACK = { from: '#5A1A2E', to: '#A4485F', texture: 'dots', scene: 'graduation' };

export const themeFor = (field = '') => {
  const key = String(field).toLowerCase().trim();
  return STREAM_THEMES[key] ?? Object.entries(STREAM_THEMES).find(([name]) => key.startsWith(name))?.[1] ?? FALLBACK;
};

// A toothed gear outline: `teeth` square-ish teeth between radius r (root) and r + depth (tip).
function gear(cx, cy, r, teeth, depth = 6) {
  const step = (Math.PI * 2) / teeth;
  const point = (radius, angle) => `${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  const parts = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    parts.push(point(r, a), point(r + depth, a + step * 0.12), point(r + depth, a + step * 0.42), point(r, a + step * 0.54));
  }
  return `M${parts.join('L')}Z`;
}

// Line art, drawn in white on the coloured scene (stroke = currentColor). viewBox 0 0 200 120.
const scenes = {
  arts: <>
    <path d="M38 92c18-10 38-10 56 0V40c-18-10-38-10-56 0Z" /><path d="M94 92c18-10 38-10 56 0V40c-18-10-38-10-56 0" />
    <path d="M48 52c10-4 22-4 34 0M48 64c10-4 22-4 34 0M48 76c10-4 22-4 34 0M106 52c10-4 22-4 34 0M106 64c10-4 22-4 34 0" opacity=".55" />
    <path d="M168 18 136 70l-4 12 9-8 32-52a4 4 0 0 0-5-4Z" /><path d="m160 30 7 5" />
  </>,
  science: <>
    <path d="M58 22h24M64 22v26L40 92a6 6 0 0 0 5 9h50a6 6 0 0 0 5-9L76 48V22" /><path d="M48 78h44" opacity=".6" />
    <circle cx="62" cy="88" r="3" /><circle cx="76" cy="84" r="2" /><circle cx="70" cy="70" r="2.5" />
    <ellipse cx="148" cy="58" rx="34" ry="13" /><ellipse cx="148" cy="58" rx="34" ry="13" transform="rotate(60 148 58)" /><ellipse cx="148" cy="58" rx="34" ry="13" transform="rotate(-60 148 58)" />
    <circle cx="148" cy="58" r="5" fill="currentColor" />
  </>,
  commerce: <>
    <path d="M30 100h120" /><path d="M42 100V76h16v24M70 100V62h16v38M98 100V48h16v52M126 100V34h16v66" />
    <path d="m40 66 30-18 26 8 44-30" opacity=".6" /><path d="m130 24 12 2-2 12" opacity=".6" />
    <ellipse cx="172" cy="96" rx="14" ry="5" /><path d="M158 96v-8c0 3 6 5 14 5s14-2 14-5v8M158 88v-8c0 3 6 5 14 5s14-2 14-5v8" /><ellipse cx="172" cy="80" rx="14" ry="5" />
  </>,
  management: <>
    <rect x="80" y="14" width="40" height="22" rx="5" /><rect x="30" y="72" width="40" height="22" rx="5" /><rect x="80" y="72" width="40" height="22" rx="5" /><rect x="130" y="72" width="40" height="22" rx="5" />
    <path d="M100 36v18M50 72V54h100v18M100 54v18" opacity=".7" />
    <circle cx="100" cy="25" r="4" fill="currentColor" /><circle cx="50" cy="83" r="3" /><circle cx="100" cy="83" r="3" /><circle cx="150" cy="83" r="3" />
  </>,
  computing: <>
    <rect x="34" y="18" width="132" height="76" rx="8" /><path d="M34 32h132" opacity=".6" />
    <circle cx="44" cy="25" r="2" fill="currentColor" /><circle cx="52" cy="25" r="2" fill="currentColor" /><circle cx="60" cy="25" r="2" fill="currentColor" />
    <path d="m62 52-12 12 12 12M138 52l12 12-12 12M108 46 92 82" /><path d="M20 104h160" opacity=".6" />
  </>,
  engineering: <>
    <path d={gear(78, 62, 26, 10, 8)} /><circle cx="78" cy="62" r="10" /><circle cx="78" cy="62" r="3" fill="currentColor" />
    <path d={gear(136, 38, 15, 8, 6)} /><circle cx="136" cy="38" r="6" />
    <path d="M118 96h56l-8-14h-40Z" opacity=".6" /><path d="M126 96v-6M134 96v-6M142 96v-6M150 96v-6M158 96v-6" opacity=".6" />
  </>,
  education: <>
    <rect x="28" y="20" width="112" height="70" rx="4" /><path d="M24 96h120M60 90v6M108 90v6" />
    <path d="M42 46c6-10 12-10 14 0s8 10 14 0M42 66h40M90 40l10 10 16-16" opacity=".7" />
    <path d="m150 44 24-10 24 10-24 10Z" /><path d="M160 49v12c8 6 20 6 28 0V49M198 44v16" />
  </>,
  pharmacy: <>
    <g transform="rotate(-35 70 60)"><rect x="34" y="46" width="72" height="28" rx="14" /><path d="M70 46v28" /><path d="M42 54h20" opacity=".5" /></g>
    <path d="m140 28 16 9v18l-16 9-16-9V37Z" /><path d="m156 55 16 9v18l-16 9-16-9V64" opacity=".7" /><path d="M140 64v-9" opacity=".7" />
    <circle cx="140" cy="28" r="3" fill="currentColor" /><circle cx="172" cy="64" r="3" fill="currentColor" /><circle cx="124" cy="64" r="3" fill="currentColor" />
  </>,
  medical: <>
    <path d="M18 64h36l8-18 12 40 12-30 8 8h20" /><path d="M150 30a14 14 0 0 1 20 20l-20 20-20-20a14 14 0 0 1 20-20Z" />
    <path d="M140 92h20M150 82v20" opacity=".7" /><path d="M120 64h-6" opacity=".6" />
  </>,
  law: <>
    <path d="M100 18v80M76 98h48M100 26 56 36M100 26l44 10" /><circle cx="100" cy="22" r="4" fill="currentColor" />
    <path d="M56 36 42 66h28ZM42 66c2 8 26 8 28 0" /><path d="m144 36-14 30h28ZM130 66c2 8 26 8 28 0" />
    <path d="m160 92 22-22M168 74l10 10" opacity=".6" />
  </>,
  design: <>
    <path d="M30 92C60 20 120 100 170 30" /><circle cx="30" cy="92" r="4" fill="currentColor" /><circle cx="170" cy="30" r="4" fill="currentColor" />
    <path d="M30 92 64 60M170 30l-30 30" opacity=".55" /><circle cx="64" cy="60" r="3" /><circle cx="140" cy="60" r="3" />
    <path d="M86 100c-10 0-16-8-12-16 4-10 22-14 30-6 6 6 0 12-6 10-4-1-6 4-2 7 2 2-2 5-10 5Z" opacity=".75" />
  </>,
  agriculture: <>
    <circle cx="156" cy="32" r="14" /><path d="M156 10v-4M156 58v-4M134 32h-4M182 32h-4M141 17l-3-3M174 50l-3-3M141 47l-3 3M174 14l-3 3" opacity=".7" />
    <path d="M70 104V54" /><path d="M70 74c-20 0-28-14-28-26 18 0 28 10 28 26ZM70 62c0-18 10-30 30-30 0 18-12 30-30 30Z" />
    <path d="M20 104h160" opacity=".6" /><path d="M110 104c4-10 12-14 22-14s18 4 22 14" opacity=".6" />
  </>,
  hospitality: <>
    <path d="M44 84h112M56 84a44 44 0 0 1 88 0" /><path d="M100 40v-8M94 32h12" />
    <path d="M36 96h128" opacity=".6" /><path d="M150 30c4-6 4-10 0-16M162 34c4-6 4-10 0-16" opacity=".6" />
  </>,
  graduation: <>
    <path d="m100 24 60 24-60 24-60-24Z" /><path d="M64 58v22c20 14 52 14 72 0V58M160 48v28" />
    <circle cx="160" cy="80" r="4" fill="currentColor" /><path d="M30 100h140" opacity=".5" />
  </>,
};

export function StreamScene({ scene, className }) {
  return <svg className={className} viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {scenes[scene] ?? scenes.graduation}
  </svg>;
}
