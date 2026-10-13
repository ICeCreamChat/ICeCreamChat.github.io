import { initDynamics } from './dynamics.js?v=interactive-lab';

const themeControl = document.querySelector('#theme-mode');
const root = document.documentElement;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
themeControl.value = root.dataset.themePreference || 'light';
themeControl.closest('label').hidden = false;
function applyTheme(preference) {
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
  document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#192329' : '#f6f8fa';
  document.dispatchEvent(new Event('themechange'));
}
themeControl.addEventListener('change', () => {
  applyTheme(themeControl.value);
  try { localStorage.setItem('bin-xu-theme', themeControl.value); } catch { /* Keep the selected theme for this visit. */ }
});
systemTheme.addEventListener('change', () => { if (themeControl.value === 'system') applyTheme('system'); });
window.addEventListener('storage', event => {
  if (event.key !== 'bin-xu-theme') return;
  themeControl.value = ['light', 'dark', 'system'].includes(event.newValue) ? event.newValue : 'light';
  applyTheme(themeControl.value);
});

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');
menuButton.hidden = false;
document.querySelector('.site-header').dataset.menuReady = 'true';
function closeMenu() {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu(); menuButton.focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

if ('IntersectionObserver' in window) {
  const sections = [...document.querySelectorAll('main section[id]:not(#top)')];
  const activeSections = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? activeSections.add(entry.target.id) : activeSections.delete(entry.target.id));
    const current = sections.find(section => activeSections.has(section.id));
    navigation.querySelectorAll('a').forEach(link => {
      if (link.hash === '#' + current?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-90px 0px -45% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

document.querySelector('.publication-tools').hidden = false;
const filters = [...document.querySelectorAll('[data-filter-year]')];
const groups = [...document.querySelectorAll('.publication-group')];
const filterStatus = document.querySelector('#filter-status');
function filterPapers(year) {
  filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter.dataset.filterYear === year)));
  let count = 0;
  groups.forEach(group => {
    group.hidden = year !== 'all' && group.dataset.year !== year;
    if (!group.hidden) count += group.querySelectorAll('.publication-row').length;
  });
  filterStatus.textContent = `显示${year === 'all' ? '全部年份' : year + ' 年'}的 ${count} 篇论文`;
}
filters.forEach(button => button.addEventListener('click', () => {
  const year = button.dataset.filterYear;
  filterPapers(year);
  const url = new URL(location.href);
  if (year === 'all') url.searchParams.delete('year');
  else url.searchParams.set('year', year);
  history.replaceState(null, '', url);
}));
const requestedYear = new URL(location.href).searchParams.get('year');
if (filters.some(filter => filter.dataset.filterYear === requestedYear)) filterPapers(requestedYear);

let noticeTimer;
const copyStatus = document.querySelector('#copy-status');
function notify(message) {
  clearTimeout(noticeTimer);
  copyStatus.textContent = message;
  noticeTimer = setTimeout(() => { copyStatus.textContent = ''; }, 4500);
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Use the local fallback below. */ }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('aria-label', '引用文本');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  return copied;
}
document.querySelectorAll('.copy-citation').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const copied = await copyText(button.dataset.citation);
      notify(copied ? '论文引用已复制' : '复制未成功，可以下载 BibTeX 或从 DOI 页面获取引用。');
    } catch {
      notify('复制未成功，可以下载 BibTeX 或从 DOI 页面获取引用。');
    } finally { button.disabled = false; button.focus({ preventScroll: true }); }
  });
});

const yearElement = document.querySelector('.site-footer');
if (yearElement) {
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date());
  yearElement.firstElementChild.textContent = `© ${year} 许斌 / Bin Xu`;
}
initDynamics();
