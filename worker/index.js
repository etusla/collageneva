// Cloudflare Worker girişi (workers.dev için). Statik dosyalar public/ içinden servis edilir,
// yalnızca /api/* istekleri bu Worker'dan geçer. Pages yayını functions/ klasörünü kullanmaya devam eder.
import { onRequestPost } from '../functions/api/checkout.js';
import { onRequestGet as getOrder } from '../functions/api/order.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/checkout') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
      return onRequestPost({ request, env });
    }
    if (pathname === '/api/order') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
      return getOrder({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
