import { readFile, writeFile } from 'node:fs/promises';
const dataUrl = new URL('../data/publications.json', import.meta.url);
const orcid = '0009-0009-6216-2201';
async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'BinXuHomepage/2.0 (https://icecreamchat.github.io/)' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`${response.status} from ${url}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
const previous = JSON.parse(await readFile(dataUrl, 'utf8'));
const works = await getJson(`https://pub.orcid.org/v3.0/${orcid}/works`);
const records = new Map();
for (const group of works.group || []) {
  for (const work of group['work-summary'] || []) {
    if (work.type !== 'journal-article') continue;
    const doi = work['external-ids']?.['external-id']?.find(identifier => identifier['external-id-type'] === 'doi' && identifier['external-id-relationship'] === 'self')?.['external-id-value'];
    if (doi) records.set(doi.toLowerCase(), work);
  }
}
if (!records.size) throw new Error('No public journal articles found; the current publication list has been preserved.');
const items = [];
// Only two articles at a time to keep the public metadata services responsive.
const entries = [...records.entries()];
for (let offset = 0; offset < entries.length; offset += 2) {
  const batch = await Promise.all(entries.slice(offset, offset + 2).map(async ([doi, work]) => {
    const crossref = (await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)).message;
    const date = crossref.published?.['date-parts']?.[0];
    if (!date?.[0] || !crossref.author?.length || !crossref.title?.[0]) throw new Error(`Incomplete DOI metadata: ${doi}`);
    const authors = crossref.author.map(author => `${author.given || ''} ${author.family || ''}`.trim());
    if (!authors.includes('Bin Xu')) throw new Error(`Author name requires review: ${doi}`);
    const clean = value => String(value).replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    return { title: clean(crossref.title[0]), authors, journal: clean(crossref['container-title'][0]), year: date[0], sortDate: [date[0], date[1] || 1, date[2] || 1].map((part, index) => index ? String(part).padStart(2, '0') : part).join('-'), volume: crossref.volume || '', issue: crossref.issue || '', article: crossref['article-number'] || crossref.page || '', doi, orcidPutCode: work['put-code'] };
  }));
  items.push(...batch);
}
// Preserve verified entries if an ORCID record is hidden or temporarily removed.
for (const old of previous.items) if (!records.has(old.doi.toLowerCase())) items.push(old);
items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
const updated = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date());
await writeFile(dataUrl, JSON.stringify({ updated, source: `https://orcid.org/${orcid}`, items }, null, 2) + '\n');
console.log(`Updated ${items.length} papers. Run npm run build to rebuild the homepage.`);
