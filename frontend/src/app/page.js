import LandingPage from '@/features/landing/LandingPage';
import { getCollegeRecords } from '@/lib/college-data';
export default async function Home() { return <LandingPage collegeRecords={await getCollegeRecords()} />; }
