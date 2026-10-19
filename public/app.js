(() => {
  const CART_KEY = 'colara-cart-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let catalog = null;
  let cart = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(raw) ? raw.filter((l) => l && l.id && l.qty > 0) : [];
    } catch {
      return [];
    }
  }
  function save() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage blocked */ }
  }

  const fmt = (bani) =>
    new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: bani % 100 ? 2 : 0 })
      .format(bani / 100).replace('RON', 'lei');
  const product = (id) => catalog?.products.find((p) => p.id === id);
  const maxQty = () => catalog?.maxQtyPerLine ?? 10;

  function add(id, qty) {
    const line = cart.find((l) => l.id === id);
    if (line) line.qty = Math.min(line.qty + qty, maxQty());
    else cart.push({ id, qty: Math.min(qty, maxQty()) });
    save();
    render();
    openCart();
  }
  function setQty(id, qty) {
    cart = cart.map((l) => (l.id === id ? { ...l, qty: Math.min(qty, maxQty()) } : l)).filter((l) => l.qty > 0);
    save();
    render();
  }

  function render() {
    if (!catalog) return;
    cart = cart.filter((l) => product(l.id));
    const count = cart.reduce((n, l) => n + l.qty, 0);
    const subtotal = cart.reduce((s, l) => s + product(l.id).price * l.qty, 0);

    const badge = $('[data-cart-count]');
    badge.textContent = count;
    badge.hidden = count === 0;

    const items = $('[data-cart-items]');
    const foot = $('[data-cart-foot]');
    foot.hidden = count === 0;
    items.replaceChildren();

    if (count === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Coșul tău este gol.';
      items.append(p);
      return;
    }

    for (const l of cart) {
      const p = product(l.id);
      const row = document.createElement('div');
      row.className = 'line';
      row.innerHTML = `
        <img src="${p.image}" alt="" width="72" height="72">
        <div>
          <h3></h3>
          <div class="qty" role="group" aria-label="Cantitate">
            <button type="button" data-dec aria-label="Scade cantitatea">−</button>
            <output>${l.qty}</output>
            <button type="button" data-inc aria-label="Crește cantitatea">+</button>
          </div>
          <button class="remove" type="button" data-remove>Șterge</button>
        </div>
        <strong>${fmt(p.price * l.qty)}</strong>`;
      $('h3', row).textContent = p.name;
      $('[data-dec]', row).onclick = () => setQty(l.id, l.qty - 1);
      $('[data-inc]', row).onclick = () => setQty(l.id, l.qty + 1);
      $('[data-remove]', row).onclick = () => setQty(l.id, 0);
      items.append(row);
    }

    $('[data-subtotal]').textContent = fmt(subtotal);
    const note = $('[data-ship-note]');
    const missing = catalog.freeShippingFrom - subtotal;
    note.replaceChildren();
    const text = document.createElement('div');
    text.textContent = missing > 0
      ? `Mai adaugă ${fmt(missing)} pentru transport gratuit.`
      : 'Ai transport gratuit!';
    const track = document.createElement('div');
    track.className = 'bar-track';
    track.innerHTML = '<div class="bar-fill"></div>';
    $('.bar-fill', track).style.width = `${Math.min(100, (subtotal / catalog.freeShippingFrom) * 100)}%`;
    note.append(text, track);
  }

  function openCart() {
    $('#cart').classList.add('open');
    $('#cart').setAttribute('aria-hidden', 'false');
    $('.overlay').hidden = false;
  }
  function closeCart() {
    $('#cart').classList.remove('open');
    $('#cart').setAttribute('aria-hidden', 'true');
    $('.overlay').hidden = true;
  }

  async function checkout(btn) {
    const err = $('[data-error]');
    err.hidden = true;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Se încarcă…';
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: cart.map(({ id, qty }) => ({ id, qty })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Eroare necunoscută.');
      window.location.assign(data.url);
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  async function init() {
    $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

    try {
      catalog = await (await fetch('/catalog.json', { cache: 'no-cache' })).json();
    } catch {
      return;
    }

    // Prețuri afișate din catalog (o singură sursă de adevăr)
    for (const p of catalog.products) {
      $$(`[data-price="${p.id}"]`).forEach((el) => (el.textContent = fmt(p.price)));
      $$(`[data-compare="${p.id}"]`).forEach((el) => (el.textContent = fmt(p.compareAt)));
    }

    let qty = 1;
    const out = $('[data-qty-value]');
    if (out) {
      $('[data-qty-minus]').onclick = () => { qty = Math.max(1, qty - 1); out.textContent = qty; };
      $('[data-qty-plus]').onclick = () => { qty = Math.min(maxQty(), qty + 1); out.textContent = qty; };
    }
    $$('[data-add]').forEach((b) => (b.onclick = () => add(b.dataset.add, qty)));
    $$('[data-open-cart]').forEach((b) => (b.onclick = openCart));
    $$('[data-close-cart]').forEach((b) => (b.onclick = closeCart));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCart());
    const co = $('[data-checkout]');
    co.onclick = () => checkout(co);

    render();
  }

  window.addEventListener('pageshow', (e) => { if (e.persisted) { cart = load(); render(); } });
  init();
})();
