import { getImageProps } from 'next/image';

const source = getImageProps({ src: '/images/course-colleges-reference.png', width: 850, height: 492, alt: '' }).props.src;
export default function CollegeArtwork({ row, className }) {
  return <svg className={className} viewBox={row.art.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustrative campus image for ${row.name}`}>
    <image href={source} x="0" y="0" width="1649" height="954" />
  </svg>;
}
