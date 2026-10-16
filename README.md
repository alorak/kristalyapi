# Kristal Yapı · 3B Studio

Tarayıcıda çalışan, **VESTA'dan esinlenen kristal yapı görüntüleyicisi ve editörü**. CIF ve diğer yapı dosyalarını açabilir, aynı oturumda birden çok kristali düzenleyebilir, geometrik/kristalografik analizler yapabilir ve sonuçları dışa aktarabilirsiniz.

**Uygulama:** [GitHub Pages](https://alorak.github.io/kristalyapi/) · **Kaynak:** [index.html](index.html) · **Geliştirme planı:** [ROADMAP.md](ROADMAP.md)

> Bu proje bilimsel görselleştirme ve eğitim amaçlıdır; VESTA'nın veya deneysel/yüksek doğruluklu hesaplama yazılımlarının tüm işlevlerine eşdeğer değildir. [Bilimsel kapsam ve sınırlar](#bilimsel-kapsam-ve-sınırlar) bölümüne bakın.

## Hızlı başlangıç

1. [Uygulamayı açın](https://alorak.github.io/kristalyapi/).
2. **Kütüphane → Örnek Yapılar** bölümünden hazır bir kristali seçip **İçe aktar** deyin veya üstteki **Aç** düğmesiyle bir dosya yükleyin.
3. Sol panelde birim hücreyi, süperhücreyi ve atom konumlarını düzenleyin; alt çubuktan görünümü değiştirin.
4. Sağdaki simgelerden ölçüm, BVS, XRD, Miller düzlemleri veya diğer analizleri açın.
5. Üstteki **Kaydet** düğmesiyle proje JSON'u, CIF, POSCAR, XYZ veya PNG dışa aktarın.

**Dil:** Uygulama ilk açılışta **İngilizce (EN)** gelir; üst sağdaki **EN / TR** düğmeleriyle Türkçeye geçebilirsiniz. Seçim bu tarayıcıda saklanır. Arayüz çevirileri [translations.js](translations.js) dosyasında yerel olarak tutulur; uzak çeviri servisi kullanılmaz.

Uygulamanın ana arayüzü, CSS'si ve uygulama JavaScript'i [index.html](index.html) içindedir. Molekül temalı [favicon.svg](favicon.svg) ve yerel dil paketi yayın sırasında ayrı eklenir. Genel kullanım için uygulama sunucusu, hesap, veritabanı veya API anahtarı gerekmez. Three.js **0.182.0** modülleri CDN'den; otomatik simetri analizi için Moyo WASM dosyaları dağıtımın yerel `vendor/` dizininden yüklenir. Bu nedenle **ilk açılış tamamen çevrimdışı değildir**. Yerel yapı dosyaları COD araması açıkça yapılmadıkça uzak bir uygulama sunucusuna yüklenmez.

## Arayüz

| Bölüm | İşlev |
| --- | --- |
| Üst menü | **Kristal Yapı** başlığının solundaki hamburger simgesi, çalışma alanları ve sayı rozeti; **Kütüphane**, **Aç**, **Kaydet**, **Geri al / Yinele** ve sağ üstte **EN / TR dil seçimi**. |
| Sol panel / **Genel** | Birim hücre parametreleri (`a, b, c, α, β, γ`), süperhücre, temel yapı düzenleme alanları. Süperhücrede `a/b/c` için **− / +** düğmeleri ve 1–6 tekrar sınırı vardır. |
| Sol panel / **Atomlar** | Asimetrik konum/atom listesi, kesirli koordinatlar, Wyckoff bilgisi, atom ekleme ve silme. |
| 3B çalışma alanı | Fareyle döndürme/kaydırma/zoom, bakış yönleri, görünüme sığdırma, perspektif–ortografik geçişi, XYZ yön göstergesi. |
| Sağdaki ikon şeridi | Seçili aracın içeriğini sola doğru açıp kapatan, birbirinden bağımsız analiz ve ayar çekmeceleri. |
| Alttaki kompakt çubuk | Model türü, görünüm seçenekleri, atom boyutu/bağ uzunluğu, komşu ve ADP ayarları; ayrı **Miller h/k/l**, kesit kalınlığı ve düzlem düğmeleri. Dar alanda gruplar alt alta geçmez, yatay kaydırılabilir. |

### Birden fazla kristal: çalışma alanları

- Üst soldaki **üç çizgili simgeye** basarak yapılar arasında geçiş yapabilir veya **+ Yeni yapı ekle** ile en fazla **10 çalışma alanı** açabilirsiniz. Simgedeki rozet açık yapı sayısını gösterir.
- Her çalışma alanı kendi kristal durumunu, kamerasını, geri alma/yineleme geçmişini ve ölçüm listesini tutar.
- Çalışma alanları ve etkin seçim `localStorage` içinde geri yüklenir. Depolama kapasitesi/açma izinleri tarayıcıya bağlıdır. Büyük hacimsel veri dizileri kalıcı kayda eklenmez; yenilemeden sonra bu dosyalar yeniden yüklenmelidir.
- **Geri al / Yinele:** üstteki ikonlar veya `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`. Metin kutusu odaktayken yerel yazı geri alma davranışı korunur.

### Alt görünüm ve Miller kontrolleri

- **Dört model:** küre ve çubuk, uzay dolduran, çubuk, tel model.
- **Sekiz aç/kapat simgesi:** atomlar arası bağlar, elemente göre otomatik bağ uzunluğu, birim hücre çizgileri, sınır atomları, atom sembolleri, yapı içi kristal eksenleri, otomatik döndürme ve termal elipsoitler (ADP). Aktif/pasif durum düğme üzerinde gösterilir.
- **İki kaydırıcı:** atom boyutu ve bağ uzunluğu sınırı. Ek alanlarda ADP olasılık düzeyi, merkez atom, komşu yarıçapı ve en fazla komşu sayısı bulunur. Komşu seçenekleri, komşuluk/koordinasyon çizimi etkin değilse genel sahneyi anında değiştirmeyebilir.
- **Bağımsız Miller alanı:** kısa `h`, `k`, `l` kutuları, kesit kalınlığı; **Miller düzlemlerini görüntüle** ve **Süperhücredeki tüm paralel düzlemleri göster** düğmeleri. Miller düzlemlerini açmak için örgü dönüşümü yapmanız gerekmez.
- Perspektif/ortografik geçişi mevcut hedefi ve yaklaşık kadraj ölçeğini koruyacak şekilde ayarlanmıştır; iki projeksiyonun matematiksel görünümü yine farklıdır.

### Sağdaki analiz araçları

Sağdaki dikey ikon şeridinden aşağıdaki araçlar açılır. İkinci bir alt sekme veya üst üste çok sayıda kutu gerektirmez:

| Araç | Başlıca işlevler |
| --- | --- |
| **Yapı bilgileri** | Hücre, simetri, yapı ve seçili kaynağın özeti. |
| **Çoklu yapı / faz karşılaştırması** | Ana kristale ek olarak en fazla üç CIF/mCIF fazı; konum, görünürlük, saydamlık ve hücre çizgileri. |
| **Atom seçimi ve ölçüm** | Atom seçimi, uzaklık (doğrudan/periyodik), açı ve dört atomlu dihedral; renklerle ayrılmış sonuç kartları. |
| **Ölçüm geçmişi** | Ölçüm paneline bitişik ayrı ikon, kayıt sayacı, kayıtların görüntülenmesi ve CSV dışa aktarma. |
| **İleri koordinasyon / BVS** | Periyodik komşular, koordinasyon ve parametreleri tanımlanmış iyon çiftleri için bağ-değerliği toplamı. |
| **Best-fit plane · düzlemsellik** | Seçilen atomlardan en iyi uyan düzlem; normal, RMS/maksimum sapma ve düzlemler arası açı. |
| **Yapı faktörü / toz XRD ve nötron** | IT92 nötr atom X-ışını `f₀(s)` veya nötron koherent `b`; `F(hkl)`, Bragg açıları, seçilebilir Bragg–Brentano LP, model Fourier/Patterson haritaları. |
| **Hacimsel fizik verileri** | CUBE, CHGCAR, XSF; çoklu izoyüzey, `A+k·B` fark alanı, 3B ekstremum araması, Miller `(hkl)` boyunca sayısal kesit ve yaklaşık Voronoi integrali. |
| **Nesneler ve katmanlar** | Atom, bağ, hücre, etiket, Miller ve hacimsel katmanların görünürlük, opaklık ve sırası. |
| **Atom türlerine göre bağlar** | Element çiftine özel min–maks bağ mesafeleri, geometrik öneriler. |
| **Örgü dönüşümü** | 3×3 baz dönüşümleri, primitive/konvansiyonel hücre, Niggli ve kısa baz, Moyo simetri analizi. |
| **Miller düzlemleri ve morfoloji** | Bağımsız düzlem katmanları, kesit/slab, `{hkl}` yüz aileleri ve geometrik morfoloji. |
| **Kristalografik simetri** | Uzay grubu/setting, simetri işlemleri, Wyckoff eşleşmeleri ve simetriyle genişletme. |

## Kütüphane ve COD

**Kütüphane** tam genişlikli sayfadır ve dört alt sekmesi vardır:

1. **COD'da ara:** ana arama ölçütleri solda, **Arama sonuçları** sağda. COD numarası, ad/formül, uzay grubu, gerekli/hariç elementler ve gelişmiş yayın/hacim/element sayısı filtreleri. Arama sonucu yer imlerine eklenebilir, CIF olarak açılabilir veya içe aktarılabilir. **COD ID üzerine tıklandığında ayrıntı modalı** açılır.
2. **Örnek Yapılar:** solda yedi örneğin **açılır menü yerine listesi**, sağda seçili yapının hücre bilgileri, açıklaması, favori düğmesi ve içe aktarma. Si, NaCl, CsCl, elmas, FCC Cu, BaTiO₃ ve grafit bulunur. **Yeni P1 oluştur** seçeneği de vardır.
3. **Yer imleri:** COD kayıtlarının yerel listesi; kaydedilmiş kayıtları bulma, içe aktarma ve yer imi JSON'unu dışa aktarma.
4. **Cloudflare Worker · COD API:** yalnızca isteğe bağlı Worker adresini kaydetme, test etme ve temizleme. Arama sayfasında yer kaplamaz.

### COD bağlantı yöntemleri

| Mod | Davranış |
| --- | --- |
| **Otomatik** | Worker ayarlıysa onu dener; uygun standart filtrelerde OPTIMADE, diğerlerinde klasik COD JSON aramasını kullanır. |
| **Yalnız kendi Cloudflare Worker API** | Kullanıcının dağıttığı Worker ağ geçidini kullanır. |
| **Yalnız doğrudan OPTIMADE API** | Yalnız OPTIMADE'nin desteklediği filtrelerle çalışır. |
| **Yalnız doğrudan COD klasik API / CIF** | COD'un klasik `result.php?format=json` API'sini kullanır. |

Resmî uç noktalar: [COD klasik JSON](https://www.crystallography.net/cod/result.php?format=json), [COD OPTIMADE](https://www.crystallography.net/cod/optimade/v1/structures). Aramayı tarayıcıdan yürütmek **CORS iznine** bağlıdır. Çevrimiçi içe aktarım başarısız olursa **Dosyadan** ile indirilen CIF'i açabilirsiniz; bu yol COD API CORS'una bağlı değildir. İsteğe bağlı Worker için [kurulum, güvenlik ve dağıtım rehberi](worker/README.md) bulunur. **GitHub Pages dağıtımı Worker'ı otomatik yayınlamaz.**

### COD üstverisi: klasik API, OPTIMADE ve Worker

Klasik COD JSON yanıtları `sg`, `a`, `b`, `c`, `vol`, `authors`, `doi` gibi alanlar döndürür. OPTIMADE yanıtlarında aynı COD üstverisi `attributes._cod_sg`, `_cod_a`, `_cod_vol`, `_cod_authors`, `_cod_doi` adlarını kullanır. **`normalizeCodRecord()` artık iki biçimi de eşleyerek doğrudan OPTIMADE ve Cloudflare Worker üzerinden gelen sonuçları aynı alanlara dönüştürür.** Deneysel hata payları (`siga`, `sigvol` vb.) ve yayın/rafinman üstverileri de desteklenir.

Örneğin [COD 4335507](https://www.crystallography.net/cod/4335507.html) için `C 1 2/m 1`, `a=16.646 ± 0.002 Å`, `b=4.419 ± 0.0006 Å`, `c=7.4834 ± 0.001 Å`, `β=106.893 ± 0.002°`, `V=526.72 ± 0.12 Å³` ve yayın üstverileri gösterilebilir.

- **COD ID modalı:** Yalnız mevcut alanları gösterir; kimyasal ad/formül, yayın/DOI, örgü ölçüleri ve belirsizlikler, sıcaklık, uzay grubu, radyasyon türü ve rafinman metrikleri ayrı kartlarda sunulur. Açıldığında seçili bağlantı yöntemine göre ayrıntıları sorgular; başarısız bağlantıda mevcut satır üstverisini gösterir. **COD'da görüntüle** ve **CIF içe aktar** düğmeleri vardır.
- **Veri bulunurluğu:** Bütün COD kayıtlarında bütün alanlar dolu olmayabilir. Yok olan alanlar için deneysel değer uydurulmaz. Worker'ın ayarlanmış ve erişilebilir olması gerekir.

Eski sürümlerde `_cod_` alanlarının eksik eşlenmesi nedeniyle görülen sahte boşluklar için klasik COD ve OPTIMADE fixture'larının aynı bilgileri üretmesi artık regresyon testlerinde doğrulanır.

## Dosya biçimleri

| İşlem | Destek |
| --- | --- |
| **İçe aktar** | CIF / yaygın mCIF yapısal altkümesi, VASP POSCAR/CONTCAR, basit XYZ, **PDB/ENT** (CRYST1 + ilk MODEL, ATOM/HETATM, ANISOU), Kristal Yapı proje JSON'u. |
| **Dışa aktar** | Proje JSON, CIF, POSCAR, XYZ (görünür süperhücre atomları), **PDB** (birim hücrede P1 atomları), PNG. |
| **Hacimsel alan** | Gaussian CUBE (`.cube`, `.cub`), VASP CHGCAR/CHG, XCrySDen XSF DATAGRID_3D. |

İçe aktarılan ve **değiştirilmemiş** bir kaynak CIF, aynı oturumda dışa aktarılırken özgün metni koruyabilir. Kristal düzenlendiğinde CIF yeniden üretilir; tanınmayan CIF alanları, tüm loop blokları ve çoklu veri blokları için eksiksiz **round-trip garantisi yoktur**. Bilimsel arşiv için orijinal CIF'i de saklayın. XYZ dosyaları hücre verisi içermez; uygulama görüntüleme için yapay bir kutu kullanır. PDB desteği **kristalografik koordinat altkümesidir**; zincir/rezidü topolojisini korumaz. PDB'nin sabit ondalık sütunları nedeniyle koordinat, doluluk ve ANISOU aktarımında biçimin yuvarlama sınırları geçerlidir.

## Kristalografi ve sayısal özellikler

### Hücre, simetri ve atomlar

- Gerçek örgü metriğiyle kesirli ↔ Kartezyen koordinatlar, eğik/triklinik hücre ve periyodik komşu ölçümü.
- **230 uzay grubu**, uygulamanın gömülü referans tablolarında **274 ayar/setting**; simetri işlemleri, asimetrik konum genişletme ve Wyckoff eşleştirme.
- **Moyo WASM 0.21.0** ile otomatik uzay grubu/Hall setting analizi; seçilen tolerans ve güvenli eşleştirme kontrolleriyle konvansiyonel–primitive dönüşümler.
- Unimodüler kısa baz, kanonik **Niggli indirgemesi**, FCC/BCC ve özel 3×3 hücre dönüşümleri. Dönüştürme işlemleri fiziksel koordinat ve uygun ADP tensörlerini yeni baza taşır; sonuç gerektiğinde açık **P1** olarak kaydedilir.
- CIF içindeki `Uiso/Biso` ve `Uij/Bij` alanlarından yönlenmiş **termal elipsoitler**; uygun olmayan tensörler görselleştirilmez.
- Süperhücre tekrarları 1–6; performans sınırı **1800 görüntülenen atom** ve **6500 bağ**.

### Geometrik analiz ve Miller

- Elemente göre yaklaşık bağ eşikleri, özel atom-türü çift kuralları, koordinasyon çokyüzlüleri ve periyodik uzaklıklar.
- Atomlar arası uzunluk, açı, dihedral; ayrı ölçüm geçmişi ve CSV.
- Seçilen oksidasyon durumu/iyon çifti için **BVS**: Brese–O'Keeffe `R₀` ve `B=0,37 Å` modeline dayalı bağ-değerliği hesabı. İyon yükleri otomatik tayin edilmez; parametresi bulunmayan çift için sayı uydurulmaz.
- **Best-fit plane**: en küçük kareler düzlemi, RMS/maksimum düzlemsellik sapması ve iki düzlemin açısı; seçili periyodik atom görüntülerini otomatik açma (`unwrap`) yapılmaz.
- Tam hücre metriğinden **Miller `(hkl)` düzlemleri** ve `d(hkl)`; bağımsız düzlemler/katmanlar, sonlu süperhücreye düşen tüm paralel düzlemler, kalınlıklı görsel kesit ve vakumlu **P1 slab** üretimi. Slab üretimi yüzey relaksasyonu veya DFT değildir.
- `{hkl}` yüz aileleri, kesişen yarı uzaylardan **geometrik kristal morfolojisi**; yüzey alanı ve hacim. Bu, yüzey enerjisine dayalı **Wulff hesaplaması değildir**.
- **Model XRD ve nötron**: Bragg konumları, `F(hkl)`, `|F|²`, göreli ideal yansıma yoğunlukları ve CSV. X-ışınında **International Tables IT92 nötr atom 4-Gauss + sabit `f₀(s)`** (Z=1–98); nötronda doğal element koherent saçılma uzunlukları (bilinen 90 element, fm). Doluluk, Uiso ve eğik hücrelerde Kartezyen tensöre dönüştürülmüş Uij içerilir. Seçilebilir Bragg–Brentano Lorentz–polarizasyon çarpanı vardır. Anomal saçılma `f′/f″`, izotop-açık kompozisyon, absorpsiyon, cihaz pik profili ve Rietveld rafinmanı hesaplanmaz. Tablolar [Gemmi 0.7.4 / IT92 / Neutron92](https://gemmi.readthedocs.io/en/stable/scattering.html) üzerinden doğrulandı.
- **Model Fourier/Patterson**: Hesaplanan model `F(hkl)` katsayılarının sonlu ters Fourier toplamıyla 16³ veya 24³ periyodik ızgara. Patterson `|F|²` katsayılarından üretilir. Bu haritalar **deneysel Fobs, Fo−Fc veya ölçülmüş yoğunluk değildir**; kesilen indis aralığı yüzünden çözünürlük/halkalanma etkileri vardır.
- **Madelung/Ewald**: Kullanıcının açıkça yazdığı site/tür iyon yükleriyle nötr ve tam dolu P1 hücre için gerçek/karşı-uzay ve self düzeltmeli nokta-yük modeli; hücre enerjisi (eV) ve site potansiyelleri (eV/e). NaCl Madelung sabiti referansıyla testlidir. Polarizasyon, dielektrik perdeleme ve elektronik yapı hesaplaması değildir.

### Çoklu faz ve hacimsel veriler

- Ana yapı ile **en fazla üç ek faz** aynı Kartezyen Å sahnesinde görüntülenebilir. Her faz için konum/hizalama, renk, saydamlık ve hücre sınırları seçilebilir. Otomatik atom eşleştirme ve gerinim analizi yapılmaz.
- Aynı uzaysal çerçevede **en fazla dört hacimsel alan**; alan başına en fazla **dört izoyüzey** ve toplam en fazla **sekiz etkin izoyüzey**.
- Eğik ızgara vektörlerinde trilineer örnekleme; 2B kesit ve renk skalası, CSV/PNG; uygun ikinci alanla yüzey/kesit renklendirme.
- Uyumlu birim ve fiziksel kapsamda **`A+k·B`** ile fark/lineer birleşim haritaları; farklı ızgara çözünürlüklerinde Kartezyen interpolasyon. 3B komşulukta yerel maksimum/minimum listesi, eşik, atomik Å koordinatları ve CSV.
- Görüntülenen kristalin `(hkl)` yönünde **eğik sayısal kesit** ve izodeğer konturu; kesit gerçek ızgara hacmine kırpılır ve CSV/PNG olarak aktarılır.
- Periyodik, tam hücreye hizalı **`e/Å³`** yoğunlukta en yakın çekirdek bölüşümüyle örneklenmiş Voronoi yük integrali. Büyük ızgarada en fazla 12.000 örnek; bu **Bader (sıfır-akı) analizi değildir** ve çoğu zaman nicel yük değerleri için yeterli yakınsama testi ister.
- Dosyadaki skaler alan **gösterilir**, kuantum kimyasal yoğunluk, elektrostatik potansiyel veya DFT **hesaplanmaz**. Farklı referans sistemindeki alanlar sessizce birleştirilmez.
- Büyük verilerin sınırları: **24 MB dosya** ve **2,5 milyon voksel**; hacimsel dosyalar sayfa yenilenince yeniden açılmalıdır.

## Bilimsel kapsam ve sınırlar

- **Bu araç tam VESTA eşdeğeri değildir.** Manyetik mCIF momentleri/uzay grupları, bütün CIF varyantları ve tüm Hall ayarlarının serbest seçimi yoktur.
- Bir CIF açık simetri işlemleri vermiyorsa tanınan uzay grubunun referans setting/orijini kullanılabilir; alternatif setting/orijin durumlarında sonucu bağımsız doğrulayın.
- Bağ çizgileri ve koordinasyon, geometrik eşiklere dayalı **yorumlayıcı görselleştirmedir**; gerçek kimyasal bağların varlığını/bağ mertebesini ispatlamaz.
- Yüzey oluşturma, BVS, model saçılma, Fourier/Patterson ve nokta-iyon Madelung fiziksel modellerin sınırlandırılmış alt kümeleridir. **Yüzey enerjisi, Wulff dengesi, atomik relaksasyon, deneysel pik profili, anomal saçılma ve DFT** hesaplanmaz.
- CIF dosyasını düzenleyip tekrar dışa aktarmak kaynak deneysel üstverinin her etiketini korumayabilir. Kaynak CIF'le ve bağımsız bilimsel programlarla karşılaştırma önerilir.
- Referans kontrolleri, sınırlar ve planlanan çalışmalar için [bilimsel CIF doğrulaması](tests/validation/README.md) ve [VESTA yol haritası](ROADMAP.md) sayfalarını inceleyin.

### VESTA ile güncel başlıca farklar

- **P0 — Tam bağımsız çevrimdışı paket:** Three.js halen CDN'den geliyor; uygulamanın servis çalışanı (Service Worker), sürümlü önbelleği veya çevrimdışı PWA paketi yok.
- **P1 — Hacimsel veri (ilk paket uygulandı):** `A+k·B`, 3B peak araması ve eğik Miller sayısal kesitleri mevcut. **Kalan:** birimler arası güvenli dönüştürme, büyük ızgaralarda yüksek performanslı/FFT tabanlı hesap, çok konturlu 2B deneysel harita karşılaştırması.
- **P1 — Fiziksel hesaplamalar (model kapsamı uygulandı):** IT92 ve doğal nötron `b`, model Fourier/Patterson, örneklenmiş Voronoi ve iyonik Ewald mevcut. **Kalan:** gerçek Fobs/MTZ veri kaynağı, anomal saçılma, izotop çözünürlüğü, deneysel XRD profili/RIETAN-FP eşdeğeri, Bader analizi ve geniş yakınsama benchmarkları.
- **P1 — Dosya ve simetri kapsamı (PDB altkümesi uygulandı):** PDB/ENT kristal koordinatları ve ANISOU desteği eklendi. **Kalan:** `.vesta` projeleri, geniş biyomoleküler/kuantum kimyası biçimleri, atomlara bağlı manyetik moment vektörleri, mCIF manyetik uzay grupları ve ayrıntılı setting/orijin dönüşümleri.
- **P2 — Morfoloji ve sahne:** Kübik olmayan `{hkl}` için tam nokta grubu eşdeğerleri, çoklu faz CIF dışa aktarımı ve VESTA düzeyinde nesne/per-site stil esnekliği eksik.
- **P2 — Yayın/3B dışa aktarım:** Çok yüksek çözünürlüklü sayısal görseller, TIFF/SVG/STL/VRML gibi biçimler ve çok büyük atom/bağ sahneleri desteklenmiyor.

Karşılaştırma: [VESTA resmî özellikleri](https://jp-minerals.org/vesta/en/) ve [geliştirme yol haritası](ROADMAP.md).

## Çevrimdışı çalışma (COD hariç)

**Şu an tam çevrimdışı çalışacağı garanti edilmez.** Kod ve bilimsel hesaplamaların büyük bölümü tarayıcıda çalışır. Dağıtımda Moyo WASM, dil paketi ve favicon yerel dosyadır; ancak Three.js modülleri `cdn.jsdelivr.net` üzerinden alınır. İlk ağsız açılış, CDN önbelleği boşsa 3B arayüzü başlatamayabilir. GitHub Pages'in normal HTTP önbelleği çevrimdışı destek garantisi değildir.

Tam çevrimdışı/PWA için üç iş gerekir:

1. Three.js 0.182.0 çekirdeğini ve kullanılan OrbitControls/ConvexGeometry modüllerini aynı sürümle **yerel `vendor/`** altından sunmak; import map'i yerel dosyalara geçirmek.
2. `index.html`, `translations.js`, `favicon.svg`, Three.js ve Moyo WASM varlıklarını kapsayan sürümlü **Service Worker / precache** ve güncelleme stratejisi eklemek. COD/Worker istekleri zorunlu cache'e dahil edilmemeli.
3. Ağ bağlantısını tamamen keserek ilk kurulum sonrası açılış, CIF/POSCAR/XYZ içe/dışa aktarımı, 3B kontrol, analiz, dil geçişi ve kayıt geri yükleme için tarayıcı E2E testi yapmak.

COD araması ve ilk CIF indirme çevrimiçi kalır; önceden bu cihazda önbelleğe alınmış CIF'ler bazı durumlarda tekrar açılabilir. Yerel bilimsel işlemler ve dosya düzenleme için COD bağlantısı gerekmez.

## Yerel geliştirme ve test

Node.js **22+** ve Python 3 ile yerel statik sunucu çalıştırabilirsiniz. Yayındaki GitHub Pages iş akışı Moyo WASM dosyalarını otomatik ekler; yerel çalıştırmada yükleyin:

```sh
npm install --no-save --ignore-scripts @spglib/moyo-wasm@0.21.0
mkdir -p vendor
cp node_modules/@spglib/moyo-wasm/moyo_wasm.js vendor/
cp node_modules/@spglib/moyo-wasm/moyo_wasm_bg.wasm vendor/
python3 -m http.server 8000
```

Sonra **http://localhost:8000** adresini açın. Dosyayı doğrudan `file://` ile çalıştırmak yerine yerel sunucu kullanın; WASM ve modül yüklemesi uygun MIME/orijin gerektirir.

**Node regresyon testleri** (ek paket gerektirmez):

```sh
node --test tests/core.test.cjs tests/worker.test.mjs
```

**Gerçek Chromium/WebGL görsel testi** (Playwright + Three.js bağımlılıkları ve tarayıcı kurulumu gerekir): `node tests/browser/visual.test.mjs`. **Bağımsız CIF doğruluğu** Gemmi 0.7.4 referanslarını ve sabitlenmiş CIF örneklerini kullanır; komutlar ve kurallar [tests/validation/README.md](tests/validation/README.md) dosyasındadır.

GitHub Actions iş akışları:

- [pages.yml](.github/workflows/pages.yml): `main` dalında Node testleri, Moyo WASM paketleme ve GitHub Pages yayını.
- [browser-visual.yml](.github/workflows/browser-visual.yml): `main` üzerindeki ilgili değişikliklerde/elle Chromium ile WebGL görsel testi ve ekran görüntüsü artifact'leri.
- [cif-validation.yml](.github/workflows/cif-validation.yml): bağımsız CIF/Gemmi kontrolü; ölçüm/gate ve elle `strict` modu.

GitHub Pages ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir. Worker bağımsız olarak dağıtılır; ayrıntılar [worker/README.md](worker/README.md) dosyasındadır.

## Kaynaklar ve lisans notları

- 3B motoru: [Three.js](https://threejs.org/), sürüm 0.182.0.
- Otomatik simetri: [moyo-wasm](https://github.com/spglib/moyo/tree/main/moyo-wasm), sürüm 0.21.0; dağıtıma eklenen [MIT](licenses/LICENSE-MOYO-MIT.txt) ve [Apache-2.0](licenses/LICENSE-MOYO-APACHE.txt) lisansları.
- Uzay grubu/Wyckoff referans tabloları: [spglib](https://github.com/spglib/spglib) ve [wyckoff](https://github.com/anoopkcn/wyckoff) kaynaklarından türetilmiş veriler. Atıf/lisans bildirimleri uygulama kaynağında yer alır.
- COD kaynak/API: [Crystallography Open Database](https://www.crystallography.net/cod/) ve [resmî REST API açıklaması](https://wiki.crystallography.net/RESTful_API/).
