# Colara – kolajen mağazası (Cloudflare Pages + Stripe Checkout)

Statik site (`public/`) + tek bir Cloudflare Pages Function (`functions/api/checkout.js`).
Sepet tarayıcıda (localStorage) tutulur; "Finalizează comanda" butonu `/api/checkout`'u çağırır,
fonksiyon fiyatları **sadece `public/catalog.json`'dan** okuyup Stripe Checkout oturumu açar ve müşteriyi Stripe'ın ödeme sayfasına yönlendirir.
Teslimat adresi yalnızca Romanya (`RO`) için toplanır.

## Yerelde çalıştırma

```bash
npm install
cp .dev.vars.example .dev.vars   # içine Stripe TEST anahtarını (sk_test_...) yaz
npm run dev                      # http://localhost:8788
```

Test kartı: `4242 4242 4242 4242`, herhangi bir gelecek tarih ve CVC.

## Yayına alma

1. **GitHub**: yeni (private olabilir) bir repo aç, bu klasörü push et.
2. **Cloudflare** → Workers & Pages → Create → Pages → *Connect to Git* → repoyu seç.
   - Framework preset: None · Build command: boş · Build output directory: `public`
3. Projede **Settings → Variables and Secrets** → `STRIPE_SECRET_KEY` ekle (önce test, sonra live anahtar; *Secret* olarak).
   İsteğe bağlı: `SITE_URL` = `https://alanadin.ro`
4. **Custom domains** bölümünden alan adını bağla.
5. Canlıya geçmeden önce Stripe panelinde: işletme doğrulaması, ödeme yöntemleri (kart, Apple/Google Pay), müşteri e-posta makbuzları, "başarılı ödemelerde bildirim" e-postası.

## Canlıya çıkmadan önce doldurulacaklar

- `[DENUMIRE FIRMĂ]`, `[CUI]`, `[Nr. Reg. Com.]`, adres, telefon, `contact@example.ro` — `index.html`, `termeni.html`, `confidentialitate.html`, `livrare-retur.html`, `success.html` içinde.
- `public/img/product.svg` yer tutucu bir illüstrasyon. Kendi ürün fotoğraflarını koy (Trendyol görsellerini kopyalama; telif hakkı satıcıya/markaya aittir).
  Stripe ödeme sayfasında görsel görünmesi için PNG/JPG koy ve `catalog.json` ürününe `"stripeImage": "/img/urun.png"` ekle.
- Ürün etiketindeki gerçek bilgiler: içerik, porsiyon/günlük doz, besin değerleri, alerjenler, üretici/ithalatçı, parti/SKT. Site metni şu an dozu "etikete göre" diye bırakıyor.
- Fiyat/kargo: `public/catalog.json` (kuruş cinsinden: `13900` = 139 lei; `freeShippingFrom`, `shippingFee`). Ücretsiz kargo metinleri `index.html` ve `livrare-retur.html` içinde de geçiyor; değiştirirsen oralarda da güncelle.

## Yasal/operasyonel notlar (avukat/muhasebeci ile doğrula)

- Gıda takviyesi satışı için firma (SRL/PFA), DSVSA kaydı ve Sağlık Bakanlığı'na gıda takviyesi bildirimi gerekebilir; etiket Romence ve AB mevzuatına uygun olmalı. Türkiye menşeli ürün olduğu için ithalat/gümrük koşulları da geçerli.
- AB'de onaylı olmayan sağlık iddiaları (cilt, eklem vb. faydaları) yasaktır; metinler bilerek yalnızca ürünün özelliklerini anlatıyor.
- Hukuki sayfalar şablondur; gerçek firma bilgileriyle ve bir uzmanın gözüyle gözden geçirilmeli.
- Site çerez/analitik kullanmıyor (çerez bandı gerekmiyor). Analitik veya reklam pikseli eklersen onay mekanizması gerekir.
- Romanya'da fiscal fatura (e-Factura) ve siparişlerin takibi için Stripe panelinden gelen siparişleri bir fatura programına bağlaman gerekecek.
