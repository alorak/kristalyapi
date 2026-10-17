# Kristal Yapı — VESTA farkları ve geliştirme sırası

## Paket 10.8.4 — Bağımsız izoyüzey algoritması ve parçalanma değerlendirmesi

- **Bağımsız referans:** scikit-image 0.25.2 Lewiner marching-cubes ile üretimdeki marching-tetrahedra **aynı Float32 yoğunluk ve aynı Å koordinat sisteminde** ölçülür; ikisi de nihai mutlak fiziksel yüzey değildir.
- **Kapsam:** Gerçek Gemmi 5i55 kısmi CCP4 ve 5wkd C2 MTZ'nin FWT/DELFWT yoğunlukları; her biri iki seyrek işaretli eşik × 32³/48³/64³.
- **Rapor:** Aynı çözünürlükte algoritmalar arası alan ve örneklenmiş tepe mesafesi; iki algoritmada ayrı ayrı 48³→64³ alan değişimi; ağ bileşenleri ve voksel yoğunluk bileşenleri.
- **Kalite kapısı:** Geçersiz/boş/kesilmiş bilimsel ağ ve yanlış Kartezyen sistem başarısız olur. Büyük yöntem farkları **uyarı olarak** kaydedilir: CI geçmesi yakınsama anlamına gelmez.
- **Yüksek doğruluk modu:** Üretim ayarı henüz açılmadı; performans, sayısal doğruluk ve bellek doğrulaması tamamlandıktan sonra ayrı A/B önerisi.
- **Açık:** Bağımsız deneysel CUBE/XSF/CHGCAR, VESTA ile bire bir skaler eşiğe göre karşılaştırma, daha güçlü nokta-üçgen yüzey uzaklıkları ve farklı gerçek donanımlar.

## Paket 10.8.3 — Tam 32³/48³/64³ ağ ve gerçek harita topolojisi

- CI, P10.8.1/2 doğrulamalarına ilaveten gerçek 5i55 ve Gemmi 5wkd FWT/DELFWT yoğunluklarında 32³/48³/64³ tam-ızgara karşılaştırması yapar.
- Yayındaki 40 aralık/eksen sınırı ile bilimsel *test referansı* 64 aralık/eksen ayrı ölçülür. 75.000 üçgen sınırı iki yolda da korunur.
- Gerçek haritalarda alan/hacim, stride, üçgen, iç açık kenar ve manifold dışı kenar raporlanır; açık kısmi-harita dış sınırları geçerli sayılır. Eğik hücreli periyodik sentetik küre sınır eşleşmesi zorunlu olarak denetlenir.
- Tekrar örnekleme farkları, kanıtlanmış uzaysal yakınsama veya Hausdorff hatası gibi sunulmaz. Bağımsız deneysel CHGCAR/CUBE/XSF ve üçüncü taraf yüzey çıkarıcı karşılaştırması ayrı takip edilir.

## Paket 10.8.1–10.8.2 — Gerçek haritalarda izoyüzey ve yakınsama doğrulaması

- **Zorunlu CI:** Üretimdeki Worker marching-tetrahedra ile 16³/24³/32³ analitik küre. Yarıçap, yüzey alanı ve kapalı hacmin bağımsız referansına göre açıklanmış eşikler başarısızsa CI kırılır.
- **Gerçek kaynak:** Gemmi 5i55 kısmi monoklinik CCP4; Gemmi 5wkd deneysel C2 FWT ve DELFWT Fourier haritaları. 16³/24³/32³ örneklemelerde fiziksel alan, üçgen, kaynak-skaler artık P95 ve eşik üstü hacim farkları raporlanır.
- **Biçim kontrolü:** Gerçek CCP4 verisini CUBE ve XSF biçimine yeniden kodlayıp okuma. Bağımsız deneysel CUBE/XSF veya CHGCAR fixture bulunmuş gibi yorumlanmaz.
- **Bilimsel sınır:** Gerçek haritalar için kesin analitik şekil bilinmez; kaynak-voksel artık/örnek değişimi global Hausdorff sınırı değildir. Kısmi/açık yüzey için mesh iç hacmi kullanılmaz. Üçgen sınırında kesilme ya da geçersiz değer CI başarısızlığıdır. Nihai bilimsel ağ değişmez.
- **Sonraki 10.8.3:** gerçek haritalarda manifold/kenar yönlülüğü ve periyodik sınır geçişi testi; bağımsız CHGCAR/CUBE/XSF korpusu ve çoklu donanım raporları.



## Paket 10.7 — Bölgesel octree, topoloji ve aygıt benchmarkları (bu PR)

| Alan | Uygulama / doğrulama | Sınır |
| --- | --- | --- |
| Gerçek yerel uyarlama | 3B octree bölgesel bölünmesi, komşu yapraklarda derinlik farkı ≤1 (2:1), düzlem boyu eksen yayılması yok | 4.500 yaprak ve 75.000 üçgen/izoyüzey bütçesi; sadece büyük hacimlerin geçici önizlemesi |
| Çatlaksız geçiş | Komşu kaba/ince yüzlerin ortak dikdörtgen yaması; her yamanın ortak yüz merkezi, dik komşu hücre yüzlerine de yayılan tüm ayrıt kırılım noktaları ve tutarlı üçgen yönü | Kendi içine kıvrılan veya sınırda biten fiziksel yüzeyleri kapalı saymaz; bütçe kesilmiş yüzeylerin watertight garantisi yok |
| Sayısal doğrulama | 64³ analitik işaretli uzaklık küresinde her ayrıt [1,1] ters yönlü üçgenle kapanıyor; en büyük köşe radyal sapması 0,021 Å (kaba düzenli örnekte 0,123 Å); eğik/periyodik/potansiyel renk testi | Küre konum sayısı yalnızca test verisinin analitik referansına göredir; başka veri için global Hausdorff üst sınırı değildir |
| Fallback ve güvenlik | Maksimum yaprak/üçgen veya %0,5 örnek merkez+yüz skaler artığı tutmazsa önceki eksen/tam düzenli Worker önizlemesine geri dönüş; final sabit marching-tetrahedra birebir | Örnekleme görünmeyen ince detayları kaçırabilir; bilimsel final/export etkilenmez |
| Cihaz benchmark raporu | İsteğe bağlı JSON: tarayıcı/OS, WebGL sürüm/GPU bilgisi, CPU çekirdek, doku limiti, sahne tahmini yükü, çekim/kare/poly draw-group ölçümleri; gerçek Chromium/WebGL smoke | Tek CI GPU/OS üzerinde doğrulandı; cihazlar arası gerçek performans matrisi bu PR'da toplanmadı; tahmini GPU aktarım yükü gerçek VRAM değildir |

**Sonraki 10.8:** Harici gerçek CCP4/MRC ve potansiyel harita korpusu üzerinde global yüzey örnek/mesafe yakınsaması; birden çok gerçek GPU/OS'ten tekrar edilebilir benchmark JSON'larının karşılaştırılması ve cihaz başına instancing eşiklerinin ancak ölçümle seçilmesi.

## Paket 10.6 — Uyumluluklu adaptif önizleme ve çokyüzlü GPU A/B (tamamlandı)

