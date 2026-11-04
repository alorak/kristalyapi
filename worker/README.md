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


## Materials Project: kişisel anahtarla CORS güvenli erişim (Worker v1.4+)

Statik GitHub Pages sayfası, Materials Project'in `X-API-KEY` başlığını içeren
cross-origin isteğini API'nin CORS önkontrolü izin vermiyorsa doğrudan yapamaz.
Bu Worker **isteğe bağlı** ve yalnızca resmî Materials Project sunucusuna
sabit olarak yönlendirilmiş bir ağ geçidi sunar.

1. Güncellenmiş `worker/src/index.mjs` sürümünü kendi Cloudflare hesabında
   `cd worker && npx wrangler deploy` ile **ayrıca** yayımla.
   Sitenin GitHub Pages PR/merge işlemi Worker'ı yayımlamaz.
2. Worker'ın `https://kristalyapi-cod-api.aoakkirman.workers.dev/health`
   adresinin `materialsProjectProxy:true` ve `version:1.3` (veya sonrası)
   döndürdüğünü doğrula. Bu URL, uygulamanın bilerek sabitlediği Worker adresidir;
   başka adrese dağıtıyorsan frontend sabitini de güvenilir adrese güncelle.
3. Kütüphane → Materials Project Ayarları altında kişisel anahtarını kaydet,
   **Materials Project sorgularını Cloudflare Worker üzerinden gönder**
   seçeneğini açıkça etkinleştir. Anahtar, Worker'a ve oradan resmî MP API'ye
   yalnız HTTPS `X-API-KEY` başlığıyla iletilir.

Desteklenen tek yeni rota:
`GET /api/mp/summary?formula=SrTiO3&_fields=material_id,formula_pretty&_limit=20`
(ayrıca `material_ids` veya `chemsys` seçicisi). Worker yalnızca belirli,
izinli alanlara ve `https://api.materialsproject.org/materials/summary/`
adresi üzerinden erişir. `OPTIONS` önkontrolünde `X-API-KEY` kabul edilir.

**Güvenlik:** Anahtar browser localStorage'da tutulur (şifrelenmiş kasa değildir).
Önce anahtar içermeyen `/health` çağrısı yapılır. Eski Worker sürümü doğrulanmazsa
anahtar ona gönderilmez. Worker URL'si istemci tarafından serbestçe seçilemez;
keyfi URL proxy'leme, yönlendirme takibi, edge cache, URL'de anahtar, Worker loglarında
anahtar veya yanıtların servis çalışanında depolanması yoktur. Yanıtlar
`Cache-Control: no-store` ile gönderilir. Kendi Worker'a güvenmiyorsan bu
seçeneği **açma**; doğrudan erişim yöntemi korunur.

Hâlihazırdaki dağıtımın güncelliği bu depodan doğrulanamaz. Worker yayımlanana
kadar canlı Materials Project erişimi hâlâ CORS/erişim hatası verebilir; sentetik
tarayıcı testleri gerçek MP erişiminin kanıtı değildir.


### 2026 AlphaID kimlikleri

Materials Project'in 2026-04-13 sürümünden sonra üretilen kayıtlar
`mp-aaaaaczy` gibi alfabetik (base-26) malzeme kimlikleri kullanabilir.
Uygulama hem önceki `mp-149` hem yeni `mp-aaaaaczy` biçimini arama,
sonuç gösterimi ve kristal içe aktarmada destekler.

Worker **v1.4** ve sonrası `material_ids=mp-aaaaaczy` sorgularını
kabul eder ve `/health` içinde `materialsProjectAlphaIds:true` özelliğini
ilan eder. Önceki v1.3 Worker formül aramalarında AlphaID kayıtlarını
döndürebilir ancak bu kimlikle tekil yapı sorgusunu reddeder. Yeni istemci
bunu anahtar göndermeden önce denetler ve açık bir hata gösterir.

Dağıtım sonrasında `/health` yanıtında
`"version":"1.4"`, `"materialsProjectProxy":true` ve
`"materialsProjectAlphaIds":true` alanlarının bulunmasını doğrulayın.
