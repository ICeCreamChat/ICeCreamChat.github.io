import { initWave } from './wave.js';

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
matchMedia('(min-width: 681px)').addEventListener('change', closeMenu);

document.querySelector('.publication-tools').hidden = false;
const filters = [...document.querySelectorAll('[data-filter-year]')];
const groups = [...document.querySelectorAll('.publication-group')];
const filterStatus = document.querySelector('#filter-status');
filters.forEach(button => {
  button.addEventListener('click', () => {
    const year = button.dataset.filterYear;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    let count = 0;
    groups.forEach(group => {
      group.hidden = year !== 'all' && group.dataset.year !== year;
      if (!group.hidden) count += group.querySelectorAll('.publication-row').length;
    });
    filterStatus.textContent = `显示${year === 'all' ? '全部年份' : year + ' 年'}的 ${count} 篇论文`;
  });
});

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
initWave();