| Alan | Yapılan iş ve doğrulama | Bilimsel sınır |
| --- | --- | --- |
| Adaptif 3B izoyüzey önizlemesi | Worker'da eşik yakınındaki örnek merkezlerinin trilineer skaler artıklarına göre her eksende seçilen düzensiz ortak koordinat düzlemleri (≤32 nokta/eksen); komşu hücreler aynı yüzey ayrıtlarına sahip, T-bağlantısı oluşmaz | Tam yerel 2:1 octree değil: bir bölgedeki rafinasyon bütün kesit düzlemini uzatır; **yalnızca geçici önizleme** değişti |
| Hata kontrolü | Üç turla sınırlı düzlem seçimi; son hücrelerde maksimum **örneklenmiş merkez skaler artığı** raporu ve tolerans geçişi; karşılanmazsa 10.4'ün düzenli kaba önizlemesine güvenli dönüş | Bu sayı tüm hacim için matematiksel hata üst sınırı/izoyüzey Hausdorff mesafesi değildir; truncated yüzeyde watertight garantisi verilmez |
| Topoloji ve eşleme | İzoyüzey tümüyle içte kalan işaretli kürede her ayrıt tam iki üçgene bağlı; aynı eksen düğümlerinde periyodik/eğik ve potansiyelle renklendirilmiş konumlar sabit algoritmayla birebir eşleşir; final Worker algoritması aynıdır | Harita sınırını kesen yüzeylerin açık kenarları fizikseldir; genel manifold garantisi fiziksel dosya korpusu ile ayrıca ele alınacak |
| Çokyüzlü GPU A/B | Performans panelinde **birleşik mesh (varsayılan)** / **deneysel GPU instancing**; asimetrik merkez+opaklık grupları, yerel gövde şablonları, 4×4 matris ve instance rengi; kenarlar eskisi gibi tek çizim grubu | Instancing otomatik seçilmez; birleştirilmiş ağ zaten tek dolgu çizim çağrısıdır, cihaz bazlı hız üstünlüğü garanti edilmez |
| Sayısal/gerçek tarayıcı testleri | BaTiO₃ 125 TiO₆ üzerinde her iki yol için çokyüzlü sayısı, alan/hacim, CPU geometri belleği, WebGL çizim grubu ve CPU süresi A/B; büyük 64³ hacim önizlemesi ve tüm önceki bağımsız Gemmi/MTZ/CCP4 testleri | CPU arabellek tahmini sürücü VRAM ölçümü değildir; GPU timer sorguları donanım/driver destekli ise ayrı geçerlidir |

**Sonraki 10.7:** gerçekten bölgesel (tensor düzlemi gerektirmeyen) 2:1 octree geçiş ağları, watertight/kesişim ve en büyük fiziksel kontur sapması denetimleri; farklı GPU/OS/tarayıcılarda A/B benchmark matrisi ve belgelenmiş VRAM tahmini/araç karşılaştırması. Doğrulanmış nihai marching-tetrahedra/CSV verileri değiştirilmeyecek.

## Paket 10.5 — Etkileşimli 2B Worker, iptal doğruluğu ve bellek görünürlüğü (tamamlandı)

| Alan | Uygulama / doğrulama | Sınır |
| --- | --- | --- |
| Etkileşimli 2B kesit | ≥75.000 vokselde 192² renk+kontur, 128² çizgi profili örnekleri ve 32² bağımsız kesit özeti tek çevrimdışı Worker isteğinde; eski istek iptali, sıra numarası, 12 s zaman aşımı, güvenli eşzamanlı yedek | Küçük haritalar eşzamanlı kalır; 3B düzleme uygulanan 192px CanvasTexture hâlâ ana thread'de hazırlanır |
| Sayısal sözleşme | Eğik Kartezyen koordinatlar, gerçek Miller çerçevesi/delikleri, işaretli konturlar, fiziksel Å mesafesi ve CSV sayısal anlamı korunur; 192/128/32 natif eşleme ve gerçek Chromium sürükleme testi | 128² profil ara değerleri öncekiyle aynı sayısal örnekleme yaklaşımıdır; doğrudan eğri boyunca 3B yeniden örnekleme değildir |
| Bellek raporu | Paylaşılan BufferGeometry/InstancedMesh backing ArrayBuffer'ları bir kez sayılır; RGBA8 taban görüntü boyutu tahmini, ham voksel dizileri ve 32 MiB yüzey önbelleği ayrı gösterilir; WebGL gerçek fixture testleri | **Ölçülen VRAM değil**; driver belleği, mipmap, GPU hizalaması, WebGL tutulan kopyalar ve sıkıştırma bilinmiyor |
| Adaptif yüzey ve çokyüzlü GPU | 10.4'teki doğrulanmış nihai marching-tetrahedra ve tek birleşik çokyüzlü dolgu draw-call yolu değiştirilmez | Yerel, çatlak oluşturmayan adaptif ağ, hata kontrolü ve instancing A/B cihaz karşılaştırmaları sonraki paket; merged 1 draw call'a karşı naif instancing kazanç garanti etmez |

**Sonraki 10.6:** bağımsız triangülasyon/topoloji ve izodeğer hata sınırı testleriyle çatlak üretmeyen yerel adaptif ağın kontrollü prototipi; çokyüzlü çizim A/B ve cihaz/VRAM benchmark matrisi. Bilimsel dışa aktarım, harita değerleri ve görünür sınırlar sonuçlar doğrulanana kadar değiştirilmeyecek.

## Paket 10.4 — Çokyüzlü şablon önbelleği, 2B kontur/CSV Worker ve görsel önizleme seçimi (tamamlandı)

| Alan | Uygulama / kabul | Açık sınır |
| --- | --- | --- |
| Çokyüzlü CPU üretimi | Her eşsiz asimetrik merkez için tek yerel ConvexGeometry + EdgesGeometry; kopyalarda yalnız öteleme ve renk; BaTiO₃ 125 oktahedronda 1 şablon + 124 yeniden kullanım, bağımsız hacim/alan testi | Tam BufferGeometry birleştirme hâlâ CPU'da; dinamik GPU instancing sonraki iş |
| PNG kontur Worker | 768² pikselde marching-squares işaretli/eşik modları, eyer noktası ve geçersiz Miller delikleri Worker'da; sayısal parite testleri | 192px etkileşimli kontur önizlemesi ana iş parçacığında |
| CSV Worker | 64×64 kesit sayılarını, Kartezyen Å koordinatlarını ve özet istatistikleri bağımsız Worker'da üretip transfer; iptal ve fallback | 128px çizgi profili ve 32px küçük panel kesiti ana iş parçacığında |
| Kaba izoyüzey | 6³ üst sınırlı eşik-kesişim yoklamasıyla iki küresel önizleme stride'ından biri seçilir; tam nihai geometri algoritması değişmez | Uzaysal adaptif, watertight ve hata kontrollü ağ henüz uygulanmadı; önizleme bilimsel harita değildir |

**Sonraki 10.5:** gerçek yerel adaptif izoyüzey için topolojik geçiş/hata tahmini, geniş örnek dosya kümesi; çokyüzlü GPU instancing; etkileşimli 2B kesit ve çizgi profili Worker desteği; cihaz bazlı gerçek VRAM/bellek ölçümü.

## Paket 10.3 — Kademeli hacim, çokyüzlü görünüm LOD'u ve GPU profil (bu PR)

