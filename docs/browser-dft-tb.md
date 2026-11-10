# Tarayıcıda kuantum hesaplamaları: P0 GANSU Lite geçişi / P1 grafen TB

Tarih: 10 Kasım 2026. Bu sayfa uygulamanın **DFT → Tarayıcı hesapları** bölümünü tanımlar.

## Kapsam ve bilimsel ayrım

| İş akışı | Hesabın nerede çalıştığı | İşlem | Periyodik kristal? |
| --- | --- | --- | --- |
| P0 · GANSU Lite | Harici `https://yasuaki-ito.github.io/GANSU-Lite/` sekmesinde kullanıcı cihazında | Gerçek moleküler HF/Kohn–Sham DFT; kullanıcı GANSU arayüzünde hesap seçer ve başlatır | **Hayır** |
| P1 · Grafen TB | KristalYapı içindeki JavaScript modülünde | İki atomlu grafen ilkel hücresi, en yakın komşu `p_z` π-band Hamiltonyeni | **Evet**, sınırlı 2B periyodik model |
| QE (eski iş akışları) | Yerel/uzak sunucu/HPC | Gerçek periyodik düzlem dalga DFT, SCF, bant, DOS, PDOS | Evet |

**P0 tamamlanma sınırı:** GANSU Lite'ın BSD-3-Clause lisanslı, TypeScript/Rust/WASM kaynak kodu ayrı bir Vite uygulamasıdır. Buradaki ilk entegrasyon **XYZ dışa aktarım köprüsüdür**. GANSU motoru henüz KristalYapı içine bundle edilmemiştir; XYZ kopyalandıktan sonra moleküler DFT hesabı GANSU'da yapılır, çıktı KristalYapı'ya otomatik gelmez. Bu sınır hem arayüzde hem bu belgede açıktır. P0'ın tam yerel/kendi alan adında WASM çalışması için motorun ayrı bir bağımlılık/lisans, build ve bilimsel regresyon değerlendirmesinden geçirilmesi gerekir.

## P0 kullanımı

1. `#dft/tarayici` rotasına git; H₂ veya H₂O örneğini seç. Bunlar sonlu moleküllerdir.
2. `XYZ kopyala` eylemiyle veriyi panoya al; `GANSU Lite'ı aç` bağlantısıyla harici siteyi aç.
3. GANSU Lite'da XYZ, baz seti, yük ve spin çoğulluğunu belirle. SCF ve fonksiyonel seçimi GANSU arayüzünde yapılır. Sonuçlar oradadır.
4. Aktif CIF'nin periyodik hücresini sonlu kümeye dönüştürme **ayrı onay** gerektirir. Periyodik komşu atomlar kopyalanmaz ve uç bağlara hidrojen eklenmez. Böyle bir XYZ'den hesaplanan enerji **periyodik kristal enerjisi değildir**.
5. İlk güvenlik kapısında en fazla 24 atom ve H–Ar elementleri kabul edilir. Ni gibi elementler için bu geçiş **kasıtlı olarak bloke edilmiştir**; element/baz/ECP uygunluğu ve açık kabuk metodolojisi henüz doğrulanmamıştır.

XYZ, tarayıcıdan otomatik biçimde üçüncü taraf siteye aktarılmaz; sadece kullanıcı tarafından istenirse panoya kopyalanır. Harici sekme kullanıcı tıklamasıyla açılır. QE anahtarları, uç noktaları veya aktif CIF verisi GANSU'ya otomatik gönderilmez. P0 harici site internet bağlantısı gerektirir.

GANSU Lite upstream: https://github.com/Yasuaki-Ito/GANSU-Lite (BSD-3-Clause). İlk yerel GANSU WASM entegrasyonu ayrı PR olmalıdır.

## P1 hesaplama modeli

İki C atomlu grafen ilkel hücresi için her karbon atomunun bir `p_z` orbitalini kullanan en yakın komşu Tight-Binding yaklaşımı uygulanır:

