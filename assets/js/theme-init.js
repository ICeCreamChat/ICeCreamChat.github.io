// Run before the stylesheet to apply a saved theme without a light flash.
(() => {
  let preference = 'light';
  try {
    const saved = localStorage.getItem('bin-xu-theme');
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch { /* The theme still works when browser storage is unavailable. */ }
  const theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#192329' : '#f6f8fa';
})();