| Alan | Uygulama / kabul | Açık sınır |
| --- | --- | --- |
| İki aşamalı izoyüzey | ≥200k vokselde Worker önce daha seyrek örneklenmiş bir önizleme gönderir, sonra 10.2 ile bire bir aynı tam yüzeyi üretir; önizleme kaynakları iptal/sıfırlamada temizlenir, önbelleğe yalnız tam sonuç kaydedilir | Yerel hata tahminli adaptif marching-tetrahedra / çok kademeli sürekli LOD henüz yok |
| Çokyüzlü görünüm LOD'u | Merkez sayısı, yaklaşık ekrandaki boyut ve yüksek/otomatik/hızlı moduna göre dekoratif kenar çizgilerini azaltır; dolgular, alan/hacim, koordinasyon, sayısal hesaplar ve dışa aktarım korunur | Çokyüzlü birleşim ve ConvexGeometry CPU maliyeti mevcut; uzak LOD yalnız çizim çağrısını azaltır |
| 2B kesit PNG Worker | 768 px Kartezyen veya Miller dilim piksel örnekleme ve renk eşlemesi, kopya veri ve transfer sonucu ile offline Worker'da; eşzamanlı güvenli geri dönüş ve eski çıktı iptali | 192px önizleme, kontur izlemesi, CSV ve nicel analiz hâlâ ana iş parçacığında |
| GPU ve bellek profili | WebGL2 `EXT_disjoint_timer_query_webgl2` varsa asenkron GPU render süresi ve disjoint kontrolü; Worker önizleme ve PNG süreleri/rapor, gerçek WebGL ve sayısal eşleme testleri | Destek yoksa GPU süresi bilinmiyor; sabit FPS/milisaniye başarı eşiği veya tam VRAM ölçümü yok |

**Sonraki 10.4:** tamamı Worker'da 2B kontur/CSV örnekleme, maliyetli çokyüzlü ConvexGeometry/merging CPU optimizasyonu, adaptif izoyüzey ve daha kapsamlı cihaz/GPU matrisi.

## Paket 10.2 — Hacimsel Worker, iptal/önbellek ve CPU darboğazları (bu PR)

| Alan | Uygulama / kabul | Açık sınır |
| --- | --- | --- |
| İzoyüzey Worker | ≥75k vokselde aynı kökenli yerel Worker; Float32Array kopyalarını transfer, sonuç konum/renk buffer'larını sıfır kopya aktarım; ana thread fallback | 2B kesit, yoğunluk integrali ve volume export Worker'a taşınmadı |
| Görev iptali | Her yeni çizimde önceki Worker terminate edilir; artan istek sürümü ile geç cevaplar atılır; veri sıfırlanınca iptal | Birden fazla paralel Worker kullanılmaz |
| Önbellek | Grid kimliği, eşik, potansiyel, palet ve üçgen bütçesi anahtarlı 32 MiB LRU; stile/opacity değişiminde tekrar hesaplamayı azaltır | Kullanıcı cihazı RAM'i ve 20k atom / 2,5M voksel sınırları devam |
| Profil ve doğruluk | Atom/bağ/çokyüzlü CPU fazları, Worker/main süreleri, cache hit/cancel; signed/renkli/periodik Worker--ana thread tam koordinat eşlemesi; gerçek Gemmi CCP4; büyük gerçek Chromium/WebGL; offline Worker | Sabit FPS/ms başarım eşiği yok; GPU süresi olarak yorumlanamaz |

**Sonraki 10.3:** çokyüzlü seviyelendirme/birleştirme maliyeti, hacim kesitlerinin Worker'a taşınması, aşamalı çözünürlük, çok büyük örneklerde bellek profili, destekli GPU timer query benchmarkları ve yayın kalitesi görsel çıktı.

## Paket 10.1 — Büyük süperhücre benchmarkları ve atom LOD'u (bu PR)

| Alan | Uygulanan kabul kriteri | Sınır |
| --- | --- | --- |
| Atom gösterim LOD | 24×16 / 12×8 / 8×6 küre tessellasyonu; ekran piksel yarıçapı ve atom sayısına göre otomatik geçiş; yüksek kalite/hız seçenekleri | Koordinatlar, bağlar, sayısal analizler, çokyüzlüler ve seçimler LOD'dan etkilenmez; henüz örgü hücresi/çokyüzlü LOD'u yok |
| Yayın PNG kalitesi | 1×–4× PNG'de geçici yüksek ayrıntı; işlem sonunda eski geometriyi geri yükleme | GPU/driver sınırlarını aşan yüksek çözünürlüklerde mevcut güvenli ret korunur |
| Ölçüm paneli | CPU sahne/iso oluşturma ms; atom/bağ/çokyüzlü ve hacim üçgen sayıları; Three.js WebGL çizim çağrısı/üçgen/geometri; ortanca/p95 kare aralığı; JSON raporu | Kare aralığı GPU zamanı değildir. Donanım ve tarayıcı farkları nedeniyle sabit ms/FPS başarı eşiği yok |
| Stres regresyonu | Chromium gerçek WebGL 60 / 1.620 / 12.960 atom, LOD değişimi ve PNG kalitesi; 9.3 Gemmi gerçek CCP4 ile yüzey üçgen ve stride raporu | 20.000 atom / 65.000 bağ / 2.400 çokyüzlü / 2,5M voksel sınırları devam eder |

**Sonraki 10.2:** bağ ve çokyüzlü hesaplama profili, hacim üretiminin Worker'a alınması/iptal ve önbellekleme, geniş çözünürlüklü yoğunluklarda hatasız bütçe uygulama; GPU timer query destekli cihaz matrisi; yayın kalitesinde daha geniş dışa aktarım.

## Paket 9.3 — VESTA 3.x proje alt kümesinin içe aktarımı (bu PR)

| Kapsam | Uygulama / bilimsel kabul | Bilinen sınır |
| --- | --- | --- |
| Hücre ve atomlar | Sürüm/terminatör doğrulaması, monoklinik dahil `CELLP`, `STRUC` kesirsel konum/doluluk, uyumlu standart `GROUP`; 1.000 atom sınırı | Özel `SYMOP`/setting ve köken dönüşümleri aktarılmaz, şeffaf uyarı |
| Görünüm | `BOUND` (-1…2), `SITET/ATOMT` RGB, `SBOND` mesafe kuralları, `BONDS/LABEL` | Kamera, ışıklar, vektör, ADP, çokyüzlü/atom yarıçapı ve doku kaplama stilleri henüz yok |
| Harita projesi | Referanslanan yerel CUBE/XSF/CHGCAR/CCP4-MRC kullanıcı tarafından `.vesta` ile birlikte seçilirse `ISURF` ± eşik/renkleri uygulanır | Harita `.vesta` içinde bulunmaz; dış yollara erişim yok, ± dört katman, opaklık varsayılan |
| Test | VESTA 3.3 örnek veri sözdizimi çapraz incelemesi; VESTA 3.5 dosya fixture'ı ve gerçek Gemmi 5i55 CCP4 ile native/Chromium | Gerçek VESTA GUI görüntüsüyle piksel eşlemesi ve tam dosya biçimi genellemesi yok |

**Sonraki çalışmalar:** VESTA sürüm/dataset çeşitliliği için daha geniş bağımsız kaynak kümesi, proje-dışı kamera/ADP/poligon görünüm eşlemesi; **Paket 10:** büyük veri LOD/benchmark, render kalitesi.

## Paket 9.2 — İşaretli izoyüzeyler ve 2B kontur stilleri (tamamlandı)

