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

### Yeni ders laboratuvarları (MVP)

- **Toz Kırınımı** (`#toz-kirinimi`): Üst menüden açılır; etkin yapının IT92
  modelinden Bragg yansıma/profilini hesaplar. λ, 2θ üst sınırı, sabit pseudo-Voigt
  genişliği ve LP seçimi değişir. Grafikteki pik veya listeden bir `(hkl)`
  seçildiğinde yanındaki **döndürülebilir 3B kristalde** o Miller düzlem
  üyesinin birim hücreyle kesişen yüzeyleri ve normal yönü vurgulanır;
  Bragg açısı ve d aralığı birlikte güncellenir. Bir toz pikindeki bütün
  simetri eşdeğerleri henüz birlikte gösterilmez. Alt bölümde geliş açısı
  değiştirilerek 3B gelen/saçılan ışın okları, iki ardışık düzlemden saçılan
  dalganın `2d sinθ` yol farkı, `Δφ` fazı ve **ideal iki-dalga girişimi**
  incelenir. Bu görsel girişim eğrisi hesaplanan toz pik şiddeti değildir.
  Bu gerçek cihaz profil ince ayarı veya Rietveld analizi değildir. Yeni
  **yapı faktörü fazör deneyi**, toz pikinde bulunmayan sönmüş yansımalar
  dahil sıfır olmayan `(hkl)` indislerini alır; atomların IT92 karmaşık
  katkılarını uç uca, `F(hkl)` ve `|F|²` ile birlikte gösterir. Sayısal
  sönmenin doğrudan uzay grubu tarafından kanıtlanmış sistematik yokluk
  anlamına gelmediği özellikle belirtilir.
- **Yarıiletken Fiziği** (`#yariiletken-fizigi`): Üst menüden açılır; iki
  düzlem dalgalı **1B yaklaşık serbest elektron** bant modeli ile ayrı
  **ideal Fermi–Dirac** doluluk modelini etkileşimli gösterir. Etkin yapının
  `a` değeri yalnızca öğretici 1B model periyoduna aktarılabilir. Eğriler
  gerçek Si/GaAs elektronik bantları ya da DFT sonucu değildir. Ayrı
  **Atomdan Banda** deneyinde N = 1–64 açık zincirin tam N tight-binding
  enerji seviyesi ve sonsuz periyodik zincirin tek Bloch bandı birlikte
  çizilir; |t| ile enerji aralığı, N ile seviye sıklığı değişir. Tek
  orbital modeli kendi başına değerlik–iletim bandı aralığı üretmez.
  Devamındaki **iki orbitalli A/B birim hücresi** deneyinde ayrı değerlik
  ve iletim bantları çizilir: eşit bağlaşım ve eşit orbital enerjisinde
  bantlar bölge sınırında temas eder; farklı hücre içi/dışı bağlaşım veya
  A/B orbital enerji farkı gerçek bir *model bant aralığı* açar.
  `Eg = sqrt(delta² + 4(t1 − t2)²)` sayısal olarak sınanır. Üç örnek
  seçimi, sürgüler ve boş enerji bölgesi birlikte gösterilir. Bu 1B modelin
  değeri gerçek Si/GaAs aralığı değildir; bağımsız Fermi örneğinin `Eg`
  sürgüsüyle kendiliğinden eşitlenmez. İki orbitalli grafikte yeni bir
  **k seçimi**, iki bandın seçili özdurumlarını ve **A/B orbital karakteri**
  yüzdelerini gösterir. Tam bant temasında özvektör tekil olmadığı için
  yüzdeler atanmaz; bu ağırlıklar elektron/delik doluluğu değildir.
- Her iki sayfa çevrimdışı uygulama kabuğuna dahildir. Bilimsel geliştirme
  sırası, ileri ders deneyleri, cihaz/model sınırlamaları ve kabul testleri
  için [todo.md](todo.md) dosyasını inceleyin.

**Dil:** Uygulama ilk açılışta **İngilizce (EN)** gelir; üst sağdaki **EN / TR** düğmeleriyle Türkçeye geçebilirsiniz. Seçim bu tarayıcıda saklanır. Arayüz çevirileri [translations.js](translations.js) dosyasında yerel olarak tutulur; uzak çeviri servisi kullanılmaz.

Mimari artık tek bir HTML dosyasına gömülü değildir: [index.html](index.html) arayüz iskeleti, [styles.css](styles.css) tasarım, [crystal-app.js](crystal-app.js) uygulama/hesaplama giriş modülü, [translations.js](translations.js) yerel dil paketi ve [favicon.svg](favicon.svg) simgedir. Bu **ilk modülerleştirme adımıdır**; geniş uygulama modülünün kristal veri, render, analiz ve UI alt modüllerine ayrılması sonraki refaktör aşamasıdır. GitHub Pages tüm dosyaları yayımlar. Genel kullanım için uygulama sunucusu, hesap, veritabanı veya API anahtarı gerekmez. **Three.js 0.186.1**, OrbitControls ve ConvexGeometry artık [yerel `vendor/three`](vendor/three/README.md) modülleridir; otomatik simetri analizi için Moyo WASM dosyaları da dağıtımın `vendor/` dizininden yüklenir. 3B motorunun açılışı artık üçüncü taraf CDN'e bağımlı değildir. **Service Worker**, ilk başarılı çevrimiçi kurulumdan sonra uygulama kabuğunu ve 3B/WASM dosyalarını çevrimdışı açılış için önbelleğe alır. Yerel yapı dosyaları COD araması açıkça yapılmadıkça uzak bir uygulama sunucusuna yüklenmez.

## VESTA 3 kılavuz denklemiyle doğrulama ve GUI kanıtı (Paket 14)

