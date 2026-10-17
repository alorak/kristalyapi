# Kristal Yapı · 3B Studio

[English](README.md) · [**Türkçe**](README.tr.md)

Tarayıcıda çalışan, **VESTA'dan esinlenen kristal yapı görüntüleyicisi ve editörü**. CIF ve diğer yapı dosyalarını açabilir, aynı oturumda birden çok kristali düzenleyebilir, geometrik/kristalografik analizler yapabilir ve sonuçları dışa aktarabilirsiniz.

**Uygulama:** [GitHub Pages](https://alorak.github.io/kristalyapi/) · **Arayüz:** [index.html](index.html) · **Uygulama modülü:** [crystal-app.js](crystal-app.js) · **Geliştirme planı:** [ROADMAP.md](ROADMAP.md)

> Bu proje bilimsel görselleştirme ve eğitim amaçlıdır; VESTA'nın veya deneysel/yüksek doğruluklu hesaplama yazılımlarının tüm işlevlerine eşdeğer değildir. [Bilimsel kapsam ve sınırlar](#bilimsel-kapsam-ve-sınırlar) bölümüne bakın.

## Hızlı başlangıç

1. [Uygulamayı açın](https://alorak.github.io/kristalyapi/).
2. Üstteki **Aç** düğmesiyle **favoriler**, **örnek yapılar** veya **bilgisayarındaki CIF/PDB vb. dosyalar** arasından seçin. Aynı seçenekler Kütüphane sekmesinde de mevcuttur.
3. Sol panelde birim hücreyi, süperhücreyi ve atom konumlarını düzenleyin; alt çubuktan görünümü değiştirin.
4. Sağdaki simgelerden ölçüm, BVS, XRD, Miller düzlemleri veya diğer analizleri açın.
5. Üstteki **Kaydet** düğmesiyle proje JSON'u, CIF, POSCAR, XYZ, PDB, **vektörel SVG/PDF/EPS**, **STL**, **VRML97 (.wrl)**, **glTF 2.0 (.glb)**, TIFF veya **1×–4× yüksek çözünürlüklü PNG** dışa aktarın.

**Dil:** Uygulama ilk açılışta **İngilizce (EN)** gelir; üst sağdaki **EN / TR** düğmeleriyle Türkçeye geçebilirsiniz. Seçim bu tarayıcıda saklanır. Arayüz çevirileri [translations.js](translations.js) dosyasında yerel olarak tutulur; uzak çeviri servisi kullanılmaz.

Mimari artık tek bir HTML dosyasına gömülü değildir: [index.html](index.html) arayüz iskeleti, [styles.css](styles.css) tasarım, [crystal-app.js](crystal-app.js) uygulama/hesaplama giriş modülü, [translations.js](translations.js) yerel dil paketi ve [favicon.svg](favicon.svg) simgedir. Bu **ilk modülerleştirme adımıdır**; geniş uygulama modülünün kristal veri, render, analiz ve UI alt modüllerine ayrılması sonraki refaktör aşamasıdır. GitHub Pages tüm dosyaları yayımlar. Genel kullanım için uygulama sunucusu, hesap, veritabanı veya API anahtarı gerekmez. **Three.js 0.186.1**, OrbitControls ve ConvexGeometry artık [yerel `vendor/three`](vendor/three/README.md) modülleridir; otomatik simetri analizi için Moyo WASM dosyaları da dağıtımın `vendor/` dizininden yüklenir. 3B motorunun açılışı artık üçüncü taraf CDN'e bağımlı değildir. **Service Worker**, ilk başarılı çevrimiçi kurulumdan sonra uygulama kabuğunu ve 3B/WASM dosyalarını çevrimdışı açılış için önbelleğe alır. Yerel yapı dosyaları COD araması açıkça yapılmadıkça uzak bir uygulama sunucusuna yüklenmez.

## Arayüz

| Bölüm | İşlev |
| --- | --- |
| Üst menü | **Kristal Yapı** başlığının solunda hamburger simgesi, etkin workspace adı ve sayı rozeti; **Kütüphane** ve **Karşı Uzay** sayfalarında da hamburger kalır. Kompakt simgeli **Aç / Kaydet**, geri alma/yineleme ve **EN / TR** dil seçimi. |
| Sol panel / **Genel** | Birim hücre parametreleri (`a, b, c, α, β, γ`), süperhücre, `a/b/c` için **− / +**, 1–6 tekrar ve her eksende **−1…2 arasında görünür kesirli sınır** seçimi (örn. −0,1…1,1). |
| Sol panel / **Atomlar** | Asimetrik atom listesi, Wyckoff, ekle/sil ve site bazında **atom rengi/ölçeği** ile **çokyüzlü rengi/opaklığı**; proje ve Undo/Redo'da korunur. |
| 3B çalışma alanı | Fareyle döndürme/kaydırma/zoom, bakış yönleri, görünüme sığdırma, perspektif–ortografik geçişi, XYZ yön göstergesi. |
| Sağdaki ikon şeridi | Seçili aracın içeriğini sola doğru açıp kapatan, birbirinden bağımsız analiz ve ayar çekmeceleri. |
| Alttaki kompakt çubuk | Model türü (**çokyüzlü dahil**), görünüm seçenekleri, atom boyutu/bağ uzunluğu, **bir veya çok sayıda merkez elementini seçme (+ düğmesi)**, çokyüzlü varsayılan rengi/opaklığı, komşu ve ADP ayarları; ayrıca **Miller h/k/l**, kesit kalınlığı ve düzlem düğmeleri. Dar alanda gruplar alt alta geçmez, yatay kaydırılabilir. |

### Birden fazla kristal: çalışma alanları

- Üst soldaki **üç çizgili simgeye** basarak yapılar arasında geçiş yapabilir veya **+ Yeni yapı ekle** ile en fazla **10 çalışma alanı** açabilirsiniz. Simgedeki rozet açık yapı sayısını gösterir.
- Kütüphane görünümündeyken de etkin çalışma alanı başlıkta kalır; Kütüphane veya Aç modalından içe aktarılan kristal **o anda etkin olan çalışma alanını** değiştirir, diğerlerini değiştirmez.
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
| **İleri koordinasyon / BVS** | Metrik-tam periyodik komşular, koordinasyon ve kısmi doluluk; Baur bozulma indisi, Hoppe ECoN, doğrulanmış tetra/octa topolojide quadratic elongation ile açı varyansı; seçili referans iyon çiftleri için BVS ve eşit bağ varsayımıyla beklenen bağ uzunluğu. |
| **Best-fit plane · düzlemsellik** | Seçilen atomlardan en iyi uyan düzlem; normal, RMS/maksimum sapma ve düzlemler arası açı. |
| **Yapı faktörü / toz XRD ve nötron** | IT92 nötr atom X-ışını `f₀(s)` veya nötron koherent `b`; Bragg kesiminden türetilen karşı-uzay taraması, `F(hkl)`, Bragg açıları, LP / Lorentz seçeneği, absorplayıcı element uyarısı; ampirik pseudo-Voigt/Caglioti toz profili, Kα1/Kα2 ikilisi ve ölçüm CSV karşılaştırması; `d_min` + FFT ile model Fourier/Patterson; fazı olan SHELX `.fcf` için hücre/faz/Friedel doğrulamalı `Fo`/`Fo−Fc` haritaları ve isteğe bağlı Fcalc LSQ ölçeği. |
| **Hacimsel fizik verileri** | CUBE, CHGCAR, XSF; CHGCAR kollineer/nonkollineer spin bileşenleri; kaynak nicelik/birim seçimi, yoğunluk/potansiyel normalizasyonu; seçilen alanın CUBE/XSF dışa aktarımı; çoklu izoyüzey, güvenli `A + k₁B + k₂C` fark alanı ve `∫Δρ dV`, ekstremum araması, Miller `(hkl)` kesitleri ve yaklaşık Voronoi integrali. |
| **Nesneler ve katmanlar** | Atom, bağ, hücre, etiket, Miller ve hacimsel katmanların görünürlük, opaklık ve sırası. |
| **Atom türlerine göre bağlar** | Element çiftine özel min–maks mesafeler ve geometrik öneriler; otomatik XYZ/PDB molekül veya CIF/POSCAR periyodik bağ modu, 300 bağımsız atoma kadar bağlantı bileşenleri, çevrimsel bağ fazlalığı ve öteleme indisli bağ CSV çıktısı. |
| **Örgü dönüşümü** | 3×3 baz dönüşümleri, primitive/konvansiyonel hücre, Niggli ve kısa baz, Moyo simetri analizi. |
| **Miller düzlemleri ve morfoloji** | Bağımsız düzlem katmanları, kesit/slab, `{hkl}` yüz aileleri ve geometrik morfoloji. |
| **Kristalografik simetri** | Uzay grubu/setting, simetri işlemleri, Wyckoff eşleşmeleri ve simetriyle genişletme. |

## Karşı Uzay ve Kırınım

Üst menüdeki **Karşı Uzay** (`#karsi-uzay`) tam genişlikli bir kavram laboratuvarıdır; etkin çalışma alanındaki yapıyı (simetriyle genişletilmiş P1 listesi) salt okunur kullanır ve editördeki IT92 `f₀(s)`, ADP ve `F(hkl)` hesaplarını paylaşır. Dört sekmesi vardır:

| Sekme | İçerik | Kapsam ve sınır |
| --- | --- | --- |
| **Gerçek ↔ karşı örgü** | Birim hücrede `(hkl)` düzlem ailesi ve ona dik `G(hkl)`; `d`, `|G| = 1/d`, `a*, b*, c*`, `α*, β*, γ*`, `V* = 1/V`; `|F|²` ile ağırlıklandırılmış 3B karşı örgü; atom katkılarını uç uca ekleyen **yapı faktörü fazör diyagramı** (kapalı çokgen = sistematik sönüm) | Kristalografik kural `aᵢ·bⱼ = δᵢⱼ`; konvansiyonel hücre kullanılır, merkezleme sönümlerle görünür |
| **Ewald küresi ve toz halkaları** | Seçilen `[uvw]` düzlemindeki Ewald kesiti, kristal dönüşü `ω`, küreye değen yansımalar ve kırınan ışınlar; **Sonraki Bragg konumu** düğmesi; toz modunda `1/d` kabuklarının küreyi kesmesi; düz dedektörde Debye–Scherrer halkaları ve LP dahil toz deseni | Kinematik model; halkalar `r = D·tan 2θ`, `D = 100 mm` ve `2θ ≤ 70°` ile çizilir |
| **Bölge ekseni deseni (SAED)** | `[uvw]` bölge ekseni için sıfırıncı Laue bölgesi; relativistik elektron dalgaboyu, Mott–Bethe elektron saçılma çarpanı, uyarılma hatası ve kalınlığa bağlı `sinc²` biçim çarpanı; kinematik olarak sönük konumlar ayrıca işaretlenir | Dinamik ve çift kırınım hesaplanmaz (ör. Si [110]'da (002) gerçek desende görülebilir); HOLZ çizgileri yok |
| **Brillouin bölgesi ve bantlar** | Yapıyı kendisine taşıyan saf ötelemelerden primitive örgü, primitive karşı örgünün Wigner–Seitz hücresi (birinci Brillouin bölgesi), Bravais türü, Setyawan–Curtarolo (2010) yüksek simetri noktaları/yolu ve **boş örgü** (serbest elektron) bantları | Yol CUB, FCC, BCC, TET, ORC ve HEX için tanımlıdır; etiketler kullanıcının a, b, c eksenlerine göredir. Boş örgüde kristal potansiyeli sıfırdır, bant aralığı açılmaz |

Bilimsel çekirdek bağımsız bir modüldedir ([`reciprocal-core.js`](reciprocal-core.js)); arayüz [`reciprocal-page.js`](reciprocal-page.js) içindedir. Çekirdek testleri dual baz, `d(hkl)`, Bragg geometrisi, saf ötelemeler, FCC/BCC/SC/HEX bölge geometrisi ve hacmi, özel noktaların bölge yüzeyinde olması ve boş örgü enerjilerini analitik değerlere karşı sınar.

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
| **İçe aktar** | CIF / yaygın mCIF yapısal altkümesi, **SHELXL `.res/.ins`**, **Quantum ESPRESSO `pw.x` `.in/.pwi`**, **CASTEP `.cell`**, VASP POSCAR/CONTCAR, basit XYZ, **PDB/ENT** (CRYST1 + ilk MODEL, ATOM/HETATM, ANISOU), Kristal Yapı proje JSON'u. |
| **Dışa aktar** | Proje JSON, CIF, POSCAR, XYZ (görünür süperhücre atomları), **PDB** (birim hücrede P1 atomları), **SVG yapı görünümü**, **STL üçgen yüzeyi**, **glTF 2.0 (.glb) renkli 3B modeli**, PNG. |
| **Hacimsel alan** | Gaussian CUBE (`.cube`, `.cub`), VASP CHGCAR/CHG, XCrySDen XSF DATAGRID_3D. |

İçe aktarılan ve **değiştirilmemiş** bir kaynak CIF, aynı oturumda dışa aktarılırken özgün metni **birebir** korur. **Paket 8.1:** Kristal düzenlendiğinde güvenli, kaynakla ilişkilendirilebilir bibliyografik `_publ_author_*`, `_citation_*` ve `_journal_*` skaler/loop alanları da (boyut ve sözdizimi sınırları içinde) yeniden üretilen CIF'ye taşınır. Yapıya bağlı `_atom_site_*`, `_geom_*`, `_refine_*` ve deneysel kayıtlar eski yapı için kalabileceğinden otomatik taşınmaz; değiştirilen yapının eski `_cod_database_code` kimliği yeniden kullanılmaz. Kimyasal bileşim değişirse özgün formül/kimyasal isimler de yeniden üretilen dosyadan çıkarılır. **Tüm CIF varyantları/metadata için kayıpsız round-trip garantisi yoktur.** Bu kaynak-koruma davranışı orijinal dosya metninin bellekte tutulduğu oturumla sınırlıdır; proje JSON veya sayfa yenilenmesi kaynak dosyanın byte düzeyinde korunduğu anlamına gelmez. Bilimsel arşiv için orijinal CIF'i ayrıca saklayın. XYZ dosyaları hücre verisi içermez; uygulama görüntüleme için yapay bir kutu kullanır. PDB desteği **kristalografik koordinat altkümesidir**: CRYST1 Hermann–Mauguin sembolü eşlenebiliyorsa asimetrik atomlara simetri uygulanır; sembol tanınmıyor veya metrikle uyuşmuyorsa açık uyarı verilir. Element sütunu boşsa atom adı/hizalama üzerinden tahmin yapılır ve uyarılır (özellikle protein `CA` atom adı kalsiyumla karıştırılmamalıdır). Zincir/rezidü topolojisi korunmaz. PDB'nin sabit ondalık sütunları nedeniyle koordinat, doluluk ve ANISOU aktarımında biçimin yuvarlama sınırları geçerlidir.

**SHELXL yapı girişi:** `.res/.ins` dosyalarındaki `CELL`, `LATT`, `SYMM`, `SFAC`, `FVAR` ve atom satırları okunur. Merkezleme/tersinme dahil simetri işlemleri açık **P1** atomlarına genişletilir; kısmi doluluklar ve desteklenen `Uiso/Uij` alanları taşınır. `PART` düzensizlik grupları, bağ/restraint/rafine parametreleri proje nesnesine birebir aktarılmaz; `.fcf` yapı dosyası değil, ayrı Fourier veri girişidir. Tanınmayan doluluk değişkenlerinde yükleme hata verir.

**Quantum ESPRESSO girişi:** `pw.x` `&SYSTEM` ve `ATOMIC_POSITIONS` kartı kullanılır; `ibrav=0` için `CELL_PARAMETERS` (`alat`, `bohr`, `angstrom`), ayrıca belgelenmiş `ibrav=1…14`, negatif eşdeğer ayarlar ve `91` desteklenir. `celldm` ve Å cinsinden `A/B/C` girdileri ayrıdır. Konumlar `crystal`, `alat`, `bohr`, `angstrom` birimlerinde dönüştürülür. `crystal_sg` yalnızca eşdeğer olmayan atomları tanımladığı ve uzay grubu ayarları olmadan tam hücre üretilemeyeceği için reddedilir. Bu okuyucu `pw.x` **girdi** dosyası içindir; çıktıda art arda yinelenen model kartları veya QE hesaplama ayarlarını saklamak amaçlanmaz.

**CASTEP girişi:** `.cell` içindeki `%BLOCK LATTICE_CART` / `LATTICE_ABC` ve `%BLOCK POSITIONS_FRAC` / `POSITIONS_ABS` okunur; `ang`, `bohr` ve `nm` uzunluk birimleri işlenir. Simetri üretme anahtarları ve DFT kısıtları aktarılmaz. Üç okuyucuda da yalnızca tarayıcıda işlem yapılır; orijinal bilimsel dosya değiştirilmez.

### Paket 8.2 — FCF yansıma doğruluğu ve Fo−Fc haritaları

**SHELXL LIST 6 / IUCr reflection CIF** içe aktarımı:
`Fo=sqrt(max(0,F²obs))` ve hesaplanan `Fc` ile kaynakta mevcutsa
`φcalc` (derece) kullanılır. Negatif ölçülen `F²` sayılır ve
`Fo=0` kabul edildiği **açıkça bildirilir**. Eksik model fazı
otomatik tahmin edilmez; fazsız FCF'den `Fo` veya `Fo−Fc` haritası
üretilmez. Kaynak CIF altı hücre parametresini içeriyorsa aktif
hücreyle karşılaştırılır; uyuşmazsa işlem reddedilir. Kaynakta hücre
yoksa aktif hücrenin ve orijinin doğru olduğu **kullanıcı varsayımıdır**.
FCF yüklendikten sonra kristal bilimsel verileri değiştirilmişse
yeniden FCF yüklemek gerekir.

Bir Friedel çifti yalnız non-anomal **gerçek yoğunluk**
varsayımı altında eşlenir; faz/gözlenen genlik/hesaplanan
genlik çelişkileri sessizce atılmaz, hata üretir. Eşdeğer
tekrarlar ve `d_min` / Nyquist nedeniyle atlanan yansımalar
ayrı raporlanır. `P1 ızgara kapsamı`, mevcut FFT aralığının
hangi yüzdesinde veri bulunduğunu ölçen **göstergedir**;
kristalografik ölçüm tamlığı, simetri eşdeğerliği veya
R-factor değildir.

`Fo−Fc` için varsayılan **ham** `Fo-Fc`, isteğe bağlı
**LSQ Fcalc ölçeği** `s=Σ(Fo Fc)/Σ(Fc²)` ve
`Fo-sFc` seçenekleri vardır. Bu basit sabit-katsayı
ölçekleme; çözünürlük kabuğu, anisotropik B-factor,
yansıma ağırlığı veya cihaz modeli refinmanı değildir.
Haritalar `φcalc` ile **model-fazlı**, P1 ters Fourier
uygulaması ve göreli ölçeklidir; gerçek deneysel
yoğunlukla karşılaştırmadan önce atomik orijin,
kristal simetrisi, ölçüm ölçeği ve verinin
tamlığı bağımsız doğrulanmalıdır.

**Paket 8.2b — sınırlı MTZ girişi:** Birleşik **P1 MTZ** dosyasında türü doğrulanmış, belirsiz olmayan **FP/F/FOBS, FC ve PHIC** sütunları varsa model fazlı Fo/Fo−Fc haritaları üretilebilir. IEEE endian, başlık/veri uzunluğu, P1 simetrisi, veri kümesi hücresi, eksik değer işaretleri ve geçersiz/negatif genlikler kontrol edilir; eksik satırların sayısı rapor edilir. **P1 dışındaki uzay grupları, batch/unmerged veriler, belirsiz veri kümeleri, anomalous çiftler ve FWT/PHWT gibi ön-ağırlıklı harita katsayıları reddedilir**; P1 ölçümüymüş gibi yorumlanmaz. İlk regresyonlar sentetik MTZ üstündedir; gerçek MTZ/harita için bağımsız Gemmi/CCP4 referans doğrulaması hâlâ gereklidir.

**Paket 8.2c — sınırlı ilkel örgü simetrisi ve açık sütun eşlemesi:** Birleşik, anomalous olmayan MTZ için **P1 (#1), P-1 (#2), P21 (#4), P21/c (#14), P212121 (#19)** desteklenir. `SYMM` işlemleri, ilkel işlem sayısı, grup kapanışı ve hücre metriği doğrulanır. `h' = Rᵀh` ve `φ' = φ - 360° h·t` ile yansıma/faz genişletilir; uyumsuz simetri/Friedel çiftleri reddedilir. Tekrarlanan sütun adlarında isteğe bağlı Fo, Fc ve faz alanlarına `veriKümesiID:ETİKET` yazılabilir. Yeni **ham veya LSQ ölçekli, model fazlı `2Fo−Fc`** seçeneği, **σA/FOM ağırlıklı refinman haritası değildir**. Alt araç çubuğunun yüksekliği artırılmış, İngilizce çeviri sözlüğü ve WebGL smoke gezinimi de düzeltilmiştir.

**Henüz desteklenmeyenler:** genel MTZ uzay grupları/ASU ayarları, CCP4 `.map` / `.ccp4` haritaları, CIF2'nin tüm yansıma sözlükleri, anomalous Friedel farkları ve FOM/σ/FREE ağırlıklı harita refinmanı. Bu artırımın testleri analitik/sentetiktir; gerçek MTZ ile bağımsız Gemmi/CCP4 sayısal harita doğrulaması hâlâ gereklidir.
İleri işler [8.2 durum belgesinde](tests/validation/PACKAGE_8_2_STATUS.md).

### Paket 8.1 — ADP site-symmetry denetimi ve CIF kaynak bütünlüğü

CIF/mCIF içe aktarımında özel konumdaki bir atomun anizotropik yer değiştirme
tensörü, siteyi kendi üzerine götüren her geçerli simetri işlemi için
Kartezyen kovaryans biçiminde karşılaştırılır. Hücre/simetri tutarlılığı
korunurken CIF'nin sonlu sayı basamağından gelen küçük farklar (en az
0,002 Å² veya tensör büyüklüğünün %3'ü) tolere edilir; açık çelişkiler
dosyanın hatalı ADP'sini doğruymuş gibi göstermemek için **hata** verir.
Genel konumdaki atomlarda tensörün dönmesi normaldir ve hata sayılmaz.

Bilimsel doğrulama kapısındaki 30 gerçek/10 sentetik CIF veri kümesi korunur.
Ayrıca kaynak/reference belirsizliği taşımayan **28 gerçek, sabitlenmiş CIF** için kaynak metni ve atom
koordinatları değiştirildikten sonraki yeniden içe aktarma testleri,
ayna/dört katlı eksen özel konumları için analitik tensör referansları
eklendi. Bu çalışmalar özel konumdaki tüm Wyckoff/ADP sınıflarını veya
deneysel kaynak hatalarını kapsayan tam bir doğruluk iddiası değildir.

## Kristalografi ve sayısal özellikler

### Hücre, simetri ve atomlar

- Gerçek örgü metriğiyle kesirli ↔ Kartezyen koordinatlar, eğik/triklinik hücre ve periyodik komşu ölçümü.
- **230 uzay grubu**, uygulamanın gömülü referans tablolarında **274 ayar/setting**; simetri işlemleri, asimetrik konum genişletme ve Wyckoff eşleştirme.
- **Moyo WASM 0.21.0** ile otomatik uzay grubu/Hall setting analizi; seçilen tolerans ve güvenli eşleştirme kontrolleriyle konvansiyonel–primitive dönüşümler.
- Unimodüler kısa baz, kanonik **Niggli indirgemesi**, FCC/BCC ve özel 3×3 hücre dönüşümleri. Dönüştürme işlemleri fiziksel koordinat ve uygun ADP tensörlerini yeni baza taşır; sonuç gerektiğinde açık **P1** olarak kaydedilir.
- CIF içindeki `Uiso/Biso` ve `Uij/Bij` alanlarından yönlenmiş **termal elipsoitler**; uygun olmayan tensörler görselleştirilmez.
- Süperhücre tekrarları 1–6; Three.js **InstancedMesh** ile atomlar türlerine, bağlar tek bir geometriye göre gruplanır. Güvenlik üst sınırı **20.000 görüntülenen atom** ve **65.000 bağdır**. Bunlar FPS garantisi değildir: GPU, WebGL, etiketler, ADP, çokyüzlü ve sahne karmaşıklığı sonucu etkiler. **5.000 atomdan sonra** daha seyrek küre ağına geçilir.
- Sınır aralıkları her eksen için normalleştirilmiş kesirli koordinatlarda seçilebilir (örn. `x: −0.1…1.1`); süperhücre tekrarları uç aralığa eklenir. Bağların periyodik gösterimi özel sınır aralıklarında görsel atom listesi üzerinden yapılır.
- Çokyüzlü model alt çubukta bağımsız seçenek olarak bulunur. Başlatıldığında **4–8 komşuya sahip merkez türü** öncelikli seçilir (ör. BaTiO₃'te Ba yerine Ti). Merkez türü seçiminin yanındaki **+** ile birden fazla element aynı anda işaretlenebilir; ek türler element renkleriyle ayrıştırılır (site bazındaki renk geçersiz kılmaları korunur). Çoklu seçim JSON projelerinde ve Undo/Redo'da korunur. Aynı fiziksel sitenin komşuları bir kez hesaplanıp süperhücre kopyalarına taşınır. Yüzeyler **tek renk/alpha öznitelikli mesh**, kenarlar **tek çizim geometrisi** olarak gruplanır. Geometrik yükü sınırlamak için tüm seçili türlerin toplamında **2400 çokyüzlü** üst sınırı vardır; aşıldığında veya seçili türlerde uygun koordinasyon bulunmadığında kullanıcıya açık uyarı gösterilir. Bu çizim elektronik bağ düzeni değildir.
- Yüksek çözünürlüklü PNG'de ekran kartının **MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE ve MAX_VIEWPORT_DIMS** sınırları önceden kontrol edilir; gerçek WebGL çizim tamponu istenen ölçüyü sağlamazsa dosya oluşturulmaz. 24 MP uygulama sınırı korunur. Düz WebGL çizgisi 4× çıktıda bir piksele sıkışmasın diye, PNG render sırasında hücre çizgilerine geçici, derinlik testli kalın geometriler eklenir; normal interaktif sahne bundan etkilenmez.
- **SVG yapı görünümü** ekrandaki kamera projeksiyonundan gerçek SVG vektör öğeleriyle üretilir: renkli atom daireleri, bağ/kafes çizgileri, çokyüzlü yüz ve kenarları ile desteklenen diğer geometri katmanları. SVG içine raster ekran görüntüsü gömülmez. Şeffaf arka plan seçilebilir. Perspektifte atomlar yaklaşık dairesel izdüşüm ve ressam-sıralamalı örtüşme ile gösterildiğinden WebGL'nin tam derinlik tamponu/aydınlatmasıyla piksel eşdeğeri değildir; hacimsel alan dokuları SVG'ye dahil edilmez. Karmaşık sahneler 60.000 vektör öğesinde güvenli biçimde sınırlandırılır.
- **STL** ikili çıktısı atom, bağ, çokyüzlü, eksen ve termal elipsoit yüzey üçgenlerini yazar; instanced atom ve bağ geometrileri ayrı nesnelere açılır. STL renksiz ve **birimsiz** olduğundan fiziksel koordinat değerleri Å kabul edilmelidir. Birleşik/manifold tek gövde oluşturma yapılmaz; baskı için gerekirse mesh birleştirme ve onarım kullanılmalıdır. En fazla **1 milyon üçgen** dışa aktarılır.
- **glTF 2.0 / .glb** çıktısı renkli 3B sahneyi ve mümkün olduğunca instanced mesh geometrisini korur. 3B model dosyasında Kartezyen **Å sayı değerleri** kullanılır; glTF görüntüleyicileri bu uzunlukları metre varsayabileceğinden başka yazılımda ölçek açıkça ayarlanmalıdır. SVG/STL/glTF dışa aktarımları hacimsel ızgara/izoyüzey dokularını içermez; bunları CUBE/XSF ile kaydedin. Resmi Three.js exporter modülleri depo içinde çevrimdışı erişilebilir.

### Geometrik analiz ve Miller

- Elemente göre yaklaşık bağ eşikleri, özel atom-türü çift kuralları, koordinasyon çokyüzlüleri ve periyodik uzaklıklar.
- Atomlar arası uzunluk, açı, dihedral; ayrı ölçüm geçmişi ve CSV.
- Seçilen oksidasyon durumu/iyon çifti için **BVS**: Brese–O'Keeffe `R₀` ve `B=0,37 Å` modeline dayalı bağ-değerliği hesabı. İyon yükleri otomatik tayin edilmez; parametresi bulunmayan çift için sayı uydurulmaz.
- **Best-fit plane**: en küçük kareler düzlemi, RMS/maksimum düzlemsellik sapması ve iki düzlemin açısı; seçili periyodik atom görüntülerini otomatik açma (`unwrap`) yapılmaz.
- Tam hücre metriğinden **Miller `(hkl)` düzlemleri** ve `d(hkl)`; bağımsız düzlemler/katmanlar, sonlu süperhücreye düşen tüm paralel düzlemler, kalınlıklı görsel kesit ve vakumlu **P1 slab** üretimi. Slab üretimi yüzey relaksasyonu veya DFT değildir.
- `{hkl}` yüz aileleri, seçilen **uzay grubunun nokta grubu** altında eşdeğer Miller indisleri (triklinik–kübik tüm sistemler), isteğe bağlı ± çifti, kesişen yarı uzaylardan **geometrik kristal morfolojisi**; yüzey alanı ve hacim. Eski proje morfolojileri aynı geometriyle yüklenir. Bu, yüzey enerjisine dayalı **Wulff hesaplaması değildir**.
- **Model XRD ve nötron**: Bragg konumları, `F(hkl)`, `|F|²`, göreli ideal yansıma yoğunlukları ve CSV. `maxIndex` küpü yerine **2θ sınırından hesaplanan `d_min` karşı-uzay küresi** taranır; hekzagonal/trigonal ailelerin ve büyük hücrelerin yansımaları indis kesimine takılmaz. Çok büyük taramalarda hesaplama bütçesi aşılırsa hata verilir. X-ışınında **International Tables IT92 nötr atom 4-Gauss + sabit `f₀(s)`** (Z=1–98); nötronda doğal element koherent saçılma uzunlukları (bilinen 90 element, fm). Doluluk, Uiso ve eğik hücrelerde Kartezyen tensöre dönüştürülmüş Uij içerilir. Seçilebilir sabit dalga boylu toz düzeltmesi X-ışınında **Lorentz–polarizasyon**, nötronda **polarizasyonsuz Lorentz `1/(sin²θ cosθ)`** çarpanı uygular; TOF geometrisi modellenmez. B, Cd, Sm, Eu, Gd içeren nötron yapılarında **karmaşık b / absorpsiyon ihmal edildi** uyarısı gösterilir. Anomal saçılma `f′/f″`, gerçek absorpsiyon düzeltmesi, izotop-açık kompozisyon ve Rietveld rafinmanı hesaplanmaz. Tablolar [Gemmi 0.7.4 / IT92 / Neutron92](https://gemmi.readthedocs.io/en/stable/scattering.html) üzerinden doğrulandı.
- **Ampirik toz profili**: Yansımalara alanı 1'e normalize edilmiş Gaussian/Lorentz karışımı pseudo-Voigt uygulanır. `FWHM² = U tan²θ + V tanθ + W` (°²), `η` Lorentz payı, tarama adımı 0,005–0,2°; Cu Kα1/Kα2 varsayılan 1,54060/1,54443 Å ve ikili oranı 2:1, kullanıcı tarafından değiştirilebilir. Şiddet oranına göre iki çizginin dağılımı korunur; genişlik yaklaşımı sabit bir ölçüm cihazına kalibre edilmiş değildir. CSV (`2theta_deg,intensity`, virgül/sekme/noktalı virgül) yüklenip aynı eksende maksimum 100'e normalize edilerek gösterilir; **ölçüm üzerinden otomatik fit, arka plan çıkarımı veya Rietveld inceltmesi yapılmaz.** Hesaplanan profil ayrıca CSV olarak indirilir.

  Profil modeli ve genişlik tanımı için bilimsel kaynak: [IUCr — X-ray powder diffraction in education: Bragg peak profiles](https://journals.iucr.org/j/issues/2021/06/00/gj5272/index.html).
- **Model Fourier/Patterson**: Hesaplanan model `F(hkl)` için **Å cinsinden `d_min` küresel çözünürlük kesimi** ve radix-2 **FFT ile 16³, 32³ veya 64³ periyodik ızgara**. Izgara Nyquist sınırı karşılanmazsa açık hata verir; hesaplama bütçesi sınırlıdır. Patterson `|F|²` katsayılarından üretilir. Bunlar **deneysel Fobs veya ölçülmüş yoğunluk değildir**; sonlu yansıma aralığı yüzünden çözünürlük/halkalanma etkileri vardır.
- **SHELX `.fcf` (deneysel genlik + model fazı)**: `_refln_F_squared_meas` / `_refln_F_meas`, `_refln_phase_calc` ve fark için `_refln_F_squared_calc` / `_refln_F_calc` olan CIF yansıma döngüsüyle **Fo** ve **Fo−Fc** FFT haritası. Ölçülmüş genlikler **hesaplanmış fazlarla** birleştirilir; saf gözlemsel faz veya tam deneysel elektron yoğunluğu değildir. Faz içermeyen FCF (örn. bazı `LIST 4` çıktıları) açık hatayla reddedilir. Hücre eşleşmesi, yansıma kapsamı, ölçek, sistematik sönmeler ve simetri kullanıcının kontrolünü gerektirir; burada `.mtz`, Rietveld veya elektron yoğunluğu rafinmanı yoktur.
- **Manyetik mCIF (sınırlı görselleştirme)**: `_atom_site_moment.Cartn_*` ve `crystalaxis_*` vektörleri okunur; `_space_group_symop_magn_operation.xyz` ve `_space_group_symop_magn_centering.xyz` işlemlerinde uzaysal dönme + eksenel vektör determinantı + zaman tersleme uygulanır. Momentler renkli oklar olarak ayrı katmanda gösterilir (en fazla 600 ok); proje JSON'unda saklanır ve düzenleme sonrası açık P1 konumlarıyla `.mcif` dışa aktarılabilir. **Manyetik Bragg saçılması, BNS grup kataloğu, k-vektörü/superspace işlemleri, SAXIS dönüşümü ve manyetik rafinman desteklenmez.**
- **Madelung/Ewald**: Kullanıcının açıkça yazdığı asimetrik site numarası, benzersiz atom etiketi veya tür iyon yükleriyle nötr ve tam dolu hücre için gerçek/karşı-uzay ve self düzeltmeli nokta-yük modeli; simetriyle genişletilmiş iyonlara **kaynak asimetrik site** yükü taşınır, potansiyel listesinde kaynak site ve simetri kopyası birlikte gösterilir. Hücre enerjisi (eV) ve site potansiyelleri (eV/e) NaCl Madelung sabiti referansıyla testlidir. Polarizasyon, dielektrik perdeleme ve elektronik yapı hesaplaması değildir.

### Çoklu faz ve hacimsel veriler

- Ana yapı ile **en fazla üç ek faz** aynı Kartezyen Å sahnesinde görüntülenebilir. Her faz için konum/hizalama, renk, saydamlık ve hücre sınırları seçilebilir. Otomatik atom eşleştirme ve gerinim analizi yapılmaz.
- Aynı uzaysal çerçevede **en fazla beş hacimsel alan**; alan başına en fazla **dört izoyüzey** ve toplam en fazla **sekiz etkin izoyüzey**.
- Etkin alanın **Gaussian CUBE** (`.cube`, negatif boyut kayıtlarıyla Å uzunluğu) veya **XCrySDen XSF DATAGRID_3D** (`.xsf`) olarak indirimi: Δρ, CHGCAR spin bileşenleri ve Fourier/FCF dahil her katman için geçerlidir. Skaler değerler yeniden ölçeklenmez; nicelik ve fiziksel birim yorumda yazılır. Dahili z-en-hızlı sıra CUBE'a, XSF x-en-hızlı sıraya çevrilir; periyodik XSF'nin yinelenen sınır düzlemleri oluşturulur. CUBE/XSF formatı birim semantiğini standart olarak zorunlu kılmadığından başka programda değerleri yorumlarken yorum başlığını ve kaynak birimini kontrol edin.

  XSF gridi ve periyodik sınır düzlemleri için [XCrySDen biçim tanımı](https://www.xcrysden.org/doc/XSF.html) izlenir.
- Eğik ızgara vektörlerinde trilineer örnekleme; 2B kesit ve renk skalası, CSV/PNG; **2–20 seviyeli marching-squares kontur haritası**, etkileşimli çizgi profili ve çizgi CSV; uygun ikinci alanla yüzey/kesit renklendirme.
- Kaynak CUBE/XSF alanı için **elektron yoğunluğu, potansiyel veya bilinmiyor** türü ve girdi birimi yükleme sırasında seçilir; `e/bohr³ → e/Å³` ve `Hartree/e → V` dönüştürmeleri uygulanabilir. **CHGCAR'ın ilk bloğu** toplam yoğunluktur; varsa takip eden **kollineer `m_z` veya nonkollineer `m_x/m_y/m_z`** ızgaraları PAW augmentation kayıtlarının ardından otomatik okunur, hücre hacmine bölünerek `μB/Å³` alanları olarak eklenir. Spin eksenlerinin yorumu VASP **SAXIS** ayarına bağlıdır; augmentation matrisi ayrıca analiz edilmez.
- Bilinmeyen nicelikler veya birbirinden farklı fiziksel türler **`A + k₁B + k₂C`** ile birleştirilemez; C isteğe bağlıdır ve üç kaynak tek geçişte fark yoğunluğu üretebilir. Farklı ızgara çözünürlükleri Kartezyen interpolasyonla eşleştirilir. Türetilen alanın **`∫(A + k₁B + k₂C) dV`** integrali birimiyle raporlanır (periyodik ızgarada voksel toplamı, açık uçlu ızgarada trapez); sayısal hata kaynak çözünürlüğüne bağlıdır. 3B komşulukta yerel maksimum/minimum listesinde işaretli `≥`/`≤` eşikleri, Kartezyen Å ve **kesirli ızgara koordinatları**, üç eksenli parabolik **alt-voksel konum tahmini** ve hücreyle hizalı periyodik alanda isteğe bağlı **simetri eşdeğerlerini birleştirme** bulunur. Bu yaklaşık işlem tam 3B Hessian veya kritik nokta sınıflandırması değildir.
- Görüntülenen kristalin `(hkl)` yönünde **eğik sayısal kesit** ve çok seviyeli konturlar; kesit gerçek ızgara hacmine kırpılır ve CSV/PNG olarak aktarılır. Harita üzerinde çizilen profilin yatay ekseni piksellerle değil, **Å cinsinden gerçek Kartezyen mesafeyle** belirlenir; kenar dışı geçersiz Miller pikselleri sahte yoğunluk çizgileriyle birleştirilmez.
- Periyodik, tam hücreye hizalı **`e/Å³`** yoğunlukta en yakın çekirdek bölüşümüyle örneklenmiş Voronoi yük integrali. Normalize edilmiş CUBE/XSF yoğunlukları, kullanıcı periyodiklik belirttiğinde ve hücre metriği uyuştuğunda kabul edilir; XSF tekrar eden son ızgara düzlemleri ayrıştırılır. Sonuç ve CSV, asimetrik site ile simetri kopyasını ayrı ayrı işaretler. Büyük ızgarada en fazla 12.000 örnek; bu **Bader (sıfır-akı) analizi değildir**. PAW/VASP CHGCAR'ın çekirdeğe yakın tüm-elektron yoğunluğunu kapsamadığı ve **AECCAR0+AECCAR2** referansının Bader için önemi arayüzde belirtilir. Nicel yükler yakınsama testi ister.
- Dosyadaki skaler alan **gösterilir**, kuantum kimyasal yoğunluk, elektrostatik potansiyel veya DFT **hesaplanmaz**. Farklı referans sistemindeki alanlar sessizce birleştirilmez.
- Büyük verilerin sınırları: **24 MB dosya** ve **2,5 milyon voksel**; hacimsel dosyalar sayfa yenilenince yeniden açılmalıdır.

### Nicel kristal kimyası — Paket 7.9

Seçilen atomun koordinasyon paneli, komşu sayısından ayrı olarak
**Baur bağ uzunluğu bozulma indisini** (`D`) ve **Hoppe etkili
koordinasyon sayısını** (`ECoN`) gösterir. ECoN, kısmi doluluk
ağırlıklı CN ile aynı büyüklük değildir: Hoppe ağırlıkları bağ
uzaklıklarından hesaplanır. Gerçek tetrahedral/oktahedral yüz-topolojisi
doğrulandığında **quadratic elongation** ve **bağ açısı varyansı**
eklenir; altı köşeli prizma otomatik olarak oktahedron sayılmaz.
Kısmi/alternatif dolulukta rapor geometrik yorumla sınırlıdır.
İlk 24 komşuya kesilme varsa nicel ölçütler verilmez.

BVS'de bağ yarıçapı içindeki periyodik görüntüler, eğik hücrelerde
`±2` ile sınırlandırılmadan ters örgü metriğine göre taranır. Model
**yalnızca seçili referans iyon çifti** ve ampirik `R₀/B` parametresi
içindir; otomatik oksidasyon durumu veya kimyasal bağ derecesi çıkarmaz.
BVS sonucu yanında, formal yükün eşit bağlar arasında bölündüğü
varsayımıyla beklenen bağ uzunluğu da bir referans değer olarak
görüntülenir. Matematiksel tanımlar, sınırlar ve bağımsız regresyonlar
[`tests/validation/PACKAGE_7_STATUS.md`](tests/validation/PACKAGE_7_STATUS.md)
içindedir.

## Bilimsel kapsam ve sınırlar

- **Bu araç tam VESTA eşdeğeri değildir.** Manyetik mCIF'in yalnızca desteklenen site-moment ve 3B simetri altkümesi vardır; tam manyetik grup/superspace kataloğu, bütün CIF varyantları ve tüm Hall ayarlarının serbest seçimi yoktur.
- Bir CIF açık simetri işlemleri vermiyorsa tanınan uzay grubunun referans setting/orijini kullanılabilir; alternatif setting/orijin durumlarında sonucu bağımsız doğrulayın.
- Bağ çizgileri ve koordinasyon, geometrik eşiklere dayalı **yorumlayıcı görselleştirmedir**; gerçek kimyasal bağların varlığını/bağ mertebesini ispatlamaz.
- Yüzey oluşturma, BVS, model saçılma, Fourier/Patterson, ampirik toz profili ve nokta-iyon Madelung fiziksel modellerin sınırlandırılmış alt kümeleridir. **Yüzey enerjisi, Wulff dengesi, atomik relaksasyon, ölçümden cihaz profili inceltmesi, anomal saçılma ve DFT** hesaplanmaz.
- CIF dosyasını düzenleyip tekrar dışa aktarmak kaynak deneysel üstverinin her etiketini korumayabilir. Kaynak CIF'le ve bağımsız bilimsel programlarla karşılaştırma önerilir.
- Referans kontrolleri, sınırlar ve planlanan çalışmalar için [bilimsel CIF doğrulaması](tests/validation/README.md) ve [VESTA yol haritası](ROADMAP.md) sayfalarını inceleyin.

### VESTA ile güncel başlıca farklar

- **P0 — Çevrimdışı paket:** Three.js, Moyo WASM ve uygulamanın tamamı aynı dağıtımdan yüklenir; sürümlü Service Worker ve PWA manifesti eklendi. İlk ziyarette bütün uygulama dosyalarının önbelleğe alınması gerekir. Kullanıcının hacimsel dosyaları, COD/Worker çağrıları ve daha önce indirilmemiş CIF'ler çevrimdışı kullanılamaz.
- **P1 — Paket A + Paket B (bilimsel doğruluk):** XRD `d_min` küresel taraması, fiziksel tür/birim kontrollü CUBE/XSF, minimum eşiği, PDB CRYST1/element doğrulaması ve simetri site kimlikleri (A); nötron Lorentz/absorpsiyon uyarıları, `d_min`/FFT tabanlı Fourier 64³, üç kaynaklı Δρ, PAW/AECCAR uyarıları ve PDB element alanı büyük-harf dışa aktarımı (B) eklendi.
- **P1 — Fiziksel hesaplamalar (model + deneysel FCF altkümesi):** IT92 ve doğal nötron `b`, model Fourier/Patterson, fazlı SHELX `.fcf` Fo/Fo−Fc FFT, örneklenmiş Voronoi ve iyonik Ewald; ampirik toz profili/ölçüm CSV; CUBE/XSF hacimsel dışa aktarımı mevcut. **Kalan:** `.mtz` ve fazsız FCF çözümleri, anomal saçılma, izotop çözünürlüğü, gerçek cihaz profili inceltmesi/RIETAN-FP eşdeğeri, Bader analizi ve geniş yakınsama benchmarkları.
- **P1 — Dosya ve simetri kapsamı:** PDB/ENT kristal koordinatları ve ANISOU, CHGCAR spin ızgaraları, sınırlı mCIF moment/simetri görselleştirmesi eklendi. **Kalan:** `.vesta` projeleri, geniş biyomoleküler/kuantum kimyası biçimleri, tam BNS/manyetik süperuzay grupları, SAXIS düzeltmesi ve ayrıntılı setting/orijin dönüşümleri.
- **P2 — Morfoloji ve sahne:** Kübik olmayan `{hkl}` için tam nokta grubu eşdeğerleri, çoklu faz CIF dışa aktarımı ve VESTA düzeyinde nesne/per-site stil esnekliği eksik.
- **P2 — Yayın/3B dışa aktarım:** 1×–4× ve en fazla **24 MP** PNG, şeffaf zemin, **vektörel yapı SVG**, **kayıpsız RGB TIFF** (150/300/600 DPI baskı metaverisi), **A4 raster PDF**, **gerçek Bezier tabanlı vektör PDF/EPS**, **STL**, **renkli VRML97 (.wrl)** ve **glTF (.glb)** var. Vektör çıktıları hacimsel alanı içermez, EPS saydamlığı beyaza düzleştirir. Ancak WebGL ışık/depth tamponuyla birebir vektör eşdeğeri, manifold STL birleşimi, hacimsel izoyüzeylerin 3B çıktısı ve büyük-atomlu sahnelerde garantili yüksek FPS henüz yok.

Karşılaştırma: [VESTA resmî özellikleri](https://jp-minerals.org/vesta/en/) ve [geliştirme yol haritası](ROADMAP.md).

## Çevrimdışı çalışma (COD hariç)

**Service Worker + PWA manifesti mevcuttur.** HTTPS üzerindeki ilk başarılı ziyarette bütün uygulama kabuğu, Three.js ES modülleri, Moyo WASM, Türkçe/İngilizce çeviriler ve Karşı Uzay sayfası bir arada önbelleğe alınır. Bu önbellek hazır olduktan sonra aynı tarayıcı profilinde, aynı site adresinden yeniden açılış ve yerel bilimsel hesaplamalar ağ olmadan çalışabilir. İlk kurulum internet gerektirir; önbellek tarayıcı tarafından silinirse tekrar çevrimiçi ziyaret gerekir.

- Service Worker yalnız **aynı alan adındaki sabit uygulama dosyalarına** yanıt verir. COD, kullanıcı ayarlı Cloudflare Worker, diğer API'ler ve dış bağlantılar önbelleğe alınmaz.
- Yeni dağıtımda `sw.js` içindeki `CACHE_NAME` sürümünü artırın. Yeni sürüm bütün dosyaları başarıyla indirdikten sonra etkinleşir; açık eski sekmeler kapatıldıktan sonra geçiş olur. Eksik dosya varsa eski çalışan sürüm korunur.
- Hacimsel veri dosyalarının baytları proje kalıcı kaydına dahil edilmez ve sayfa yenilendiğinde yeniden yüklenmesi gerekir. Yerel CIF/POSCAR/XYZ dosyalarını kullanıcı tekrar açabilir; uzak COD verisine çevrimdışı erişilemez.
- Çevrimdışı testi Service Worker aktivasyonundan sonra DevTools ağ bağlantısını keserek veya tarayıcıdaki çevrimdışı senaryoyla yapın. `file://` şeması desteklenmez; HTTPS veya localhost kullanılmalı.

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
node --test tests/core.test.cjs tests/worker.test.mjs tests/reciprocal.test.mjs
```

**Gerçek Chromium/WebGL görsel testi** (Playwright + Three.js bağımlılıkları ve tarayıcı kurulumu gerekir): `node tests/browser/visual.test.mjs`. **Bağımsız CIF doğruluğu** Gemmi 0.7.4 referanslarını ve sabitlenmiş CIF örneklerini kullanır; komutlar ve kurallar [tests/validation/README.md](tests/validation/README.md) dosyasındadır.

GitHub Actions iş akışları:

- [pages.yml](.github/workflows/pages.yml): `main` dalında Node testleri, Moyo WASM paketleme ve GitHub Pages yayını.
- [browser-visual.yml](.github/workflows/browser-visual.yml): `main` üzerindeki ilgili değişikliklerde/elle Chromium ile WebGL görsel testi ve ekran görüntüsü artifact'leri.
- [cif-validation.yml](.github/workflows/cif-validation.yml): bağımsız CIF/Gemmi kontrolü; ölçüm/gate ve elle `strict` modu.

GitHub Pages ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir. Worker bağımsız olarak dağıtılır; ayrıntılar [worker/README.md](worker/README.md) dosyasındadır.

## Kaynaklar ve lisans notları

- 3B motoru: [Three.js](https://threejs.org/), sürüm **0.186.1**, GitHub Pages'e paketlenen [MIT lisanslı yerel ES modülleri](vendor/three/README.md).
- Otomatik simetri: [moyo-wasm](https://github.com/spglib/moyo/tree/main/moyo-wasm), sürüm 0.21.0; dağıtıma eklenen [MIT](licenses/LICENSE-MOYO-MIT.txt) ve [Apache-2.0](licenses/LICENSE-MOYO-APACHE.txt) lisansları.
- Uzay grubu/Wyckoff referans tabloları: [spglib](https://github.com/spglib/spglib) ve [wyckoff](https://github.com/anoopkcn/wyckoff) kaynaklarından türetilmiş veriler. Atıf/lisans bildirimleri uygulama kaynağında yer alır.
- COD kaynak/API: [Crystallography Open Database](https://www.crystallography.net/cod/) ve [resmî REST API açıklaması](https://wiki.crystallography.net/RESTful_API/).
