// GET /api/order?session_id=cs_...  ->  rezumatul comenzii pentru pagina /success
// Returnează doar ce vede deja clientul: nr. comandă, produse, total, e-mail.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ error: 'Cerere invalidă.' }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Plata nu este configurată încă.' }, 500);

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${id}?expand[]=line_items`,
    { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
  );
  const s = await res.json();
  if (!res.ok) {
    console.error('Stripe error', res.status, JSON.stringify(s?.error || s));
    return json({ error: 'Comanda nu a fost găsită.' }, 404);
  }

  return json({
    ref: s.client_reference_id || s.metadata?.order_ref || null,
    paid: s.payment_status === 'paid',
    email: s.customer_details?.email || null,
    total: s.amount_total,
    currency: s.currency,
    items: (s.line_items?.data || []).map((l) => ({ name: l.description, qty: l.quantity })),
  });
}