| Öncelik | Yapılan iş | Test ve bilimsel sınır |
| --- | --- | --- |
| P0 | İki işaretli alan için eşit büyüklükte +|ρ|/−|ρ| izoyüzey çifti; eşik ve renkler bağımsız düzenlenir | Gerçek 5i55 CCP4 ve sentetik Fo−Fc üzerinde işaret, sonlu eşik, değer korunumu |
| P1 | 3B smooth, flat-shaded, wireframe ve hybrid yüzeyler | Aynı örnekleme/geometri kullanılır; performans/üçgen limiti değişmez |
| P1 | 2B uniform, ± simetrik, pozitif/negatif kontur seviyeleri; işaretli düz/kesikli ve tek renk çizim | Marching-squares sentetik sayısal testleri; boş işaret için güvenli davranış |
| P1 | 768×768 PNG (192×192 önizlemeden bağımsız yeniden örnekleme) | WebGL gerçek dosya yükleme, görüntü ve PNG başlık testi; vektör çizim değil |

**9.3 uygulandı:** sınırlı VESTA 3.x yapı ve eşlik eden harita/ISURF içe aktarımı. **Paket 10:** çok büyük ızgaralar için LOD/benchmark ve ileri çıktı optimizasyonları.

## Paket 9.1 — CCP4/MRC skaler harita içe aktarımı (tamamlandı)

| Kapsam | Uygulama / kabul | Sınır |
| --- | --- | --- |
| MAP/CCP4/MRC ikili okuyucu | MODE 0/1/2/6; little-/big-endian, NSYMBT, MAPC/MAPR/MAPS, signed START, birim hücre geometri ve Å konumu | MODE 3/4/12, skew ve 1B/2B reddedilir; 24 MB/2,5M voksel sınırı |
| Kısmi haritalar ve fiziksel anlam | START ile doğru uzay kesiti; tam hücre periyodik, kısmi kesit periyodik değil; kaynak niceliği varsayılan bilinmiyor | Otomatik simetriyle genişletme, birim ve sağ-/sol-el yorumu yok |
| Bağımsız referans | Gerçek Gemmi 5i55 monoklinik permütasyonlu harita; 5wkd gerçek MTZ → Gemmi FFT → CCP4 yaz → bağımsız voksel/orijin doğrulaması | Genel CCP4/EM üretici corpus'u, tarayıcıda büyük harita performansı sonra |
| Kullanıcı akışı | Üç dosya yükleme yolu ve iki dilde uyarılar | MRC2014 extended-header metadatası veya VESTA proje içe aktarımı yok |

**9.2 tamamlandı:** işaretli ± izoyüzey, 3B yüzey stili, işaretli kontur ve 768 px PNG; **9.3 uygulandı:** sınırlı .vesta proje/harita/ISURF içe aktarımı. Paket 10: GPU/CPU LOD/benchmark.

## Paket 8.1 — CIF veri bütünlüğü ve ileri ADP doğrulaması (#61 merge)

| Öncelik | Kapsam | Bilimsel kabul / kalan açık |
| --- | --- | --- |
| P0 | Düzenlenmiş CIF'de güvenli `_publ_author_*`, `_citation_*`, `_journal_*` alanlarını ve `loop_` değerlerini taşı; eski COD depo kimliği, rafinman ve geometri etiketlerini yeniden atama | Tam CIF2 / bütün bilinmeyen alanları kayıpsız taşıma hedefi yok; kullanıcıya orijinal kaynağı saklama uyarısı |
| P0 | Özel konum stabilizer ADP koşulunu Kartezyen `R U Rᵀ` üzerinden doğrula; açık uyuşmazlıkta fail-closed davran | Yalnız supported CIF/mCIF simetri altkümesi; tüm Hall/orijin/deneysel belirsizlik analizi yok |
| P0 | Sabitlenmiş gerçek CIF kaynaklarından 28 geçerli dosya için korunma/yeniden-içe-aktarma, analitik ayna/dörtlü simetri ve Gemmi 0.7.4 ile bağımsız yeniden ayrıştırma testleri | Önceki 40 dosyalık Gemmi referans kapısı da çalışır; iki bilinen `inconclusive` kaynak olumlu sayılmaz |
| P1 | Alan bazında metadata kayıp raporu, çoklu `data_` ve CIF2 sözdizimi | Sonraki paket |
| P1 | Deneysel Fo/Fc, yansıma ölçekleme ve MTZ veri akışı | Paket 8.2 |

Bilimsel kontrat ve test örnekleri:
[`tests/validation/PACKAGE_8_1_STATUS.md`](tests/validation/PACKAGE_8_1_STATUS.md).

## Paket 8.2 — FCF/Fourier bilimsel güvenilirlik (bu PR)

| Öncelik | Uygulanan / yapılacak | Bilimsel doğrulama |
| --- | --- | --- |
| P0 | FCF `F²` ölçümünü izlenebilir Fo genliğine dönüştür; negatif `F²` say, hatalı hesaplanan `F²` reddet | Negatif/eksik FCF ölçüm-fixture testleri |
| P0 | FCF içindeki hücreyi aktif kristalle karşılaştır; FCF yüklemesinden sonra yapısal değişimi algıla | Yanlış hücre ve değişmiş kristal fail-closed |
| P0 | `hkl`/Friedel eşleniği faz ve amplitüd uyumunu kontrol et; tekrarları sessizce seçme | Modulo-360 ve zıt faz referansları, çelişki testleri |
| P0 | Ham `Fo−Fc` ve seçilebilir LSQ Fc ölçekli fark haritaları, d_min/Nyquist ve P1 grid kapsamı | Analitik tek-çift Fourier ve ölçek testleri |
| P1 | **8.2b başlangıcı:** Birleşik P1 MTZ için endian/başlık/NCOL/COL/DCELL/VALM doğrulamalı FP/FC/PHIC okuma ve model-fazlı Fo/Fo−Fc; non-P1 ve belirsiz sütunlar fail-closed | Sentetik LE/BE, eksik değer, yanlış hücre/simetri testleri; **gerçek Gemmi/CCP4 fixture ve bağımsız harita referansı hâlâ gerekli** |
| P1 | **8.2c ilk aşama:** P1 / P-1 / P21 / P21/c / P212121 MTZ simetri kapanışı, hkl/faz translasyonu; `datasetId:LABEL` eşlemesi; ham/LSQ `2Fo−Fc` | Analitik dönüşüm/Friedel/sistematik sönüm testleri; gerçek Gemmi/CCP4 karşılaştırması açık |
| P1 | **8.2d gerçek referans + kalite süzgeçleri:** Gemmi 5e5z (P21) / 5wkd (C2), gerçek COLUMN ve FWT/DELFWT, Gemmi 0.7.5 FFT voxelleri, Fo/σ ve açık FREE filtreleri; FOM deneysel çarpanı | 367 gerçek 5wkd yansıması ve iki bağımsız harita gridi CI kapısında; σA hesaplaması ve çözünürlük kabukları sonraki iş |
| P1 | Tam σA/m/D refinman ağırlığı, çözünürlük kabukları ve CCP4/MRC map | Bu sürümde FWT/DELFWT hazır ağırlıkları kullanılır; tam refinman algoritması ayrı kapsam |

**Kapsam belgesi:** [`tests/validation/PACKAGE_8_2_STATUS.md`](tests/validation/PACKAGE_8_2_STATUS.md).

### Paket 8.1 kalan işler

