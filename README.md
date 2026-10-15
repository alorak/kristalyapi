# Kristal Yapı · 3B Studio

Yalnızca tarayıcıda çalışan, **VESTA'dan esinlenen bir kristal yapı görüntüleyicisi/editörü**.

## Kullanım

- [index.html](index.html) tek başına arayüzü, CSS'yi ve uygulama JavaScript'ini içerir. Derleme, backend, veritabanı veya API anahtarı gerekmez.
- 3B motor için sabitlenmiş **Three.js 0.182.0** ve OrbitControls/ConvexGeometry modülleri jsDelivr CDN'den yüklenir. **İlk açılışta internet bağlantısı gerekir; tamamen çevrimdışı, tek dosya değildir.** Kristal dosyaları bir sunucuya yüklenmez.
- GitHub Pages için depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilir. `main` dalına merge sonrasında doğrulama ve dağıtım çalışır; PR açıldığı anda CI tetiklenmez.
- Yerelde statik sunucu kullanabilirsiniz: `python3 -m http.server 8000` ve `http://localhost:8000` adresini açın.

## P0 — Kanonik Niggli hücre indirgemesi

Sol **Örgü dönüşümü → Primitive hücre / kısa baz → Niggli indirgemesi**.
Křivý–Gruber'in sekiz adımlı Niggli indirgeme algoritması (spglib
BSD-3-Clause uygulaması temel alınmıştır) gerçek unimodüler baz matrisiyle
atom konumlarını dönüştürür. ADP bileşenleri yeni metrikte yeniden ifade
edilir. Determinant/hacim/atom sayısı denetlenir; başarısız yakınsama
atomlara uygulanmaz. Referans karşılaştırmaları Gemmi 0.7.4 ile
kübik, ortorombik ve 3 triklinik/eğik hücre için eklendi.
Bu işlem merkezleme veya simetri grubunu **bulmaz**; merkezi bir hücre
önce doğrulanarak primitive hale getirilmelidir.
## VESTA Aşama 3 — Primitive / kısa baz dönüşümleri

Sol **Örgü dönüşümü → Primitive hücre / kısa baz** bölümünde iki güvenli işlem vardır:

- **Merkezlemeden primitive hücreye:** Seçili uzay grubu ayarındaki
  F, I, A, B veya C merkezleme çevirilerini belirler; öncelikle bütün
  P1 atomlarının eşdeğer çevirilerinin element ve dolulukla uyuştuğunu
  Kartezyen toleranslı biçimde denetler. Eksik atom/uyumsuz doluluk
  varsa sessiz dönüştürmez. Primitive dönüşüm sonucu atom sayısı ve
  hücre hacim oranını doğrular; ADP tensörleri yeni hücre metriğine
  taşınır. Örnek: konvansiyonel NaCl 8 atom → primitive 2 atom,
  hacim 1/4. BCC 2 atom → primitive 1 atom, hacim 1/2.
- **Unimodüler kısa baz dönüşümü:** Tam sayı katsayılı sağ elli
  unimodüler (det=+1) baz sıralama ve uzunluk kısaltma uygular.
  Atom sayısı ve hacim invariantları denetlenir; kristalografik
  geometri korunur.

Her iki işlemden sonra **P1 hücre** üretilir; kaynak uzay grubu
setting/orijin otomatik eşdeğer olarak yeniden tanımlanmaz.
Miller düzlemleri, hacimsel veri ve diğer faz üst üste bindirmeleri
artık aynı referans bazını temsil etmeyebileceğinden sıfırlanır.
Tam spglib `standardize_cell` / `niggli_reduce` eşdeğerliği
uygulanmadı: R-merkezleme, genel setting/orijin dönüşümü,
uzay grubu tayini ve Niggli algoritması **eksik**.
Referans: https://spglib.readthedocs.io/en/stable/api/autodoc/spglib.cell.html
ve https://spglib.readthedocs.io/en/stable/api/autodoc/spglib.reduce.html
## VESTA Aşama 3 — Kristalografik analiz (BVS, düzlem, XRD)

- **Bağ-değerliği / BVS:** Açıkça seçilmiş katyon, oksidasyon durumu ve anyon
  için Brese–O'Keeffe (1991) R₀ sabitleri ve B=0,37 Å kullanılır. Komşular
  kristal metriğinde periyodik görüntülerden bulunur; çoklu görüntüler ayrı
  komşu olarak raporlanır. Kısmi doluluk bağ katkısını ağırlıklandırır.
  NaCl (a=5,64 Å, Na–Cl=2,82 Å) modelinde CN=6 ve BVS≈0,981.
  Atom ve oksidasyon durumları otomatik tayin edilmez; desteklenmeyen çiftlerde
  sonuç uydurulmaz. Parametre kaynağı:
  https://doi.org/10.1107/S0108768190011041 .
- **Best-fit plane:** 1-tabanlı atom indislerinden 3B kartezyen koordinatları
  hesaplar; kovaryans özvektör ayrışımıyla en düşük RMS dik sapmalı düzlemi
  belirler. Normal vektörü, RMS/maks sapma, iki düzlem arası dar açıyı ve
  düzlem çizimini üretir. Kısmi periyodik koordinat unwrap yapmaz.
