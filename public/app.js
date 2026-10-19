(() => {
  const CART_KEY = 'colara-cart-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let catalog = null;
  let cart = load();
  let pending = { items: [], fromCart: false, order: null };

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
  const selectedId = () => $('input[name="bundle"]:checked')?.value ?? catalog.products[0].id;
  const totalOf = (items) => items.reduce((s, l) => s + product(l.id).price * l.qty, 0);

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

  // Fiyatları ve tasarruf metinlerini katalogdan doldur (tek doğruluk kaynağı)
  function fillPrices() {
    const unitBase = catalog.products[0].price;
    for (const p of catalog.products) {
      $$(`[data-price="${p.id}"]`).forEach((el) => (el.textContent = fmt(p.price)));
      $$(`[data-compare="${p.id}"]`).forEach((el) => (el.textContent = fmt(p.compareAt)));
      $$(`[data-unit="${p.id}"]`).forEach((el) => (el.textContent = `${fmt(Math.round(p.price / p.units))} / pachet`));
      $$(`[data-save="${p.id}"]`).forEach((el) => {
        const saved = unitBase * p.units - p.price;
        el.textContent = saved > 0 ? `economisești ${fmt(saved)}` : '';
      });
    }
  }

  function renderSelected() {
    const p = product(selectedId());
    if (!p) return;
    $('[data-sel-price]').textContent = fmt(p.price);
    $('[data-sel-compare]').textContent = p.compareAt > p.price ? fmt(p.compareAt) : '';
    $('[data-sel-ship]').textContent = 'Livrare gratuită prin DPD inclusă';
  }

  function render() {
    if (!catalog) return;
    cart = cart.filter((l) => product(l.id));
    const count = cart.reduce((n, l) => n + l.qty, 0);

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

    $('[data-subtotal]').textContent = fmt(totalOf(cart));
    $('[data-ship-note]').textContent = 'Livrare gratuită prin DPD inclusă.';
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

  // ---------- Ödeme penceresi: kart (Stripe) veya IBAN havalesi ----------
  const dlg = () => $('#checkout');
  const showStep = (name) => $$('[data-step]', dlg()).forEach((s) => (s.hidden = s.dataset.step !== name));

  function openCheckout(items, fromCart) {
    if (!items.length) return;
    pending = { items, fromCart, order: null };
    closeCart();
    const list = $('[data-co-summary]');
    list.replaceChildren();
    for (const l of items) {
      const p = product(l.id);
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${l.qty > 1 ? l.qty + ' × ' : ''}${p.name}`;
      const price = document.createElement('strong');
      price.textContent = fmt(p.price * l.qty);
      li.append(name, price);
      list.append(li);
    }
    $('[data-co-total]').textContent = fmt(totalOf(items));
    $('[data-co-error]').hidden = true;
    showStep('method');
    dlg().showModal();
  }

  async function payByCard(btn) {
    const err = $('[data-co-error]');
    err.hidden = true;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Se încarcă…';
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: pending.items.map(({ id, qty }) => ({ id, qty })) }),
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

  function newRef() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `EVA-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
  }

  function finishTransfer(form) {
    const f = Object.fromEntries(new FormData(form));
    const ref = newRef();
    const total = totalOf(pending.items);
    const { iban, beneficiary } = catalog.bankTransfer;
    const lines = pending.items.map((l) => `- ${l.qty} x ${product(l.id).name}`);
    const text = [
      `Comandă nouă (transfer bancar) ${ref}`,
      ...lines,
      `Total: ${fmt(total)} (transport DPD inclus)`,
      '',
      `Nume: ${f.name}`,
      `Telefon: ${f.phone}`,
      `E-mail: ${f.email}`,
      `Adresă: ${f.street}, ${f.city}, jud. ${f.county}${f.zip ? ', ' + f.zip : ''}`,
      '',
      `Plătesc prin transfer bancar în contul ${beneficiary}, ${iban}.`,
    ].join('\n');

    pending.order = { ref };
    $('[data-co-ref]').textContent = ref;
    $('[data-bank-name]').textContent = beneficiary;
    $('[data-bank-iban]').textContent = iban;
    $('[data-bank-amount]').textContent = fmt(total);
    $('[data-bank-ref]').textContent = ref;
    $('[data-wa-send]').href = `https://wa.me/${catalog.contact.whatsapp}?text=${encodeURIComponent(text)}`;
    showStep('done');
  }

  async function init() {
    $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

    try {
      catalog = await (await fetch('/catalog.json', { cache: 'no-cache' })).json();
    } catch {
      return;
    }

    fillPrices();
    renderSelected();
    $$('input[name="bundle"]').forEach((r) => r.addEventListener('change', renderSelected));

    $('[data-add-selected]').onclick = () => add(selectedId(), 1);
    // "Cumpără acum": doar setul ales merge la plată; coșul rămâne neschimbat
    $('[data-buy-now]').onclick = () => openCheckout([{ id: selectedId(), qty: 1 }], false);
    $('[data-checkout]').onclick = () => openCheckout(cart.map((l) => ({ ...l })), true);

    $$('[data-open-cart]').forEach((b) => (b.onclick = openCart));
    $$('[data-close-cart]').forEach((b) => (b.onclick = closeCart));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCart());

    const d = dlg();
    $('[data-co-close]', d).onclick = () => d.close();
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    const cont = $('[data-co-continue]', d);
    cont.onclick = () => {
      const method = $('input[name="pay"]:checked', d).value;
      if (method === 'card') payByCard(cont);
      else showStep('details');
    };
    $('[data-co-back]', d).onclick = () => showStep('method');
    $('form[data-step="details"]', d).addEventListener('submit', (e) => {
      e.preventDefault();
      finishTransfer(e.currentTarget);
    });
    $('[data-copy-iban]', d).onclick = async (e) => {
      try {
        await navigator.clipboard.writeText(catalog.bankTransfer.iban.replace(/\s/g, ''));
        e.currentTarget.textContent = 'Copiat ✓';
      } catch {
        e.currentTarget.textContent = 'Selectează manual';
      }
    };
    // După trimiterea comenzii pe WhatsApp, golește coșul (dacă comanda a venit din coș)
    $('[data-wa-send]', d).addEventListener('click', () => {
      if (pending.fromCart) { cart = []; save(); render(); }
    });

    render();
  }

  window.addEventListener('pageshow', (e) => { if (e.persisted) { cart = load(); render(); } });
  init();
})();
