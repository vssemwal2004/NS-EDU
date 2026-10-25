// Education news topics (ids match the feed classifier) and the cover-image policy.
// `publisher` shows the thumbnail each publisher puts in its own feed (hosts are still limited to
// the three publishers in next.config.mjs). `reviewed` shows only the URLs listed below — the feeds
// rotate within days, so a reviewed list goes stale and every story loses its picture.
export default {
  topics: [
    { id: 'all', label: 'All education', icon: 'news' },
    { id: 'admissions', label: 'Admissions & funding', icon: 'cap' },
    { id: 'exams', label: 'Exams & results', icon: 'document' },
    { id: 'schools', label: 'School education', icon: 'book' },
    { id: 'higher-education', label: 'Higher education', icon: 'cap' },
    { id: 'learning', label: 'Learning & EdTech', icon: 'laptop' },
    { id: 'policy', label: 'Education policy', icon: 'document' },
  ],
  imagePolicy: {
    mode: 'publisher',
    reviewedUrls: [],
  },
};