- **Yapı faktörü / öğretici XRD:** P1 konumları veya simetriyle tam genişletilmiş
  konumlardan F(hkl), faz, |F|² ve 2θ Bragg konumlarını hesaplar.
  Kullanıcı λ, maksimum hkl, 2θ üst sınırını düzenler. Noktasal X-ışını
  elektron saçıcı f=Z yaklaşımı, doluluk ve mevcut Debye–Waller Uiso/Uij
  sönümü kullanılır. ±hkl çiftleri ve eş 2θ çizgileri gruplanır;
  spektrum ve yansıma CSV dışa verilir. BCC (100) sistematik söner;
  (110) izinlidir. **Deneysel XRD veya tam saçılma simülasyonu değildir:**
  f₀(q) Cromer–Mann, anomal saçılma, Lorentz/polarizasyon, geometrik
  düzeltmeler, pik profili ve tercihli yönlenme bulunmaz. Bağlantı:
  https://dictionary.iucr.org/Structure_determination .
- **Testler:** NaCl BVS, kısmi doluluk, kollinear best-fit hata yakalama,
  BCC sönümleri ve Bragg açıları Node regresyonlarına eklendi. Bu modüller
  gerçek tarayıcı E2E ve bütün 230 uzay grubu için bilimsel referans
  doğrulaması olmadan tam VESTA eşdeğeri kabul edilmemelidir.
## VESTA Aşama 2 — Çoklu CIF yapı/faz karşılaştırması

Sağ **Yapı → Çoklu yapı/faz karşılaştırması** bölümünden ana kristali değiştirmeden
en fazla **üç ek CIF/mCIF** yüklenebilir (her biri en çok **400 genişletilmiş P1 atom**).
Diğer fazlar kendi hücre metriğiyle ve renk/saydamlık seçenekleriyle aynı
Kartezyen Å sahnesinde çizilir. Kullanıcı her faz için orijin veya hücre merkezini
hizalama ve X/Y/Z ofsetlerini Å cinsinden düzenleme seçeneğine sahiptir.
Birim hücre sınırları da ayrı gösterilir.

Faz modelleri proje JSON, son kristal ve Undo/Redo durumunda saklanır.
**Sınır:** Bu kullanıcı kontrollü yapısal üst üste bindirmedir; otomatik atom
eşleştirme, minimum-RMSD hizalaması, strain/dislokasyon analizi veya
mCIF manyetik momentleri desteklenmez.
## VESTA Aşama 2 — Geometrik kristal morfolojisi

Sağ **Miller** sekmesindeki **Kristal morfolojisi** bölümünde `{hkl}` yüz aileleri, merkezden Å cinsinden uzaklık, renk ve görünürlük seçilebilir. Kübik hücre metriklerinde, istenirse eşdeğer `{hkl}` indis permütasyonları kullanılır; diğer sistemlerde yalnız iki zıt normal `±(hkl)` doğrudan desteklenir. Geometri, Kartezyen `n·r ≤ d` yarı uzaylarının kesişiminden oluşturulur; açık/sonsuz şekil üretilemezse yüzey çizilmez. Kapalı hacim (Å³) ve yüzey alanı (Å²) raporlanır.

Morfoloji katmanı mevcut nesne yöneticisinden yönetilir; yüz aileleri proje/son kristal kaydında ve geri alma geçmişinde saklanır. Kübik `{100}`, merkezden 3 Å örneğinde altı yüz / sekiz köşe / 216 Å³ hacim / 216 Å² toplam alan elde edilir.

**Sınır:** Bu Wulff denge şekli değildir: yüzey enerjisi, adatom, fiziksel büyüme kinetiği veya yüzey relaksasyonu hesaplanmaz. Kübik olmayan sistemlerde tüm kristal nokta grubu eşdeğerleri otomatik türetilmez; ek yüz aileleri kullanıcı tarafından girilmelidir.

## VESTA Aşama 2 — Çoklu hacimsel alan, izoyüzey ve nicel 2B kesit

**Hacimsel veriler** ekranından en fazla **dört** CUBE / CHGCAR / XSF alanı yüklenebilir. Ek alanlar yalnızca fiziksel Kartezyen orijin ve üç boyutlu kapsama vektörleri uyumluysa kabul edilir; farklı çözünürlükteki eşkapsamlı ızgaralarda trilineer interpolasyon kullanılır.

- Her alanda **en fazla dört ayrı izoyüzey**: izodeğer, renk, görünürlük, saydamlık ve kaldırma. Toplam etkin izoyüzey sayısı performans için sekiz ile sınırlıdır; ızgaralar bellekte tutulur.
- Aktif alan seçilerek 2B kesit alınır; ikinci uyumlu alan seçilirse mevcut izoyüzeyler ve kesit onun skaler değerleriyle renklendirilebilir. Veri türleri otomatik olarak gerçek elektrostatik potansiyel diye etiketlenmez.
- 2B kesit için fiziksel boyut (Å), min/maks/ortalama alan değeri, sayısal renk skalası, **64×64 örneklemeli CSV** (u,v,x,y,z koordinatları Å) ve PNG dışa aktarma eklendi. Kesit, dosyanın gerçek eğik ızgara vektörlerinde örneklenir.
- Çoklu alanların baytları hâlen tarayıcı belleğindedir; proje JSON veya localStorage içine kopyalanmaz. Sayfa yenilenince hacimsel dosyaların yeniden açılması gerekir.
- Bu paket **keyfî (hkl) yönlü kesit, hacimsel veri toplama/çıkarma ve VESTA eş görüntü kıyası** yapmaz. Yalnız mevcut fiziksel ızgara eksenlerine paralel kesitler desteklenir. Aynı koordinat çerçevesinde olmayan alanlar sessizce birleştirilmez.

