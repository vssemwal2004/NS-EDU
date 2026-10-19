import Link from 'next/link';
import PageIntro from '@/components/layout/PageIntro';
import Icon from '@/components/ui/Icon';
import LocationDiscovery from '@/features/landing/LocationDiscovery';
import DestinationsDirectory from '@/features/home/DestinationsDirectory';
import { countByPlace } from '@/features/home/placeCounts';
import { getCatalog } from '@/lib/api/catalog';
import styles from '@/features/home/Destinations.module.css';

export const metadata = { title: 'Study destinations | Gyaan Vidhya', description: 'Browse every city and state, see how many sample programmes each has, and open its colleges.' };

export default async function LocationsPage({ searchParams }) {
  const [{ q = '', type = 'all', has = '', sort = 'az' }, catalog] = await Promise.all([searchParams, getCatalog()]);
  const counts = countByPlace(catalog.colleges);
  const places = [...catalog.cities, ...catalog.states].filter((place) => counts.get(place.name)?.programmes).length;
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Locations" icon="location" title="Where do you" accent="want to study?" description="Pick a city or state. Your course choice carries into the college results."
      related={[{ href: '/colleges', icon: 'cap', label: 'Course-wise colleges' }, { href: '/budget', icon: 'wallet', label: 'Living cost check' }]}>
      <div className={styles.summary}>
        <dl>
          <div><dt>Cities</dt><dd>{catalog.cities.length}</dd></div>
          <div><dt>States</dt><dd>{catalog.states.length}</dd></div>
          <div><dt>With sample colleges</dt><dd>{places}</dd></div>
        </dl>
        <p>Illustrative sample catalogue · institutions are fictional.</p>
        <Link className="text-link" href="#all-destinations">Browse the full directory<Icon name="arrow" /></Link>
      </div>
    </PageIntro>
    <LocationDiscovery variant="page" />
    <DestinationsDirectory initialQuery={String(q)} initialType={String(type)} initialHas={has === '1' || has === 'true'} initialSort={String(sort)} />
  </main>;
}