CIF2 ve çoklu bloklar, desteklenmeyen metadata'nın alan bazında
kayıp raporu, deneysel `Uij` belirsizlikleri, Hall/orijin ayarlarının
kapsamlı doğrulanması. Paket 8.2 bunları tamamlamış saymaz.

## Görselleştirme, workspace ve mimari paketi · Ekim 2026

| Başlık | Uygulanan ilk kapsam | Kalan doğrulama / geliştirme |
| --- | --- | --- |
| Aç / kaydet ve kütüphane | Favoriler (COD yer imi + örnek yapı), hazır yapılar ve yerel dosyaları birleştiren Aç modalı; simgeli kompakt üst butonlar, Kütüphane içinde etkin workspace göstergesi | Çoklu dosyayı aynı anda açma, yeniden adlandırılmış favori koleksiyonları, tam klavye/ekran okuyucu denetimi |
| Dil ve panel başlıkları | TR/EN için statik Türkçe başlık kaynakları; düğmelerin hover görünürlüğü, UI çevirileri | Dinamik bilimsel hata mesajlarının tam çift dilliliği |
| Çizim ölçeği | Atomlar element bazlı, bağlar toplu `InstancedMesh`; atom sınırı 20.000, bağ sınırı 65.000; 5.000+ atomda basit küre | Farklı cihazlarda FPS/GPU bellek ölçümü, instanced ADP/etiketler, daha büyük yapı için LOD ve WebGPU |
| Çokyüzlü ve site stilleri | Koordinasyonla seçilen otomatik merkez türü; fiziksel site komşu önbelleği; tek yüzey mesh'i (RGB+alpha), tek kenar geometrisi ve 2400 merkez üst sınırında açık uyarı; site bazında renk/opaklık | Çok büyük sahnelerde FPS ve GPU bellek profili; per-facet stiller, gelişmiş çokyüzlü LOD |
| Sınırlar ve çıktı | x/y/z için −1…2 kesirli pencere; 1×–4× beyaz/şeffaf PNG (24 MP / WebGL texture-renderbuffer-viewport sınırları, gerçek tampon boyutu testi), dışa aktarımda kalın hücre çizgileri | TIFF/SVG, 3B STL/glTF, tipografi/vektörel makale çıktıları |
| Dosya mimarisi | HTML/CSS/JS modülleri; yerel Three.js 0.186.1; sürümlü Service Worker, PWA manifesti ve Moyo WASM dâhil önbellek | Uygulama modülünü alanlara ayırma, gerçek cihazlarda çevrimdışı yenileme ve güncelleme geçişi testleri |

Bu pakette bildirilen atom/bağ/çokyüzlü sayıları **koruyucu uygulama sınırlarıdır, ölçülmüş performans hızlanması değildir**. Three.js üçüncü taraf CDN'den yüklenmez; canlı COD ve ilk site ziyareti hâlâ ağ gerektirir.

## Kavram laboratuvarı · Karşı Uzay ve Kırınım (Ekim 2026)

VESTA'da karşılığı olmayan, öğretim ve araştırma amaçlı ayrı sayfa (`#karsi-uzay`).

**Ekim 2026 arayüz düzeni:** Sekmeler beyaz bir yüzey üzerinde seçili mavi dolgu, kaynak bilgi bandı ayrı vurgu, parametre paneli beyaz, sayısal özet mavi-gri, kavram kutuları yeşil ton ve 3B grafikler kendi beyaz kartı içinde nötr arka plan kullanır. Tek rengin üst üste binen alanlarında kaybolmayı önlemek için tüm dört sekmede tutarlı yüzey hiyerarşisi uygulanır. Boş çokyüzlü merkezini ilk elemente zorlayan `syncControls()` ataması kaldırıldı.

| Başlık | Uygulanan kapsam | Kalan geliştirme |
| --- | --- | --- |
| Gerçek ↔ karşı örgü | `(hkl)` düzlem ailesi ve `G(hkl)`, karşı hücre parametreleri, `|F|²` ağırlıklı karşı örgü, yapı faktörü fazör diyagramı | Gerçek ve karşı görünüm kameralarını eşleme; düzlem ailesini karşı örgüde vurgulayan animasyon |
| Ewald ve toz | Ewald kesiti, `ω` dönüşü ve sonraki Bragg konumu, toz kabukları, Debye–Scherrer halkaları, LP'li toz deseni | 3B Ewald küresi, Laue (beyaz ışın) deseni, eğik/2B alan dedektörü geometrisi |
| SAED | Relativistik λ, Mott–Bethe, uyarılma hatası, `sinc²` biçim çarpanı, sönük konumlar | HOLZ halkaları, Kikuchi çizgileri, çift kırınım yolları, dinamik (Bloch dalgası) hesap |
| Brillouin bölgesi | Saf ötelemelerden primitive örgü, Wigner–Seitz bölgesi, Setyawan–Curtarolo yolu (CUB/FCC/BCC/TET/ORC/HEX), boş örgü bantları | BCT, RHL, ORCF/ORCI/ORCC, MCL, TRI yolları; sıkı bağ veya ampirik psödopotansiyel bantları (ör. Si/GaAs) |

## P1 ilerleme · Ekim 2026

Bu bölüm önceki faz notlarını günceller; aşağıdaki işler P1 geliştirme dalında gerçekleştirildi ve regresyonlarla sınanıyor:

| Başlık | Eklenen kapsam | Bilimsel ve teknik sınır |
| --- | --- | --- |
| Hacimsel matematik ve çıktı | Kaynak fiziksel tür/birim seçimiyle CUBE/XSF yoğunluk/potansiyel normalizasyonu; tek adımda `A + k₁B + k₂C`, farklı çözünürlükte trilineer örnekleme; aktif Δρ/spin/Fourier alanının CUBE/XSF olarak indirimi | Birim semantiği yorumda, standart DATAGRID/CUBE alanında zorunlu değildir; başka programda yeniden yorumlanmalıdır. 2,5 milyon voksel sınırı geçerli |
| Miller kesitleri | Kristalin gerçek karşı-örgü metriğiyle `(hkl)` yönlü 2B sayısal kesit, ızgara sınırlarına kırpma, PNG/CSV ve kontur | Hesaplanan kesit veri olmayan alanda extrapolasyon yapmaz; inceleme çözünürlüğü sınırlıdır |
| Kinematik saçılma ve profil | IT92 X-ışını form faktörü; koherent nötron uzunluğu, ADP, isteğe bağlı LP / Lorentz; pseudo-Voigt/Caglioti U/V/W, Kα1/Kα2 oranı, ölçüm CSV üst üste gösterimi ve profil CSV | İyonik/anomal saçılma, özel izotoplar, absorpsiyon, cihaz asimetrisi ve Rietveld inceltmesi yok; kullanıcı U/V/W'yi kendisi kalibre eder |
| Türetilmiş model haritası | `d_min` Å çözünürlük küresi ve 16³/32³/64³ radix-2 FFT ile model `F(hkl)` Fourier/Patterson | Fobs/Fo−Fc değildir; Nyquist/hesaplama bütçesi ve Gibbs artefaktları sınırlayıcıdır |
| Voronoi | E/Å³ periyodik elektron yoğunluğunda en yakın çekirdeğe sayısal integral ve CSV | Bader sıfır-akı havzaları değildir; örnekleme ve site limiti nedeniyle yakınsama gerektirir |
| Madelung | Açık iyon yükleriyle nötr P1 hücrede gerçek/karşı-uzay + self terimli Ewald, site potansiyeli ve eV/cell | Noktasal iyon modeli; kısmi doluluk, polarizasyon/dielektrik etki ve elektronik yapı yok |
| Dosya kapsamı | PDB/ENT CRYST1 hücre+Hermann–Mauguin grup eşleme, ATOM/HETATM element hizalaması, ilk MODEL, ANISOU; PDB P1 dışa aktarımı | Tanınmayan space group güvenli uyarıyla P1 kalır; geniş biyomoleküler topoloji ve `.vesta` tamamlanmadı |

