// Publisher education feeds only. Never accept a feed URL from a request.
export const educationFeeds = [
  { id: 'indian-express', name: 'The Indian Express', url: 'https://indianexpress.com/section/education/feed/', host: 'indianexpress.com', path: /^\/article\/education\//, imageHosts: ['images.indianexpress.com'] },
  { id: 'hindustan-times', name: 'Hindustan Times', url: 'https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml', host: 'www.hindustantimes.com', path: /^\/education\//, imageHosts: ['www.hindustantimes.com'] },
  { id: 'et-education', name: 'ET Education', url: 'https://education.economictimes.indiatimes.com/rss/recentstories', host: 'education.economictimes.indiatimes.com', path: /^\/news\//, imageHosts: ['etimg.etb2bimg.com', 'education.economictimes.indiatimes.com'] },
];

export const newsCategories = ['admissions', 'exams', 'schools', 'higher-education', 'learning', 'policy'];
