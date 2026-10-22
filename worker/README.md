# Kristal Yapı — COD Cloudflare Worker

Worker, GitHub Pages kristal editörü için kendi yönettiğin COD API ağ geçididir.
COD sunucusunun tarayıcı CORS izinlerine bağımlı değildir: Worker, COD'a sunucudan sunucuya istek yapar.

## İlk dağıtım

1. https://dash.cloudflare.com/ üzerinde oturum aç.
2. worker/wrangler.jsonc içindeki vars.CORS_ORIGINS değerini Pages origin'i ile eşleştir. Varsayılan: https://alorak.github.io . Yol (/kristalyapi/) ekleme.
3. Depoyu yerel bilgisayarına indirip Worker klasöründe şu komutları çalıştır:

~~~bash
cd kristalyapi/worker
npx wrangler login
npx wrangler deploy
~~~

4. Wrangler, https://kristalyapi-cod-api.<hesap>.workers.dev benzeri bir HTTPS URL verecek.
5. GitHub Pages sitesinde Kütüphane → COD'da ara → Cloudflare Worker bağlantısı kısmına URL'yi yaz.
   Bağlantıyı test et düğmesi önce /health, ardından gerçek COD 4335507.cif isteğini dener.
   İkisi de başarılıysa Kaydet. Otomatik mod artık Worker'ı öncelikli kullanır.

**Önemli:** Bu repo Cloudflare hesabına bağlı değildir. PR merge tek başına Worker'ı
yayınlamaz. Cloudflare dağıtımı ve URL kaydı yapılınca tarayıcıdaki CIF importu
COD CORS izninden bağımsız hale gelir. Worker'ın COD sunucusuna gerçek erişimi
bağlantı testi ile ayrıca doğrulanmalıdır.

## Rotasyon / izin verilen rotalar

| API | Sabit COD upstream |
| --- | --- |
| GET /health | Upstream yok |
| GET /api/cif/4335507 | /cod/4335507.cif |
| GET /api/structures/4335507 | /cod/optimade/v1/structures/4335507 |
| GET /api/structures?filter=... | /cod/optimade/v1/structures?filter=... |
| GET /api/search?id=4335507 | /cod/result.php?id=4335507&format=json |

Upstream yolları aşağıdaki sunucuların her birinde aynıdır; önce ana sunucu,
sonra aynalar denenir.

COD upstream alan adları sabittir: www.crystallography.net, qiserver.ugr.es, cod.ibt.lt.
Yalnızca GET ve OPTIONS; doğrulanmış COD ID'leri; izinli sorgu parametreleri;
CIF 4 MB, JSON 6,5 MB; yönlendirme takip edilmez; izin verilmeyen Origin için 403.

### COD aynaları, geçici hatalar ve önbellek

Worker sabit bir sunucu listesini sırayla dener (keyfi URL kabul edilmez):

1. `https://www.crystallography.net/cod` (ana COD sunucusu)
2. `https://qiserver.ugr.es/cod` (Granada aynası)
3. `https://cod.ibt.lt/cod` (Vilnius aynası)

Aynalar API'nin tamamını her zaman sunmaz. 22.10.2026'da ana sunucu PHP
açığı nedeniyle kapalıyken qiserver CIF ve aramayı sunuyor, OPTIMADE'de 500
veriyordu; cod.ibt.lt CIF ve OPTIMADE'yi sunuyor, `result.php` için HTTP 200
ile ham PHP kaynak kodu döndürüyordu. Bu yüzden:

- Her turda sunucular sırayla birer kez denenir; en fazla 2 tur, turlar arası
  0,8 s. Tüm denemeler 20 s'lik ortak bütçeyi paylaşır ve tek bir sunucu en
  fazla 8 s bekletebilir. Uygulama Worker yanıtını 25 s bekler.
- 408, 425, 429, 5xx, 520–526/530, zaman aşımı ve bağlantı hataları sonraki
  turda yeniden denenir. 403, 404, yönlendirmeler ve beklenen biçimde olmayan
  gövdeler o sunucu için kesindir, ama diğer sunucular yine denenir.
- HTTP 200 yanıtı yalnızca gerçekten istenen biçimdeyse iletilir: CIF bir
  `data_` bloğu içermeli, JSON ayrıştırılabilmeli; HTML ve `<?php` kaynakları
  reddedilir. Boyut sınırı aşımı hemen 413 döner.
- Tüm sunucular 404 derse 404 (`COD entry not found`), aksi hâlde her sunucunun
  nedenini listeleyen 502 döner.
- Başarılı gövdeler Cloudflare kenar önbelleğinde (`caches.default`), yanıtı
  hangi sunucu verirse versin ana COD URL'si anahtarıyla saklanır: CIF 30 gün,
  JSON 5 dakika. Önbellekte CORS başlığı tutulmaz. Yanıt başlıkları:
  `X-Kristalyapi-Cache: HIT|MISS`, `X-Kristalyapi-Source: <sunucu>`.
  Hata yanıtları önbelleğe alınmaz. Bu önbellek veri merkezi bazında ve
  "en iyi çaba"dır; az istenen kayıtlar süresi dolmadan düşebilir.
- COD'a `User-Agent: kristalyapi-cod-worker/1.2 …` ile kendini tanıtır.
- `GET /health` sürüm (`version`) ve sunucu listesini (`upstreams`) döndürür;
  yayındaki Worker'ın güncel olduğu buradan doğrulanabilir.

Bu davranış değiştiğinde Worker'ı yeniden `npx wrangler deploy` ile yayınla;
GitHub Pages dağıtımı Worker'ı güncellemez.

## Güvenlik ve işletim

- Worker genel amaçlı CORS proxy değildir; keyfi hedef URL desteklemez.
- CORS kimlik doğrulama değildir. Origin header olmadan sunucu istemcileri Worker'ı
  çağırabilir. Trafik / kota Cloudflare panosundan izlenmeli; gerekiyorsa WAF
  rate limit uygulanmalıdır.
- Cloudflare API token ya da hesabın kimlik bilgilerini frontend HTML'e koyma.
- HTTPS ve Workers.dev kullan; kendi alan adın varsa Cloudflare route bağlayabilirsin.
- Cache-Control yanıtları tarayıcıda kullanılabilir; uygulama CIF'leri Cache Storage'da
  ayrıca sınırlı saklar.

## Yerel test

Node.js 22 ile depo kökünde:

~~~bash
node --test tests/core.test.cjs tests/worker.test.mjs
~~~

Worker yerel geliştirme:

~~~bash
cd worker
npx wrangler dev
~~~

Yerel frontend http://localhost:8000 üzerinde çalışıyorsa CORS_ORIGINS
değerine bu origin'i virgülle ekle; üretim için gereksiz lokal izinleri kaldır.