### Paket A · bilimsel doğruluk düzeltmeleri (Ekim 2026)

- **XRD:** Sabit ±hkl küpü yerine dalga boyu ve 2θ üst sınırından türeyen d_min küresi; büyük hücrede hesaplama bütçesi uyarısı; fiziksel indise koyulmuş eski ±8 kesimini yapı faktöründen ayırma.
- **Hacimsel dosyalar:** CUBE/XSF için kullanıcıdan kaynak nicelik/birim seçimi; e/bohr³ → e/Å³ ve Hartree/e → V; bilinmeyen türün fiziksel aritmetik ve Voronoi işlemlerine girmesini önleme; periyodik XSF son-ızgara düzlemlerini kaldırma.
- **Ekstremum:** Minimumlarda `değer ≤ eşik`, maksimumlarda `değer ≥ eşik`, negatif eşikler dahil.
- **PDB:** İki harfli büyük element adlarının hizalama/kalıntı bilgisiyle okunması; CRYST1'de tanınan Hermann–Mauguin uzay gruplarının açılması, tanınmayan/uyumsuz gruplarda bilimsel uyarı.
- **Simetri/site kimliği:** Genişletilmiş atomlarda asimetrik kaynak site ve simetri işlemi indeksi; Madelung yük ve Voronoi raporlarını kullanıcıdaki kaynak atom etiketiyle eşleme.
- **Arayüz:** Görünür kesirli sınırlar, birim hücre ve süperhücre gibi ayrı başlıklı bölüm.

### Paket B · sayısal modeller ve arayüz (Ekim 2026)

- Sabit dalga boylu nötron için polarizasyonsuz Lorentz; B, Cd, Sm, Eu, Gd'de kompleks koherent b ve absorpsiyon ihmal uyarısı. Gerçek absorpsiyon düzeltmesi yapılmaz.
- Fourier/Patterson için karşı-uzay `d_min` küresi ve radix-2 FFT ile 16³, 32³, 64³ örnekleme; Nyquist hatası ve hesaplama bütçesi koruması.
- Fark alanı için isteğe bağlı C kaynağıyla `A + k₁B + k₂C`, tek örnekleme geçişi ve fiziksel birim/çerçeve kontrolü.
- PAW/CHGCAR ve AECCAR0 + AECCAR2 sınırlama uyarısı; PDB 77–78 element sütununda iki harfli büyük element sembolü.
- **Görünür kesirli sınırlar** sayı kutuları, kompakt yuvarlatılmış/focus vurgulu stile geçirildi.
- CIF doğrulama çalıştırıcısı, modüler `crystal-app.js` kaynak dosyasından tarayıcı başlangıç sınırına kadar ayrıştırıcıyı alacak şekilde güncellendi; kapalı-sınır davranışı korunuyor.

### Paket B sonrası · P1 açığı kapatma (Ekim 2026)

- **PDB güvenilirlik uyarısı:** CRYST1 grubu eşlenemediğinde XRD/Fourier/Ewald sonuçlarının bağımsız doğrulama olmadan güvenilir sayılamayacağı TR/EN olarak belirtildi.
- **VASP CHGCAR spin:** İlk toplam-yük bloğundan sonra augmentation kayıtları arasından tekrar eden ızgara başlıkları okunarak kollineer `m_z` veya nonkollineer `m_x/m_y/m_z` alanları ayrı veri kaynakları olarak gösterilir; hücre hacmi normalizasyonu ve fiziksel nicelik türü korunur. VASP'ın spinor ekseni `SAXIS` bilgisi CHGCAR tek başına içinden elde edilemez.
- **Δρ integral kontrolü:** `A + k₁B + k₂C` sonucu için periyodik örneklem toplamı veya uç noktası dahil ızgarada 3B trapezle `∫Δρ dV` ve birim yazdırılır; nicelik/birim uyuşmazlığı engellenir.
- **Tepe bulma:** Ayrı `f=(u,v,w)` çıktısı ve CSV; komşu örneklerden üç eksenli parabolik alt-voksel tahmin; hücreyle hizalı periyodik veride tanınan simetri setting'inden eşdeğer tepe eleme. Tam Hessian yaklaşımı veya rastgele uzay grupları için otomatik hacim simetrileştirmesi değildir.
- **SHELX `.fcf`:** Hkl + gözlenen `F²/F` + hesaplanan faz ile deneysel genlikten model-fazlı Fo; hesaplanan `F²/F` varsa Fo−Fc FFT katmanı. Fazı olmayan FCF, hücre/simetri/ölçek bakımından şüpheli veri veya Nyquist dışı istemler için güvenli sınırlamalar ve uyarılar.
- **Manyetik mCIF:** `Cartn` ve `crystalaxis` moment üçlüleri; `_space_group_symop_magn_operation.xyz` / `_space_group_symop_magn_centering.xyz` ile 3B eksenel dönüşüm ve zaman tersleme. 600 ok sınırıyla manyetik moment katmanı; proje kaydı ve P1 açık site-moment `.mcif` dışa aktarımı. Kapsam **manyetik kırınım / BNS katalog / modüle yapı / superspace / SAXIS dönüşümünü içermez**.

**Kalan P1 önceliği:** deneysel `.mtz` (ve fazsız FCF için faz çözümü değil, dışarıdan model-faz eşleme) ve nicel FCF ölçek/doğrulama; özgül izotop/anomal saçılma; geniş referans testleri, tam BNS manyetik gruplar, spinor ekseni/SAXIS dönüşümü, Hall setting/orijin ve VESTA proje biçimi.

Bu plan gerçek VESTA özellikleriyle statik HTML/CSS/JavaScript tabanlı tarayıcı uygulamasını karşılaştırır. Sıra hem bilimsel doğruluğu hem de kullanıcı arayüzünün anlaşılabilirliğini esas alır. **Bir özellik UI'da mevcut diye bilimsel olarak doğrulanmış sayılmaz.** Canlı COD araması internet/CORS'a bağlıdır; 3B motoru yerel Three.js ES modülleriyle çalışır.

## VESTA Aşama 1 — bu dalda uygulanan kapsam