## VESTA Aşama 1 — CIF / WebGL / katmanlar / termal elipsoitler

- **CIF doğruluğu:** CIF anizotropik `_atom_site_aniso_U_ij` / `_atom_site_aniso_B_ij`
  ve izotropik `U_iso_or_equiv` / `B_iso_or_equiv` alanlarını okur.
  CIF simetri operatörleriyle oluşturulan eşdeğer konumların **ADP tensörleri
  de döndürülür**; tensor koordinatları triclinic örgü metriğiyle Kartezyen
  uzaya dönüşür. Orijinal P1 genişletmesi korunur.
- **Kayıt ve kaynak üstverileri:** seçilmiş kimyasal ve bibliyografik **skaler**
  CIF alanları (örn. DOI, dergi, başlık, COD kimliği), Uij ve Uiso proje/son
  kristal kayıtları ile CIF dışa aktarımına taşınır. Atom bileşimi değiştiyse
  kaynak `_chemical_formula_sum` otomatik olarak tekrar yazılmaz.
  **Tam CIF round-trip garantisi yoktur:** bilinmeyen tag ve loop blokları,
  tüm alternatif origin/setting eşdeğerliği, çoklu CIF veri blokları ve
  manyetik mCIF verileri hâlâ eksik; CIF dışa aktarımı genişletilmiş atomlarla
  P1 üretir. Metadata için kaynak dosyayı saklamanız önerilir.
- **Termal elipsoitler:** Sol Genel → Görünüm bölümünde ADP göster ve
  50 / 90 / 99 % olasılık düzeyi. Özdeğer ayrışımına dayalı yönlenmiş
  elipsoid; pozitif tanımlı olmayan tensörler çizilmez ve sayılar raporlanır.
  İzotropik Uiso, triklinik hücrede dahi Kartezyen küre olarak gösterilir.
- **Katman yöneticisi:** Sağ Yapı → Nesneler ve katmanlar. Atomlar, elipsoitler,
  bağlar, koordinasyon çokyüzlüleri, hücre, Miller katmanları, hacimsel
  veri, etiketler, eksenler için görünürlük, opaklık, uygun katmanlarda renk
  ve sıralama. İşlemler proje/son-kristal kaydına ve Undo/Redo'ya dahildir.
- **Bağımsız testler:** 5 gerçek CIF (COD 4335507, Fe3O4, grafit, LiFePO4,
  CuCl) için atom/hücre roundtrip kontrolleri; ADP tensor ve izotropik
  ellipsoid için triclinic regresyonları; katman state testleri.
- **Gerçek tarayıcı testi:** `.github/workflows/browser-visual.yml` yalnızca
  main push / manuel çalışmada yazılım WebGL ile Chromium render eder.
  Si, COD, ADP ve Miller sahnelerini PNG ve sayısal piksel istatistiği
  artifact'lerine yazar; görüş, elipsoid ve Miller görünürlüğünün ekrana
  etkisini test eder. Harici Three.js CDN erişimi ve Chromium/SwiftShader
  bulunduğu CI ortamı gereklidir. Bu test VESTA görüntüsüyle piksel-piksel
  bilimsel eşitlik iddiası taşımaz.
## Güncel kısa vade ve VESTA yol haritası

[**VESTA farkları ve sıralı geliştirme planı → ROADMAP.md**](ROADMAP.md)

Son kısa-vade güncellemesinde: tekrar eden 3B çalışma alanı başlığı kaldırıldı; kamera görünüm düğmeleri ikonlaştırıldı; bağ çifti editörü ve periyodik çokyüzlüler genişletildi; 4 atomlu dihedral ve CSV ölçüm geçmişi eklendi; Miller paneli bağımsız düzlem katmanlarını, görünürlük ve renk ayarlarını yönetir.

Bunlar gerçek kimyasal bağ varlığını veya yüzey relaksasyonunu hesaplamaz; bilimsel karşılaştırmalar ve gerçek WebGL görsel doğrulaması ayrıca gereklidir.

## Undo / Redo · Kristal düzenleme geçmişi

Üst menüde **Geri al (↶)** ve **Yinele (↷)** ikonları yer alır. Yapı düzenlemesinden önce etkin olmayan düğmeler, değişiklik kaydedildikçe açılır.

- **Klavye:** `Ctrl+Z` / `Cmd+Z` geri alır, `Ctrl+Shift+Z` / `Cmd+Shift+Z` veya `Ctrl+Y` yeniden uygular.
- Atom ekleme, silme ve koordinat değiştirme; yapı içe aktarma / örnek yükleme; hücre, uzay grubu, süperhücre, bağ kuralları, koordinasyon parametreleri, görünüm ve Miller ayarlarının **başarıyla çizilmiş durumları** kaydedilir.
- Yinele yaptıktan sonra yeni bir düzenleme uygulanırsa eski yineleme kolu temizlenir. Birbirinin aynısı olan yeniden çizimler geçmişi doldurmaz.
- 60 önceki durumla ve tek görüntü için 380.000 karakterle sınırlandırılmış **bellek içi geçmiş** kullanılır. Geçmiş sayfa yenilenince sıfırlanır; **yalnız son kristal** önceki `localStorage` mekanizmasıyla kalıcıdır.
- Metin veya sayı kutusu odaktayken klavye kısayolları tarayıcının **yerel metin geri alma** davranışını bozmaz; kristal durumunu geri almak için üstteki düğmeleri kullanabilirsin.
- Kamera hareketleri ve ayrıca kaydedilmiş ölçüm geçmişi bu özelliğin kapsamında değildir. CUBE/CHGCAR/XSF alan matrisi geçmişe kopyalanmaz; önceki kristale dönüşte uyumsuz hacimsel katman temizlenir.

