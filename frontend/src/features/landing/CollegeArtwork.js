import { getImageProps } from 'next/image';

const image = (width, height) => getImageProps({ src: '/images/course-colleges-reference.png', width, height, alt: '' }).props.src;
const source = image(850, 492);
// Full-resolution variant for large frames (profile hero): crops are only ~130px wide in the source.
const detailSource = image(1649, 954);

export default function CollegeArtwork({ row, className, detail = false }) {
  return <svg className={className} viewBox={row.art.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustrative campus image for ${row.name}`}>
    <image href={detail ? detailSource : source} x="0" y="0" width="1649" height="954" />
  </svg>;
}
