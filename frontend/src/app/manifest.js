import { studentImageUrl } from '@/lib/student-image';

export default function manifest() {
  return {
    name: 'Gyaan Vidhya',
    short_name: 'Gyaan Vidhya',
    description: 'Discover universities, compare courses and apply with confidence.',
    lang: 'en-IN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFAF5',
    theme_color: '#72243B',
    categories: ['education'],
    icons: [192, 512].map((size) => ({
      src: studentImageUrl(`/brand/icon-${size}.png`), sizes: `${size}x${size}`, type: 'image/png', purpose: 'any',
    })),
  };
}
