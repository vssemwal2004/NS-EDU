import Image from 'next/image';
import { isStudentCdnImage, studentImageUrl } from '@/lib/student-image';

export default function StudentImage({ src, unoptimized = false, ...props }) {
  const url = studentImageUrl(src);
  return <Image {...props} src={url} unoptimized={unoptimized || isStudentCdnImage(url)} />;
}
