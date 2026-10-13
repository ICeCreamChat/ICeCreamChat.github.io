import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [profile, publicationData, projectData, template] = await Promise.all([
  readJson('data/profile.json'), readJson('data/publications.json'), readJson('data/projects.json'),
  readFile(path.join(root, 'templates/index.html'), 'utf8')
]);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const externalIcon = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4 12 12 4M4 4h8v8"/></svg>';
const groupByYear = (items, getYear) => [...new Set(items.map(getYear))].sort((a, b) => b - a).map(year => ({ year, items: items.filter(item => getYear(item) === year) }));
const publications = [...publicationData.items].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
const projects = [...projectData.items].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
const uniqueDois = new Set(publications.map(paper => paper.doi.toLowerCase()));
if (uniqueDois.size !== publications.length) throw new Error('Duplicate publication DOI');
for (const paper of publications) {
  if (!paper.title || !paper.authors?.length || !paper.journal || !paper.year || !/^10\.\d{4,9}\//.test(paper.doi)) throw new Error(`Incomplete publication: ${paper.doi}`);
  if (!paper.authors.some(author => author === 'Bin Xu')) throw new Error(`Bin Xu is missing from ${paper.doi}`);
}
for (const project of projects) {
  if (!/^[A-Za-z0-9_.-]+$/.test(project.repo) || !project.description || !project.technologies?.length) throw new Error(`Incomplete project: ${project.repo}`);
}
function citation(paper) {
  return `${paper.authors.join(', ')} (${paper.year}). ${paper.title}. ${paper.journal}${paper.volume ? ', ' + paper.volume : ''}${paper.issue ? '(' + paper.issue + ')' : ''}${paper.article ? ', ' + paper.article : ''}. https://doi.org/${paper.doi}`;
}
function publicationRow(paper) {
  const url = `https://doi.org/${paper.doi}`;
  const issueDate = paper.sortDate.slice(0, 7);
  const detail = [paper.volume ? `Vol. ${paper.volume}` : '', paper.article].filter(Boolean).join(', ');
  return `<article class="publication-row" data-doi="${escape(paper.doi)}" data-date="${escape(paper.sortDate)}">
    <div class="publication-journal"><span>${escape(paper.journal)}</span><span class="publication-date">${escape(detail)}${detail ? ' / ' : ''}<time datetime="${issueDate}">刊期 ${issueDate}</time></span></div>
    <h3 class="publication-title" lang="en"><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(paper.title)}</a></h3>
    <p class="publication-authors" lang="en">${paper.authors.map(author => author === 'Bin Xu' ? `<strong>${escape(author)}</strong>` : escape(author)).join(', ')}</p>
    <div class="publication-actions"><a class="doi-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">DOI: ${escape(paper.doi)} ${externalIcon}</a><button class="copy-citation" type="button" data-citation="${escape(citation(paper))}" aria-label="复制论文引用：${escape(paper.title)}" hidden>复制引用</button></div>
  </article>`;
}
function projectDate(project) {
  return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(project.pushedAt));
}
const technologies = project => `<ul class="technology-list" aria-label="技术与工具">${project.technologies.map(technology => `<li>${escape(technology)}</li>`).join('')}</ul>`;
function projectRow(project) {
  const url = `https://github.com/ICeCreamChat/${project.repo}`;
  return `<article class="project-row" data-updated="${escape(project.pushedAt)}"><div class="project-row-heading"><h3><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(project.name)}</a></h3><span class="project-date">更新于 <time datetime="${projectDate(project)}">${projectDate(project)}</time></span></div><p class="project-category">${escape(project.category)}</p><p class="project-description">${escape(project.description)}</p><div class="project-details">${technologies(project)}<a class="project-repo-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">GitHub 源码</a></div></article>`;
}
const paperGroups = groupByYear(publications, paper => paper.year);
const tokens = {
  description: escape(`${profile.name}（${profile.englishName}），${profile.role}、${profile.qualification}。非线性动力学研究、学术论文与数学教学开源项目。`),
  bio: escape(profile.bio),
  structuredData: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: profile.name, alternateName: profile.englishName, jobTitle: profile.role, description: profile.bio, url: profile.site, sameAs: [profile.github, profile.orcid], knowsAbout: ['高中数学教学', '非线性动力学', '螺旋波', '数学建模'] }).replace(/</g, '\\u003c'),
  currentYear: new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date()),
  projectCount: projects.length,
  publicationCount: publications.length,
  publicationUpdated: escape(publicationData.updated),
  publicationFilters: `<button type="button" data-filter-year="all" aria-pressed="true">全部</button>${paperGroups.map(group => `<button type="button" data-filter-year="${group.year}" aria-pressed="false">${group.year}</button>`).join('')}`,
  publications: paperGroups.map(group => `<section class="publication-group" data-year="${group.year}" aria-labelledby="papers-${group.year}"><h3 class="publication-year" id="papers-${group.year}">${group.year}</h3><div>${group.items.map(publicationRow).join('\n')}</div></section>`).join('\n'),
  projects: groupByYear(projects, project => Number(projectDate(project).slice(0, 4))).map(group => `<section class="project-group" aria-labelledby="projects-${group.year}"><h3 class="project-year" id="projects-${group.year}">${group.year}</h3><div class="project-list">${group.items.map(projectRow).join('\n')}</div></section>`).join('\n'),
  honors: groupByYear(profile.honors, honor => honor.year).map(group => `<div class="honor-group"><h4 class="honor-year">${group.year}</h4><ul class="honor-list">${group.items.map(honor => `<li>${escape(honor.title)}<span class="honor-level">${escape(honor.level)}</span></li>`).join('')}</ul></div>`).join('\n'),
  education: [...profile.education].sort((a, b) => b.end - a.end).map(education => `<article class="education-item"><span class="education-time">${education.start}–${education.end}</span><h4>${escape(education.degree)} / ${escape(education.field)}</h4><p>${escape(education.school)}<span class="education-status">${escape(education.status)}</span></p></article>`).join('\n')
};
const html = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
  if (!(key in tokens)) throw new Error(`Unknown template token ${key}`);
  return tokens[key];
});
if (/攻读|预计|polyfill\.io|senli1073|ICe0330|background\.jpeg|sk-[A-Za-z0-9_-]{12,}/.test(html)) throw new Error('Obsolete content in the generated page');
await writeFile(path.join(root, 'index.html'), html);
const bibEscape = value => String(value).replace(/[&%#_]/g, character => '\\' + character);
const bibtex = publications.map(paper => `@article{Xu${paper.year}_${paper.doi.split('/').at(-1).replace(/[^a-z0-9]/gi, '')},\n  title = {${bibEscape(paper.title)}},\n  author = {${paper.authors.map(name => { const parts = name.split(' '); return bibEscape(parts.pop() + ', ' + parts.join(' ')); }).join(' and ')}},\n  journal = {${bibEscape(paper.journal)}},\n  year = {${paper.year}},\n${paper.volume ? `  volume = {${paper.volume}},\n` : ''}${paper.issue ? `  number = {${paper.issue}},\n` : ''}${paper.article ? `  pages = {${paper.article}},\n` : ''}  doi = {${paper.doi}},\n  url = {https://doi.org/${paper.doi}}\n}`).join('\n\n') + '\n';
await writeFile(path.join(root, 'data/publications.bib'), bibtex);
console.log(`Built static homepage: ${publications.length} papers, ${projects.length} projects, ${profile.honors.length} honors.`);
