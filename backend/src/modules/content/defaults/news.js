// Education news topics (ids match the feed classifier) and the reviewed-cover image policy.
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
    mode: 'reviewed',
    reviewedUrls: [
      'https://etimg.etb2bimg.com/thumb/img-size-108414/134766315.cms',
      'https://etimg.etb2bimg.com/thumb/img-size-14738/134766198.cms',
      'https://etimg.etb2bimg.com/thumb/img-size-207852/134764718.cms',
    ],
  },
};