## Bağımsız CIF doğruluğu (GitHub Actions)

[**CIF doğrulama hattı**](tests/validation/README.md), 29 açık kaynak test CIF'si + özel olarak COD 4335507 ve 10 sentetik zorlayıcı örneği **Gemmi 0.7.4** ile karşılaştırır. Testler aynı `index.html` içindeki CIF ayrıştırıcısını kullanır. Atom türü, occupancy, simetriyle genişletilmiş konumlar, periyodik koordinatlar, hücre metrikleri ve hacim karşılaştırılır.

- Sadece `main` dalına ilgili kod/test değişiklikleri merge/push edildiğinde veya `workflow_dispatch` ile çalışır; PR'larda tetiklenmez.
- Sonuçlar GitHub Actions **Summary** ve `browser.json`, `reference.json`, `report.json`, `report.md` içeren indirilebilir **artifact** olarak sunulur.
- Varsayılan **ölçüm modu** uyumsuzlukları gizlemez ancak mevcut Pages yayınını engellemez. Manuel `strict` modda uyumsuzluk veya belirsiz sonuç işin başarısız olmasına yol açar.
- Test sırasında COD bağlantısına gerek yoktur; tüm fixture dosyaları kaynak ve Git blob SHA-1 pinleriyle repoda saklanır, her çalışmada ayrıca SHA-256 kaydedilir.

Bu hat **uyumsuzlukları ölçer**, CIF parser'ındaki hataları otomatik düzeltmez. Referans üretimi ve bilimsel ölçümler yalnızca CI/test ortamında yapılır; frontend uygulamasına Python veya backend eklenmez.

## Miller düzlem aileleri

**Sağ panel → Miller** bölümünde artık **Süperhücredeki tüm paralel düzlemleri göster** seçeneği bulunur (varsayılan açık).

- Belirli bir `(h,k,l)` için normal yön ve aralık `dₕₖₗ` değişmez. Gösterim, `h u + k v + l w = t+n` (tam sayı `n`) koşulunu sağlayan, seçili sonlu süperhücre ile kesişen **tüm paralel düzlemleri** çizer. Seçilen `t` düzlemi daha belirgin renktedir.
- Örneğin 2×2×2 birim hücrede **(111)** için `t=1`, 0–6 aralığında 7 potansiyel düzlem düzeyine karşılık gelir; iki dış düzlem yalnız köşelere değdiği için 3B yüzey olarak çizilebilen **5 adet** düzlem oluşur.
- Seçenek kapatıldığında yalnızca `t` düzlemi çizilir. Son kaydedilen proje ve `localStorage` geri yüklemesi bu seçimi korur.
- **Sonlu kalınlıkla atom filtreleme ve vakumlu slab oluşturma**, tek bir seçili `t` kesitini esas almaya devam eder. Paralel düzlemleri çoğaltmak fiziksel yüzey üretimi veya kristalografik {hkl} yön ailesindeki farklı normal yönleri üretmek anlamına gelmez.

## Hacimsel fizik verileri: izoyüzeyler, kesitler ve potansiyel

**Yapı (sağ panel) → Hacimsel fizik verileri** bölümünden bilgisayarındaki hacimsel veriyi ekleyebilirsin. Uygulama bütün işlemeyi tarayıcının JavaScript/WebGL ortamında yapar; yeni bir backend, veritabanı veya harici sayısal hesaplama servisi gerekmez.

- **Gaussian CUBE (.cube, .cub):** Atom başlığı, üç boyutlu ızgara, orijin ve gerçek Kartezyen eksenler okunur. Pozitif ızgara sayısı Bohr, negatif ızgara sayısı Å olarak işlenir. Çoklu moleküler orbital / negatif atom sayılı CUBE bu sürümde desteklenmez.
- **VASP CHGCAR / CHG:** POSCAR hücresi/koordinatları ve ilk yoğunluk bloğu okunur; x indeksi en hızlı değişen veri sıralaması uygulanır. VASP'ın [CHGCAR tanımına](https://vasp.at/wiki/CHGCAR) göre ızgara değerleri **hücre hacmine bölünerek** yük yoğunluğuna dönüştürülür (Å⁻³). Çizim aşamasında sınırdaki ilk veri dilimi periyodik görüntü olarak kullanılarak tüm birim hücre kaplanır; ek veri dosyaya yazılmaz. PAW augmentation ve ikinci/sonraki spin–manyetizasyon blokları henüz işlenmez.
- **XCrySDen XSF DATAGRID_3D:** XSF alan orijini, gerçek uzaysal grid vektörleri, x-en-hızlı sıralama ve datagrid uç noktaları kullanılır; varsa PRIMVEC/PRIMCOORD atom/hücre bilgileri alınır. Diğer XSF veri blokları uygulanmaz.
- **3B izoyüzeyler:** Marching tetrahedra algoritması, tek saydam 3B yüzey ve seçilebilir izodeğer. Büyük veri performansı için üç eksende adaptif altörnekleme ve maksimum 75.000 üçgen uygulanır. Seyreltme küçük ayrıntıları gizleyebilir; sonuç sayısal analiz değildir.
- **2B kesitler:** X/Y/Z doğrultularında ızgara düzlemi, kesit konumu (%), trilineer örnekleme, mavi–beyaz–kırmızı veya viridis-benzeri renk şeması, isteğe bağlı izodeğer konturu. Kesit gerçek grid vektörleri boyunca geometrik olarak yerleştirilir (eğik/triklinik ızgaralar desteklenir).
- **Potansiyel ile yüzey renklendirme:** Uyumlu uzaysal kapsamı olan **ikinci CUBE/CHGCAR/XSF ızgarası** yüklenirse, yoğunluk izoyüzeylerinin köşeleri ikinci alanın interpolasyon değerleriyle renklendirilir; aynı seçenek 2B kesitte kullanılabilir. Seçilen ikinci dosya gerçekten elektrostatik potansiyel değilse renkler fiziksel potansiyel olarak yorumlanmamalıdır.
- **Kaynak atomları:** CHGCAR ve XSF içinde atom/hücre bilgisi varsa ve **Dosyadaki atomları ve hücreyi kullan** seçilmişse, bunlar kristal çalışma alanına aktarılır. CUBE dosyalarının molekül atomları bu sürümde otomatik olarak mevcut kristalle birleştirilmez; CUBE ızgarası dosyanın kendi Kartezyen koordinatlarında gösterilir.

