import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { getReviewPage, getReviewSummary } from '@/lib/api/reviews';
import RatingSummary from '@/features/reviews/RatingSummary';
import ReviewList from '@/features/reviews/ReviewList';
import WriteReview from '@/features/reviews/WriteReview';
import styles from '@/features/reviews/Reviews.module.css';

export const metadata = {
  title: 'Student reviews | Gyaan Vidhya',
  description: 'What students and parents say about using Gyaan Vidhya to explore courses, compare colleges and apply. Every review comes from a verified account and is checked before it appears.',
};

const ratingOf = (raw) => {
  const value = Number.parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  return value >= 1 && value <= 5 ? value : null;
};

export default async function ReviewsPage({ searchParams }) {
  const params = await searchParams;
  const rating = ratingOf(params?.rating);
  const [summary, initial] = await Promise.all([getReviewSummary(), getReviewPage(rating ?? '')]);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={`lux-surface-dark ${styles.hero}`}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}><ol><li><Link href="/">Home</Link></li><li aria-current="page">Student reviews</li></ol></nav>
          <p className={styles.heroEyebrow}><Icon name="chat" />Student reviews</p>
          <h1>Honest words from students and parents</h1>
          <p>Every review comes from a signed-in Gyaan Vidhya account and is checked by our team for spam and personal details — never for opinion. We publish good and critical reviews alike.</p>
          <div className={styles.ctaRow}>
            <WriteReview className="lux-button lux-button--gold" autoOpen={params?.write === '1'} />
            <a className="lux-button lux-button--light" href="#all-reviews">Read reviews<Icon name="arrow" /></a>
          </div>
        </div>
        <RatingSummary summary={summary} tone="dark" active={rating} filterHref={(value) => (value ? `/reviews?rating=${value}#all-reviews` : '/reviews#all-reviews')} />
      </div>
    </header>
    <section id="all-reviews" className={`container ${styles.listSection}`} aria-labelledby="all-reviews-title">
      <div className={styles.listHead}>
        <h2 id="all-reviews-title">{rating ? `${rating}-star reviews` : 'All reviews'}</h2>
        <p>Newest first. Names are shortened to first name and last initial.</p>
      </div>
      <ReviewList key={rating ?? 'all'} initial={initial} rating={rating} />
      <aside className={styles.policy}>
        <Icon name="shield" />
        <div>
          <strong>How we handle reviews</strong>
          <p>One review per account. We remove only spam, abuse, personal contact details and reviews that are not about Gyaan Vidhya. Reviews describe personal experiences; confirm admission rules, fees and deadlines with the institution. <Link href="/terms-and-conditions#reviews-and-content-you-share">Review guidelines</Link></p>
        </div>
      </aside>
    </section>
  </main>;
}
