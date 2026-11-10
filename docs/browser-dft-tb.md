# Tarayıcıda kuantum hesaplamaları: P0.2 GANSU Lite WASM / P1 grafen TB

Tarih: 10 Kasım 2026. Bu sayfa uygulamanın **DFT → Tarayıcı hesapları** bölümünü tanımlar.

## Kapsam ve bilimsel ayrım

| İş akışı | Hesabın nerede çalıştığı | İşlem | Periyodik kristal? |
| --- | --- | --- | --- |
| P0.2 · GANSU Lite | **KristalYapı'nın kendi Worker ve WASM motorunda** | Gerçek sonlu molekül Kohn–Sham DFT, SCF ve atomik Mulliken yükleri | **Hayır** |
| P1 · Grafen TB | KristalYapı içindeki JavaScript modülünde | İki atomlu grafen ilkel hücresi, en yakın komşu `p_z` π-band Hamiltonyeni | **Evet**, sınırlı 2B periyodik model |
| QE (eski iş akışları) | Yerel/uzak sunucu/HPC | Gerçek periyodik düzlem dalga DFT, SCF, bant, DOS, PDOS | Evet |

## P0.2 · Yerleşik GANSU Lite SCF / WASM

GANSU Lite'ın orijinal derlenmiş SCF Worker'ı ve STO-3G baz dosyası kaynak deposunda, **upstream commit `58237bc616e9795f393b3d5272805ecef6d377ad`** ve Git blob SHA ile sabitlenmiştir. Derlenmiş iki gerçek WASM ikilisi aynı commit'ten **yalnız build/test aşamasında** indirilir. `tools/gansu_wasm_assets.py` bilinen dosya boyutu ve Git blob SHA-1 değerini doğrular; yanlış hash veya indirme hatasında Pages kurulumu başarısız olur. Depo içindeki BSD-3-Clause lisansı dağıtımda da taşınır.

GANSU Worker ve WebAssembly çalışırken **aynı origin** üzerindeki `vendor/gansu-lite/` kaynakları kullanılır. Kullanıcı XYZ verisi uygulamanın içinde kalır; hesaplama sırasında `yasuaki-ito.github.io` veya QE API çağrısı yapılmaz. WASM yüklenemezse Worker'ın kendi JS fallback mekanizması KristalYapı adaptöründe **başarı olarak kabul edilmez**.

### Kullanım

1. **DFT → Tarayıcı hesapları** bölümünde H₂/H₂O örneği ya da kullanıcı XYZ verisi seçilir.
2. Desteklenen moleküller: H–Ne elementleri ve Si atomuyla en fazla 12 atom. SiH₄ için iki fonksiyonelli bağımsız doğrulama: [P0.3 silisyum/PySCF raporu](gansu-p03-silicon-validation.md). Üçüncü satırdan itibaren her satırda `Element x y z` biçiminde Å birimleriyle koordinat yazılır.
3. `SVWN/LDA`, `PBE/GGA` veya `B3LYP` fonksiyoneli, coarse/medium grid, yük (-2…+2) ve spin çokluğu (1…3) seçilir. Bu ilk sürümde baz seti STO-3G'dir.
4. **Yerel WASM DFT hesapla** düğmesi kullanılır. Enerji, SCF iterasyonu, orbital enerjileri ve Mulliken yükleri görüntülenir. **Sonuç JSON indir** ile giriş ayarları ve köken bilgisi kaydedilir. Uzun süren işlem **Hesabı iptal et** ile Worker sonlandırılarak durdurulur.
5. Aktif periyodik hücrenin sonlu kümeye dönüşümü yalnız açık onayla yapılır. Bağlar kesilir, yüzey atomları pasifleştirilmez; **elde edilen sonuç periyodik kristal DFT değildir**.

GANSU Lite: https://github.com/Yasuaki-Ito/GANSU-Lite (BSD-3-Clause, Yasuaki Ito, 2026).
Hesap kodu `gansu-local-engine.js` içinde şema `kristalyapi.gansu-molecular-dft.v1` olarak saklanır. Ni–N grafen, XRS, çekirdek seviyeleri, elektronik spin-orbit, periyodik Kohn–Sham ve büyük baz setleri desteklenmez. Kohn–Sham HOMO–LUMO ayrımı deneysel temel bant aralığı değildir.

### Dağıtım ve kabul testleri

```bash
python3 tools/gansu_wasm_assets.py
python3 tools/gansu_wasm_assets.py --offline
node --test tests/gansu-local-engine.test.mjs
# Chromium ve node_modules/playwright kurulu ise:
node tests/browser/gansu-local.test.mjs
```

Gerçek Chromium kabul testi H₂ için WebAssembly üzerinde SVWN/STO-3G SCF başlatır. Sonucun sonlu, negatif ve makul Hartree aralığında olması, Mulliken yükleri, JSON şema bilgisi, `WASM` backend işareti, uzaktaki kökenlere istek gitmemesi ve Ni'nin engellenmesi kontrol edilir. Bu bir referans literatür/PySCF eşdeğerliği testi değildir; ileri yakınsama ve fonksiyonel doğrulamaları ayrı bilimsel kabul kapısıdır.

Her yeni motor güncellemesi upstream SHA ve iki WASM binary blob SHA değerini, bilimsel referansları ve testleri birlikte güncellemelidir.

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

Gerçek Chromium duman testi: `node tests/browser/browser-dft-lab.test.mjs` (CI; Playwright). GANSU için gerçek H₂ WASM SCF tarayıcı testi ayrı `tests/browser/gansu-local.test.mjs` dosyasında bulunur; periyodik DFT doğrulaması bunun kapsamı dışındadır.

## Dağıtım ve mevcut QE ile birlikte yaşama

`browser-tb-core.js`, `browser-dft-lab.js`, `browser-dft-lab.css` kaynakları Pages dağıtım listesine ve statik servis çalışanı önbelleğine eklenmiştir. TB çevrimdışı çalışır; GANSU bağlantısı çalışmaz. Mevcut `qe-api-client.js` ve API koduna dokunulmamıştır; yeni tarayıcı rotası QE sunucu hazır olma kapısından bağımsızdır.

## Sonraki işler

- **P0.3:** H₂, H₂O, NH₃ ve SiH₄ için gerçek WASM–PySCF bağımsız enerji karşılaştırması: [ayrı bilimsel rapor ve CI kapısı](gansu-p03-silicon-validation.md). Ni/ECP/açık kabuk ve geniş baz setleri sonraki aşamalar için kapsam dışıdır.
- **P1.2:** graphene supercell unfolding, ikinci komşu hopping, t' parametrizasyonu ve k-yolu seçenekleri için ayrı fiziksel doğrulama.
- **P2:** DFTB veya tam periyodik DFT motoru sadece bağımsız doğrulama ve lisans incelemesi sonrası gündeme alınmalı.