**Sınırlar:** Tek dosya 24 MB, ızgara 2,5 milyon voksel ile sınırlandırılır. Veriler yoğunluk/potansiyel *hesaplamaz*; dosyada önceden hesaplanmış skaler alanı gösterir. Eş yüzey oluşturma, XSF ve VASP'ın tüm varyantlarını veya büyük verilerde tam çözünürlüğü karşılamaz. CUBE kaynağındaki atom konumları ile başka bir CIF modelinin uzaysal referansı farklı olabilir. Grid uyumu doğrulanmadan iki alan birlikte kullanılmaz.

## Arayüz ve son kristalin geri yüklenmesi

- **Sol Genel** sekmesinin ilk bölümü artık **Görünüm**. Hücre, simetri, bağlar, süperhücre ve örgü dönüşümü aşağıda yer alır.
- **Sağ panelin altında sabit Yapı/Miller sekmeleri** bulunur. Miller (hkl) düzlemleri, kesit kalınlığı ve vakumlu slab üretimi tamamen sağdaki Miller sekmesine taşınmıştır.
- Üstten alta tekrar eden **WebGL durumu**, **tarayıcıda çalışma alt yazısı** ve sahnedeki fare kullanım talimatları kaldırılmıştır. Sol alt yön göstergesi X/Y/Z oklarını korur; tekrarlanan harf açıklaması kaldırılmıştır.
- **Son görüntülenen/düzenlenen kristal** (CIF'den gelen hücre ve atom konumları dahil) `localStorage` içinde `kristalyapi.last-structure.v2` anahtarıyla saklanır. Sayfa yenilendiğinde son yapı otomatik açılır. Kaydedilemeyen/bozuk kayıt uygulamayı kilitlemez; yerleşik Si örneği yedek olarak kullanılır.
- Hacimsel alan dizilerinin kendisi `localStorage`'a yazılmaz (büyük dosya boyutları nedeniyle); yenilemeden sonra hacimsel veri yeniden seçilmelidir. Yalnız kristal modeli/ayarları geri yüklenir.

## Çalışma alanı ve sol panel sekmeleri

Beyaz tema, **3B model görünümünü saf beyaz**, sol düzenleme panelini hafif mavi-gri, sağ yapı/ölçüm panelini daha açık gri, üst menüyü ayrı kırık beyaz yüzey olarak kullanır. Bölümlerin kart sınırları, araç çubuğu ve alt durum çubuğu düşük yoğunluklu çizgi/gölgeyle ayrılır. Bu düzen yalnızca görünüme etki eder; kristal hesaplamalarının sonucu değişmez.

Sol sidebar'ın en altında **her zaman görünür iki sekme** bulunur:

- **Genel**: en üstte görünüm; ardından birim hücre, uzay grubu, bağ kuralları, süperhücre ve örgü dönüşümü.
- **Atomlar**: daha önce sol panelin en sonunda bulunan **Asimetrik konumlar / atomlar** tablosu, kesirli koordinatlar, Wyckoff eşleşmeleri ve atom ekleme/silme işlevleri. Sekme başlığında mevcut yapının bağımsız atom/konum sayısı gösterilir.

Tab çubuğu sol panelin kaydırılabilir kısmının **dışında** tutulur; içerik uzasa da kaybolmaz. Sekmeler ayrı kaydırma konumlarını hatırlar. CIF/POSCAR/XYZ veya yerleşik örnek içe aktarımından sonra Atomlar tablosu ve sayaç, `state.sites` üzerinden yeniden çizilir. Mobilde sol panel kapalı kalır, menü düğmesiyle açıldığında iki sekme de görünür.

## Kütüphane → Örnek Yapılar

**Kütüphane** sayfasında artık üç ayrı sekme var: **COD'da ara**, **Örnek Yapılar** ve **Yer imleri**. Yerleşik örnek kristallerin seçimi ve yeni P1 oluşturma işlemi 3B editörün sol panelinden kaldırılmıştır.

- **Örnek Yapılar** sekmesindeki açılır listede Si (diamond cubic), NaCl, CsCl, elmas, FCC Cu, BaTiO₃ ve grafit bulunur. Seçim yapıldığında yalnızca sağdaki **bilgi önizlemesi** güncellenir; açık 3B yapı değiştirilmez.
- **Seçilen yapıyı içe aktar** düğmesi, editöre döner ve yeni örneğin hücre parametrelerini, atomlarını, uygun uzay grubu numarasını, bağ sınırını ve 1×1×1 birim hücre gösterimini yükler. Önceki yapının görüntüleme kesiti/atom türü kuralı yeni örneğe taşınmaz. Yapı geçerli olduğunda 3B sahne yeniden oluşturulur.
- **Yeni P1 oluştur** aynı sekmede 5 Å kenarlı, tek Si atomlu düzenlenebilir bir başlangıç hücresi oluşturur.
- Örnek kristaller idealize edilmiştir; deneysel ölçüm ya da veri tabanı CIF kaydının yerine geçmez. İşlem, editördeki mevcut yapıyı değiştirir.

## Kaydet / dışa aktar modalı

Üst menüdeki **↓ Kaydet**, yapı dosyası formatı seçilebilen bir modal açar:

- **Proje dosyası (JSON)**: Mevcut yapı ve uygulama ayarları, sonradan tekrar düzenlemek için saklanır.
- **CIF**: Kristalografi dosyası (gerekli olduğunda simetri operatörleriyle).
- **POSCAR**: VASP uyumlu hücre ve atom konumları.
- **XYZ**: Görüntülenen süperhücrenin Kartezyen atom konumları.
- **PNG**: Beyaz zeminli 3B görsel.

Modal `Escape`, **Vazgeç** veya kapat düğmesiyle kapanır. Dışa aktarma ve örnek yapılar artık sol panelde yer kaplamaz. 3B editörün sol paneli hücre, simetri, bağ ve model düzenleme işlevlerine ayrılmıştır. Kod tek `index.html` içindedir; backend gerektirmez.

## COD Kütüphane (yalnızca frontend)

Üst navigasyondaki **Kütüphane** üzerinden COD'da arama yapabilir, yerleşik örnekleri inceleyebilir ve yer imlerindeki yapıları 3B editöre aktarabilirsin.

- **OPTIMADE REST API**: COD kimliği, gerekli/hariç elementler ve element sayısı aralığı gibi OPTIMADE standart filtreleri doğrudan `https://www.crystallography.net/cod/optimade/v1/structures` üzerinden sorgulanır. Gelişmiş (metin, yayın, formül, hacim, Z, Z′ vb.) filtrelerde klasik `result.php?format=json` uç noktası kullanılır. Desteklenmeyen filtreler sessizce yok sayılmaz.
- **İçe aktar**: Önce tarayıcının CIF önbelleği, sonra COD OPTIMADE tekil yapı JSON'u denenir; JSON'daki örgü vektörleri ve atom konumları P1 CIF biçimine dönüştürülerek mevcut doğrulanmış CIF ayrıştırıcısıyla açılır. Gerektiğinde doğrudan `<COD-ID>.cif` istenir. Bu iki çevrimiçi yolun çalışması, COD sunucusunun uygun CORS yanıtı vermesine bağlıdır.
- **CORS bağımsız dosya yolu**: Arama sonucu ve yer imlerindeki **Dosyadan** düğmesiyle CIF indirme bağlantısı ve dosya seçicisi açılır. CIF'i COD'dan indir, dosya seçicisiyle aç; hiçbir CORS izni veya proxy gerekmez. Otomatik içe aktarım başarısız olduğunda aynı bölüm gösterilir. Seçilen COD ID ile dosya adındaki COD ID farklıysa işlem engellenir.
- **Yer imleri**: `localStorage` yalnızca kaynak üstverilerini tutar; JSON olarak dışa aktarılabilir. Başarıyla açılmış CIF/P1 içerikleri, tarayıcı destekliyorsa Cache Storage üzerinde sınırlı sayıda bu cihaza kaydedilir. Tekrar içe aktarmada önbellek önceliklidir. Tarayıcının site verilerini silmek önbelleği de siler.
- **Arama filtreleri**: metin, COD numarası, kimyasal formül, uzay grubu, dergi, yayın yılı, cilt, sayı, DOI, gerekli/hariç elementler ve sayısal aralıklar, ayrıca kayıt bayrakları.

### CORS ve bağlantı yöntemleri

COD resmî uç noktaları: [OPTIMADE](https://www.crystallography.net/cod/optimade/v1/structures), [klasik JSON araması](https://www.crystallography.net/cod/result.php?format=json), tekil CIF için `https://www.crystallography.net/cod/4335507.cif`.

`Otomatik`, `Yalnız kendi Cloudflare Worker API`, `Yalnız OPTIMADE` ve `Yalnız COD klasik` seçenekleri vardır. **`proxy.cors.dev` ve `allorigins.win` kullanılmaz**; harici CORS proxy'leri hata veriyor ve veri aktarımının gizliliğini karmaşıklaştırıyordu. JSON tabanlı REST API olması tarayıcının CORS güvenlik politikasını kendiliğinden aşmaz. Tam otomatik çevrimiçi içe aktarımı sunucu CORS izninden bağımsız ve garantili yapmak için GitHub Pages dışında kendi denetlediğin bir backend/reverse proxy gerekir. Bu proje, ek sunucu gerektirmeyen dosya seçme yolunu da sunar.


### Tam otomatik CORS bağımsız içe aktarma (Cloudflare Worker)

Depoda [Cloudflare Worker ağ geçidi](worker/README.md) için kaynak kod,
Wrangler dağıtım yapılandırması ve güvenlik testleri bulunur. Kütüphane
ekranındaki **Cloudflare Worker bağlantısı** alanına kendi dağıttığın
Worker HTTPS adresini girip **Bağlantıyı test et** ile hem Worker sağlık
kontrolünü hem de gerçek COD CIF indirmesini doğrulayabilirsin.
**Kaydet** sonrasında Otomatik mod tüm sorgularda Worker'ı önce dener,
yer imi içe aktarmada ise **orijinal CIF dosyasını** Worker'dan öncelikle
indirir. Orijinal CIF, uzay grubu ve kristalografik üstverileri korur.
İnternet yokken daha önce önbelleğe alınmış CIF kullanılabilir.

Bu ek servis dağıtılmadığı veya adresi henüz girilmediği takdirde
uygulama doğrudan COD / dosyadan içe aktarma yöntemiyle çalışmaya devam eder.
**GitHub Pages merge işlemi Worker'ı Cloudflare hesabına otomatik dağıtmaz.**
İlk kurulum: Cloudflare hesabında Wrangler ile Worker'ı yayımla, ardından
Workers.dev HTTPS adresini uygulamaya kaydet.
## Özellikler

- Si (diamond cubic), C (elmas), NaCl, CsCl, Cu (FCC), BaTiO₃ (ideal kübik), grafit örnekleri
- Birim hücre parametreleri (**a, b, c, α, β, γ**); triklinik hücre desteği
- Kesirli koordinatlardan Kartezyen koordinatlara dönüşüm, atom ekleme/silme/düzenleme
- 1–6 arasında üç eksende tekrar, dış sınır atomları, hücre çizgileri ve eksenler
- Ball & stick, space filling, stick ve wireframe gösterimi; geometrik bağ eşiği; seçili tür etrafında konveks koordinasyon çokyüzlüleri
- Perspektif/ortografik kamera, animasyon, standart bakışlar, PNG kaydı
- Atom seçimi ile iki atom arası uzaklık ve üç atom açısı
- **İçe aktarma:** CIF (fraksiyonel atom konumları ve dosyada açıkça verilen simetri işlemleri), VASP POSCAR/CONTCAR, basit XYZ ve uygulamanın JSON projesi
- **Dışa aktarma:** CIF, POSCAR, XYZ, proje JSON ve PNG
- Node.js'in yerleşik test çalıştırıcısıyla kristal geometri ve temel dosya ayrıştırma regresyon testleri

## Beyaz tema ve VESTA benzeri görünüm

- Tüm uygulamada **beyaz/açık tema**: başlık, sol/sağ paneller, formlar, tablolar, menüler, ölçüm panelleri ve 3B çalışma alanı.
- Atomlar **elementlerine göre Jmol/CPK-esinli farklı renklerle** gösterilir (118 element için kararlı renkler); beyaz fondaki kontrast için nötr ışıklandırma kullanılır.
- 3B sahnenin sol altında kamerayla birlikte dönen **XYZ yön göstergesi** vardır: X kırmızı, Y yeşil, Z mavi. Bu gösterge Kartezyen eksenlerdir; triklinik yapılarda birim hücrenin a/b/c örgü vektörleriyle karıştırılmamalıdır.
- **Otomatik bağ uzunluğu (elemente göre)** varsayılan açıktır. Bağ uzunluğu, genel eşik ile yaklaşık kovalan yarıçapları toplamının (1,2×) küçüğüyle sınırlandırılır. Özel element-çifti kuralları bu otomatik sınırı geçersiz kılar. Bu yalnızca geometrik bir görselleştirme sezgisidir; VESTA dosyalarındaki kullanıcı tanımlı bağ kurallarını yeniden üretmez.
- Bağ çubukları inceltildi, hücre çizgileri beyaz fonda okunacak gri tona getirildi ve PNG dışa aktarımı beyaz zeminle yapılıyor.
- Orijinal 3B sahnedeki renkli kristal ekseni çizgileri varsayılan olarak kapalıdır; **Görünüm → Kristal eksenlerini yapı içinde göster** ile tekrar açılabilir. Sol alt XYZ göstergesi sabit görünür.

## Kristalografik temel (Aşama 1)

- **230 uzay grubu, 274 referans/alternatif setting**, HTML içine gömülü simetri operatörleri ve Wyckoff referans konumları.
- Belirlenen uzay grubunun **asimetrik atom konumlarını tam birim hücreye** genişletme; eşdeğer atomları koordinat toleransıyla tekilleştirme.
- Simetri modu açıkken, en çok 60 bağımsız konum için site çokluğu ve Wyckoff sınıfı **atom koordinatlarından otomatik olarak** eşleştirilir (affine pozisyon kısıtları ve simetri eşdeğerleri). Wyckoff konumlarını otomatik *oluşturma* ve koordinatları simetrik ideal konuma zorlama özelliği yoktur.
- Hücre metriğiyle uyumsuz simetri operatörlerinin uygulanmasını engelleyen doğrulama.
- Tür bazlı bağ kuralları; görünür hücre sınırını geçen periyodik bağların çizimi (100 veya daha az temel atom için tam yöntem, büyük yapılarda mevcut uzaysal eşik yöntemi).
- Mesafe ölçümünde doğrudan uzaklığın yanında **minimum periyodik görüntü uzaklığı** (komşu 27 görüntünün taranması).
- CIF içe aktarımı: Dosyada verilen simetri operatörlerini uygular; operatör yoksa tanınan uzay grubu ve referans ayarıyla genişletir, setting/orijin varsayımını uyarıyla bildirir.
- CIF dışa aktarımı: Asimetrik konumlara simetri uygulanıyorsa seçilen grup ve operatörler korunur; önceden genişletilmiş (P1) atomlar P1 olarak yazılır.

## Miller düzlemleri ve dönüşümler (Aşama 2)

- Tam örgü metriğinden **Miller (hkl) düzlemi** ve **d(hkl)** düzlemler arası uzaklık hesaplaması (kübik ile sınırlı değildir).
- Gerçek 3B örgü üzerinde birim/süperhücreyle kesişen saydam düzlem poligonu.
- Seçili düzlem etrafında Å cinsinden kalınlıkla **görsel atom-merkezi kesiti** (slab filtreleme), ayrıca **vakumlu slab hücresi oluşturma**: (hkl) yüzeyinin iki primitive 2B örgü vektörü, yüzeye dik üçüncü hücre ekseni, belirtilen Å kalınlığı ve vakum boşluğu. Oluşturulan P1 slab CIF/POSCAR olarak dışa aktarılabilir. Yüzey relaksasyonu, yeniden yapılanma, pasivasyon, dipol düzeltmesi ve DFT çalıştırma bu uygulamanın kapsamı dışındadır.
- Pozitif determinantlı özel **3×3 örgü dönüşümü**, atomların koordinatlarına uygun baz değişikliği ve dönüştürülen hücrede atomların yeniden bulunması.
- FCC/BCC conventional → primitive, FCC primitive → conventional, eksen değişimi ve bir yönde çoğaltma örnek dönüşüm matrisleri.
- Dönüştürülmüş hücre P1 olarak atanır; özgün simetri grubu otomatik olarak tekrar çözümlenmez.
- Dar ekranda üst araç çubuğunun başlığa taşması engellendi; gereksiz alt başlık kaldırılarak 3B çalışma alanı büyütüldü.

## Bilimsel kapsam ve sınırlar

- **VESTA'nın bütün özellikleri henüz yoktur:** Hacimsel veri okuyucuları ve izoyüzeyler eklenmiştir; manyetik yapı, çok fazlı görselleştirme, termal elipsoitler, tam hacimsel veri varyantları ve otomatik uzay grubu belirleme eksiktir.
- CIF'de simetri operasyonları verilmemişse, tanınan uzay grubunun referans ayarı/orijini varsayılır. Alternatif orijin ve eksen ayarlarında fiziksel doğruluğu bağımsız olarak kontrol etmek gerekir.
- CIF okuyucu yaygın CIF 1.x metinsel altkümesini hedefler; tüm CIF/mCIF standartlarını uygulamaz. mCIF manyetik verileri dikkate alınmaz.
- CIF içe aktarımı atomları görünür P1 konumlarına genişletir. **Simetri modu açık ise** dışa aktarma seçilen uzay grubunu açık operatörlerle korur; simetri modu kapalı ise P1 yazılır. Her iki durumda da kaynak dosyanın bütün kristalografik meta verileri korunmaz.
- XYZ periyodik kafes bilgisi taşımaz; program atomları suni bir dik kutuya yerleştirir.
- Bağlar, kullanıcı eşiğiyle element yarıçapına dayalı otomatik sınırlama (ve varsa özel çift kuralları) kullanılarak çizilir. Kimyasal bağların varlığı, bağ mertebesi veya koordinasyon kimyası doğrulanmaz.
- Mesafe/açı ölçümü seçilen görüntüler arasında yapılır; buna ek olarak iki atom için 27 komşu görüntü taranarak periyodik minimum mesafe sunulur. Açı için minimum-görüntüye dayalı yeniden seçim yapılmaz.
- Sahne koruması için görüntülenen atom sayısı 1800, bağ sayısı 6500 ile sınırlıdır. 100'den fazla temel atom içeren yapılarda periyodik bağların dış sınırda tam çizilmesi yerine yalnızca uzaysal eşik yaklaşımı kullanılır.
- Editör ağırlıklı olarak yapısal görselleştirmeye odaklanır; deneysel parametreler ve kristalografik sonuçlar bilimsel kaynaklarla ayrıca doğrulanmalıdır.

## Geliştirici testi

```sh
node --test tests/core.test.cjs
```

Veriler: https://github.com/anoopkcn/wyckoff (MIT; Anoop K. Chandran) ile https://github.com/spglib/spglib (BSD-3-Clause; Spglib team) kaynaklarından türetilen referans tabloları HTML içinde taşınır; telif/lisans bildirimleri de HTML içinde yer alır.

Vakumlu slab üreticisi, atom merkezlerini kesen ideal geometrik yüzey üretir. Fiziksel yüzey kararlılığı / kutupluluk değerlendirmesi yapmaz; DFT hesabı öncesinde doğrulanmalıdır.

Uygulamanın kaynak dosyası tek başına `index.html` dosyasıdır. Testler ve GitHub Actions yalnızca geliştirme/deploy içindir.