BVS paneli artık **gerçek VESTA GUI sonucu olmadığını açıkça belirten** bir
referans hesap gösteriyor. [VESTA 3 resmî kılavuzunda](https://jp-minerals.org/vesta/en/doc/VESTAch11.html)
`B = 0,37 Å` sabit; uygulamadaki IUCr 2020 `Cu²⁺–O²⁻` çiftinde ise
`B = 0,36 Å`. Aynı seçili `R₀` ve aynı periyodik komşuluk kullanılarak
**B parametresi farkının** etkisi ve **ligand doluluğu varsayımının** etkisi
ayrı hesaplanıyor. Bu sayılar VESTA masaüstü programından **ölçülmedi**.

Zorunlu bağımsız Gemmi/ASE testinde deneysel sekiz ortam için bağ uzunlukları,
**Baur D, Hoppe ECoN ve VESTA'nın sabit-B kılavuz formülü** doğrulanıyor.
CSV fark matrisinde gerçek VESTA GUI sütunları **boş** bırakılıyor.
Yerel incelemede VESTA 3.5.8'in özgün 2016 parametre tablosundaki 19 çiftin
tamamının aynı `R₀` için `B = 0,37 Å` seçeneği bulundu; Cu için uygulama
ile referans kodu farklı. Telif koşulları nedeniyle VESTA ikilileri/parametre
dosyası depoya dağıtılmıyor. Başsız ortamda gerçek VESTA GUI çalıştırması
tamamlanamadı; gerçek ekran ve metin kayıtlarının doğrulanması için araç hazır.
[Paket 14 fark matrisi, bilimsel sınırlar ve ölçüm protokolü](tests/validation/PACKAGE_14_STATUS.md).

## Deneysel CIF ve yerel karma doluluk belirsizliği (Paket 13)

CIF okuyucu artık yalnızca üstveri içeren **`data_global` bloğundan sonra tek
bir kristal yapı bloğunu** güvenli biçimde kabul ediyor; birden fazla gerçek
yapı bloğu karıştırılmadan reddediliyor. Ekinde **SHELX rafinman metni**
taşıyan `.cif` dosyası da yanlışlıkla `.res` gibi yorumlanmıyor. Böylece IUCr'nin 2022 tarihli,
**K/Na kısmi doluluklu silikat** çalışmasının özgün ek CIF'i 40 simetri atomuyla
yükleniyor. Aynı kristalografik konumu **%72,2 K / %27,8 Na** paylaşabiliyor.

BVS paneli, aynı merkezdeki farklı iyon türlerinin hesaplarını, **türe göre
koşullu ortalama ve standart sapmayı** ayrı gösteriyor. Kısmi ligandlar için
**bağımsız konum modeli** ile olası minimum/maksimum ve en fazla 4096 durumdan
kesin %5–%95 kuantilleri hesaplanıyor. Aynı konumdaki türler birbirini
dışlıyor. Bunlar ölçülmüş konum hataları, atom korelasyonları, oksidasyon
atayımı veya bağ kanıtı değildir.

Zorunlu bilimsel CI'da SHA-256 ile sabitlenmiş **üç gerçek deneysel CIF**
(1965 NaCl, 1963 rutil TiO₂, 2022 IUCr K/Na silikat) ve **sekiz BVS merkezi**
bağımsız **Gemmi 0.7.5 + ASE 3.26.0** ile doğrulanıyor: tüm simetri atomları,
periyodik komşu görüntüleri, mesafeler ve bağ-değeri katkıları eşleşiyor.
IUCr'de yayımlanmış K1–O uzaklıkları da ayrı kontrol ediliyor. **Gerçek VESTA
GUI karşılaştırması yapılmadı.**
[Paket 13 kaynakları, ölçümler ve elle VESTA karşılaştırması](tests/validation/PACKAGE_13_STATUS.md).

## Kristal kimyası: koordinasyon ve bağ değerliği (Paket 12)

**BVS** panelinde artık [IUCr 2020 bağ-değerliği derlemesinden](https://www.iucr.org/what-we-do/digital-standards/data/datasets/bond-valence-parameters)
alınmış **19 açık yüklü katyon–anyon çifti** bulunuyor. Her satırın `R₀`,
**çifte özel `B`** (Cu(II)–O için `0,36 Å` dahil) ve kaynak kodu korunuyor.
Merkez atom değiştirildiğinde yalnız uygun parametreler seçilebiliyor.
Sonuç **geometrik komşu sayısı**, **doluluk ağırlıklı CN**, **BVS** ve
kullanıcının seçtiği formal valansla **işaretli farkı** ayrı gösteriyor.
Karışık/kısmi doluluk, kesim duyarlılığı ve büyük BVS sapmaları uyarılıyor.
Periyodik olmayan CUBE/XSF molekülleri yapay kutu duvarından bağlanmıyor.

Zorunlu **bağımsız ASE 3.26.0 CI testi**, dokuz NaCl/MgO/perovskit,
eğik hücre, karma doluluk, molekül ve sınır senaryosundaki **her görüntü
kaymasını, komşu uzaklığını ve ağırlıklı katkıyı** karşılaştırıyor.
Bunlar deneysel yapı belirlemeleri değil, analitik referans geometrilerdir.
Alternatif konumlardan doğan toplam **koşullu doluluk ortalamasıdır**;
birbirini dışlayan atomların aynı anda bulunduğunu kanıtlamaz. BVS oksidasyon
durumu, bağ derecesi veya VESTA ile bire bir eşdeğerlik kanıtı değildir.
[Paket 12 bilimsel protokolü ve sınırları](tests/validation/PACKAGE_12_STATUS.md).

## Çok alanlı CUBE/XSF ve VESTA setting güvenliği (Paket 11)

CUBE `NVAL` ile voksel başına iç içe saklanan **en fazla beş alanı** veya
negatif `NATOMS`/`DSET_IDS` ile adlandırılmış orbital alanlarını ayrı
katmanlara yükleyebilir. XSF'deki aynı Kartezyen çerçeveli birden fazla
`DATAGRID_3D` bloğu da adlandırılmış katman olur. Moleküler XSF `ATOMS`
koordinatları özgün **Kartezyen Å** konumunda korunur; yapay görüntüleme
kutusu kristal hücresi sayılmaz. Toplam **beş katman sınırı** korunur;
birden fazla alan barındıran belirsiz potansiyel/VESTA eşlikçi dosyası
tek alanmış gibi sessizce kullanılmaz.

VESTA `.vesta` projesinde doğrulanamayan `GROUP` ayarı ve özel
`SYMOP`/`TRANM` dönüşümü varsa standart ayardan **yanlış simetri çoğaltması**
yapılmaz; kaynak atomlar P1 olarak ve açık uyarıyla açılır. Bağımsız
ASE 3.26.0 testleri sabit gerçek CUBE kaynağından **türetilmiş** çoklu alanlarda
her katmanın 12.696 vokselini, fiziksel Å çerçevesini ve dokuz atomu
denetler. Bu bağımsız yeni deneysel alan veya gerçek VESTA GUI karşılaştırması
değildir. [Paket 11 protokolü ve sınırları](tests/validation/PACKAGE_11_STATUS.md).

## CUBE atomları ve bağımsız XSF doğrulaması (Paket 10.9)

CUBE açılırken **dosyadaki atomları kullan** seçeneği işaretliyse atom
koordinatları elektron yoğunluğuyla aynı **Kartezyen Å** sisteminde okunur.
CUBE bir kristal örgüsü tanımlamak zorunda olmadığından atomlar için
**periyodik olmayan, hücresi gizli bir görüntüleme kutusu** kullanılır;
bu kutu fiziksel birim hücre veya hücre hacmi sayılmaz. Gerçek örneğin
**dokuz atomu** bağımsız ASE 3.26.0 ile karşılaştırıldı ve korundu.

Gerçek hesaplama CUBE'ı bağımsız ASE yazıcısıyla **23×23×24 XSF** dosyasına
dönüştürüldü: 12.696 vokselde eşleşme **hatasız**; orijin/ızgara vektörleri
Å cinsinden aynı. Bu XSF **aynı CUBE'ın türetilmiş kodlamasıdır**, ikinci
bağımsız ölçüm değildir. 48³→64³ araştırma yüzey alanı farkı gerçek CHGCAR
için **%7,27**, CUBE ve ondan türeyen XSF için **%1,09**. Örnek 64³
tam çözünürlüklü Worker yolu üretimdeki 40-aralık yolundan yaklaşık
**7–9 kat daha uzun** sürdü (tek yerel CPU koşusu). Yüksek doğruluk
seçeneği bu verilerle henüz arayüze eklenmedi; gerçek VESTA GUI
ekran karşılaştırması da yapılmadı.
[P10.9 yöntem, performans ve sınırlar](tests/validation/PACKAGE_10_9_STATUS.md).

## Bağımsız gerçek dosya karşılaştırması (Paket 10.8.6)

CI, `pymatgen-core` deposunun kaynak commit ve SHA-256'sı sabitlenmiş
**CHGCAR, CUBE ve XSF** dosyalarını alıyor; uygulamanın **gerçek okuyucusunu**
bağımsız **ASE 3.26.0** okuyucularıyla tüm voksel değerleri, orijin,
eğik Kartezyen Å ızgara vektörleri ve üç orta kesitte karşılaştırıyor.
Gerçek Li CHGCAR (32³) ve hesaplamadan CUBE (23×23×24) alanlarında
**hatalı voksel yok**; küçük 2³ XSF ise gerçek fiziksel yoğunluk değil,
upstream biçim/sıra sınamasıdır. Aynı izoeşikte iki bağımsız izoyüzey
algoritmasının alan farkı sırasıyla **%0,21 / %8,55 / yaklaşık %0**;
bunlar **VESTA ekranından ölçüm değildir**. CUBE'daki **dokuz atomun**
uygulamada yalnız alan yüklenirken kristal sitesi olarak alınmadığı açık
bir eksiklik olarak raporlandı; **Paket 10.9 bu eksikliği giderdi**. [P10.8.6 yeniden üretme ve elle VESTA
karşılaştırma adımları](tests/validation/PACKAGE_10_8_6_STATUS.md).

## Kaynak örnekleme ve izoeşik duyarlılığı (Paket 10.8.5)

Yeni **yalnız CI'da çalışan** inceleme, 5wkd gerçek Fourier yoğunluğunun
48³→64³ izoyüzey alanında iki bağımsız üçgenleyiciyle de neden büyük değişim
gösterdiğini araştırır. Gerçek kaynak voksel değerleri ve uygulamanın 32³/48³/64³
trilineer örnekleyicisi kullanılır; **orijinal kaynaktan belirlenen sabit
izoeşikler**, negatif DELFWT tepeleri, fiziksel Å koordinatları, tepe değer
korunumu ve parçalanma ayrı ölçülür. Kaynak tepe-medyan skaler kontrastının
**±%2'si** kadar eşik kaydırıldığında bağımsız izoyüzey alanının duyarlılığı
raporlanır. Nyquist yakınındaki indeks-FFT enerjisi yalnız *örnekleme göstergesidir*;
aliasing kanıtı değildir. Eşik üstü düğüm oranı fiziksel elektron integrali
anlamına gelmez. Yüksek duyarlılıklar bilimsel uyarıdır, **yakınsama başarısı
değildir**. Uygulama algoritması/sınırları ve yüksek doğruluk modu değişmedi.
JSON ölçümleri CI'da saklanır: [P10.8.5 yöntem ve sınırlar](tests/validation/PACKAGE_10_8_5_STATUS.md).

## Bağımsız üçgenleyici ve yüzey parçalanması analizi (Paket 10.8.4)

Yeni CI kapısı, uygulamanın **gerçek tam-ızgara marching-tetrahedra Worker** algoritmasını bağımsız **scikit-image 0.25.2 Lewiner marching-cubes** yöntemiyle karşılaştırır. İki algoritmaya **aynı kaynak-türevli Float32 voksel alanı**, izoeşik ve fiziksel Å koordinat sistemi verilir. Böylece aynı çözünürlükteki farklar deneysel veri değişiminden değil, çıkarım yönteminden kaynaklanan duyarlılığı gösterir. Korpus gerçek 5i55 kısmi CCP4 ile Gemmi 0.7.5 tarafından 5wkd MTZ'den oluşturulan ağırlıklı/fark yoğunluklarıdır. Her kaynakta iki işaretli eşik **32³, 48³, 64³** çözünürlükte sınanır (18 karşılaştırma).

Raporda aynı ızgarada algoritmalar arası Å² alan farkları, her algoritmanın **48³→64³ çözünürlük duyarlılığı**, bağlantılı yüzey bileşeni sayıları, yoğunluk eşiği üstündeki voksel bileşenleri ve Å birimli örneklenmiş çift yönlü en-yakın-tepe mesafeleri bulunur. Bu geometrik mesafeler **kesin nokta-üçgen Hausdorff hata sınırları değildir**; bağımsız yöntem de gerçek fiziksel yüzeyin kesin referansı sayılmaz. Haritalarda alanın monoton yakınsaması beklenemez. Üçgen kotası aşımı, eksik ağ, sıfır alanlı üçgen veya ciddi koordinat hatası CI'yı kırar; gerçek ölçülen yöntem/çözünürlük farkları **bilimsel bulgu olarak uyarıyla raporlanır**, yanlış biçimde yakınsama kanıtı yapılmaz. JSON raporu Actions'ta saklanır; yüksek doğruluk modu sonuçlar netleşmeden arayüze eklenmez. **Ölçülen bulgu:** gerçek 5wkd FWT için q=.990 düzeyinde 48³→64³ alan değişimi üretim algoritmasında **%62,33**, bağımsız marching-cubes algoritmasında **%62,42**; q=.995'te **%87,72 ve %88,01**. Bulgular tek bir üçgenleyici kusurundan çok örnekleme/çözünürlük duyarlılığına işaret eder; **yakınsama sağlanmamıştır**. [Yöntem ve sınırlar](tests/validation/PACKAGE_10_8_4_STATUS.md).

## Yüksek çözünürlüklü yakınsama ve topoloji denetimi (Paket 10.8.3)

İkinci zorunlu CI kapısı gerçek 5i55 CCP4 ve Gemmi ile bağımsız üretilen 5wkd FWT/DELFWT haritalarını **32³/48³/64³** boyutlarında inceler. Yayındaki nihai üçgenleme eksen başına yaklaşık **40 aralıkla** sınırlıdır; dolayısıyla 48³ veya 64³ veri, kendiliğinden aynı ayrıntıda mesh çizimi anlamına gelmez. CI hem **mevcut varsayılan** hem de **yalnız testte kullanılan tam ızgara** üretimini raporlar. İki yol da mevcut **75.000 üçgen üst sınırına** uyar; kesilmiş sonuçlar reddedilir.

Fiziksel Å² yüzey alanı, eşik üstü voksel-integrali Å³ hacim, gerçek stride ve üçgen sayısı kaydedilir. Alan/hacim değişimleri *gözlenen çözünürlük duyarlılığıdır*, kesin yakınsama ispatı değildir. Gerçek kısmi haritaların dış sınırında açık kenara izin verilir, ancak **iç çatlaklar ve manifold olmayan kenarlar** CI hatasıdır. Eğik periyodik hücre sınırından geçen sentetik işaretli kürenin iki yüzündeki eş kenarlar periyodik sarımla kapatılmalıdır. Yönlendirme tutarsızlıkları ayrıca raporlanır, gizlice düzeltilmez.

Mevcut Worker kodu kullanılır; eksen aralığı yalnızca doğrulama amaçlı değiştirilebilir, **üretim varsayılanı ve bilimsel algoritma değişmedi**. Bağımsız deneysel CHGCAR/CUBE/XSF veri kümesi hâlâ açıktır. [Doğrulama durumu](tests/validation/PACKAGE_10_8_3_STATUS.md).

## Bağımsız hacimsel yakınsama kapısı (Paket 10.8.1–10.8.2)

CI artık analitik işaretli-mesafe küresi ve gerçek Gemmi kaynaklı haritalar üzerinden **zorunlu bilimsel izoyüzey doğrulaması** çalıştırır. Analitik kürenin (16³/24³/32³) gerçek alanı, kapalı hacmi ve yarıçapı bilindiği için **yüzey konumu, alan ve hacim yakınsaması** açık hata eşikleriyle denetlenir. Üretimdeki nihai marching-tetrahedra algoritması doğrudan mevcut Worker kaynağından çalıştırılır.

Gerçek korpusta sabitlenmiş **5i55 kısmi monoklinik CCP4** haritası ile **5wkd C2 deneysel rafinman MTZ** verisinden Gemmi 0.7.5 tarafından bağımsız oluşturulan **FWT/PHWT** ve **DELFWT/PHDELWT** 64³ haritaları bulunur. Her kaynak aynı fiziksel alan üzerinde 16³/24³/32³ ızgaralara örneklenir; yüzey alanı, üçgen sayısı, kaynak alanına karşı %95 örnek skaler sapma ve eşik üstü ızgara hacmi raporlanır. Bu son büyüklük **voksel-integraliyle tahmini hacimdir**; kapalı, yönleri tutarlı bir ağ doğrulanmadan 3B mesh'in iç hacmi olarak sunulmaz. Gerçek haritaların bilinen kesin bir izoyüzey geometrisi olmadığı için çözünürlükler arası farklar **ölçümdür**, kanıtlanmış Hausdorff sınırı veya monoton yakınsama garantisi değildir. Geçersiz, sıfır alanlı veya üçgen sınırında kesilmiş sonuç CI'yı başarısız yapar.

Aynı gerçek CCP4 skaler dizileri CUBE ve XSF biçimine yeniden kodlanıp geri okunarak koordinat ve değer korunumu sınanır; bu dosyalar **bağımsız deneysel CUBE/XSF örnekleri değildir**. Gerçek ve bağımsız CUBE/XSF/CHGCAR ile daha geniş MRC üretici korpusu sonraki açık iştir. P10.7 octree yalnızca önizlemeyi etkiler; **nihai bilimsel ağ ve dışa aktarma anlamı değişmez**. Node.js 22, Gemmi 0.7.5 ve NumPy ile `python tests/validation/volume_surface_reference.py` çalıştırılabilir. [Doğrulama durumu](tests/validation/PACKAGE_10_8_STATUS.md).

## Yerel 2:1 octree geçişleri ve ölçülmüş izoyüzey konum hatası (Paket 10.7)

**Büyük hacimlerde (≥200.000 voksel)** çevrimdışı Worker önce gerçekten bölgesel bir octree önizlemesi dener. Örneklenmiş izoyüzey geçişlerinin yakınında hücreler bölünür; komşu yaprak derinlikleri **2:1** oranında dengelenir. Büyük/küçük hücre yüzleri ortak dikdörtgenlere ayrılır ve aynı yüz merkezi yelpazesiyle üçgenlenir; ayrıt ara noktaları dik komşu yüzlere de taşınır. Böylece iç geçişlerde T-bağlantısı oluşmaz. **4.500 yaprak, yüzey başına 75.000 üçgen** ve harita genliğinin **%0,5'i** örnek skaler artık eşiği uygulanır. Bütçe veya örnek doğrulaması başarısızsa önceki ortak eksen ızgarasına ya da düzenli kaba önizlemeye dönülür. **Nihai bilimsel marching-tetrahedra ağı ve veri dışa aktarımı değiştirilmez.**

Analitik **64³ işaretli mesafe küresinde** yerel octree önizlemesinin her iç ayrıtına ters yönlü tam iki üçgen bağlıdır; sıfır alanlı yüz bulunmaz, komşu octree derinliği en fazla bir değişir. Bu özel testte köşe noktalarının **en büyük gerçek radyal konum hatası yaklaşık 0,021 Å**; eski düzenli kaba önizlemede **0,123 Å**. Performans paneli ve JSON çıktısı ayrıca köşe noktalarında örneklenen **skaler sapmayı** ve **birinci mertebeden yerel normal konum tahminini (Å)** gösterir. Bu tahminler *kanıtlanmış global Hausdorff hata sınırı değildir*; örnekler arasındaki kaçırılan ayrıntıların bulunacağını garanti etmez. Açık veya kesintiye uğramış ağlar watertight kabul edilmez.

Farklı GPU/CPU karşılaştırmalarında her cihazda aynı kristali, süperhücreyi, hacmi ve çokyüzlü modunu açın; kare ölçümünü sıfırlayıp görüntü kararlı hale geldikten sonra **JSON performans raporunu indir** düğmesini kullanın. Rapor tarayıcı/işletim sistemi dizesini, WebGL GPU satıcısı/renderer bilgisini, WebGL sürümünü, mantıksal çekirdek sayısını, piksel oranını, en büyük doku boyutunu, sahne tampon tahminlerini ve kare ölçümlerini içerir. Her cihazda birleşik ağ/GPU instancing A/B karşılaştırmasını ayrı ayrı yapın. CPU arabellek boyutları gerçek sürücü VRAM'i, kare aralıkları GPU süresi değildir. CI yalnızca bir gerçek Chromium/WebGL ortamını çalıştırır; çoklu GPU/OS korpusu için bağımsız cihaz kayıtları gereklidir.

## Uyumlu adaptif önizleme ve çokyüzlü GPU karşılaştırması (Paket 10.6)

Büyük (≥200.000 voksel) haritaların geçici izoyüzey önizlemesi, çevrimdışı Worker üzerinde **eşit aralıklı olmayan fakat birbirine tam uyumlu eksen düzlemleri** kullanabilir. İzoyüzeye yakın hücrelerin trilineer gerçek alan örnekleri ile kaba merkez interpolasyonu arasındaki fark, ortak eksen koordinatlarının nerede sıklaşacağını belirler. Düzlemler tüm ızgara boyunca uzanır; komşu hücrelerde **T-bağlantısı/çatlak** oluşmaz. Her eksende en çok **32 düğüm** ve üç düzeltme turu vardır. Performans paneli son hücrelerdeki **örneklenmiş skaler merkez artığını** ve belirlenen toleransın sağlanıp sağlanmadığını raporlar; sağlanmazsa önceki düzenli kaba önizlemeye dönülür. Bu artık matematiksel küresel hata sınırı veya izoyüzey mesafesi garantisi değildir; tam bölgesel 2:1 octree geçiş ağı henüz uygulanmadı. Izgara sınırını kesen ya da üçgen bütçesinde kesilen yüzeyler kapalı kabul edilmez.

**Nihai bilimsel marching-tetrahedra ağı değişmedi.** İşaretli değerler, eğik/periyodik örgü, potansiyel renklendirme, üçgen sınırları ve dışa aktarım aynı kaldı. Natif testler sabit ızgara renk/konum dizilerini birebir karşılaştırır ve içerde kapalı bir yoğunluk küresinin her ağ ayrıtının tam iki üçgene bağlandığını denetler.

Performans panelinde **Çokyüzlü dolgu yöntemi** seçimi eklendi: **Birleşik ağ (varsayılan)** ve **GPU örnekleme (deneysel)**. İkinci yöntem her asimetrik merkez için yerel gövde şablonunu, örnek başına öteleme matrisini ve RGB rengini yeniden kullanır; atom sahasına özgü opaklığı ve birleşik kenar çizimlerini korur. Gerçek Chromium/WebGL testinde 125 BaTiO₃ TiO₆ oktahedronu için her iki yolun sayı, alan/hacim, CPU geometri belleği ve çizim grubu karşılaştırması alınır. CPU süreleri ve destek varsa donanım GPU sorguları ölçülür; sabit FPS/ms iddiası veya zorunlu hız kazancı yoktur. Mevcut birleşik yöntem zaten tek dolgu draw-call kullandığından GPU yolu **isteğe bağlıdır**.

Paket 10.7'de gerçekten yerel, çatlak oluşturmayan octree geçiş ağı ve isodeğer/şekil hatası doğrulamaları, ayrıca çoklu GPU/cihaz performans matrisi ele alınacak.

## Etkileşimli kesit Worker'ı ve bellek hesabı (Paket 10.5)

**75.000 ve üstü vokselde** ekrandaki **192×192 2B kesit ve işaretli konturlar**, çizgi profili için **128×128 örnekler** ve bağımsız **32×32 kesit istatistikleri** artık aynı yerel ve çevrimdışı Worker göreviyle üretilir. Yeni istek eski görevi kapatır; sıra numarası kontrolü, 12 saniyelik zaman aşımı ve Worker hata durumunda güvenli ana iş parçacığına dönüş vardır. Küçük haritalar Worker açma maliyeti olmadan anında hesaplanır. Trilineer voksel değerleri, işaretli eşikler, eğik/Miller kesiti, Kartezyen Å uzunlukları ve CSV anlamı korunur. 3B sahnedeki kesit dokusu hâlâ ana iş parçacığında oluşturulur.

Performans paneli ve JSON raporu **paylaşılan arabellekleri bir kez sayan CPU geometri/dizi belleğini**, **RGBA8 doku taban seviye tahminini**, **ham voksel belleğini**, mevcut **32 MiB yüzey önbelleğini** ve canlı kesit Worker süresi/iptalini ayrı gösterir. Bu değerler **gerçek GPU VRAM ölçümü değildir**; sürücü tahsisi, mipmap, iç format ve saklı kopyalar WebGL tarafından açıklanmaz. Donanım GPU zaman sorguları ayrı kalır.

Son doğrulanmış izoyüzey üçgenlemesi ve mevcut tek-draw-call birleştirilmiş çokyüzlü dolguları korunur. Yerel çatlak üretmeyen adaptif ağ/hata sınırı denetimi ve çokyüzlü GPU instancing A/B deneyleri **Paket 10.6** kapsamına taşındı; bilimsel sonuçlar ve güvenlik sınırları değiştirilmedi.

## Çokyüzlü şablonları ve 2B dışa aktarımı Worker'a taşıma (Paket 10.4)

Süperhücrede aynı asimetrik merkezin tekrar eden çokyüzlüleri için **bir kez yerel ConvexGeometry gövdesi ve kenar şablonu** oluşturulur. Her kopyanın koordinatları ötelenir; renk/opaklığı ayrı kalır. Koordinasyon geometrisi, alan/hacim ve birleştirilmiş çıktı değişmez. Performans paneli eşsiz şablon, yeniden kullanım ve geçici şablon bellek miktarını gösterir. 2.400 çokyüzlü güvenlik sınırı korunur.

Çevrimdışı hacim Worker'ı artık 2B PNG'nin **marching-squares konturlarını** (işaretli seviyeler, belirsiz eyer noktası seçimi ve tanımsız bölge boşlukları dahil) da hesaplar. **64×64 bilimsel kesit CSV'si**, Kartezyen Å koordinatlarını ve voksel değerlerini Worker'da üretir; iptal, transfer ve güvenli eşzamanlı yedek yol vardır. Anlık 192px etkileşimli önizleme, küçük kesit istatistikleri ve çizgi profili hızlı geri bildirim için ana iş parçacığında kalır. Fiziksel birimler veya işaretlerin anlamı değiştirilmez.

Büyük haritalarda ilk *görsel önizlemenin* ızgara adımı en fazla 6³ hücrelik eşik-kesişim örneklemesine göre ayarlanır; yoğun ayrıntılı haritada seyrek olana göre daha sık global örnekleme seçilir. Bu yaklaşım **uzaysal uyarlamalı, hata kontrollü ağ** değildir. Son izoyüzey her durumda önceki doğrulanmış algoritma ve güvenlik sınırlarıyla hesaplanır. Bölgesel uyarlamalı ağ, GPU bellek ölçümleri ve daha geniş cihaz matrisi sonraki aşamalardadır.

## Kademeli yüzey, çokyüzlü LOD ve GPU ölçümü (Paket 10.3)

Büyük (≥200.000 voksel) ve önbellekte bulunmayan izoyüzeyler önce Worker üzerinde üretilen **kaba bir önizleme**, ardından sayısal algoritması değişmeyen tam geometri olarak görünür. Eski görevlerin iptali nedeniyle geç önizleme/sonuç sahneye eklenmez; mevcut 32 MiB önbelleğe yalnız tam sonuç girer. Bu yöntem iki aşamalı önizleme/iyileştirmedir; yerel hata kontrollü uyarlamalı üçgenleme değildir.

Çok sayıda çokyüzlü için **kenar çizgileri** uzaklık, sayı ve kalite seçimine göre görsel LOD kullanır. Dolgu yüzeyleri, koordinasyon komşuları, alan/hacim değerleri ve bilimsel dışa aktarım geometrisi değişmez. **Yüksek kalite** kenarları korur. 768×768 2B kesit PNG'sinin eğik Kartezyen/Miller düzlemindeki örnek ve renk hesabı aynı çevrimdışı Worker'a taşındı; 192px etkileşimli önizleme, kontur çizimi ve sayısal CSV ana iş parçacığındadır. Worker kullanılamazsa eşzamanlı güvenli PNG yoluna dönülür.

WebGL2'de `EXT_disjoint_timer_query_webgl2` desteklenirse Performans paneli ve JSON raporu CPU/kare sürelerinden ayrı olarak asenkron **gerçek GPU render sorgu süresi**, örnek sayısı ve geçersiz sorgu olaylarını gösterir. Desteklenmeyen veya geçersiz cihazlarda GPU süresi raporlanmaz. Sürücü/tarayıcı farklılıkları nedeniyle sabit FPS/ms başarı eşiği uygulanmaz. Mevcut atom, çokyüzlü, izoyüzey ve voksel güvenlik sınırları korunur.

## Hacimsel Worker ve CPU profili (Paket 10.2)

En az **75.000 voksel** içeren haritalarda önbellekte bulunmayan 3B izoyüzeyler, **çevrimdışı çalışabilen aynı kökenli Web Worker** üzerinde üçgenlenir. Böylece sayısal marching-tetrahedra hesabı sürerken görüntüleyici yanıt verebilir. İzodeğeri, veri kümesi veya görünürlük değiştiğinde eski görev iptal edilir; daha önce hesaplanan bir yüzeye dönüldüğünde **32 MiB sınırındaki bellek önbelleği** kullanılır. Asıl voksel dizisi uygulamada kalır, Worker'a yalnızca kopyalar aktarılır. Worker hatasında veri gizlenmez; eşzamanlı güvenli çizime dönülür.

Performans paneli artık atom yerleştirme, bağ arama ve çokyüzlü üretiminin CPU sürelerini; ana iş parçacığındaki hacim hazırlığını, Worker üçgenleme süresini, önbellek isabetlerini ve iptal edilen işleri ayrı gösterir. Bu süreler donanıma/tarayıcıya bağlıdır ve **GPU zamanlayıcı sorgusu değildir**. Sayısal sonuçların mevcut izoyüzey hesabıyla eşitliği, işaretli seviyeler, eğik/periodik ızgaralar ve potansiyelle renklendirme için doğrulanır. Gerçek tarayıcı testleri iptal, önbellek, Gemmi CCP4 ve çevrimdışı Worker çalışmasını kapsar.

Paket 10.2'de fiziksel voksel değerleri, birimler ve 8-yüzey/üçgen güvenlik sınırları değişmedi; 2B PNG raster işleme ve desteklenen GPU zaman sorguları yukarıdaki Paket 10.3 kapsamındadır.

## Performans ve LOD (Paket 10.1)

Görünümün üst araç çubuğundaki **çubuk grafik simgesi** Performans panelini açar. **Otomatik LOD**, atomların ekrandaki yaklaşık büyüklüğüne ve toplam sayısına göre üç küre ağ ayrıntısından birini seçer. **Yüksek kalite** büyük yapılarda bile ayrıntılı küreler kullanır; **Hız öncelikli** hafif ağı seçer. Yalnızca etkileşimli atom çizim ağı değişir: koordinatlar, renkler, bağ topolojisi, çokyüzlü geometrisi, seçimler ve bilimsel hesaplar korunur. **PNG dışa aktarımında daima tam ayrıntılı küreler kullanılır** ve ardından etkileşimli LOD geri yüklenir.

Panel görünür atom/bağ örneklerini, çokyüzlü sayısını, yaklaşık CPU sahne ve hacim üçgenleme sürelerini, WebGL çizim çağrılarını, çizilen üçgenleri ve geometri sayısını gösterir. Kare aralıkları tarayıcı zamanlamasını ve ekran senkronunu içerdiğinden **ortanca/p95 süreleri doğrudan GPU zamanı veya donanımdan bağımsız FPS değildir**. **JSON performans raporunu indir** ile cihazınızdaki ölçümü kaydedebilirsiniz. Tarayıcı CI, 60 / 1.620 / 12.960 atomlu stres sahnelerini ve gerçek Gemmi CCP4 yüzeyini kaydeder; değişken süreler için sabit geçiş eşiği koymaz.

Mevcut güvenlik sınırları geçerlidir: **20.000 atom, 65.000 bağ, 2.400 çokyüzlü, 2,5 milyon hacim vokseli**. Paket 10.1 henüz Web Worker ile geometri üretimi, GPU zamanlayıcı sorguları veya sınırsız hacim render'ı sağlamaz.

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
| **Hacimsel fizik verileri** | CUBE, CHGCAR, XSF, CCP4/MRC; CHGCAR kollineer/nonkollineer spin bileşenleri; kaynak nicelik/birim seçimi, yoğunluk/potansiyel normalizasyonu; seçilen alanın CUBE/XSF dışa aktarımı; çoklu izoyüzey, güvenli `A + k₁B + k₂C` fark alanı ve `∫Δρ dV`, ekstremum araması, Miller `(hkl)` kesitleri ve yaklaşık Voronoi integrali. |
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
4. **Cloudflare Worker · COD API:** varsayılan Worker adresini görüntüleme, test etme, özel adres kaydetme ve varsayılana dönme. Arama sayfasında yer kaplamaz.

### COD bağlantı yöntemleri

| Mod | Davranış |
| --- | --- |
| **Otomatik** | Kayıtlı özel Worker varsa önce onu, yoksa varsayılan Worker'ı dener; Worker erişilemezse doğrudan COD'a döner. Uygun filtrelerde OPTIMADE, diğerlerinde klasik COD JSON kullanılır. |
| **Yalnız Cloudflare Worker API** | Kayıtlı özel Worker'ı veya varsayılan Worker'ı kullanır; doğrudan COD'a geçmez. |
| **Yalnız doğrudan OPTIMADE API** | Yalnız OPTIMADE'nin desteklediği filtrelerle çalışır. |
| **Yalnız doğrudan COD klasik API / CIF** | COD'un klasik `result.php?format=json` API'sini kullanır. |

Resmî uç noktalar: [COD klasik JSON](https://www.crystallography.net/cod/result.php?format=json), [COD OPTIMADE](https://www.crystallography.net/cod/optimade/v1/structures). Aramayı tarayıcıdan yürütmek **CORS iznine** bağlıdır. Çevrimiçi içe aktarım başarısız olursa **Dosyadan** ile indirilen CIF'i açabilirsiniz; bu yol COD API CORS'una bağlı değildir. Varsayılan Worker adresi `https://kristalyapi-cod-api.aoakkirman.workers.dev` olarak tanımlıdır. Tarayıcıya kaydedilmiş geçerli özel adres varsa önceliklidir; **Varsayılana dön** yalnızca bu özel ayarı siler. Worker için [kurulum, güvenlik ve dağıtım rehberi](worker/README.md) bulunur. **GitHub Pages dağıtımı Worker'ı otomatik yayınlamaz.**

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

**Paket 8.2d — gerçek MTZ/Gemmi kıyaslaması ve kalite süzgeçleri:** İki gerçek Gemmi referansı test fikstürüdür: fazsız **5e5z (P21)** ve model/refinman fazlı **5wkd (C2, merkezleme dahil)**. Okuyucu gerçek CCP4 `COLUMN` kartlarını ve C2 simetri genişletmesini tanır. CI, sabit Gemmi 0.7.5 ile **367 gerçek 5wkd Fo/Fc/faz, σ, FOM, FREE satırını** ve **FWT/PHWT ile DELFWT/PHDELWT** haritalarının gerçek ızgara örneklerini uygulamadan bağımsız karşılaştırır. Kullanıcı, dışarıdan rafine edilmiş harita katsayılarını doğrudan içe alabilir veya **asgari Fo/σ(Fo)** ve açık **FREE=0/1 hariç tutma** seçebilir. `×FOM` yalnızca **ampirik genlik çarpımıdır**; σA maksimum olabilirlik ağırlığı değildir. Fazsız MTZ incelenebilir ancak model fazlı harita üretilemez.

**Henüz desteklenmeyenler:** genel MTZ uzay grupları/ASU ayarları, CIF2'nin tüm yansıma sözlükleri, anomalous Friedel farkları ve yansımalardan uygulama içinde σA/m/D refinman ağırlığı hesaplaması. Dışarıdan rafine FWT/DELFWT desteklense de tam CCP4 eşdeğerliği ve genel deneysel fazlama henüz iddia edilmez.
İleri işler [8.2 durum belgesinde](tests/validation/PACKAGE_8_2_STATUS.md).

### Paket 9.1 — CCP4/MRC2014 hacimsel harita içe aktarımı

Hacimsel çalışma tezgâhı artık CUBE, CHGCAR ve XSF yanında ikili **`.map`, `.ccp4` ve `.mrc`** dosyalarını tarayıcıda okur (en fazla 24 MB / 2,5 milyon voksel). Skaler MRC2014 **MODE 0/1/2/6**, açık little-/big-endian damgası, genişletilmiş başlık boyu, işaretli `NCSTART/NRSTART/NSSTART` ve `MAPC/MAPR/MAPS` eksen permütasyonu uygulanır. Voksel orijinleri ve adımları eğik hücre dâhil gerçek kristal metriğiyle Å olarak hesaplanır. Yalnızca örneklemesi tam birim hücre haritası periyodik kabul edilir; **kısmi harita kesiti** simetriyle sessizce doldurulmaz. `.mrc` dosyalarında START sıfırken Kartezyen `ORIGIN` uygulanır, belirsiz/çakışan konum bilgisi reddedilir. Bu işlem uzayda **skaler alan içe aktarımıdır**, yansıma veya faz okuma değildir.

CCP4/MRC başlıkları fiziksel niceliği/birimi güvenilir biçimde bildirmez. Varsayılan **bilinmiyor** seçilir; yoğunluk/potansiyel birimi ancak kaynaktan biliniyorsa açıkça seçilmelidir. Karmaşık Fourier modları, MODE 12 float16, skew matrisleri, eksik hücre geometri bilgisi ve 1B/2B haritalar henüz desteklenmez; genel cryo-EM haritalarının sağ-/sol-el oryantasyonu üreticiye bağlı olabilir. Bağımsız CI testi Gemmi'nin gerçek monoklinik **5i55_tiny.ccp4** örneğinin permütasyonunu, işaretli başlangıcını ve voksel değerlerini doğrular; ayrıca gerçek **5wkd rafinman MTZ** verisinden Gemmi 0.7.5 FFT ile yeni tam-hücre haritası üretilip aynı kontroller uygulanır. Bu, tüm MRC üreticileri veya VESTA proje uyumu iddiası değildir.

### Paket 9.3 — Sınırlı VESTA 3.x proje içe aktarımı

**Aç → Bilgisayarımdan** ekranında bir `.vesta` dosyası seçilebilir. Projenin `IMPORT_DENSITY` haritasını da kullanmak için aynı seçim penceresinde **`.vesta` ve referans gösterdiği yerel CUBE/XSF/CHGCAR/CCP4/MRC dosyasını birlikte** seçin. Uygulama `.vesta` içindeki dosya yolunu kendiliğinden açmaz ve internetten indirme yapmaz. Yalnız `.vesta` seçilirse yapı yüklenir; harita eksikliği uyarı olarak gösterilir ve sanal voksel üretilmez.

3.x alt kümesinde `CELLP` hücresi, en fazla 1.000 `STRUC` atomu (kesirsel konum/doluluk), uyumlu standart `GROUP` simetrisi, `BOUND` görünüm sınırları, `SBOND` bağ aralıkları, `SITET/ATOMT` renkleri, `BONDS/LABEL` görünürlüğü ve referans harita için en fazla **dört işaretli `ISURF` eşik/rengi** doğrulanır. Özel `SYMOP`/dönüşüm matrisleri, kamera/ışıklar, atom yarıçapları, vektörler, termal elipsoitler, çokyüzlü görünümleri, doku kaplamaları ve diğer harici `IMPORT_*` girdileri aktarılmaz; uyarılar editörde kalır. `ISURF` saydamlığı henüz dönüştürülmez; güvenli varsayılan kullanılır. Harita-hücre boyutu uyuşmazlığı uyarılır, sessiz yeniden örnekleme yapılmaz. Birimi bilinmeyen haritalar yine **bilinmiyor** birimiyle açılır. Bu işlem VESTA ile kayıpsız proje round-trip veya tam özellik eşdeğerliği iddiası değildir.

Gerçek açık VESTA 3.3 Cd/Te proje dosyasının yapısal bölümleri, bağımsız 3.5 VESTA oluşturucusunun `IMPORT_DENSITY/ISURF` sözleşmesi ve **gerçek Gemmi 5i55 monoklinik CCP4** haritasını referanslayan 3.5 test projesiyle kontrol uygulanır. Yayın için yine VESTA içindeki karşılaştırmalı görsel denetim önerilir.

### Paket 9.2 — İşaretli izoyüzey ve yüksek çözünürlüklü kontur stilleri

Fo−Fc fark haritası veya potansiyel gibi **iki işaretli skaler alanlara** tek tıklamayla **+|ρ| / −|ρ|** izoyüzey çifti eklenir. Pozitif/mavi ve negatif/kırmızı yüzeyler eklendikten sonra eşik, görünürlük ve saydamlık bakımından bağımsız ayarlanabilir. Her iki işarette de kaynak değer bulunması ve eşik değerinin ikisini de kapsaması gerekir; işlem **voksel verisini değiştirmez**, birimi belirsiz CCP4 alanını otomatik elektron yoğunluğu kabul etmez. Mevcut izoyüzeyler korunur; alan başına dört katman sınırı geçerlidir.

3B için **yumuşak**, **keskin (flat shading)**, **tel kafes** ve **yüzey+tel kafes** stilleri bulunur. 2B konturlarda **tüm aralıkta eşit**, **sıfıra göre ± simetrik**, **yalnız pozitif**, **yalnız negatif** seviye seçenekleri; işarete göre **düz/kesikli** ve **tek renk baskı** çizgileri vardır. Simetrik seviyelerde iki işaretin ortak büyüklük aralığı seçilir; tek işaretli veri güvenle eşit aralığa döner. PNG indirme artık 192 × 192 önizlemeyi büyütmez, doğrudan **768 × 768** sayısal ızgarayı örnekler. Bu iyileştirme hâlen **raster** çıktıdır; vektör/PDF konturu, GPU LOD veya tam VESTA eşdeğerliği değildir.

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
- Seçilen oksidasyon durumu/iyon çifti için **BVS**: IUCr 2020 kayıtlarından alınan `R₀` ve **çifte özgü `B`** parametreleriyle bağ-değerliği hesabı. İyon yükleri otomatik tayin edilmez; parametresi bulunmayan çift için sayı uydurulmaz.
- **Best-fit plane**: en küçük kareler düzlemi, RMS/maksimum düzlemsellik sapması ve iki düzlemin açısı; seçili periyodik atom görüntülerini otomatik açma (`unwrap`) yapılmaz.
- **DFT çalışma alanı:** Üst menüdeki **DFT** düğmesi (`#dft`); hesap hazırlığı, işler/kaynaklar, sonuçlar, yakınsama kanıtları ve kusur çalışmalarını ayrı bir sayfada toplar. [Çalışma alanı kılavuzu](docs/qe-workspace.md).
- **Quantum ESPRESSO ilk aşama:** Üst menüdeki **DFT → Hesap hazırlığı** bölümü sabit hücreli `relax` veya `scf` girdisi (`.in`) üretir. Simetri ve görüntüleme tekrarları tam doluluklu açık P1 hücresine dönüştürülür; isteğe bağlı alt atom tabakasını sabitleme `0 0 0` hareket bayraklarıyla yapılır. Gerçek pseudopotansiyel `*.UPF` dosyalarını kullanıcı `./pseudo` içine yerleştirir; dışa aktarılan parametreler yakınsama testinin yerine geçmez. Terminalde `pw.x -in kristal_relax.in > kristal_relax.out` ile hesaplamayı çalıştırıp **tamamlanmış** `.out` dosyasını **DFT → Sonuçları incele** bölümünden okuyabilirsiniz. Son enerji ve toplam kuvvet gösterilir; atom sayısı/türü eşleşen son koordinatlar kullanıcı onayıyla geri alma geçmişine eklenir. Tarayıcı DFT çalıştırmaz ve yüklenen dosyaları sunucuya göndermez.
- **Kristalin altına ve üstüne vakum:** Sağdaki Miller panelinden üst ve alt vakumu ayrı ayrı (0–80 Å) ekleyin. Slab kesmenin aksine, var olan atomlar korunur; `ab` düzlemine dik doğrultuda hücre uzatılır, alt boşluk kadar atomlar ötelenir ve yapı P1 süperhücreye dönüştürülür. Geri alma ve CIF/POSCAR dışa aktarımı kullanılabilir; relaksasyon yapılmaz.
- **MoS₂ araştırma ön denetimi (P0):** Sağdaki Kristal kusurları panelinde [ACS Nano 2022 UV/tek-foton çalışması](https://doi.org/10.1021/acsnano.2c09209) için açık P1 atomlarıyla bileşim, tek/iki S boşluğu veya oksijenli kusur **adayı**, yaklaşık Mo düzlem sayısı ve periyodik c-yönü boşluk kontrolü yapılır. Çıktı, geometri ve uyarıları içeren bağımsız araştırma JSON'udur; KristalYapı proje dosyası veya DFT/PL sonucu değildir. Adsorpsiyon, komşuluk, deneysel vakum ve tek foton emisyonu kanıtlanmaz; ayrıntılı araştırma planı için [todo.md](todo.md) dosyasına bakın.
- **MoS₂ kusur serisi karşılaştırması (P2 devamı):** `tools/qe_defect_compare.py` ile kusursuz, `V_S`, `V_2S`, `O_S`, `O2_at_VS` modellerinin tamamlanmış QE PDOS çıktıları aynı süperhücre/protokol koşullarında kontrol edilip kusura yakın/uzak atomlar üzerinden karşılaştırılır. Vakum enerji referansı bağımsız olarak verilmezse eğriler **hizalanmaz**. [Yöntem ve kullanım](docs/qe-defect-comparison.md).
- **Atom/orbital bazlı PDOS (P2 devamı):** `projwfc.x` tarafından üretilen atom bazlı dosyalar indeks, element, s/p/d/f kanalı, enerji ızgarası ve toplam projeksiyon tutarlılığıyla doğrulanır. DFT panelinde Mo-d, S-p, O-p ve tek atom orbital katkıları görüntülenir. Yalnız spin-polarize olmayan kollineer biçim desteklenir; veri tek başına kusur kaynaklı foton emisyonunu kanıtlamaz.
- **QE bant/DOS iş akışı (P2 başlangıcı):** [Hesaplama ve grafik kılavuzu](docs/qe-electronic.md). Yerel `tools/qe_pipeline.py`, gerçek QE `pw.x`, `bands.x`, `dos.x`, `projwfc.x` ile `relax → scf → bands / nscf → DOS / toplam PDOS` zincirini yönetebilir. Bant yolu kullanıcı tarafından doğrulanarak verilir; sonuç `electronic-results.json` dosyasından DFT paneline yüklenip çizilir. İlk sürümde Fermi/vakum hizalaması, orbital-bazlı PDOS, spin/SOC ve bilimsel yakınsama doğrulaması yoktur.
- **MoS₂ D2.2 gerçek koşu:** [Protokol ve sonuçlar](docs/qe-mos2-validation.md). Doğrulanmış Mo/S UPF dosyalarıyla 7/7 gerçek Docker/API SCF işi yakınsadı; ham QE/API/hash kanıtları kayıtlıdır. **Genel kabul başarısız:** 80→100 Ry kesme enerjisi farkı 2.374556 meV/atom ile 1 sınırını aşıyor; k-örgüsü ve vakum kontrolleri geçti. İlk başarısız sonuç ve eşik korundu; D2.2b takip sonucu aşağıda.
- **D2.2b yüksek cutoff takibi geçti:** [Üç gerçek MoS₂ SCF işi ve ham kanıtlar](docs/qe-mos2-cutoff-validation.md), 100/120/140 Ry, sabit k=8×8×1 ve c=24 Å. Ön kayıtlı 120→140 Ry farkı **0.268123 meV/atom ≤1**; 100 Ry eski D2.2 enerjisini tam tekrarladı. İlk zaman aşımı korunarak 6 GiB kabul worker'ıyla tekrar başarılı oldu. Yüksek cutoff k/vakum takibi aşağıdaki D2.2c ile geçti; kuvvet ve bağımsız fiziksel doğruluk ayrı kalır.
- **D2.2c ortak SCF referansı geçti:** [Altı gerçek iş ve üç kapı](docs/qe-mos2-kvac-validation.md), 120/960 Ry, 16×16×1, c=24 Å: cutoff 0.267715 ≤1, k-örgüsü 0.000907 ≤1, vakum basılı hassasiyette 0 ≤2 meV/atom. D3 öncesi sonlu enerji kapıları kapandı; kuvvet/relaksasyon ve bağımsız fiziksel doğruluk ayrıca bekliyor.
- **D2 — Gerçek SCF iş API'si (ilk sürüm):** [Docker/worker ve UPF kurulum kılavuzu](docs/qe-jobs.md). Kullanıcının onayladığı PBE/spinsiz SCF işi, doğrulanmış yapı JSON'undan ve yalnız operatörün izin verdiği UPF dosyalarından hazırlanır; SQLite kuyruğu, ayrı worker, iptal, log ve gerçek toplam enerji/SCF sonucu sunulur. Varsayılan mod hâlâ salt-okunurdur; `QE_JOBS_ENABLED=1` ve güçlü API anahtarı gereklidir. Yerel ağda kimlikli iş için HTTPS gereklidir. **[D2.1 gerçek Si doğrulaması](docs/qe-scf-validation.md):** yedi Docker/API işi, ham SCF yakınsama kanıtları ve sınırlı kesme enerjisi/k-örgüsü enerji kontrolleri kayıtlıdır. MoS₂ ve bağımsız fiziksel referans doğrulaması ayrı kabul adımlarıdır.
- **Docker Quantum ESPRESSO bağlantısı (D0–D1):** [Kurulum ve API kılavuzu](docs/qe-docker-api.md). `compose.qe.yml` ile Debian QE 6.7 ikilisi ve salt-okunur FastAPI servisi; DFT panelinden IP:port girerek `/api/health` ile `/api/capabilities` kontrol edilir. Servis varsayılan localhost'a bağlıdır; yerel ağ erişimi, CORS ve HTTPS izinleri açıkça yapılandırılmalıdır. **Bu aşamada HTTP üzerinden DFT hesabı başlatılamaz.**
- **Yerel DFT yürütücüsü (P1 başlangıcı):** [Python + Quantum ESPRESSO çalıştırma kılavuzu](docs/qe-runner.md). Tarayıcıda dışa aktarılan `.in` dosyasını Linux/VM üzerinde gerçek `pw.x` ile çalıştırabilir, `run.json` ve `structure.out` dosyalarını alabilirsiniz. Kod DFT'yi tarayıcıda çalıştırmaz; açıkça `--run` verilmezse yalnız hazırlık yapar. Bilimsel yakınsama ve MoS₂ doğrulaması henüz yapılmamıştır.
- **Kristal kusurları:** görüntüleme süperhücresini gerçek P1 atom konumlarına dönüştürerek tek atomda vakans/ikame veya kesirli koordinatta arayer atomu oluşturma. 1000 atom üst sınırı ve periyodik arayer çakışma kontrolü vardır. Geri alma ve CIF/POSCAR dışa aktarımı desteklenir; yüzey/atom relaksasyonu, yük durumu ve oluşum enerjisi hesaplanmaz.
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
`±2` ile sınırlandırılmadan ters örgü metriğine göre taranır; periyodik
olmayan moleküler verilerde görüntü eklenmez. Model
**yalnızca seçili referans iyon çifti** ve ampirik `R₀/B` parametresi
içindir; otomatik oksidasyon durumu veya kimyasal bağ derecesi çıkarmaz.
BVS sonucu yanında, formal yükün eşit bağlar arasında bölündüğü
varsayımıyla beklenen bağ uzunluğu da bir referans değer olarak
görüntülenir. Matematiksel tanımlar, sınırlar ve bağımsız regresyonlar
[`tests/validation/PACKAGE_7_STATUS.md`](tests/validation/PACKAGE_7_STATUS.md)
içindedir. Paket 12 bağımsız bilimsel karşılaştırmaları ve kısıtları
[`tests/validation/PACKAGE_12_STATUS.md`](tests/validation/PACKAGE_12_STATUS.md)
dosyasında ayrıca sunulur.

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
