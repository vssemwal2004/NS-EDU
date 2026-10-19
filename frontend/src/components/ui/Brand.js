import Image from 'next/image';
import styles from './Brand.module.css';

// The one place that knows the logo files. `lockup` is emblem + wordmark, `mark` is the emblem alone;
// `tone="light"` is the white version for the wine footer, admin rail and other dark surfaces.
const logos = {
  lockup: { dark: '/brand/gyaan-vidhya-logo.webp', light: '/brand/gyaan-vidhya-logo-light.webp', width: 1200, height: 500 },
  mark: { dark: '/brand/gyaan-vidhya-mark.webp', light: '/brand/gyaan-vidhya-mark-light.webp', width: 512, height: 389 },
};

export default function Brand({ variant = 'lockup', tone = 'dark', className = '', priority = false, alt = 'Gyaan Vidhya' }) {
  const logo = logos[variant];
  return <Image
    className={`${styles.logo} ${styles[variant]} ${className}`.trim()}
    src={tone === 'light' ? logo.light : logo.dark}
    width={logo.width}
    height={logo.height}
    alt={alt}
    priority={priority}
    sizes={variant === 'lockup' ? '(max-width: 640px) 120px, 168px' : '64px'}
  />;
}
