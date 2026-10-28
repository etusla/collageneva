// SEO / GEO üreticisi: canonical + Open Graph + hreflang, JSON-LD (Organization, WebSite, Product,
// FAQPage), sitemap.xml, robots.txt ve llms.txt dosyalarını üretir.
//
//   npm run seo                          -> site.config.json içindeki base ile
//   npm run seo -- https://alanadi.ro    -> base'i değiştirir, kaydeder ve her şeyi yeniden üretir
//
// Başlık/description her sayfanın kendi HTML'inden okunur; fiyatlar public/catalog.json'dan gelir.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'public');
const cfgPath = path.join(root, 'site.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const arg = process.argv[2];
if (arg) {
  cfg.base = arg.replace(/\/+$/, '');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
}
const base = cfg.base.replace(/\/+$/, '');
const catalog = JSON.parse(fs.readFileSync(path.join(pub, 'catalog.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const pages = [
  { file: 'index.html', url: '/', priority: '1.0', changefreq: 'weekly' },
  { file: 'livrare-retur.html', url: '/livrare-retur', priority: '0.5', changefreq: 'yearly' },
  { file: 'termeni.html', url: '/termeni', priority: '0.3', changefreq: 'yearly' },
  { file: 'confidentialitate.html', url: '/confidentialitate', priority: '0.3', changefreq: 'yearly' },
  { file: 'politica-cookies.html', url: '/politica-cookies', priority: '0.3', changefreq: 'yearly' },
];

const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const write = (f, t) => fs.writeFileSync(path.join(pub, f), t);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const lei = (bani) => `${bani % 100 ? (bani / 100).toFixed(2).replace('.', ',') : bani / 100} lei`;

function replaceBlock(html, name, content) {
  const re = new RegExp(`<!--${name}:BEGIN-->[\\s\\S]*?<!--${name}:END-->`);
  const block = `<!--${name}:BEGIN-->\n${content}\n  <!--${name}:END-->`;
  if (!re.test(html)) throw new Error(`Marker yok: ${name}`);
  return html.replace(re, block);
}

// ---------- JSON-LD ----------
function jsonLd() {
  const org = `${base}/#org`;
  const shipping = {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'RON' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'RO' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' },
    },
  };
  const returns = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'RO',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
  };
  const offers = catalog.products.map((p) => ({
    '@type': 'Offer',
    name: p.name,
    sku: p.id,
    url: `${base}/#produs`,
    priceCurrency: 'RON',
    price: (p.price / 100).toFixed(2),
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': org },
    shippingDetails: shipping,
    hasMerchantReturnPolicy: returns,
  }));
  const main = catalog.products[0];
  const html = read('index.html');
  const faq = [...html.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({
    '@type': 'Question',
    name: strip(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: strip(m[2]) },
  }));
  const title = unesc(html.match(/<title>(.*?)<\/title>/)[1]);
  const desc = unesc(html.match(/<meta name="description" content="(.*?)">/)[1]);
  const graph = [
    {
      '@type': 'Organization',
      '@id': org,
      name: cfg.siteName,
      legalName: cfg.legalName,
      taxID: cfg.taxId,
      url: `${base}/`,
      logo: `${base}/img/logo-512.png`,
      telephone: cfg.phone,
      areaServed: cfg.country,
      address: { '@type': 'PostalAddress', streetAddress: cfg.street, addressLocality: cfg.locality, addressRegion: cfg.region, addressCountry: cfg.country },
      contactPoint: { '@type': 'ContactPoint', telephone: cfg.phone, contactType: 'customer service', areaServed: cfg.country, availableLanguage: ['ro'] },
    },
    { '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: `${cfg.siteName} – Collagen5`, inLanguage: 'ro-RO', publisher: { '@id': org } },
    {
      '@type': 'WebPage',
      '@id': `${base}/#webpage`,
      url: `${base}/`,
      name: title,
      description: desc,
      inLanguage: 'ro-RO',
      isPartOf: { '@id': `${base}/#website` },
      about: { '@id': `${base}/#product` },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${base}/img/collagen5-can.jpg` },
      dateModified: today,
    },
    {
      '@type': 'Product',
      '@id': `${base}/#product`,
      name: 'Collagen5 – peptide de colagen bovin, pulbere, 30 de porții',
      description: 'Supliment alimentar cu peptide de colagen bovin dublu hidrolizat (tipurile I, II, III, V, X) și complex de vitamine, pulbere, 30 de porții.',
      image: [`${base}${main.image}`],
      brand: { '@type': 'Brand', name: 'Collagen5' },
      category: 'Suplimente alimentare > Colagen',
      sku: main.id,
      countryOfOrigin: { '@type': 'Country', name: 'Turcia' },
      offers,
    },
    { '@type': 'FAQPage', '@id': `${base}/#faq`, inLanguage: 'ro-RO', mainEntity: faq },
  ];
  return `  <script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}\n  </script>`;
}

// ---------- <head> blokları ----------
function seoHead(page, html) {
  const title = unesc(html.match(/<title>(.*?)<\/title>/)[1]);
  const descM = html.match(/<meta name="description" content="(.*?)">/);
  const desc = descM ? descM[1] : esc(`${cfg.siteName} – Collagen5, livrare în România.`);
  const url = `${base}${page.url}`;
  const img = `${base}${cfg.ogImage}`;
  return [
    `  <link rel="canonical" href="${url}">`,
    `  <link rel="alternate" hreflang="ro-RO" href="${url}">`,
    `  <link rel="alternate" hreflang="x-default" href="${url}">`,
    `  <meta property="og:type" content="${page.url === '/' ? 'product' : 'website'}">`,
    `  <meta property="og:locale" content="ro_RO">`,
    `  <meta property="og:site_name" content="${esc(cfg.siteName)}">`,
    `  <meta property="og:title" content="${esc(title)}">`,
    `  <meta property="og:description" content="${desc}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${img}">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="630">`,
    `  <meta property="og:image:alt" content="Collagen5 – peptide de colagen bovin, 30 de porții">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${esc(title)}">`,
    `  <meta name="twitter:description" content="${desc}">`,
    `  <meta name="twitter:image" content="${img}">`,
  ].join('\n');
}

// ---------- "Pe scurt" (GEO) ----------
function facts() {
  const [p1, p2, p3, p5] = catalog.products;
  return `          <p class="facts"><strong>Pe scurt:</strong> Collagen5 este un supliment alimentar sub formă de pulbere, cu peptide de colagen bovin dublu hidrolizat (tipurile I, II, III, V, X) și complex de vitamine, într-un pachet de 30 de porții. Se vinde în România de ${cfg.legalName} (${cfg.siteName}). Preț: ${lei(p1.price)} pentru 1 pachet, ${lei(p2.price)} pentru setul de 2 (-5%), ${lei(p3.price)} pentru setul de 3 (-10%), ${lei(p5.price)} pentru setul de 5 (-15%), TVA inclus. Livrare gratuită prin DPD în 2–4 zile lucrătoare, plată cu cardul sau transfer bancar, retur în 14 zile.</p>`;
}

function priceText() {
  const [p1, p2, p3, p5] = catalog.products;
  return `Collagen5 costă ${lei(p1.price)} pentru 1 pachet (30 de porții), ${lei(p2.price)} pentru setul de 2 pachete, ${lei(p3.price)} pentru setul de 3 pachete și ${lei(p5.price)} pentru setul de 5 pachete.`;
}

for (const page of pages) {
  const f = path.join(pub, page.file);
  if (!fs.existsSync(f)) continue;
  let html = read(page.file);
  html = replaceBlock(html, 'SEO', seoHead(page, html));
  if (page.file === 'index.html') {
    // Fiyat metni, JSON-LD (FAQ) üretilmeden ÖNCE HTML'e işlenmeli
    html = html.replace(/<!--PRICES:BEGIN-->[\s\S]*?<!--PRICES:END-->/, `<!--PRICES:BEGIN-->${priceText()}<!--PRICES:END-->`);
    write(page.file, html);
    html = replaceBlock(html, 'FACTS', facts());
    write(page.file, html);
    html = replaceBlock(html, 'JSONLD', jsonLd());
  }
  write(page.file, html);
}

// ---------- sitemap.xml ----------
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>\n    <loc>${base}${p.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`);

// ---------- robots.txt (crawlerlar + yapay zekâ botları serbest) ----------
const bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot', 'Applebot-Extended'];
const rules = 'Allow: /\nDisallow: /api/\nDisallow: /success';
write('robots.txt', `# ${cfg.siteName} - search crawlers and AI search bots are welcome
User-agent: *
${rules}

${bots.map((b) => `User-agent: ${b}\n${rules}`).join('\n\n')}

Sitemap: ${base}/sitemap.xml
`);

// ---------- llms.txt (GEO) ----------
const [p1, p2, p3, p5] = catalog.products;
write('llms.txt', `# ${cfg.siteName} – Collagen5 (România)

> ${cfg.siteName} (${cfg.legalName}, CUI ${cfg.taxId}) vinde online în România suplimentul alimentar Collagen5: peptide de colagen bovin dublu hidrolizat, pulbere, 30 de porții. Livrare gratuită prin DPD, plată cu cardul sau transfer bancar.

## Produs
- Nume: Collagen5 – peptide de colagen bovin, pulbere, 30 de porții
- Tip: supliment alimentar; peptide de colagen bovin dublu hidrolizat (tipurile I, II, III, V, X), cu complex de vitamine
- Formă: pulbere, fără aromă adăugată, fără zahăr
- Țara de origine: Turcia
- Ingredientele, valorile nutriționale și doza zilnică sunt cele de pe eticheta produsului
- Suplimentele alimentare nu înlocuiesc o dietă variată și echilibrată

## Prețuri (RON, TVA inclus, transport inclus)
- 1 pachet: ${lei(p1.price)}
- Set 2 pachete (-5%): ${lei(p2.price)}
- Set 3 pachete (-10%): ${lei(p3.price)}
- Set 5 pachete (-15%): ${lei(p5.price)}

## Livrare, plată, retur
- Livrare doar în România, prin DPD, gratuită; 2–4 zile lucrătoare
- Plată: card online (Stripe) sau transfer bancar
- Dreptul de retragere: 14 zile (produs sigilat)

## Contact
- Telefon / WhatsApp: ${cfg.phone}
- Adresă: ${cfg.street}, ${cfg.locality}, jud. ${cfg.region}, România

## Pagini
- [Prima pagină și comandă](${base}/)
- [Livrare și retur](${base}/livrare-retur)
- [Termeni și condiții](${base}/termeni)
- [Politica de confidențialitate](${base}/confidentialitate)
- [Politica de cookie-uri](${base}/politica-cookies)
`);

console.log(`SEO/GEO dosyaları üretildi. base = ${base}`);
