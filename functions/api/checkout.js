// POST /api/checkout  ->  { url }  (Stripe Checkout Session)
// Prețurile vin DOAR din public/catalog.json; clientul trimite numai id + cantitate.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Plata nu este configurată încă.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cerere invalidă.' }, 400);
  }

  const origin = env.SITE_URL || new URL(request.url).origin;
  const catalogRes = await env.ASSETS.fetch(new URL('/catalog.json', request.url));
  const catalog = await catalogRes.json();
  const byId = new Map(catalog.products.map((p) => [p.id, p]));

  // Validare + unificare linii
  const qtyById = new Map();
  for (const item of Array.isArray(body.items) ? body.items.slice(0, 20) : []) {
    const qty = Number(item?.qty);
    if (!byId.has(item?.id) || !Number.isInteger(qty) || qty < 1) continue;
    qtyById.set(item.id, Math.min((qtyById.get(item.id) || 0) + qty, catalog.maxQtyPerLine));
  }
  if (qtyById.size === 0) return json({ error: 'Coșul este gol.' }, 400);

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('locale', 'ro');
  params.set('success_url', `${origin}/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/?checkout=anulat#produs`);
  params.set('shipping_address_collection[allowed_countries][0]', 'RO');
  params.set('billing_address_collection', 'auto');
  params.set('phone_number_collection[enabled]', 'true');
  params.set('allow_promotion_codes', 'true');
  params.set(
    'custom_text[submit][message]',
    `Prin plasarea comenzii accepți [Termenii și condițiile](${origin}/termeni) și [Politica de livrare și retur](${origin}/livrare-retur).`,
  );

  let i = 0;
  const summary = [];
  for (const [id, qty] of qtyById) {
    const p = byId.get(id);
    summary.push(`${id} x${qty}`);
    const k = `line_items[${i++}]`;
    params.set(`${k}[quantity]`, String(qty));
    params.set(`${k}[price_data][currency]`, catalog.currency);
    params.set(`${k}[price_data][unit_amount]`, String(p.price));
    params.set(`${k}[price_data][tax_behavior]`, 'inclusive');
    params.set(`${k}[price_data][product_data][name]`, p.name);
    if (p.stripeImage) params.set(`${k}[price_data][product_data][images][0]`, `${origin}${p.stripeImage}`);
  }
  params.set('metadata[items]', summary.join(', ').slice(0, 480));

  // Transportul prin DPD este inclus în preț (livrare la adresă, gratuită pentru client)
  params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.set('shipping_options[0][shipping_rate_data][display_name]', 'Livrare gratuită prin DPD, la adresă');
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', catalog.currency);
  params.set('shipping_options[0][shipping_rate_data][tax_behavior]', 'inclusive');
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '2');
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '4');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    console.error('Stripe error', res.status, JSON.stringify(data?.error || data));
    return json({ error: 'Nu am putut porni plata. Încearcă din nou.' }, 502);
  }
  return json({ url: data.url });
}
