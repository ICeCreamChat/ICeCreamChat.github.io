import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
function projectVisual(type) {
  if (type === 'classroom') return `<svg aria-hidden="true" viewBox="0 0 460 126"><g class="project-visual-soft"><path d="M157 63h35m70 0h44M306 63V25h28M306 63h28M306 63v38h28"/><rect x="68" y="37" width="89" height="53" rx="5"/><rect x="194" y="39" width="66" height="49" rx="8"/></g><path d="M99 55v14l12-4V54l-12-4Zm13 0h9v12h-9m-6 3v8m-9 0h17"/><circle cx="226" cy="63" r="13"/><path d="M218 63h16m-8-8v16"/><g><rect x="335" y="13" width="53" height="25" rx="4"/><rect x="335" y="51" width="53" height="25" rx="4"/><rect x="335" y="89" width="53" height="25" rx="4"/></g><g class="project-visual-amber"><circle cx="377" cy="25" r="2"/><circle cx="377" cy="63" r="2"/><circle cx="377" cy="101" r="2"/></g><text x="95" y="109">教师</text><text x="213" y="109">云端</text><text x="400" y="30">班级</text><text x="400" y="68">班级</text><text x="400" y="106">班级</text></svg>`;
  return `<svg aria-hidden="true" viewBox="0 0 460 126"><g class="project-visual-soft"><path d="M31 93h160M45 16v93M244 64h180M251 18v90"/><circle cx="116" cy="61" r="39"/></g><path d="M65 91 116 22l64 69Zm51-69v69M65 91l89-54"/><g class="project-visual-amber"><circle cx="116" cy="22" r="3"/><circle cx="65" cy="91" r="3"/><circle cx="180" cy="91" r="3"/><path d="M251 64c14-57 29-57 43 0s29 57 43 0 29-57 43 0 29 57 43 0"/></g><text x="84" y="118">动态几何</text><text x="305" y="118">数学动画</text></svg>`;
}
function projectDate(project) {
  return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(project.pushedAt));
}
const technologies = project => `<ul class="technology-list" aria-label="技术与工具">${project.technologies.map(technology => `<li>${escape(technology)}</li>`).join('')}</ul>`;
function projectCard(project) {
  const url = `https://github.com/ICeCreamChat/${project.repo}`;
  return `<article class="project-featured" data-updated="${escape(project.pushedAt)}"><div class="project-visual">${projectVisual(project.visual)}</div><div class="project-content"><div class="project-meta"><span>${escape(project.category)}</span><span>更新于 <time datetime="${projectDate(project)}">${projectDate(project)}</time></span></div><h3><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(project.name)}</a></h3><p class="project-description">${escape(project.description)}</p>${technologies(project)}<a class="project-repo-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">查看源码 ${externalIcon}</a></div></article>`;
}
function projectRow(project) {
  const url = `https://github.com/ICeCreamChat/${project.repo}`;
  return `<article class="project-compact" data-updated="${escape(project.pushedAt)}"><h3><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(project.name)}</a></h3><time datetime="${projectDate(project)}">${projectDate(project)}</time><p class="project-description">${escape(project.description)}</p>${technologies(project)}</article>`;
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
  projects: groupByYear(projects, project => Number(projectDate(project).slice(0, 4))).map(group => {
    const cards = group.items.filter(project => project.featured);
    const rows = group.items.filter(project => !project.featured);
    // Featured entries must also be the newest entries in their year.
    if (group.items.some((project, index) => project.featured && group.items.slice(0, index).some(earlier => !earlier.featured))) throw new Error('Featured project order would violate chronological order');
    return `<section class="project-group" aria-labelledby="projects-${group.year}"><h3 class="project-year" id="projects-${group.year}">${group.year}</h3>${cards.length ? `<div class="featured-projects">${cards.map(projectCard).join('\n')}</div>` : ''}${rows.length ? `<div class="compact-projects">${rows.map(projectRow).join('\n')}</div>` : ''}</section>`;
  }).join('\n'),
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
await mkdir(path.join(root, 'assets/img'), { recursive: true });
let spiralPaths = '';
for (const [shift, color] of [[Math.PI / 2, '#72d8d2'], [Math.PI * 1.5, '#f0c98a']]) {
  for (let turn = 0; turn < 7; turn++) {
    let d = '';
    for (let point = 0; point <= 240; point++) {
      const angle = point / 240 * Math.PI * 2;
      const radius = (shift - angle + turn * Math.PI * 2) / (Math.PI * 2 * 5);
      if (radius < 0 || radius > 1) continue;
      d += `${d ? 'L' : 'M'}${(240 + radius * 207 * Math.cos(angle)).toFixed(2)},${(240 - radius * 207 * Math.sin(angle)).toFixed(2)}`;
    }
    if (d) spiralPaths += `<path d="${d}" stroke="${color}" stroke-width="15" opacity=".12"/><path d="${d}" stroke="${color}" stroke-width="4" opacity=".8"/>`;
  }
}
await writeFile(path.join(root, 'assets/img/wave-preview.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480"><circle cx="240" cy="240" r="211" fill="#0c1e32"/><g fill="none">${spiralPaths}<circle cx="240" cy="240" r="207" stroke="#30475d"/></g><circle cx="240" cy="240" r="2" fill="#eef4fa"/></svg>`);
console.log(`Built static homepage: ${publications.length} papers, ${projects.length} projects, ${profile.honors.length} honors.`);