| Paket | Gerçekleştirilen | Doğrulama / sınır |
| --- | --- | --- |
| A1.1 · CIF veri bütünlüğü | Seçili yayın/metaveri alanları, Uij/Bij ve Uiso/Biso; simetriyle tensör dönüşümü, kaynak formül koruma kontrolü ve 5 gerçek CIF için round-trip testleri | Tam CIF/mCIF metadata döngüsü, alternatif setting/orijin dönüşümü ve tüm genişletilmiş simetri testleri henüz kapsanmıyor |
| A1.2 · Gerçek WebGL testleri | Playwright+Chromium başsız görüntüleme, Si/COD/ADP/Miller ekran görüntüleri, piksel fark ölçümleri, artifact yükleme | İlk gerçek GitHub Actions koşusu ve gerçek VESTA eş görüntü kıyaslaması merge sonrasında doğrulanacak |
| A1.3 · Nesne / katman yöneticisi | 9 katmanda görünürlük, opaklık, sıra; renk değiştirilebilen katmanlarda renk, proje kaydı ve Undo/Redo | Büyük hacimsel veri ve yoğun sahnede performans ayrıca değerlendirilmelidir |
| A1.4 · Termal elipsoitler | Uij/Bij/Uiso/Biso okuma; triclinic Cartesian tensor dönüşümü; 50/90/99% olasılıklı 3D elipsoid, pozitif tanımlılık kontrolü ve P1 CIF dışa aktarımı | Kompleks mCIF ve makale temelli VESTA görsel uyum testleri henüz yapılmadı |

Bu kapsam uygulandı ancak **CI/WebGL E2E ve gerçek cihaz doğrulaması yapılmadan tamamı kanıtlanmış sayılmaz**.
İlk PR merge sonrası hem Pages testlerini hem `browser-visual` iş akışını kontrol et.
## Kısa vade · PR #12 (bu geliştirme)

| Sıra | İş | Durum / teslim ölçütü |
| --- | --- | --- |
| K1 | Görselde tekrar eden yapı başlığını kaldır | Yapı adı sağdaki Yapı Bilgileri'nde kalır; sahnede başlık kartı bulunmaz |
| K2 | Kamera kontrolleri ikonlaştırma | Sığdır / üst / ön / yan / projeksiyon için beş kompakt erişilebilir SVG ikon, hover metni ve projeksiyon durumu |
| K3 | Bağ ve çokyüzlü iş akışı | Atom çifti bazlı min–maks eşik editörü, geometrik öneri, kural kaldırma; PBC komşularından çokyüzlü üretme, komşu/kesim sınırı |
| K4 | Ölçüm arayüzü | 2 atom mesafe, 3 atom açı, 4 atom torsiyon; periyodik komşuluk özeti; ölçüm geçmişi/CSV |
| K5 | Çoklu Miller gösterimi | 8 ek (hkl) katmanı, ayrı renk/görünürlük/silme; tekrar eden paralel düzlemler ve ayarlar proje/son-kristal kaydında korunur |

Bu adımlar **kodlandı ve 84/84 regresyon testi başarılı**. Ancak gerçek tarayıcı/WebGL görsel E2E, farklı CIF dosyalarıyla koordinasyon kriterleri ve büyük yapıların performansı merge sonrası ayrıca denetlenmelidir. Çokyüzlüler geometrik yakınlığa dayanır; oksidasyon ve bağ mertebesini saptamaz. Ek Miller katmanları gösterim içindir: slab üretimi yalnız birincil `t` düzlemini kullanır.

## Öncelikli kalite kapısı (her yeni bilimsel özellikten önce)

- COD 4335507, grafit, NaCl, CsCl, Si ve triklinik örneklerde hücre, atom çokluğu, periyodik mesafe ve bağ/koordinasyon farklarını **Gemmi referansıyla** raporla.
- Kullanıcı tanımlı eşik değişiminde atom koordinatlarının etkilenmediğini; toplam atom, tahmini koordinasyon ve çokyüzlü köşe sayılarının beklenen sınırlarda olduğunu test et.
- Otomatik CI yalnızca **main merge** sonrası çalışsın; hata veya `inconclusive` kayıtlar raporda açık kalsın. Eşik düzeltmeleri gerçek sapmaları gizlememeli.
- Mobil ve masaüstünde gerçek WebGL screenshot/duman testi, GPU bellek/çizim sınırı ve yükleme hatası deneyleri ekle.

## Aşama 2 — çoklu CIF/faz karşılaştırması

- **O9 ilk kapsam:** bir ana kristal + en fazla üç ek faz, bağımsız hücre metriği,
  renk/görünürlük/saydamlık, Å ofseti ve merkez/orijin hizalaması.
- Karşılaştırma fazları proje, son kristal ve Undo/Redo'da saklanır.
- Otomatik atom eşleme / rijit en düşük RMSD / örgü uyumu sonraki geliştirme.
- Node regresyonları ve Chromium WebGL smoke senaryoları genişletildi.
## Aşama 2 — hacimsel geliştirmeler

- **O2 (çoklu izoyüzey):** her dosyada dört katmana kadar ayrı izodeğer/renk/opacity, toplam 8 aktif yüzey sınırı.
- **O3 (çoklu alan):** dört eş uzaysal kapsamlı dosya; farklı grid çözünürlükleri için world-coordinate interpolasyon; ayrı alanla renklendirme.
- **O4 ilk bölüm (nicel kesit):** fiziksel boyut, min/maks/ortalama, sayısal renk aralığı, PNG ve koordinatlı CSV. Keyfî hkl yönleri ve kapsamlı nicel kontur çıktısı sonraki iş.
- **O5 / çoklu yapı bindirme:** ayrı takip PR'ında planlanıyor.
- Bu değişiklikler GitHub Pages üzerinde ana dala merge sonrası CI çalıştırılmadan görsel olarak doğrulanmış sayılmaz.

## Orta vade · önerilen uygulama sırası

| Öncelik | Paket | Kabul kriteri |
| --- | --- | --- |
| O1a · tamamlandı | Kristal düzenleme Undo/Redo | 60 durumluk, tekrarları ayıklayan geri alma/yineleme; atom/hücre/simetri/bağ/Miller ve görünüm durumları; Ctrl/Cmd kısayolları. **İlk 90 regresyon testi geçti**; gerçek browser E2E ayrıca bekliyor. |
| O1b · Aşama 1 PR'ında | Nesne / katman paneli ve görünürlük yöneticisi | Kristal, bağ, çokyüzlü, Miller ve hacimsel öğeler için tutarlı ağaç, tek tek görünürlük/renk, katman yeniden sıralama; düzenlemeler Undo/Redo'da korunur |
| O2 | Çok seviyeli izoyüzey | Tek CUBE/CHGCAR/XSF alanında birden fazla izodeğer, ayrı renk/opacity ve katman kontrolü |
| O3 | Çoklu hacim alanı + uyum kontrolü | Aynı yapıya birden fazla yoğunluk/potansiyel haritası; birim, koordinat çerçevesi ve grid interpolasyonu açıkça doğrulanır |
| O4 | Gelişmiş 2B kesitler | Orta/kenar düzlemleri, nicel skala, kontur seviyeleri, PNG/SVG çıktısı ve eğik hücrede örnekleme doğruluğu |
| O5 | Kristal morfolojisi / crystal faces | Ayrı `{hkl}` yüz aileleri, orijinden mesafe, kapalı morfoloji poliedri ve bağımsız renk/etiket katmanı |
| O6 | Koordinasyon/bağ kimyasının bilimsel kontrolü | Site bazında CN, bağ uzunluğu dağılımı, minimum-image tolerans kontrolü, kısmi occupancy ayrımı; testli BVS hazırlığı |

### Undo/Redo sonrasında kesin uygulama sırası

