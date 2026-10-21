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

COD upstream alan adı sabittir: https://www.crystallography.net.
Yalnızca GET ve OPTIONS; doğrulanmış COD ID'leri; izinli sorgu parametreleri;
CIF 4 MB, JSON 6,5 MB; yönlendirme takip edilmez; izin verilmeyen Origin için 403.

### Geçici COD hataları ve önbellek

COD de Cloudflare arkasındadır ve soğuk bir isteğe zaman zaman 521/525 ya da
zaman aşımıyla yanıt verir; aynı isteğin hemen tekrarı genellikle başarılıdır
(ör. COD 1502689). Worker bu yüzden:

- 408, 425, 429, 5xx ve 520–526/530 yanıtlarını ve bağlantı hatalarını en fazla
  3 deneme ile (400 ms, 1,2 s bekleme) yeniden dener; tüm denemeler tek bir
  20 saniyelik süre bütçesini paylaşır. Uygulama Worker yanıtını 25 s bekler.
- 403 (hız sınırı), 404, yönlendirmeler ve boyut sınırı aşımı yeniden denenmez.
- Başarılı gövdeleri Cloudflare kenar önbelleğinde (`caches.default`) sabit COD
  URL'si anahtarıyla saklar: CIF 30 gün, JSON 5 dakika. Önbellekte CORS başlığı
  tutulmaz; yanıt başlığı `X-Kristalyapi-Cache: HIT|MISS` gösterir. Hata
  yanıtları önbelleğe alınmaz.
- COD'a `User-Agent: kristalyapi-cod-worker/…` ile kendini tanıtır.

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
