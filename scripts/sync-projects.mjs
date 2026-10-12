import { readFile, writeFile } from 'node:fs/promises';
const dataUrl = new URL('../data/projects.json', import.meta.url);
const data = JSON.parse(await readFile(dataUrl, 'utf8'));
const repositories = new Map();
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/users/ICeCreamChat/repos?per_page=100&type=owner&page=${page}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BinXuHomepage/2.0' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}; project data was preserved.`);
  const batch = await response.json();
  for (const repo of batch) repositories.set(repo.name, repo);
  if (batch.length < 100) break;
}
for (const project of data.items) {
  const repository = repositories.get(project.repo);
  if (!repository || repository.fork) throw new Error(`Project requires review: ${project.repo}`);
  project.pushedAt = repository.pushed_at;
}
data.items.sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
// Keep the two most recently updated projects in the larger presentation.
data.items.forEach((project, index) => { project.featured = index < 2; });
data.updated = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date());
await writeFile(dataUrl, JSON.stringify(data, null, 2) + '\n');
console.log(`Refreshed dates for ${data.items.length} projects. Descriptions remain editable in data/projects.json.`);
