// Çerez / izin yönetimi (AB: GDPR + ePrivacy). Varsayılan: yalnızca zorunlu depolama.
// Analitik / pazarlama etiketleri EKLENİRSE yalnızca ilgili izin verilmişse yüklenmelidir:
//   window.evaConsent.onChange((c) => { if (c.analytics) { /* analitik betiğini yükle */ } });
(() => {
  const KEY = 'eva-consent-v1';
  const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 ay sonra yeniden sor
  const listeners = [];

  const read = () => {
    try {
      const c = JSON.parse(localStorage.getItem(KEY));
      if (c && c.v === 1 && Date.now() - c.ts < MAX_AGE_MS) return c;
    } catch { /* yok sayılır */ }
    return null;
  };
  const store = (analytics, marketing) => {
    const c = { v: 1, ts: Date.now(), necessary: true, analytics, marketing };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* depolama kapalı */ }
    listeners.forEach((fn) => fn(c));
    return c;
  };
  window.evaConsent = {
    get: () => read() || { necessary: true, analytics: false, marketing: false },
    onChange: (fn) => { listeners.push(fn); const c = read(); if (c) fn(c); },
  };

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  let banner;

  function close() { banner?.remove(); banner = null; }

  function open(startInPrefs = false) {
    close();
    const cur = window.evaConsent.get();
    banner = el(`
      <div class="cc" role="dialog" aria-modal="false" aria-labelledby="cc-title" aria-describedby="cc-text">
        <div class="cc-main">
          <h2 id="cc-title">Respectăm confidențialitatea ta</h2>
          <p id="cc-text">Folosim doar stocare strict necesară (coșul de cumpărături și alegerea ta privind cookie-urile). Cu acordul tău am putea folosi în viitor și cookie-uri de analiză sau de marketing. Poți accepta, respinge sau alege. Detalii în <a href="/politica-cookies">Politica de cookie-uri</a>.</p>
          <div class="cc-prefs" hidden>
            <label class="cc-row"><span><strong>Strict necesare</strong><small>Coș de cumpărături, preferințe de consimțământ. Mereu active.</small></span><input type="checkbox" checked disabled></label>
            <label class="cc-row"><span><strong>Analiză</strong><small>Statistici anonime despre utilizarea site-ului.</small></span><input type="checkbox" name="analytics"${cur.analytics ? ' checked' : ''}></label>
            <label class="cc-row"><span><strong>Marketing</strong><small>Măsurarea și personalizarea reclamelor.</small></span><input type="checkbox" name="marketing"${cur.marketing ? ' checked' : ''}></label>
          </div>
          <div class="cc-actions">
            <button type="button" class="cc-btn" data-cc="reject">Respinge toate</button>
            <button type="button" class="cc-btn" data-cc="prefs">Personalizează</button>
            <button type="button" class="cc-btn cc-save" data-cc="save" hidden>Salvează alegerea</button>
            <button type="button" class="cc-btn" data-cc="accept">Acceptă toate</button>
          </div>
        </div>
      </div>`);
    const prefs = banner.querySelector('.cc-prefs');
    const q = (a) => banner.querySelector(`[data-cc="${a}"]`);
    const showPrefs = () => { prefs.hidden = false; q('prefs').hidden = true; q('save').hidden = false; };
    q('reject').onclick = () => { store(false, false); close(); };
    q('accept').onclick = () => { store(true, true); close(); };
    q('prefs').onclick = showPrefs;
    q('save').onclick = () => {
      store(!!banner.querySelector('[name="analytics"]').checked, !!banner.querySelector('[name="marketing"]').checked);
      close();
    };
    document.body.append(banner);
    if (startInPrefs) showPrefs();
  }

  function init() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); open(true); }
    });
    if (!read()) open(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