```text
H(k) = [ 0        -t f(k) ]
       [ -t f*(k)  0     ]

f(k) = sum_{j=1..3} exp(i k · δ_j)
E_±(k) = ± |t f(k)|
```

Buradaki `k`, kristalin ters örgüsünün kesirli koordinatlarıdır, `δ_j` ise CIF'deki A→B yakın komşularının gerçek hücre ve periyodik ötelemelerinden elde edilir. Bant yolu Γ–M–K–Γ'dir; K köşesi, giriş hücresinin ters örgü koordinat geleneğinde doğru Dirac köşesi seçilerek bulunur. Bant mesafesi gerçek ters-örgü metriğinden `Å⁻¹` biriminde hesaplanır.

Kısıtlar: **yalnız iki karbonlu ilkel hücre**, yaklaşık 2,46 Å 2B kafes, 60°/120° açı, üç eşdeğer ~1,42 Å C–C yakın komşusu ve düzlemsellik. Diğer CIF'ler sessizce örnek grafene çevrilmez; doğrulama hatası verir. Birim hücre yeniden seçimi, daha büyük grafen süperhücresi, kusur ve Ni/N katkısı bu ilk parametrizasyonda desteklenmez.

Varsayılan `|t|=2.7 eV` deneysel/eğitsel model parametresidir; *ab initio* hesaplanmış değildir. Yerinde enerji `ε=0`, orbital örtüşmesi sıfır, spin bağımsızdır. Bu model kuvvet, toplam DFT enerjisi, SCF yük dağılımı, Fermi seviyesi, manyetik moment veya optik/XRS/Raman spektrumu üretmez.

DOS: birinci Brillouin bölgesi boyunca düzgün `N×N` k-mesh ile örneklenen iki bant için Gaussian genişletme uygulanır. Birim `states/(eV · primitive cell · spin)`; normalize integral yaklaşık **2 durum/hücre/spin** olmalıdır. CSV'de model etiketi ve veri kaynağı saklanır. Bu DOS QE tarafından üretilen DOS/PDOS JSON şemasıyla karıştırılmaz.

## Bilimsel birim testleri

```bash
node --test tests/browser-tb-core.test.mjs
```

- Grafen yakın komşu sayısı üç ve bağ uzunluğu 1,4203 Å.
- Γ'da `E± = ±3t = ±8.1 eV`, M'de `±t`, K'de Dirac ayrımı sıfır.
- DOS enerji integrali ≈2/spin.
- Doğrulanmamış atom türleri ve bozulmuş grafen geometrileri reddedilir.

Gerçek Chromium duman testi: `node tests/browser/browser-dft-lab.test.mjs` (CI; Playwright). GANSU için otomatik hesap testi **yoktur**: harici uygulamanın çalışma koşulları, sonuç aktarımı ve sayısal kabulü bu PR kapsamı dışındadır.

## Dağıtım ve mevcut QE ile birlikte yaşama

`browser-tb-core.js`, `browser-dft-lab.js`, `browser-dft-lab.css` kaynakları Pages dağıtım listesine ve statik servis çalışanı önbelleğine eklenmiştir. TB çevrimdışı çalışır; GANSU bağlantısı çalışmaz. Mevcut `qe-api-client.js` ve API koduna dokunulmamıştır; yeni tarayıcı rotası QE sunucu hazır olma kapısından bağımsızdır.

## Sonraki işler

- **P0.2:** GANSU motorunun bağımsız MIT/BSD uyumlu içerik incelemesi; WASM build ürünlerini yerel olarak version/hash pinleyip motoru `Worker` üzerinden çalıştırma; PySCF referansları ile karşılaştırma. Bunu tamamlamadan "yerleşik DFT" etiketi kullanılmamalı.
- **P1.2:** graphene supercell unfolding, ikinci komşu hopping, t' parametrizasyonu ve k-yolu seçenekleri için ayrı fiziksel doğrulama.
- **P2:** DFTB veya tam periyodik DFT motoru sadece bağımsız doğrulama ve lisans incelemesi sonrası gündeme alınmalı.