1. **O1b – Nesne/katman yöneticisi:** Çalışma alanı objelerini tek panelde düzenleme, görünürlük ve renk kontrolü, geçmişe dahil etme.
2. **Kalite kapısı:** Gerçek WebGL E2E, NaCl/Si/grafit/COD 4335507 gibi yapılarda PBC koordinasyon ve bağ/çokyüzlü doğrulaması.
3. **O2 – Çok seviyeli izoyüzeyler:** Her izoyüzeyin ayrı eşik, renk ve opaklığı.
4. **O3 – Çoklu hacimsel alan:** Yoğunluk/potansiyel ızgaralarında birim ve geometri uyumu.
5. **O4 – Nicel 2B kesitler:** Ölçek, renk çubuğu, kontur ve bilimsel veri çıktısı.
6. **O5 – Morfoloji:** `{hkl}` yüz aileleri, dış kristal geometrisi, yüz etiketleri.
7. **O6 – Koordinasyon/BVS doğrulaması:** Bağ-değerliği ve site çevresi analizleri.
8. **U1–U3 – Termal elipsoitler, best-fit plane, çoklu yapı üst üste bindirme.**
9. **U4–U6 – Patterson, Voronoi ve ileri format/yayın çıktıları.**

> Undo/Redo şu an yalnızca **kristal durumunu** kapsar. Harici hacimsel alan baytları, kamera hareketleri ve ayrı ölçüm kayıtları sürüm geçmişinde değildir. Nesne ağacı ile beraber katman bazlı geçmiş ayrıca genişletilecektir.

## Uzun vade · önerilen uygulama sırası

| Öncelik | Paket | Kabul kriteri |
| --- | --- | --- |
| U1 | ADP/termal elipsoitler | CIF `Uij`/eşdeğer parametrelerini okuma, pozitif tanımlı tensör kontrolü, seçilebilir olasılık düzeyi |
| U2 | Best-fit plane ve gelişmiş geometri | Seçili atom kümesine en küçük kareler düzlemi, RMS sapma, düzlem–düzlem açı ve dihedral karşılaştırmaları |
| U3 | Çoklu yapı bindirme | Aynı anda iki CIF modeli, ayrı hücre/baz dönüşümü, atom hizalama ve karşılaştırmalı görünürlük |
| U4 | Patterson ve türetilmiş alanlar | Sadece veri gösterimi değil: formüle dayalı Fourier/Patterson, Laplasyen ve fiziksel birim testleri |
| U5 | Voronoi integrali ve ileri kristal-kimya | Periyodik hücrede bölüşüm ve sayısal integral testi; occupancy ile yük/elektron sayımı denetimi |
| U6 | Gelişmiş format/yayın çıktıları | Kesin atom/alan metadata kaybı raporu, yüksek çözünürlüklü vektör çıktı, dönüşümlerde round-trip testleri |

### Mimari ilkeler

- Üretim yine frontend ağırlıklı ve tarayıcı tabanlı kalmalı. Büyük hacimsel veriler için Web Worker/WASM tercih edilebilir.
- CUBE/CHGCAR/XSF dosyalarındaki nicelikler **dosyada ne varsa odur**; renklendirmenin tek başına elektron yoğunluğu veya elektrostatik potansiyel hesapladığı söylenmemeli.
- Eklenecek her fiziksel hesap için referans fixture, ölçülebilir tolerans ve bilinen bilimsel sınırlama gerekir.
- Three.js sürümü depodaki yerel dosyalarla sabitlenmiştir; önbelleğe alınmayan ilk sayfa isteği ile offline Service Worker hedefi birbirinden ayrı değerlendirilmelidir.

### A3.1 — Hücre dönüşümü (kısmi)

- Seçili SG'nin F/I/A/B/C merkezleme translasyonları hem simetri
  kütüphanesine hem atom/occupancy içeriğine göre kontrol edilerek
  primitive P1 hücreye dönüşür; oran ve türler regresyonla korunur.
- Unimodüler 3B kısa baz işlemi atom sayısı ve hacim korur.
- **Tamamlanmadı:** kanonik Niggli indirgeme, origin/setting,
  otomatik SG tespiti, R-merkezleme.
- Bunlar için spglib Niggli/standardize ile bağımsız referans
  eşdeğerlik testleri gereklidir; 'kısa baz' Niggli değildir.
## P0 doğrulama ve bilimsel standardizasyon · Ekim 2026

| İş | Bu PR zincirinde yapılan | Kalan doğrulama/sınır |
| --- | --- | --- |
| Regresyon CI | Eksik test-VM `preferredSetting` dışa aktarımı düzeltildi (#22) | İlk main-merge CI sonucunu doğrula |
| Kanonik Niggli | spglib Křivý–Gruber 8-adım JS uygulaması; Gemmi 0.7.4 ile 5 hücre metrik testi, ADP invariant kontrolü (#23) | Sınır koşullarında daha geniş random/ref veri testi; iterasyon/katsayı sınırı |
| Otomatik SG | Tarayıcı içi yerel `@spglib/moyo-wasm` 0.21.0, 230 uzay grubu/Hall numarası, tolerans ve iki standart setting seçimi (#24) | WASM tarayıcı E2E/CI doğrulaması; kısmi doluluk güvenli reddedilir |
| Setting ve orijin | Moyo `std_linear` / `std_origin_shift`, primitive alternatif; orijinal koordinatı rafine etmeden açık P1'e dönüştürme; atom/occupancy/hacim kontrolü (#24) | Kullanıcıya tam 530 Hall seçimi, manyetik uzay grupları ve otomatik P1 dışı yeni setting ataması eklenmedi |

**Bütün bu işler merge-only CI başarılı olana kadar tamamlanmış kabul edilmez.**
Geleneksel `P1` olarak kaydedilen dönüştürülmüş yapı ile `moyo` tarafından tanınan
uzay grubu ayrı gösterilir; eşdeğerliği bilinmeyen uygulama-içi setting
operasyonları otomatik etkinleştirilmez.
## Aşama 3 — İleri kristalografi ve analiz

| Paket | Uygulanan | Sınır / sonraki çalışma |
| --- | --- | --- |
| A3.2 Koordinasyon ve BVS | Seçili valanslı katyon/anyon için deneysel R₀/B ve periyodik komşuluk, CN, dağılım ve CSV | Çift/valans parametre kapsamını genişletme, karışık yerleşimler |
| A3.3 Best-fit plane | En küçük kareler normal vektörü, RMS/maks sapma, iki düzlem açısı ve 3B çizim | PBC atom unwrap ve çok düzlem kaydı |
| A3.4 Yapı faktörü ve öğretici toz XRD | P1/simetri genişletilmiş F(hkl), Bragg açısı, Debye–Waller, pik/CSV; BCC/FCC sönüm testleri | Tam f₀(q), LP, anomal saçılma ve Rietveld yok |
| A3.1 Hücre standardizasyonu | F/I/A/B/C primitive hücre kontrolü ve GL(3,Z) baz kısaltma testleri | Genel Niggli, SG/orijin/setting tayini ve R merkezleme henüz yok |
## VESTA referansları

- [VESTA resmî kullanım kılavuzu](https://www.jp-minerals.org/vesta/archives/VESTA_Manual.pdf)
- K. Momma & F. Izumi, *VESTA 3 for three-dimensional visualization of crystal, volumetric and morphology data*, J. Appl. Cryst. **44**, 1272–1276 (2011), DOI: 10.1107/S0021889811038970
- K. Momma & F. Izumi, *VESTA: a three-dimensional visualization system for electronic and structural analysis*, J. Appl. Cryst. **41**, 653–658 (2008), DOI: 10.1107/S0021889808012016
