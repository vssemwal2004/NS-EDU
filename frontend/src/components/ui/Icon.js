import landingIcons from './icons/landing';
import headerIcons from './icons/header';
import loginIcons from './icons/login';
import collegesIcons from './icons/colleges';
import compareIcons from './icons/compare';
import coursesIcons from './icons/courses';
import guidesIcons from './icons/guides';

const basePaths = {
  mail: 'M3 5h18v14H3ZM3 5l9 7 9-7',
  support: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7H4Zm16 0h2v7h-4v-7h2Zm0 7q0 3-7 3',
  arrowUp: 'M12 20V4m-6 6 6-6 6 6',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17.5 6.5h.01',
  linkedin: 'M4 9v12m0-16v.01M9 21V9m0 5a5 5 0 0 1 10 0v7',
  youtube: 'M3 6q9-2 18 0v12q-9 2-18 0V6Zm7 3v6l5-3-5-3Z',
  facebook: 'M15 3h-3q-4 0-4 4v14m-3-11h10m-3-7v4',
  socialX: 'M4 3h4l12 18h-4L4 3ZM20 3 4 21',
  news: 'M4 3h13v18H4ZM17 7h4v12a2 2 0 0 1-4 0M7 7h7M7 11h3v4H7Zm6 0h1m-1 4h1m-7 3h7',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  bookmarkFilled: 'M6 3h12v18l-6-4-6 4V3Z',
  refresh: 'M20 7V3m0 4h-4M4 17v4m0-4h4M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3',
  external: 'M7 17 19 5M8 5h11v11',
  wallet: 'M20 8H5a2 2 0 0 1 0-4h13v4M3 6v13a2 2 0 0 0 2 2h15V8m0 4h-5v5h5m-3-2.5h.01',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
  check: 'm5 12 4 4L19 6',
  bed: 'M3 18V7m18 11V9M3 13h18v5H3m0-8h5v3H3Zm5 3V9h9q4 0 4 4M3 18v3m18-3v3',
  heart: 'M12 21S2 15 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 7-10 13-10 13Z',
  star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z',
  compare: 'M9 9h12v12H9ZM15 5V3H3v12h2',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  search: 'M21 21l-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  cap: 'm2 8 10-5 10 5-10 5-10-5Zm4 2v7c4 3 8 3 12 0v-7m4-2v8',
  chart: 'M5 20V10m7 10V4m7 16v-8M3 20h18',
  bars: 'M4 13h3v8H4ZM10 8h3v13h-3ZM16 3h3v18h-3Z',
  people: 'M3 21v-3q0-5 9-5t9 5v3H3ZM12 10a3.5 3.5 0 1 0 0-7m0 7a3.5 3.5 0 0 0 0-7M4 5q-3 2 0 5m16-5q3 2 0 5',
  document: 'M5 3h14v18H5ZM9 7h6M9 11h6M9 15h4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  chevron: 'm6 9 6 6 6-6',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-3 5-5 3 3-5 5-3Z',
  book: 'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v17h-5a4 4 0 0 0-4 1 4 4 0 0 0-4-1H3Z',
  science: 'M9 3h6m-5 0v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M8 14h8',
  medical: 'M5 3v6a5 5 0 0 0 10 0V3M3 3h4m6 0h4M10 14v2a5 5 0 0 0 10 0v-3m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  palette: 'M21 12a9 9 0 1 0-9 9h1a2 2 0 0 0 1-3 2 2 0 0 1 2-3h2a3 3 0 0 0 3-3ZM7 10h.01M10 6h.01M15 7h.01M6 14h.01',
  scales: 'M12 3v17M7 21h10M4 6h16M5 6l-4 9h8L5 6Zm14 0-4 9h8l-4-9ZM1 15q4 4 8 0m6 0q4 4 8 0',
  laptop: 'M5 4h14v12H5ZM2 20l3-4h14l3 4H2Z',
  commerce: 'M4 6c0-2 16-2 16 0s-16 2-16 0Zm0 0v4c0 3 16 3 16 0V6M4 10v4c0 3 16 3 16 0v-4M4 14v4c0 3 16 3 16 0v-4',
  eligibility: 'M9 3H5v18h14v-9M9 2h6v4H9ZM9 10h4m-4 4h2m5 2 2 2 4-5',
  gear: 'm9 3-1 3-3 1-2-1-1 4 2 2-2 2 1 4 2-1 3 1 1 3h4l1-3 3-1 2 1 1-4-2-2 2-2-1-4-2 1-3-1-1-3H9ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 16h2',
  lock: 'M5 11h14v10H5ZM8 11V7a4 4 0 0 1 8 0v4m-4 4v2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  eyeOff: 'M3 3l18 18M10.6 5.1Q11.3 5 12 5c6 0 10 7 10 7a17 17 0 0 1-2.9 3.7M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7q2.6 0 4.6-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4',
  dashboard: 'M3 3h8v10H3ZM13 3h8v6h-8ZM13 11h8v10h-8ZM3 15h8v6H3Z',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M12 9h.01M15 9h.01M9 12h.01M12 12h.01M15 12h.01',
  map: 'm9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  layers: 'm12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-1.5 1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L15 21h-4l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L3.8 10.3l2-3.4 1.9.7a7 7 0 0 1 2-1.2L11 3h4l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Zm4 4h4',
  trend: 'm3 17 6-6 4 4 8-8M15 7h6v6',
  calendar: 'M4 5h16v16H4ZM4 10h16M8 3v4m8-4v4',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z',
  sparkleUser: 'M16 21a6 6 0 0 0-12 0M10 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-10 .8 2.2L21 6l-2.2.8L18 9l-.8-2.2L15 6l2.2-.8L18 3Z',
};
// Area icon files extend (never override) the base set.
const paths = { ...landingIcons, ...headerIcons, ...loginIcons, ...collegesIcons, ...compareIcons, ...coursesIcons, ...guidesIcons, ...basePaths };

export default function Icon({ name = 'arrow', className = '' }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill={name === 'bars' || name === 'bookmarkFilled' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.arrow} /></svg>;
}
