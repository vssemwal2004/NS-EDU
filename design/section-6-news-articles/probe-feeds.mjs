const feeds = [
  ['Indian Express', 'https://indianexpress.com/section/education/feed/'],
  ['Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml'],
  ['ET Education', 'https://education.economictimes.indiatimes.com/rss/recentstories'],
];
for (const [name, url] of feeds) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'NSEDU/0.1 (+education feed reader)', Accept: 'application/rss+xml, application/xml, text/xml' } });
    const body = await response.text();
    console.log(JSON.stringify({ name, status: response.status, bytes: body.length, preview: body.slice(0, 500), firstItem: body.match(/<item[\s>][\s\S]*?<\/item>/)?.[0]?.slice(0, 2600) }));
  } catch (error) { console.log(JSON.stringify({ name, error: error.message })); }
}
