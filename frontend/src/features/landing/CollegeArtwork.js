'use client';
import { mediaImage } from '@/lib/hero-image';
import { useContent } from '@/providers/ContentProvider';

const initials = (name = '') => name.split(/\s+/).filter((word) => word.length > 2).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'U';

function Initials({ row, className }) {
  return <svg className={className} viewBox="0 0 100 70" role="img" aria-label={`${row.name} initials`}><rect width="100" height="70" fill="#72243B" /><text x="50" y="44" textAnchor="middle" fill="#FFFAF8" fontSize="24" fontFamily="serif">{initials(row.name)}</text></svg>;
}

// Illustrative records crop the shared campus artwork (`media.campusArt`); real institutions show their logo or initials.
// `detail` uses the full-resolution variant for large frames (profile hero): crops are only ~130px wide in the source.
export default function CollegeArtwork({ row, className, detail = false }) {
  const art = useContent('media')?.campusArt;
  if (row.logoUrl) return <svg className={className} viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${row.name} logo`}><rect width="100" height="70" fill="#FFFAF8" /><image href={row.logoUrl} x="20" y="8" width="60" height="54" preserveAspectRatio="xMidYMid meet" /></svg>;
  const source = Array.isArray(row.art) && art && mediaImage(art, detail ? art.width : 850);
  if (!source) return <Initials row={row} className={className} />;
  return <svg className={className} viewBox={row.art.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustrative campus image for ${row.name}`}>
    <image href={source.src} x="0" y="0" width={art.width} height={art.height} />
  </svg>;
}
