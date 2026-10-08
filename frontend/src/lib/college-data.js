import { staticCollegeRecords } from '@/data/colleges';

// Replace this server-side loader with the Express API when the directory is ready.
export async function getCollegeRecords() { return staticCollegeRecords; }
