# Eğitim sayfaları: MVP ve sonraki işler

Durum: 19 Ekim 2026 · Kristal Yapı / Paket 14 tabanlı bağımsız eğitim MVP'si.
Bu belge bilimsel kapsamı, kabulleri ve sonraki paketleri planlar. Mevcut
VESTA/BVS doğrulaması için öngörülen **Paket 15** takvimini değiştirmez.

## MVP-1: X-Işını Toz Kırınımı — uygulandı

- [x] Üst menüde `#toz-kirinimi` bağımsız sayfası.
- [x] Etkin çalışma alanındaki gerçek yapıyı salt okunur kullan.
- [x] Mevcut `powderPattern` / `powderProfile` fizik motorunu paylaş.
- [x] Dalga boyu, 2θ sınırı, sabit FWHM, LP kontrolü.
- [x] Yeniden hesaplanan toz profili SVG, (hkl) pik listesi ve Bragg ölçüleri.
- [x] Bilimsel sınır: ideal kinematik yansıma, ampirik pseudo-Voigt.
- [x] Bragg modeli birim testi; gerçek Chromium smoke testi altyapısı.

### E2 — XRD'yi ders ve ölçüm laboratuvarına geliştirme

- [x] XRD grafik pikine **veya** (hkl) listesine tıklayınca aynı sayfada 3B
  birim hücrede seçilen düzlem üyesinin kesitlerini vurgula; hücre köşelerini,
  atomları ve `G(hkl)` yönünü göster. `#karsi-uzay` ile test edilen
  `planeCellPolygons` geometrisini paylaş, orbital bakış ve mobil ölçekleme ekle.
- [ ] Tek bir toz pikinde çakışan farklı `(hkl)` üyelerini ve kristal nokta
  grubuna göre eşdeğer üyeleri **ayrı ayrı** seçilebilir kıl; basit kübik
  indis permütasyonu tüm simetrilere uygulanamaz. `#karsi-uzay` ile (hkl)
  seçimi/bakış senkronizasyonu ekle.
- [x] Seçili hkl düzleminin normaline göre dönen gelen/saçılan 3B ışın
  yönleri; açı sürgüsü, Bragg'a dön kontrolü ve ardışık iki düzlemin
  `ΔL=2d sinθ`, `Δφ=2πΔL/λ` yol/faz farkını çizerek iki ideal dalganın
  yapıcı/yıkıcı girişimini canlandır. Bragg açısı θ ve dedektör 2θ ayrımı.
- [ ] Gerçek toz örneğine özgü çok-kristalit yönelim ortalaması ve 2θ
  Debye–Scherrer konisini de ayrı bir görselleştirmeye bağla; mevcut iki
  dalgalı girişim animasyonunun hesaplanan XRD şiddeti olmadığını koru.
- [x] Seçilen veya elle girilen `(hkl)` için mevcut IT92/ADP/doluluk motorundan
  atom fazörlerini uç uca toplama, `F`, `|F|²`, sayısal sönme; powder pikine
  girmeyen (200) gibi indisler için elle seçim ve 30 üzeri atomda gruplanmış
  tam vektör toplamı. Seçilen pike dönüş ve Si (200)/(220) tarayıcı kabulü.
- [ ] Yapı atomları/doluluk/hücre değişirken yapı faktörünün ve toz pikinin
  **aynı eksende** canlı değişimini canlandır; BCC (100), FCC (100) ve diamond
  Si (200) sönmeleri için bağımsız çoklu-yapı regresyonu.
- [ ] Kα1/Kα2 profili, referans dalga boyu seçimi (Cu/Co/Mo; kalibre edilmiş
  spektral yayılım yoksa uyarı) ve çubuk/profil/halka görünümü.
- [ ] Ölçüm CSV ile aynı eksende grafik, kontrollü arka plan/ölçek/ofset;
  doğrulamalı cihaz kalibrasyonu olmadan nicel faz yüzdesi üretme.
- [ ] Scherrer boyut (şekil katsayısı ve cihaz genişliği bilgisi zorunlu),
  Williamson–Hall mikrogerinim (birim ve belirsizlik raporu).
- [ ] Çoklu faz karışımı, etiketli desen karşılaştırması. Gerçek absorpsiyon,
  mikroabsorpsiyon ve tercihli yönlenme düzeltilmedikçe kütle yüzdesi iddia etme.
- [ ] Gelişmiş profil/refinman işi yalnız bağımsız bir uygunluk raporuyla
  `Rietveld` olarak adlandırılabilir; mevcut MVP öyle değildir.
- [ ] İhracat: ölçüm + model grafiği SVG/PNG, yansıma/profil CSV, deney ayarları.

### E2 bilimsel kabul ve testler

- [ ] Cu Kα1 ile Si (111) yaklaşık 28.44°; farklı `a` değerinde Bragg
  kaymasının bağımsız analitik sınırı.
- [ ] Gemmi / ASE ile yansıma çoğullukları ve uygun temel `F(hkl)` oranları.
- [ ] IUCr'nin Bragg pik profili/şiddeti referanslarıyla boyut/gerinim ayırımı:
  https://journals.iucr.org/j/issues/2021/06/00/gj5272/
  https://journals.iucr.org/j/issues/2023/03/00/dv5004/
- [ ] Gerçek iki cihazdan alınan ölçüm dosyası, bağımsız pik pozisyonu,
  profil ve başarısız dosya durumları.

## MVP-2: Yarıiletken Fiziği — uygulandı

- [x] Üst menüde `#yariiletken-fizigi` bağımsız sayfası.
- [x] İki düzlem dalgalı 1B yaklaşık-serbest-elektron modelinde canlı
  E(k) eğrileri; zincir periyodu, `m*/me`, `|V_G|` sürgüleri.
- [x] Kullanıcı isterse etkin kristalin `a` uzunluğu 1B modelin başlangıç
  periyodu yapılabilir; gerçek 3B malzeme bandı olduğu iddia edilmez.
- [x] Bağımsız ideal `E_g`, `E_F`, sıcaklık sürgüleriyle Fermi–Dirac `f(E)`.
- [x] Kısıtlar: `2|V_G|` yalnız bölge sınırı iki-dalga ayrılmasıdır;
  Fermi panelindeki `E_g` bununla bir tutulmaz.
- [x] Band-edge ayrılma, k ölçeği, `f(E_F)=1/2` ve model birim testleri.

### E3 — Atomdan banda gerçek ders akışı

- [x] Tek orbitalin seviyesi → iki atomun ayrılması → N = 1…64 sonlu açık
  zincirin **tam N özdeğeri** → ayrı, sonsuz periyodik zincirin Bloch bandı.
  En yakın komşu tight-binding modeli, |t| sürgüsü ve N canlandırması;
  atom sayısı/enerji genişliği ile açık/periyodik sınır ayrımını etiketle.
- [x] Tek orbitalli deneyden sonra **iki A/B orbital/birim hücreli** sonsuz
  periyodik 1B model ekle. İki Bloch bandı, t₁/t₂ bağlaşım farkı ve Δ
  orbital enerji farkından `Eg = sqrt(Δ² + 4(t₁ − t₂)²)` model aralığını
  göster. Bandın teması, bağlaşım kaynaklı aralık, enerji kaynaklı aralık
  için üç örnek, sürgüler, boş enerji bölgesi, bağımsız birim ve tarayıcı
  testleri. Gerçek Si/GaAs bandı veya Fermi panelindeki serbest `Eg` ile
  özdeşleştirilmez.
- [x] İki orbitalli modelde seçilebilir `k` ve bant eğrisinde tıklama; seçili
  valans/iletim özdurumlarının normalize `|u_A(k)|²`, `|u_B(k)|²` ağırlıkları,
  limitte 0/0 özvektör belirsizliği ve doluluktan ayrı açıklama.
- [ ] Elektron doluluğu/filling (spin, hücre başına iki elektron, eksik dolu
  bant), gerçek uzay Bloch genlikleri ve atomik sınırdan valans/iletim
  doluluğuna kontrollü geçiş. Orbital ağırlığını Fermi doluluğuyla karıştırma.
- [ ] Bloch teoremi, periyodik potansiyel, birinci Brillouin bölgesi; mevcut
  karşı örgü/BZ sahnesine ders bağlantısı.
- [ ] Yaklaşık serbest elektron (1B Kronig–Penney / iki dalga) ve tight-binding
  birbirinden ayrı çözülebilir, doğrulanmış model seçenekleri.
- [ ] Tek-boyutlu iki dalga modelinin yalnız bölge kenarı yakınında güvenilir
  olduğuna dair görünür uyarı; bağımsız sayısal Hamiltonyen özdeğer kontrolü.
- [ ] Si diamond, Ge diamond ve GaAs zincblende için önceden kaynaklanmış
  kristal örnekleri, doğrudan/dolaylı bant aralığı *verisi*. CIF yalnızca
  geometri sağlar; gerçek bant aralığını üretmez.

### E4 — Taşıyıcı fiziği

- [ ] 1B/2B/3B parabolik-bant durum yoğunluğu (DOS), enerji birimi ve spin
  degenerasyonu; analitik normalizasyon testleri.
- [ ] Elektron/delik yoğunlukları `n,p`, etkin durum yoğunluğu `Nc,Nv`,
  özdeşlik `np=ni²` yalnız Boltzmann/intrinsik denge varsayımında.
- [ ] Donor/akseptör, nötrlük denklemi ve sıcaklığa bağlı Fermi seviyesi.
  Şu anki serbest `E_F` sürgüsünü katkı miktarı gibi göstermeme.
- [ ] Etkin kütle `m*=ℏ²/(d²E/dk²)`, hareketlilik ve iletkenlik;
  geometrik anlam ve birimler.
- [ ] Fermi–Dirac integrallerini yüksek katkı/degenerasyon rejiminde
  geçerli varsayımlarla doğrula; basit Boltzmann yaklaşımını etiketle.

### E5 — Cihaz fiziği

- [ ] Ani p-n eklemi: Poisson, yük nötrlüğü, tükenim genişliği, `V_bi`,
  `E(x)` ve bant bükülmesi (depletion approximation açık).
- [ ] İleri/ters kutuplama, ideal diyot I–V; seri direnç, yeniden birleşme,
  kırılma ve yüksek seviye enjeksiyon hesaplanmıyorsa uyarı.
- [ ] Akış animasyonları: difüzyon/sürüklenme akımları, elektron/delik.
- [ ] İleri MOS, Schottky, fotodiyot modülleri ancak bilimsel kaynak
  ve ayrı testlerle geliştirilecek.

### E6 — Gerçek malzeme/veri katmanı

- [ ] Kaynak, tarih, fonksiyonel (PBE/HSE vb.), spin/SOC, `k` yolu ve
  deneysel/hesaplanmış ayrımını taşıyan bant ve DOS dosya şeması.
- [ ] Önceden paketlenmiş ve açık lisanslı küçük Si/Ge/GaAs örnekleri:
  çevrimdışı açılış; kaynak ve lisans atıfları.
- [ ] İsteğe bağlı Materials Project verisi: API anahtarı ve kullanıcı
  rızası; anahtar/uzak isteği varsayılan çevrimdışı akışa sokmama.
- [ ] Model bant eğrisini 3B kristalle karıştırmayan görsel ayrım.

## Ortak mimari / kalite

- [ ] Her iki MVP'deki bütün yeni statik/dinamik metinler için TR/EN
  sözlükleri, uzun metin ve formül parçalarının güvenli çevirisi.
- [ ] Mobil ve tablet panel yerleşimi / dokunmatik sürgüler / klavye
  erişilebilirliği ve ekran okuyucu grafik özetleri.
- [ ] Aynı çalışma alanı değiştiğinde sayfalarda güvenli geçiş;
  konumlandırılmış büyük CIF için maliyet sınırı, lazy rendering,
  güncellemelerde debounce/Worker.
- [ ] Ders presetleri, konu anlatımı, matematiksel temel ve deney sekmeleri;
  öğretmen için görev/cevap doğrulama (öğrenci verisi sunucuya gitmez).
- [ ] Her yeni bilimsel model için analitik birim testi + bağımsız referans,
  Chromium/WebGL ekran görüntüsü ve Firefox/Safari/mobil smoke matrisi.
- [ ] Servis çalışanının offline uygulama listesi sürümlendirilsin;
  Pages dağıtımından sonra ağ kapalı iki sayfa testi.
- [ ] Büyük `crystal-app.js` modülünden veri/analiz/gezinti köprülerini
  aşamalı ayır; sayfalar paylaşılabilir fizik çekirdeğini kullanmaya devam etsin.
- [ ] Site menüsünde dar ekran yatay taşması, scroll/focus erişilebilirliği.

## Paketleme ve yayın

Bu MVP için önerilen PR, mevcut `main` üzerine ayrı dalda tutulur.
Kullanıcı onayından sonra birleştirilir; ana dağıtımdaki sayfalar GitHub
Pages yeniden yayımlandığında erişilir. PR'deki testler ve yayımdan sonraki
gerçek cihaz kontrolleri ayrıca raporlanır.


---

## M — 2B MoS₂ kusur fiziği / ACS Nano (2022) yeniden üretim programı

**Kaynak:** Wang, Jones, Chen, Schatz ve Ma, *Utilizing Ultraviolet Photons to Generate Single-Photon Emitters in Semiconductor Monolayers*, ACS Nano **16** (2022) 21240–21247; DOI: https://doi.org/10.1021/acsnano.2c09209.
**Araştırma hedefi:** Önce makalenin Şekil 4(c,g)'deki kusur atomik modelleri, bant yapısı ve PDOS karşılaştırmasını bağımsız hesaplamayla yeniden üretmek; ardından optik geçişleri ve ML/vekil modelleri değerlendirmek.
**Bilimsel ayrım:** KristalYapı geometriyi oluşturur; DFT tarayıcı dışında çalıştırılır; deneysel UV ışınlaması, PL ve foton antibunching ölçümleri bir laboratuvarın işidir. Simülasyon hücresindeki c-yönü vakumu **deneysel vakum** değildir. Geometrik kusurdan tek foton emisyonu kanıtı çıkarılmaz.

### M-P0 — Tek katman ve kusur modeli ön denetimi (ilk geliştirme)

- [x] Mevcut CIF/COD, P1 süperhücre, vakans/ikame, CIF/POSCAR ve QE `relax`/`scf` akışını yeniden kullan; mevcut araçları ikinci kez yazma.
- [x] Kusur panelinden erişilen **MoS₂ araştırma ön denetimi**: açık P1 atomları, Mo:S sayıları, tam doluluk, yaklaşık Mo düzlem sayısı ve c-yönü periyodik boşluk kontrolü. İleri sürülen tek katman/vakum uygunluğu konusunda açık koşullar ve sınırlamalar göster.
- [x] Stokiyometriye dayalı **aday** sınıflandırması: kusursuz MoS₂, tek S vakansı (`V_S`), iki S kaybı (`V_2S`), `O_S`, iki O içeren kusur adayı. **Komşuluk, adsorpsiyon ve kimyasal bağ doğrulanmış gibi gösterilmez.**
- [x] İncelenen yapı atomlarını ve uyarıları içeren, **DFT/deney sonucu içermeyen** JSON araştırma bildirimi dışa aktarımı. Dosya, KristalYapı proje JSON'u değildir.
- [x] Bağımsız Node testleri: kusursuz 1H-MoS₂, `V_S`, `V_2S`, `O_S`, iki O adayı, çok katman, vakum eksikliği, kısmi doluluk, P1 olmayan yapı ve geçersiz koordinatlar.
- [x] Yeni modülü Pages dağıtımına ve sürümlü çevrimdışı önbelleğe dahil et; mevcut doğrulama testlerinden bağımsız yeni regresyon testi ekle.
- [ ] Yayın sonrası gerçek tarayıcı/PWA kontrolleri: COD örneği, P1 hazırlama, Undo/Redo, TR/EN, mobil panel, manifest indirme.
- [ ] Kaynaktan tek tabaka ayırma aracı (otomatik katman tespiti ve atom korunumu testi). **Vakum eklemek katman ayırmak değildir.**
- [ ] Tek kusurdan bağımsız tekrar üretilebilir örnek seti: 4×4×1 MoS₂, `V_S`, komşu/uzak `V_{2S}`, `O_S`, `O_2@V_S`; her biri için koordinatlı referans, biçim kontrolü ve açık kaynak/lisans.
- [ ] hBN/MoS₂/hBN heteroyapı katman birleştirme, hizalama ve arayüz doğrulaması; tek tabaka MoS₂ hesabından ayrı tutulmalı.

### M-P1 — DFT iş akışının bilimsel güvenilirliği

- [x] Başlangıç: tarayıcıdaki `pw.x` girdisini gerçek yerel/VM Quantum ESPRESSO ile çalıştırmak için Python CLI; pseudopotential SHA-256, ayrı çalışma dizini, süre sınırı, toplam enerji/kuvvet ve yakınsama kapısı; sahte solver testleri. **Gerçek MoS₂ DFT çalıştırması henüz doğrulanmadı.**
- [x] Merge sonrası P0 CI hatasının nedeni olan yeni MoS₂ etiketlerinin İngilizce sözlüğünü tamamla; offline önbellek sürümünü yenile.
- [ ] Gerçek `pw.x` ile en az bir MoS₂ `scf` ve `relax` uçtan uca testi, enerji/kuvvet ve denge geometrisi denetimi; bilimsel yakınsama ayrıca değerlendirilmeli.

- [ ] SIESTA makale ayarlarını **referans protokol** olarak kaydet: SIESTA 4.1 b4, PBE, DZP, 4×4×1 gamma merkezli k-ağı, 200 Ry mesh cutoff, 150 Ry filter cutoff, Grimme vdW, CG relaksasyon; QE parametreleriyle bire bir eşit olmadığını belirt.
- [ ] QE'de bağımsız pseudopotential/PAW, ecutwfc/ecutrho, k-ağı, vakum kalınlığı, süperhücre boyutu ve kuvvet yakınsama testleri; fiziksel parametreler ve yazılım sürümü kaydedilmeli.
- [ ] 2B elektrostatik sınır koşulları ve yüklü kusurlara özel sonlu-hücre düzeltmelerini sonraki iş akışına dahil et; ilk P0 yalnız nötr modelleri tanımlar.
- [x] **Teknik ilk sürüm:** yerel Python QE pipeline: shared `prefix/outdir`, durdurmalı `relax → scf → bands/bands.x → nscf → dos.x/projwfc.x`, kullanıcı doğrulamalı `crystal_b` k-yolu, enerji/DOS JSON ve ham çıktı saklama. Mock-çıktı testleri var; **gerçek MoS₂ hesabı / bilimsel tekrarlanabilirlik henüz doğrulanmadı**.
- [ ] Her geometri için `relax` → `scf` → `nscf`/bands/PDOS sırasını durum makinesiyle yönet; hesabı tamamlanmış gibi gösterme.
- [ ] DFT sonuçlarına: solver/sürüm, işlevsel, pseudopotential SHA256, k-ızgara, toplam enerji, kuvvet, çalıştırma tarihi, yakınsama ve model kimliği ekle.
- [ ] Farklı atom sayısı ve kimyasal potansiyeller için doğru kusur oluşum enerjileri; yalnız toplam enerjileri doğrudan karşılaştırma.

### M-P2 — Makale Şekil 4(c,g): bantlar ve PDOS

- [x] **İlk görselleştirme:** yerel `electronic-results.json` üzerinden ham QE bant ve toplam DOS/PDOS SVG grafiklerini göster; biçim/sayı kontrolü ve boyut sınırlaması; yanlış Fermi/vakum hizalaması iddiası olmadan.
- [x] **Atom/orbital PDOS teknik ilk paket:** `projwfc.x` atom indeksi ve elementleri son SCF atom sırasıyla doğrulanır; s/p/d/f LDOS toplamları `pdos.pdos_tot` ile karşılaştırılır ve Mo-d, S-p, O-p ile tek atom görünümleri sağlanır. Yalnız kollineer-spin-polarize olmayan sonuçlar; gerçek MoS₂ DFT koşumu henüz doğrulanmadı.
- [ ] Quantum ESPRESSO `bands.x`, `dos.x`, `projwfc.x` çıktılarının kaynak/birim doğrulamalı içe aktarımı.
- [ ] Band / DOS / PDOS grafiklerinin ortak enerji referansı, spin kanalı, orbital ve atom projeksiyonları; yoğunluk–bant enerjisi ayrımını koru.
- [x] **MoS₂ serisi P2 teknik karşılaştırma:** tamamlanmış QE sonuçları, Mo/S/O bileşimi, aynı hücre ve SCF/NSCF/son işlem parametreleri, UPF ve SHA-256 kontrolleri; kullanıcı tarafından belirtilen kusur merkeziyle periyodik yakın/uzak atom grupları ve yaklaşık atom eşlemesi. **Belgelendirilmiş vakum potansiyeli referansı yoksa enerji grafikleri hizalanmaz.** Sentetik Python/JS testleri eklendi; gerçek MoS₂ DFT hesaplaması ve fiziksel doğrulama henüz yapılmadı.
- [ ] Pristine–V_S–V₂S–O_S–O₂@V_S vakans/adsorpsiyon modellerini yakın/uzak kusur atomları üzerinden **atom bazlı** PDOS ile karşılaştır: atom numaraları ve ham QE enerji sıfırları farklı hesaplar arasında doğrudan eşitlenemez.
- [ ] Kusursuz–`V_{2S}`–`O_2@V_S` karşılaştırması, kusur kaynaklı lokalize durumlar; elektron yoğunluğunu CUBE/XSF ile birlikte göster.
- [ ] Şekil 4'ün k yolu ve süperhücre bant katlanması sorununu açıkça ele al; gerektiğinde band unfolding.
- [ ] Önce sayısal yeniden üretim, ardından bağımsız ikinci çözücü (SIESTA/GPAW) kontrolü; farklı yöntemleri aynı çıktı gibi sunma.

### M-P3 — Optik ve makaledeki deneysel verilerle karşılaştırma

- [ ] Makalenin Şekil 1–3 PL pikleri, çizgi genişlikleri, ömürler, doz/süre verileri için **kaynak etiketli deneysel veri** içe aktarma ve grafik; veri varsa Supporting Information ile doğrula, grafikten değer uydurma.
- [ ] Şekil 4(b,f)'deki yaklaşık optik geçiş enerji farklarını hesaplamak için yöntem sınırları; yalnız Kohn–Sham orbital farkını doğrulanmış PL enerjisi diye adlandırma.
- [ ] Optik geçiş, eksiton ve fonon etkileri için uygun ΔSCF, GW/BSE ve elektron–fonon yöntemlerini ayrı modüller olarak tasarla.
- [ ] PL eğrisi uydurma ve `g^(2)(tau)` analizini **ölçülmüş dosyalara** uygula; girdi olmadığında deney/tek foton üretimi varmış gibi simüle sonuç sunma.
- [ ] UV kaynaklı kusur oluşumunu statik atom silme eylemiyle eşitleme; reaksiyon bariyerleri/kinetik/uyarılmış durumlar ayrı araştırma konusudur.

### M-P4 — AI/ML/vekil model ve aktif öğrenme

- [ ] DFT verisinin provenance, split ve kör dış-test tasarımı; aynı yapının türevleri eğitim/test sızıntısı yapmamalı.
- [ ] GPR, CatBoost ve grafik modeli için kusur oluşum enerjisi / elektronik seviye baseline'ları; MAE, RMSE ve genelleme.
- [ ] Belirsizlik kalibrasyonu ve conformal prediction; model belirsizliği doğrulanmamışsa güvenilirlik iddiası yok.
- [ ] Aktif öğrenme: rastgele/çeşitlilik/en yüksek belirsizlik seçimini **eşit DFT maliyeti** ile karşılaştır; yeni hesaplama karar kapısı.
- [ ] LLM yalnız girdi planlama, dokümantasyon ve araç orkestrasyonu için; fiziksel hesap sonucu ve doğrulama kaynağı değildir.

### M-P5 — Yayınlanabilir bilimsel doğrulama koşulları

- [ ] Tek katmanlı referans, kusur geometrisi, atom sayısı ve komşuluk testleri; bağımsız ASE/pymatgen kıyası.
- [ ] Makale Şekil 4 için veri/sürüm/hesaplama/çizim tekrarlanabilirliği, PBE bant aralığı ve optik yorum sınırlamaları.
- [ ] Negatif kontroller: vakumsuz/hacim MoS₂, `O_S` vs `O_2@V_S`, farklı komşuluk ve spin durumları.
- [ ] Deneysel X_vacuum / X_air PL, ömür ve antibunching iddialarının yalnız kaynaklandırılmış **deney kanıtıyla** sunulması; KristalYapı'da DFT/deney ayrımı açık.

---

## D — DFT web platformu: QE hesabını KristalYapı'ya bağlama

**Plan tarihi:** 28 Ekim 2026. **Amaç:** Statik GitHub Pages üzerinde
çalışan KristalYapı'yı bozmadan, isteğe bağlı bir web API üzerinden gerçek
DFT hesaplarını Linux VM/HPC'de çalıştırmak, iş durumunu takip etmek ve
sonuçları 3B kristal üzerinde incelemek. Birincil motor **Quantum ESPRESSO**;
**VASP** yalnız kullanıcının lisanslı kurulumuyla çalışan isteğe bağlı
ileriki adaptör olacak. Tarayıcı ve ML modelleri fizik hesabı yapıyor gibi
gösterilmeyecek.

**İlgili mevcut çalışmalar:** [QE runner](docs/qe-runner.md),
[elektronik hesaplama zinciri](docs/qe-electronic.md),
[`tools/qe_run.py`](tools/qe_run.py),
[`tools/qe_pipeline.py`](tools/qe_pipeline.py).
Bu bölüm **genel DFT web/API altyapısıdır**. Yukarıdaki **M-P0–M-P5**,
özellikle MoS₂ makalesinin *bilimsel yeniden üretimi* ve optik deney
karşılaştırması için ayrı kalır. Yeni platform mevcut runner/pipeline'ı
tekrar yazmamalı; gerekli adaptörler ve testlerle yeniden kullanmalı.

### D-UX P0 — Hesap hazırlama ve iş durumu arayüzü

- [x] **Sunucu / yerel dosya ayrımı:** DFT hazırlığında iki açık yöntem. Sunucu iş türü tek seçimden SCF, sabit-hücre relaksasyon → SCF veya elektronik zincir olarak belirlenir; yerel QE `.in` hesap türü/doluluğu/UPF dosya adları yalnız dosya dışa aktarımını etkiler.
- [x] **İlgili alanları göster:** Kuvvet eşiklerini yalnız relaksasyonda; iyonik adım ve enerji eşiğini sunucu relaksasyonunda göster. Var olan değerleri ve referans protokolünü mod geçişlerinde koru.
- [x] **İş açılma kapısı:** QE motoru hazır, iş gönderimi açık, kaynak profili yürütmeye izin veriyor ve anahtar biçimi geçerli olmadan İşler sayfasını etkinleştirme.
- [x] **Ön kontrol durumu:** İş durumundan ayrı ön kontrol göstergesi; yapı, adres veya ilgili parametre değişiminde eskimiş ön kontrolün durumunu yenile. Gerçek gönderimde sunucu ön kontrolünü tekrar koş.
- [x] **Görsel iyileştirme:** Form etiketleri, yardımcı metinler ve eylemlerin okunabilirliği; dar ekranlarda hazırlık yöntemi seçeneklerini tek sütuna indir.
- [x] Tarayıcı regresyonunda yöntem geçişi, sunucu/yerel alan ayrımı, kısa anahtar, bozulmuş çözücü, yalnız hazırlık kaynak profili ve eskimiş ön kontrol durumunu kapsa.
- [x] **Takip P1:** Tek operatörlü iş adı, sunucu tarafında filtre/arama/sayfalama, kalıcı geçmiş ve sürümlü hesap snapshot/provenance özeti; bant/DOS sonuç görünümü mevcut D4 ile korunuyor. Çok kullanıcılı proje izolasyonu sonraki aşama.
- [ ] **Takip P1:** Kullanıcı etkileşimli hesap türü ve preflight durumları için daha kapsamlı TR/EN metin bütünlüğü; gerçek Chromium + API CI koşularını merge öncesi doğrula.

### D-UX P3 — İş geçmişi ve CalculationSummary kanıt özeti
- [x] SQLite iş kayıtlarını kaybetmeden görünen iş adı / hesap türü alanlarını migrate et.
- [x] Sunucu tarafında sınırlı durum/hesap türü/isim-ID-hash arama ve sayfalama; eski 20 kayıtlı uç nokta davranışını koru.
- [x] Sürümlü salt okunur `kristalyapi.calculation-summary.v1`: kaydedilen girdi, yapı/profil kimliği, UPF/çıktı hash'leri ve yalnız eşleşmiş tamamlanmış sonucun fiziksel ölçümleri.
- [x] Frontend iş filtreleri, sayfa gezinimi, isteğe bağlı adlandırma ve kimlikli kanıt özeti; eski işler için geriye uyumluluk.
- [ ] **P1 sonrası:** Tek operatör modu dışına çıkılacaksa kullanıcı/proje sahipliği, kotası ve iş izolasyonunu ayrıca tasarla; mevcut token modeli çok kullanıcılı değildir.
- [ ] **P1 sonrası:** Bağımsız ham eser/JSON kanıt doğrulaması ve dışa aktarılabilir imzalı manifest; özet ekranı tek başına bilimsel kabul değildir.

### D-UX P2 — Gerçek hesap kanıtlarından eksen ve iyonik geçmiş

- [x] `crystal_b` yol ağırlıklarını gerçek `bands.x` örneklenmiş x-ekseni ve hücreye özgü reciprocal metrikle çapraz doğrulayarak yalnız kanıtlı `k_path_nodes` üret.
- [x] Spin bantları ve eski elektronik JSON şemasında geriye dönük uyumluluğu koru; doğrulanamayan node için eksen işaretini çizme.
- [x] Sabit hücreli gerçek relaksasyon stdout'undan enerji/kuvvet çiftleri eksiksizse ham stdout hash'iyle bağlı `ionic_history` üret; eksik veri varsa atla.
- [x] Relaksasyon Sonuçlar panelinde gerçek adımları ayrı Ry ve Ry/Bohr grafikleriyle göster; final bağımsız SCF değerini iyonik seriye katma.
- [x] Negatif Python/Node/Chromium testleri ve TR/EN/PWA/doküman güncellemeleri.
- [ ] İleride adım başına atomik kuvvet/konum arşivini ayrı ham kanıt sözleşmesiyle ele al; yalnız toplam kuvvetten atom başına kuvvet üretme.
- [ ] K-yolu düğümleri için bağımsız `bands.x` ham k-vektör kanıtını da saklama; deneysel yüksek simetri sınıflandırması yapmama.

### D-UX P1 — Sonuçlar ekranının bilimsel sunumu

- [x] Bant eğrilerini tek fiziksel anlamı olmayan farklı bant renkleri yerine tutarlı renkle çiz; DOS/PDOS serilerini birbirinden ayır.
- [x] Gerçek örneklenmiş k-uzaklık/etiket eşleşmesi varsa yüksek-simetri çizgilerini göster, yalnız etiket listesinde gösterme; Fermi seviyesi veya bant aralığı üretme.
- [x] Kaynak/ham QE enerji referansını öne çıkar, indirilen ham CSV/plot verisini değiştirme.
- [x] Son relaksasyon görünümünde minimum-görüntü Å vektörlerini aç/kapat, maksimum/ortalama hareket özetini ve Δr sıralı atom tablosunu ekle.
- [x] Geriye uyumlu parser, spin verisi, masaüstü/mobil ve sentetik periyodik sınır UI testleri ekle.
- [x] **D-UX P2:** Gerçek QE örneklenmiş k-ekseni ve hücre metriğiyle doğrulanan düğümler (PR #145).
- [ ] **Sonraki paket:** Enerji referansları (Fermi/vakum) ve bant kenarı gibi analizleri yalnız bilimsel protokol ve ham kanıtla doğrulanmış durumda eklemek.
- [x] **D-UX P2:** Ham `relax.out` hash'iyle bağlı tam enerji–kuvvet adımları varsa çizilir (PR #145).

### D0–D1 — Docker QE kurulumu ve read-only bağlantı (ilk altyapı)

- [x] İlk konteyner: Debian Trixie QE 6.7-3+b1 sürümünü paket düzeyinde sabitleyen Dockerfile; `pw.x`, `bands.x`, `dos.x`, `projwfc.x` varlık kontrolleri ve `pw.x` banner smoke. **Bu gerçek SCF/relax fizik koşumu değildir.**
- [x] FastAPI salt-okunur `GET /api/health`, `GET /api/capabilities`: QE sürüm, binary durumu ve API şemasını sunma; kimlik doğrulamasız iş yürütme uç noktası yok.
- [x] Docker Compose varsayılan loopback binding, isteğe bağlı LAN IP/port, kesin origin CORS, host doğrulama, root olmayan kullanıcı, salt-okunur kök FS ve kaynak sınırları.
- [x] KristalYapı DFT panelinde IP/port ve **kullanıcı tıklamasıyla bağlantı testi**; sonuçlar tarayıcıda gösterilir, iş/model/UPF gönderilmez ve sunucu adresi saklanmaz.
- [x] Python API mock smoke + tarayıcı ağ/şema/negatif senaryo testleri, offline cache, EN/TR, Docker ve browser kısıtları belgelendi.
- [ ] **Gerçek Docker doğrulaması:** x86_64/arm64 hostta `docker compose build/up`, gerçek `pw.x` banner, yerel CORS ve Chrome LNA izin akışı; Docker çalıştırılmadan doğrulandı sayılmamalı.
- [ ] **Bilimsel D-P0 kabulü ayrı:** gerçek UPF ile Si SCF / MoS₂ SCF ve yakınsama deneyleri; bu D0–D1 API hiçbir fizik hesabı başlatmıyor.
- [x] Merge sonrası MoS₂ serisi CI regresyonu: pristine atom eşleme döngüsü bitmeden erken silinmemeli (`KeyError: atoms`).

**Sınır:** Bu paket D-P1 iş API'sini tamamlamaz. İlk gerçek job gönderme ancak şemalı girdi, yetki, kotalar, güvenli UPF profili, kuyruğa alma ve gerçek QE doğrulama sonrası gelecek.

### D-P0 — Mevcut yetenekleri ve sınırlarını sabitle

- [x] CIF/COD, P1, vakum/kusur araçları ve CIF/POSCAR dışa aktarımı.
- [x] DFT panelinden QE `pw.x` için sabit hücreli `relax` / `scf`
  girdisi üretme; yerel tamamlanmış `.out` dosyasını okuyup uygun son
  koordinatları kullanıcı onayı ve Undo ile uygulama.
- [x] Gerçek yerel QE'yi çalıştırmaya hazır `tools/qe_run.py`:
  girdi/UPF staging, SHA-256, ayrı iş dizini, timeout, çıktı/
  yakınsama kontrolü ve fake-solver testleri. **Web servisi değildir.**
- [x] `tools/qe_pipeline.py`: isteğe bağlı `relax → scf → bands/bands.x
  → nscf → dos.x/projwfc.x` zinciri; JSON sonuçları ve yerel bant/DOS
  görselleştirme. Testler tek başına gerçek DFT doğrulaması değildir.
- [ ] API'ye bağlanabilecek CLI ve parser fonksiyonlarının envanteri:
  mevcut seçenekler, kabul edilen girdi alt kümesi, yakınsama statüleri,
  desteklenmeyen `vc-relax`/spin/SOC vb. ve sürüm sınırları.
- [ ] Gerçek QE kurulumunda **Si SCF** ve ayrı **MoS₂ SCF/relax**
  smoke testlerini, solver sürümü/UPF hash'i ve fiziksel sınırlarıyla
  çalıştır; mock test ile gerçek koşumu açıkça ayır.

**Kabul:** Mevcut çevrimdışı/PWA uygulaması ve elle dosya indirip içe
aktarma akışı aynen çalışır; henüz backend varmış gibi gösterilmez.

### D2 — İlk güvenli SCF iş hattı ve kalıcı görev kuyruğu (teknik başlangıç)

- [x] Sürümlü, yalnız desteklenen PBE/spinsiz/SCF parametrelerini kabul eden yapı JSON şeması, 64 atom sınırı, sonlu koordinat ve hücre/atom doğrulamaları; kullanıcı kontrollü QE input, shell veya dosya yolu kabul etmeme.
- [x] Opt-in kimlikli `POST /api/v1/calculations/validate`, `POST /api/v1/calculations` (202), `GET /api/v1/calculations/{id}`, sonuç, log kuyruğu, liste ve iptal; varsayılan GET-only keşif modu korunur.
- [x] SQLite kalıcı tek-worker kuyruğu, iş durumları ve restart sonrası yarıda kalan işi başarısız olarak işaretleme; kaynak kimlik hash'i ve gerçek çıktı/UPF SHA-256.
- [x] Operatörün önceden temin ettiği gerçek UPF ve açıklanan lisans/kaynakla sunucu profili, SHA-256 kontrolü; pseudopotansiyel seçimi istemciye bırakılmaz.
- [x] Docker üzerinde ayrı worker, kabuksuz `pw.x`, process-group iptal ve timeout; 10 bekleyen iş limiti, konteyner CPU/RAM/process sınırları.
- [x] DFT panelinde açık onayla SCF işi gönderme, durum/result ve iptal; erişim token'ı saklanmaz ve HTTP üzerinden özel LAN IP'ye gönderilmez.
- [x] Node API istemci testleri, Python API/worker/sentetik solver/UPF testleri, Compose ve PWA dağıtım entegrasyonu.
- [ ] **Kapsamlı bilimsel kabul:** Si Docker/API SCF ve sınırlı enerji hassasiyeti D2.1 ile doğrulandı. MoS₂ SCF/relax, farklı pseudopotansiyeller ve fiziksel bağımsız referans doğrulaması ayrı bekliyor.
- [ ] **D3+ sonraki işler:** relaksasyon/bands/DOS/PDOS job pipeline, otomatik geometri önizleme, çok kullanıcılı kimlik/quotas, GPU/HPC/AiiDA, bilimsel yakınsama taramaları ve yalnız sonra vekil modeller. Mevcut D-P1–D-P7 ayrıntılı adımlar korunur.

**Kabul notu:** D2.1, gerçek UPF/QE ile Si SCF iş hattını ve belirtilen sonlu enerji hassasiyeti ölçütlerini doğrular. MoS₂ ve bağımsız fiziksel doğruluk kabulü bu kanıttan çıkarılmaz.

### D2.1 — Gerçek SCF doğrulaması (P0, Si kabulü tamamlandı)

- [x] `tools/qe_scf_acceptance.py --run`: sabit SHA-256'lı gerçek PSlibrary Si PBE UPF; Docker imajı build, yalıtılmış API/worker ve yalnız loopback erişimi.
- [x] Kimlikli API'den ön kontrol → 202 iş gönderme → job ID ile izleme → gerçek sonuç ve tam QE çıktısı; kaynak yapı, girdi/çıktı ve UPF hash kontrolü.
- [x] Yedi gerçek işin tamamında `JOB DONE`, ham SCF yakınsama bildirimi ve son `estimated scf accuracy ≤1e-8 Ry`; API/raw enerji ve Ry/eV dönüşümü uyumu.
- [x] 45/60/75 Ry kesme enerjisi ve 4/6/8/10/12 k-örgüsü taraması. Son iki noktada önceden tanımlı ≤1 meV/atom ölçütü: kesme enerjisi 0.118, k-örgüsü 0.290 meV/atom. İlk 6→8 başarısız kontrolü de kaydedildi; eşik gevşetilmedi.
- [x] ARM64 ve Linux x86_64 üzerinde ayrı ayrı yedi gerçek iş; kalıcı ham kanıtlar, çevrimdışı tekrar doğrulama, sahte/tutarsız/eksik kanıtı reddeden 11 birim testi ve başarılı [Linux CI/artifact koşusu](https://github.com/alorak/kristalyapi/actions/runs/40766130544).

**Kanıt ve tekrar çalıştırma:** [D2.1 kılavuzu](docs/qe-scf-validation.md), [gerçek koşu raporu](validation-results/qe-si-d21-20261028-arm64/README.md). Bu kabul yalnız sabit Si protokolünü kapsar; MoS₂, relaksasyon ve genel fiziksel doğruluk ayrı kalır.

### D2.2 — Pristine 1H-MoS₂ gerçek SCF kabulü (7/7 SCF tamamlandı, kesme enerjisi kapısı başarısız)

- [x] D2.1'deki gerçek Si kabul API/Docker/worker alt yapısını yeniden kullanan **MoS₂ kabul planı**: ideal üç atomlu 1H yapı, sabit PBE, 8/12/16×k×1, 60/80/100 Ry ve c=18/24/30 Å; vaka parametreleri ve test öncesi duyarlılık ölçütleri.
- [x] Gerçek Mo ve S PSlibrary 1.0.0 UPF kaynak URL/lisans; **her iki SHA-256 operatör tarafından açıkça sağlanmadan hesap başlatma**. Dosyalar doğrulanmadan "pinned" denilmez.
- [x] `tools/qe_mos2_acceptance.py --run/--verify`: gerçek QE/API işlerinin ham çıktısı, SCF yakınsama, Ry/eV, input/cell/atom/k-örgüsü, pseudo ve çıktı hash'leri ve ortak kabul eşiği kanıt denetimi.
- [x] `tests/test_qe_mos2_acceptance.py` negatif/sentetik testleri, manuel iş akışı ve CI/usage rehberi; **gerçek veri oldukları iddia edilmez**.
- [x] **Gerçek manuel koşu ve kanıt incelemesi:** resmi Mo/S UPF baytları ve metadata'sı doğrulandı; [Linux CI](https://github.com/alorak/kristalyapi/actions/runs/40770083516) üzerinde 7/7 gerçek SCF işi tamamlandı. Ham QE/API, 26 elektron, SHA-256 ve ≤1e-8 Ry SCF hata tahminleri yerelde tekrar doğrulandı. [Kalıcı kanıtlar](validation-results/qe-mos2-d22-20261029-amd64/README.md).
- [ ] **D2.2 genel bilimsel kabul:** kesme enerjisi 80→100 Ry farkı **2.374556 >1 meV/atom**, kabul başarısız. K-örgüsü **0.000635 ≤1**, vakum **0.000363 ≤2 meV/atom** geçti. D2.2b yeni ön kayıtlı taramasında 120→140 Ry **0.268123 ≤1** geçti; D2.2c yeni 120/960 Ry, k=16/c=24 referansında üç kapıyı da geçti. Genel fiziksel doğruluk/kuvvet/relaksasyon ayrı kalır. İlk başarısız sonuç ve eşikler değiştirilmedi.
- [x] **D3:** `relax → scf` worker, atomik kuvvet/geometri doğrulaması ve kaynak eşleşmeli 3B önizleme; [gerçek MoS₂ kabulü 8/8 geçti](validation-results/qe-mos2-d3-20261029-amd64/INCELEME.md).
- [x] **D4 sonlu işleyiş/veri kabulü:** gerçek 6 aşama, 26×61 bant, 3677 DOS ve üç atomun orbital PDOS'u; [ham QE/API kabulü geçti](validation-results/qe-mos2-d4-20261029-amd64/INCELEME.md). Geniş bant/DOS yakınsaması, spin/SOC ve optik doğruluk ayrıca bekliyor.
- [ ] **D5:** V_S / V₂S / O_S / O₂@V_S kusur karşılaştırması ve spin/SOC; bağımsız araştırma kabulü.

**Bilimsel sınır:** D2.2'nin ideal monolayer SCF enerji duyarlılığı optik/tek-foton doğrulaması veya makalenin SIESTA sonuçlarının yeniden üretimi değildir. [Kabul protokolü](docs/qe-mos2-validation.md).

### D2.2b — MoS₂ yüksek kesme enerjisi yakınsaması (geçti)

- [x] İlk D2.2'nin 80→100 Ry başarısızlığını koruyarak yeni 100/120/140 Ry, ecutrho=8×ecutwfc, k=8×8×1 ve c=24 Å sabit planını gerçek koşudan önce kaydet; aynı doğrulanmış Mo/S hash'lerini ve 120→140 Ry ≤1 meV/atom birincil ölçütünü sabitle.
- [x] İlk gerçek koşuyu incele: 100 ve 120 Ry yakınsadı; 100 Ry önceki enerjiyi tam tekrarladı. 140 Ry 900 saniyede `timed_out`; birincil kapı belirlenemedi. [Korunan ham kanıtlar](validation-results/qe-mos2-d22b-first-timeout-20261029-amd64/INCELEME.md).
- [x] Fiziksel plan/eşik değiştirilmeden yalnız kabul ortamına 6 GiB RAM, swap kapalı ve 3600 saniye/iş tanımlayan ayrı v2 ön kaydı; üretim Compose dosyası değişmez.
- [x] [İkinci gerçek Linux koşusu](https://github.com/alorak/kristalyapi/actions/runs/40783454635): **3/3** SCF, ham QE/API/hash ve 26 elektron denetimi geçti. **120→140 Ry: 0.268123 ≤1 meV/atom**. 100 Ry önceki enerjiyi tam tekrarladı. [Kalıcı kanıt ve inceleme](validation-results/qe-mos2-d22b-20261029-amd64/INCELEME.md).
- [x] Eksik işte kabul enerjisi üretmeyen `failure.json`, SCF iterasyonu/hatası ve kısmi çıktı hash tanısı; worker API hata açıklamasında süre sınırı. **84 Python QE testi** geçti.
- [x] Yüksek kesme enerjisinde k/vakum ve yoğun örgüde cutoff D2.2c ile doğrulandı; sonlu SCF enerji referansı kabul edildi. Kuvvet/relaksasyon ve bağımsız fiziksel doğruluk ayrı kalır.

**Protokol ve kapsam:** [D2.2b kılavuzu](docs/qe-mos2-cutoff-validation.md). İlk D2.2'nin 100 Ry'deki k/vakum sonuçları yeni yüksek-cutoff protokolünün yerine geçmez; kuvvet/relaksasyon kabulü ayrıca gerekir.

### D2.2c — Yüksek-cutoff k/vakum ve ortak SCF referansı (geçti)

- [x] Altı gerçek iş ve üç karar çiftini koşudan önce sabitle; cutoff'u seçilen yoğun örgüde yeniden denetle.
- [x] [Linux CI](https://github.com/alorak/kristalyapi/actions/runs/40786532333) üzerinde **6/6 SCF**; ham QE/API/26 elektron/SHA-256 ve kaynak kimliği yerelde yeniden doğrulandı.
- [x] Kesme enerjisi **0.267715 ≤1**, k-örgüsü **0.000907 ≤1**, vakum **basılı hassasiyette 0.000000 ≤2 meV/atom** geçti. [Kalıcı kanıtlar](validation-results/qe-mos2-d22c-20261029-amd64/INCELEME.md).
- [x] D3 öncesi sonlu enerji referansı: **120/960 Ry, 16×16×1, c=24 Å**, -181.58163993 Ry. 120/k8 tekrarı önceki D2.2b ile tam eşleşti.
- [x] Bu referanstan D3 gerçek relaksasyon/kuvvet/geometri kabulü: son max kuvvet bileşeni 1.29e-5 Ry/Bohr; 120→140 Ry farkı 0.267443 meV/atom; sekiz ölçüt geçti. Bağımsız fiziksel doğruluk ve elektronik/optik kapsam ayrıca bekliyor.

### D5.1 — Kaynak eşleşmeli kusur adayları (kod ve geometri hazırlığı)

- [x] Kabul edilmiş D3 summary/result/yapı hash'ine bağlı 4×4 P1 süperhücre; pristine / V_S / aynı katmanda en yakın iki S boşluğu / O_S başlangıç adayları.
- [x] Sabit kaynak atom kimlikleri, çıkarılan/ikame atom kaydı, CIF/JSON ve aday relax istekleri; yeniden üretim ve tüm dosya hash'leriyle çevrimdışı doğrulama.
- [x] O₂ adayında iki açık kesirli koordinat zorunlu; otomatik bağ geometrisi veya adsorpsiyon kabulü yok.
- [x] Resmi O PBE/skaler UPF bayt/header SHA-256 incelemesi; fiziksel kusur uygunluğu ayrıca bekliyor.
- [x] Valans elektron/bant kapasitesi ön kontrolü: 4×4 pristine 416 elektron / en az 208 dolu bant; mevcut 128 bant elektronik API sınırına sığmaz. Kaynak limitleri yükseltilmedi.
- [x] Ön kayıtlı 4×4, 416 bant, `nstep=0` gerçek başlangıç pilotu: 4/4 aday 6 GiB/no-swap sınırında OOM/exit137; SCF başlamadı. Ham bellek tahminleri 71.76–80.49 GB; ölçülmüş peak değildir. [Başarısız kaynak pilotu](validation-results/qe-mos2-d5-init-first-20261029-arm64/INCELEME.md) korunur, sınır artırılmadı.
- [x] Başarısız başlangıçta sayı/bellek tanısı, timeout/cleanup testleri ve beklenmeyen SCF çalışmasını başlangıç gibi göstermeyi reddetme.
- [x] D4 kabulüne bağlı, çalıştırması kapalı [D5 hesap protokolü](docs/qe-defect-compute-protocol.md) ve her adayın sunucu derleyicisiyle üretilmiş `candidate-relax.in` dosyası; source manifest hash'i korundu.
- [ ] Gerçek kusur relax/SCF/elektronik sonuçları; spin/doluluk, süperhücre boyutu, k-örgüsü/cutoff yakınsaması ve büyük hücre kaynak profili kabulü.

[Üretim ve doğrulama rehberi](docs/qe-defect-preparation.md). Hazırlanan modeller hesap sonucu değildir.

### D5.2 — Dondurulmuş OOM kanıtından kaynak karar tablosu (çalıştırmasız)

- [x] 2026-10-29 başarısız `nstep=0` pilotunun dört vaka için girdi/stdout/stderr SHA-256, Docker OOM/exit137/izolasyon, kaynak commit, UPF ve QE atom-elektron-bant sayılarını çevrimdışı çapraz doğrula.
- [x] QE'nin `>` işaretli işlem başına **ondalık GB** bellek tahminlerini, ölçülmüş peak RAM gibi sunmadan hipotetik GiB bütçeleriyle karşılaştır; gerçek 6 GiB OOM ile yeni yapılmamış denemeleri ayır.
- [x] Sürümlü makine-okunur değerlendirme `kristalyapi.qe-d5-resource-review.v1`, fail-closed bozulma testleri ve CI; [kılavuz](docs/qe-defect-resource-review.md).
- [x] Varsayılan 128 bant / 64 atom API limitlerini, QE Docker worker'ını ve tüm gerçek koşumları değiştirmeden tut.
- [x] **D5.3 kod/CI:** Tek aday için `--execute --acknowledge-resource-risk` ile açık onay isteyen, image/UPF hash ve Docker kapasitesini doğrulayan, cgroup-v2 bellek `memory.peak` / CPU / scratch / OOM / süre kanıtlarını ve ham çıktıları kaydeden ölçümlü `nstep=0` pilot aracı; varsayılanda yalnız plan, **yeni gerçek koşum yapılmadı**. [Rehber](docs/qe-defect-metered-pilot.md).
- [ ] **D5.3 gerçek operatör koşumu:** Yeterli izolasyonlu hostta tek aday için gerçek kaynak pilotunu operatör onayıyla çalıştır, `initialized_only_metered` / OOM / eksik kanıt durumunu ölçerek arşivle. Başlatma başarısını tam SCF veya bilimsel kabul sayma; MPI/rank dağılımı henüz test edilmedi.
- [ ] **D5.4:** Spin/doluluk ve dolu/boş bant protokolünü belirle; büyük hücre elektronik API limitlerini yalnız doğrulanmış profil ile ayrı güvenlik kabulünden geçir.
- [ ] **D5.5:** Gerçek kusur relaksasyon → bağımsız SCF → elektronik zinciri, cutoff/k-mesh/süperhücre/DFT+spin karşılaştırma kabulü; henüz yapılmadı.

### D-P1 — İlk çalışan web dilimi: tek SCF işi (gerçek QE bilimsel kabul bekleniyor)

- [ ] **Sürümlü motor-bağımsız JSON girdi şeması (v1):** hücre
  vektörleri (Å), atom sırası/türü, koordinat sistemi, periyodiklik,
  `structure_hash`/snapshot, iş türü, fonksiyonel, k-ağı,
  `ecutwfc`/`ecutrho` (Ry), spin ve pseudopotansiyel profil kimliği.
  Kesirli doluluk, desteklenmeyen simetri, eksik/NaN koordinat, atom/
  hücre tutarsızlığında hesaplamayı reddet; sunucu da doğrulasın.
- [ ] Frontend'den ayrı **Python/FastAPI** servisi (örn. `server/`);
  ilk aşamada yalnız gerçek `pw.x` **SCF** hesabını başlat.
  GitHub Pages'in statik ve sunucudan bağımsız çalışma biçimi değişmesin.
- [ ] Minimal API: `GET /api/v1/engines`,
  `POST /api/v1/calculations/validate`,
  `POST /api/v1/calculations` (**202 + job_id**),
  `GET /api/v1/calculations/{id}`,
  `GET /api/v1/calculations/{id}/results`.
  Hesaplamayı HTTP isteğinin içinde bekletme; ilk sürüm tek VM/tek
  worker olabilir, P2'de kalıcı kuyruk eklenecek.
- [ ] Sunucuda **izinli pseudopotansiyel profili**: gerçek UPF, kaynak,
  lisans, XC uyumu ve SHA-256 kontrolü; varsayılan/uydurma UPF dosyası
  ile yürütme yapma. Backend yalnız şemadan doğrulanmış `.in` üretmeli;
  istemciden shell komutu, keyfî dosya yolu veya executable kabul etme.
- [ ] Benzersiz izole iş dizini, kabuksuz `subprocess`, CPU/bellek/disk/
  süre/eşzamanlılık limitleri, input boyut sınırları, hata kaydı ve
  başarısızlık/timeout durumları. İnternete açılacak API için
  kimlik doğrulama, yetkilendirme, HTTPS, dar CORS, iş kotası ve audit
  kaydı **başlangıçtan zorunlu**.
- [ ] Mevcut DFT panelinden açılan **DFT Çalışma Alanı** (ilk ekran):
  aktif yapıyı önizle, motor=QE, iş=SCF, profil ve ön kontrolü göster,
  kullanıcı onayıyla işi gönder, iş durumu ve gerçek toplam enerji/
  SCF yakınsama sonucunu göster. API yoksa dosyadan çalışma sürer.
- [ ] API sözleşmesi, hatalı JSON/UPF, auth, yol/komut enjeksiyonu,
  timeout, çözücü hatası ve sahte `JOB DONE.` için testler.
  Gerçek QE smoke testi ayrı ve kurulum varsa koşulsun.

**P1 kabul kapısı:** Gerçek kurulu QE üzerinde bir Si `scf` işi,
KristalYapı'dan onayla başlatılıp `job_id` ile izlenebilir; sonuç
yalnız gerçekten üretilen `pw.x` çıktısından okunur ve başarısızlıklar
başarı diye gösterilmez. API devre dışıyken statik uygulama çalışır.

### D-P2 — Kalıcı işler, kuyruğa alma ve geçmiş

- [ ] SQLite destekli kalıcı iş kayıtları + ayrı worker; tanımlı durumlar:
  `created`, `queued`, `running`, `completed`, `failed`,
  `timed_out`, `cancelled`, `not_converged`. Workflow alt aşamalarının
  durumu ve yarım kalan işlerin yeniden başlatılma politikası belirli olsun.
  `completed`, **bilimsel yakınsama çalışması yapıldı** demek değildir.
- [ ] Eşzamanlı iş limiti, kullanıcı kota/önceliği, idempotent gönderim,
  iptal ve güvenli temizleme; gerçek log ve polling/SSE; bilimsel solver'ın
  vermediği ilerleme yüzdesini uydurma.
- [ ] `GET /api/v1/calculations/{id}/artifacts` ve
  `POST /api/v1/calculations/{id}/cancel`; yalnız iş sahibine
  erişilebilir ham çıktı ve loglar; artifact boyutu/saklama politikası.
- [ ] Job ile kaynak yapı hash'ini, ayar snapshot'ını, çalışma alanı
  kimliğini ve tarih bilgisini ilişkilendir. Kullanıcı kristali sonradan
  değiştirirse eski çıktıyı yeni geometriye otomatik bağlama.
- [ ] Yeniden başlatma, eşzamanlı iki kullanıcı, yasak artifact erişimi,
  iptal/timeout ve yeniden deneme için entegrasyon testleri.

**P2 kabul:** Restart sonrası geçmiş korunur; iş durumu tutarlıdır
ve kullanıcılar birbirlerinin sonuçlarını göremez.

### D-P3 — Standart sonuç modeli ve görselleştirme

- [ ] Motor-bağımsız, sürümlü `CalculationResult`:
  `job_id`, `structure_hash`, engine/version, calculation,
  input snapshot, fonksiyonel, UPF SHA-256, k-ağı, SCF/iyonik yakınsama,
  enerji (eV), kuvvet (eV/Å), gerilim, son atomik yapı, Fermi referansı,
  zaman/süre, hata, provenance ve artifact referansları.
  Hesaplanmamış alanlar zorunlu doldurulmasın.
- [ ] Mevcut `electronic-results.json` formatını geriye uyumlu bağla;
  gerçek `bands.x`/`dos.x`/`projwfc.x` çıktıları için kaynak ve birim
  doğrulaması yap. k-yolu, atom/orbital, spin ve enerji referansı
  etiketlenmeden fiziksel karşılaştırma sunma.
- [ ] QE relaksasyon sonucunu aktif 3B yapının yanında **önizle**;
  final koordinatları/hücreyi kullanıcı onayıyla, Undo/Redo ve
  eşleşen `structure_hash` kontrolüyle uygula. `vc-relax` desteği
  ayrı validasyon ister.
- [ ] CUBE/XSF/yük yoğunluğu/dalga fonksiyonu gibi büyük dosyaları JSON
  içine gömme; artifact referansıyla, boyut sınırı ve gerektiğinde
  hacimsel veri indirgeme ile işle.
- [ ] Hatalı/eksik/uyumsuz veri, farklı yapı, near-convergence,
  farklı enerji sıfırı, büyük dosya ve spin kanalları için negatif testler.

**P3 kabul:** Gerçek QE çıktısı hem kaynağı doğrulanabilir
sayısal grafiklerde hem de doğru kaynak yapıyla 3B görüntüde incelenir.

### D-P4 — Bilimsel parametreler, yakınsama ve tekrarlanabilirlik

- [ ] Pseudopotansiyel/XC ailesi, `ecutwfc`/`ecutrho`, k-örgüsü, spin,
  SOC, sınır koşulları, k-yolu ve kuvvet/SCF toleranslarını açıklayan
  kontrollü **temel/gelişmiş** hesap profilleri; öneri=yakınsama
  kanıtı değildir.
- [ ] Ecut, k-ağı, vakum, süperhücre ve kuvvet toleransı taramalarını
  ayrı iş serisi yap; ölçülen duyarlılık/toleransı ve başarısızlıkları
  açıkça raporla. 2B/yüklü kusurlarda uygun düzeltmeler yoksa uyar.
- [ ] Girdi/çıktı hash'leri, QE sürümü, UPF sürümü ve lisansı,
  kullanılan tam hesaplama parametreleri, MPI/CPU/ortam ve tarihle
  **yeniden üretilebilir hesap manifesti**.
- [ ] Gerçek solver kurulumu olan ayrı test ortamında Si/MoS₂ referans
  koşumları; gerçek sayısal sonuç, bağımsız kontrol ve negatif testler.
  CI'daki mock hesaplar fiziksel doğrulama sayılamaz. MoS₂'nin
  makale protokolü ve yayın kanıtı için `M-P1` ve `M-P5` izlenmeli.

### D-P5 — Kusur/malzeme sonuçlarını karşılaştırma

- [ ] Aynı araştırma projesinde kusursuz MoS₂ ve `V_S`, `V_2S`,
  `O_S` gibi kusurlu varyantlara ayrı yapı/job kimliği; karşılaştırılabilir
  hücre, atom sırası, spin, fonksiyonel, pseudo ve k-örgüsü ön denetimi.
- [ ] Relaksasyon öncesi/sonrası 3B örtüşme, atomik yer değiştirme ve
  kuvvetleri; bant/DOS/atom-orbital PDOS karşılaştırmalarını seçilebilir
  grafiklerde sun. Farklı işlerin Fermi/vakum sıfırlarını eşit varsayma.
- [ ] Kusur oluşum enerjisi yalnız kimyasal potansiyeller, yük durumları,
  Fermi seviyesi ve gerekli sonlu-boyut düzeltmeleriyle hesaplanabilir;
  farklı atom sayılı yapıların ham toplam enerjisini çıkarma.
- [ ] Spin/SOC, 2B elektrostatik, defect localization ve band unfolding
  ayrı araştırma/analiz modülleri; DFT DOS sonuçlarını doğrulanmış
  fotolüminesans veya tek-foton yayılımı olarak yorumlama (`M-P2/M-P3`).

### D-P6 — AiiDA, HPC ve VASP adaptörü (gereksinim doğunca)

- [ ] `aiida-quantumespresso` / AiiDAlab QE ile PoC: iş akışı,
  hata kurtarma, veri kökeni, parser kapsamı, operasyonel maliyet ve
  mevcut Python pipeline'a göre kazanımı ölç; çalışan kodu gerekçesiz
  yeniden yazma.
- [ ] Gerektikçe PostgreSQL/AiiDA, HPC/Slurm/MPI veya Kubernetes Jobs
  bağlantısı; uzun `pw.x` süreçleri API sunucusunun içinde çalışmaz.
  Kullanıcı/proje kota, hesap maliyeti, gözlemlenebilirlik ve kaynak
  izolasyonunu ekle.
- [ ] `EngineAdapter` sözleşmesi (`validate/prepare/submit/status/parse`)
  ile QE/VASP ayrımı; VASP çalıştırılabilir dosyası veya POTCAR'ı
  dağıtma, yalnız lisanslı kullanıcının kurulumuna güvenli bağlantı.
- [ ] Çoklu kullanıcı yetkilendirmesi, secret saklama, log temizliği,
  hesaplama kaynağı erişimi ve artifact izolasyonu güvenlik denetimi.

### D-P7 — Fizik bilgili vekil model ve aktif öğrenme (en son)

- [ ] Provenance ve yakınsaması doğrulanmış hesaplardan veri kümesi
  üret; türev yapı/süperhücrelerin eğitim-test sızıntısını engelle;
  kör dış test ve dağılım dışı değerlendirme yap (`M-P4`).
- [ ] GPR/ağaç/graf baseline'ları, MAE/RMSE ve kalibrasyon;
  belirsizliği doğrulanmadan vekil model güvenilir kararı vermez.
- [ ] Eşit DFT bütçesinde rastgele/çeşitlilik/belirsizlik temelli
  aktif öğrenmeyi karşılaştır; model yalnız hesaplama önerir,
  gerçek DFT sonucunun yerini almaz.
- [ ] LLM yalnız dokümantasyon, kontrollü girdi önerisi veya
  araç orkestrasyonu için; bilimsel çözücü/doğrulayıcı değildir.

### D — Bütün aşamalar için yatay kalite koşulları

- [ ] **Güvenlik:** shell komutu/rasgele executable, sunucu dosya yolu,
  izinsiz pseudo, arşiv gezinmesi, sınırsız compute ve yetkisiz artifact
  erişimine karşı test; CORS, kimlik doğrulamanın yerine geçmez.
- [ ] **Lisans:** QE açık kaynak olsa da UPF veri kümelerinin ayrı
  dağıtım koşullarına uy; lisanslı VASP/POTCAR dosyalarını açık
  repoya veya genel container imajına koyma.
- [ ] **Frontend:** TR/EN, mobil, klavye/erişilebilirlik, çevrimdışı
  fallback, servis çalışanı cache sürümü, büyük yapı sınırları ve
  mevcut CIF/Undo/DFT panelinin regresyon testleri.
- [ ] **Kanıt:** Her paket gerçek/mocked test ayrımı, hata durumları,
  sürüm ve belge güncellemesi, açık kabul kapısı içermeli. `JOB DONE.`,
  tek başına bilimsel doğruluğu veya yeterli yakınsamayı göstermez.

**Uygulama sırası:** Önce `D-P0` envanter + gerçek yerel smoke;
ardından **`D-P1` tek gerçek SCF uçtan uca**; sonra `D-P2` iş
yönetimi, `D-P3` sonuç/3B, `D-P4` bilimsel doğrulama, `D-P5`
kusur karşılaştırması; ihtiyaç halinde `D-P6` çoklu kaynak ve
yeterli güvenilir veri oluşunca `D-P7` vekil model.


### TRUBA / SLURM P1 sonuç toplama ve sonraki iş akışı (30 Ekim 2026)

- [x] **P0:** Mevcut DFT P1 yapı girdisinden çevrimdışı `structure.in`,
  `run.slurm`, `manifest.json` ve isteğe bağlı UPF ZIP hazırlığı.
- [x] **P1.1:** Bağımsız Python 3 `collect.py` ile SLURM iş sonunda
  başarı/başarısızlık durumunda `summary.json` üretme. Büyük QE çıktısını
  satır satır tarayarak son enerji, kuvvet ve `JOB DONE`/yakınsama
  işaretlerini, SLURM iş ID'sini ve çıkış kodunu kaydetme.
- [x] **P1.1:** Girdi, varsa sabitlenmiş UPF ve `run.slurm` SHA-256
  kontrolü; hash eksikliği ile hash uyuşmazlığını farklı statülerle gösterme.
- [x] **P1.1:** DFT Sonuçları içinde salt-okunur yerel özet JSON
  doğrulama/görüntüleme; hiçbir geometri uygulaması veya SSH erişimi yok.
- [x] **P1.1:** Sentetik doğrulama testleri, Pages/PWA dosya grafiği,
  CI testi ve kılavuz.
- [x] **P1.2:** `relax → scf → bands/bands.x → nscf → dos.x/projwfc.x`
  aşamaları için kontrollü SLURM koşum paketi, zorunlu açık k-yolu,
  bant sayısı, spin/pseudopotansiyel ve ortak prefix/outdir kuralları.
- [x] **P1.2:** Aşama bazlı `afterok` bağımlılıkları, tekrar çalıştırmayı engelleme,
  başarısız aşamada sonraki hesapları başlatmama ve ara eserlerin hash kanıtı.
- [ ] **P1.2:** TRUBA üzerinde gerçek QE küçük örnek ve Linux/MPI
  sürüm eşdeğerliliği; dosya/sonuç formatı ve fiziksel referans kabul testleri.
- [ ] **P2:** Cutoff/k-point parametre taraması ve SLURM job array;
  geçerli bilimsel yakınsama ölçütleri olmadan otomatik kabul yok.

Ayrıntılar: [TRUBA SLURM kılavuzu](docs/qe-truba-slurm.md).

- [x] **P1.2:** P1.1 tek iş ve P1.2 aşamalı sonuç şemalarının DFT ekranında
  ayrı ayrı doğrulanması; otomatik geometri veya sahte bant grafiği üretme.
- [x] **P1.3:** Ham bands.gnu, dos.dat ve PDOS çıktılarının gerçek QE format
  ayrıntılarıyla denetlenerek existing electronic-results.json grafikleri için
  güvenilir, sınırlı ve bağımsız testli dönüştürücüyle içe alınması.

- [x] **TRUBA P1.3:** P1.2 aşamalı ZIP içine SHA-256 sabitlenmiş
  `electronic.py` / `qe_pdos.py` ekleme; başarılı son aşama için
  `electronic-results.json` zorunluluğu, P1.1/P1.2 geriye uyum.
- [x] **TRUBA P1.3:** Spinli çıktıyı, bozuk k-yolunu ve tutarsız
  atom/orbital PDOS dosyalarını reddeden sentetik regresyon testleri;
  depodaki gerçek spinli Si QE DOS çıktısıyla red doğrulaması.
- [ ] **TRUBA P1.3 kabulü:** Gerçek orfoz SLURM/QE koşumu; en az
  Si ve MoS₂ spin-polarize olmayan referansla baştan sona elektronik
  sonuç JSON ve grafik gözlemi, ölçek/UPF/yakınsama denetimi.
- [x] **P1.4 (kod):** 300 bant üzeri büyük sistemler için açık grafik bant
  penceresi; bilimsel niyetle seçilen nbnd'yi düşürmeden güvenli görünüm.

- [x] **TRUBA P1.4 yazılımı:** Tam `nbnd` korunurken kullanıcı seçimiyle
  1 tabanlı ilk/son bant penceresi; tüm ham bantların düşük bellekle
  taranması, seçili bantların indeksli JSON/CSV gösterimi ve testler.
- [ ] **TRUBA P1.4 gerçek kabul:** 300+ bantlı gerçek QE hesabında
  SLURM/`bands.x` sonucu, 301–380 gibi açık grafik penceresi, eksiksiz
  hash kanıtı ve DFT grafiği/CSV doğrulaması; bu CI için sentetik
  veriden bağımsız olarak raporlanmalı.


### TRUBA P1.5 — Kaynak tahsisi ve güvenli ön kontrol (30 Ekim 2026)

- [x] `orfoz` için yalnız 56/112 MPI görevi, seri postprocessor için en az 56 CPU tahsisi.
- [x] `pipeline.py preflight`: doğrulanmış kaynaklar, temiz çalışma alanı, sabitlenmiş Python/betik/UPF hashleri.
- [x] `submit.sh`: bütün aşamalarda `sbatch --test-only` başarılı olmadan hiçbir gerçek `sbatch` çağrısı yapmama.
- [x] Erken hata kaydı ve SLURM/modül çevre logları; sentetik Python/JS testleri.
- [ ] Gerçek TRUBA orfoz Si smoke, MoS₂ ve 300+ bant kabulü (operatör erişimi gerektirir).
- [x] `afterok` zincirinde yalnız seri postprocessor aşamaları için manuel, tek seferlik kontrollü `resume.sh` (P1.6/P2.0). **Kısmi `pw.x` restart desteklenmiyor; gerçek TRUBA hata senaryosu kabulü açık.**
- [x] **İsteğe bağlı** P2.2 ortak fiziksel SLURM tahsisi: 56 MPI ile `bands+bands.x`, `nscf+dos.x+projwfc.x`; 6→3 (relax varsa 7→4) iş. **Gerçek CPU-saat tasarrufu kanıtlanmadı; seri işlemlerde 56 CPU ayrılmış kalıyor.**
- [x] `sacct` telemetrisi (P1.7), gerekli elektron kapasitesi/UPF uyarıları (P1.8/P2.1) ve byte-temelli sonuç–girdi SHA eşleştirmesi (P1.9) kodu.
- [ ] Otomatik cutoff, k-örgüsü, vakum, `nbnd` parametre yakınsama taramaları ve bağımsız bilimsel kabul (P2.3+).


### TRUBA P1.6 — Kanıtlı ve sınırlı yeniden devam

- [x] ZIP'e SHA-256 ile sabitlenmiş `resume.sh` ekleme ve eski paketlerle geriye uyumluluk.
- [x] Önceki aşama ve `prefix.save` XML hashleri, orijinal iş kimlikleri ve kısmi çıktılar için `pipeline.py resume-check`.
- [x] `squeue` ile eski işlerin tamamının bitmiş/iptal olduğunu şart koşma; kalan aşamalar için `sbatch --test-only` ve yeni `afterok` zinciri; en çok bir manuel devam denemesi.
- [x] Tekrar denenen `pw.x` aşamalarını ve kısmi `bands.x/dos.x/projwfc.x` çıktılarının üstüne yazılmasını reddetme; sentetik testler.
- [ ] Gerçek TRUBA'da kesilmiş postprocessor zincirinde smoke test.
- [ ] Güvenilir `pw.x` resume için tüm QE restart veri dosyalarının ayrı snapshot/hash yönetimi ve operatör kabulü (şimdilik desteklenmiyor).


### TRUBA P1.7 — Kaynak muhasebesi ve bağımsız kabul kanıtları

- [x] Operatör tarafından çağrılan `python3 pipeline.py accounting`: `sacct` iş/step sonuçlarını ayrı tutan ve eksik veriyi `partial` raporlayan salt-okunur JSON.
- [x] Orijinal ve yeniden gönderilen işlerin sıralı/nümerik job ID doğrulaması, komut enjeksiyonu reddi ve sentetik regresyonlar.
- [x] Si/MoS₂ TRUBA gerçek-küme smoke protokolü, korunacak girdi/ham çıktı/UPF/SLURM/telemetri kanıt envanteri.
- [ ] Gerçek `sacct` çıktısıyla kabul ve bilimsel Si/MoS₂ referans kıyasının operatörce çalıştırılması.
- [ ] Güncel TRUBA IQ ve bellek/disk tüketimi üzerinden kalibre kaynak önerileri (ölçülmüş tahsis verisi gerektirir).


### TRUBA P1.8 — Nötr UPF v2 elektron kapasitesi ve gerekli bilimsel ön kontrol

- [x] `pipeline.py science-check`: sabitlenmiş UPF v2 `element/z_valence` ve `structure.in` atom sayılarından nötr elektron sayısı ve asgari `nbnd` kontrolü.
- [x] `submit.sh` öncesindeki `preflight` içine gerekli bant kapasitesi kontrolünü ekleme (bilinen valansla yetersiz `nbnd` engellenir).
- [x] Eksik/legacy UPF valans bilgisini `valence-unverified` olarak işaretleme; bilimsel geçerlilik iddiasında bulunmama; sentetik Si/yanlış element testleri.
- [ ] Fonksiyonel, UPF ailesi, cutoff/k-mesh/2B vakum ve fiziksel yakınsama koşulları için bağımsız referanslı kabul.
- [ ] Gerçek Si ve MoS₂ UPF v2 ile TRUBA orfoz hesap kabulü.


### TRUBA P1.9 — Sonuç/girdi SHA eşleştirmesi

- [x] Tek iş ve aşamalı SLURM sonuç özetlerinde aktif DFT hazırlık `structure.in` SHA-256 eşleştirme; eşleşmeme/karşılaştırılamama uyarıları.
- [x] TRUBA bant/DOS/PDOS sonuçlarında da kaynak `input_sha256` karşılaştırma; çalışma alanı/dosya değişimi yarış kontrolü.
- [x] WebCrypto SHA-256 yardımcı fonksiyonu ve sentetik regresyonları; kristal koordinatlarını otomatik uygulamama.
- [ ] Bağımsız kaynak ZIP/ham dosyalarla doğrulanabilir dijital imza veya harici güven kökü; SHA içeren JSON tek başına yetmez.
- [ ] Yalnız geometriyi esas alan normalleştirilmiş yapı kimliği ve hesap protokol kimliğinin bilimsel karşılaştırılması.

### TRUBA P2.0 — Devam işlemi güvenliği

- [x] `resume.sh`: `squeue` başarılı çıkış kodu ve boş çıktı ayrımını zorunlu tut; SLURM sorgu başarısızken iş göndermeyi reddet.
- [x] Mock `squeue` hata/aktif-job durumlarında sıfır yeni `sbatch` çağrısını doğrulayan Node regresyonu.
- [ ] Gerçek TRUBA üzerinde bağlantı kesintisi ve iptal edilen bağımlı işler için operatör kabulü.

### TRUBA P2.1 — UPF/XC, 2B vakum uyarısı ve aşama bazında süre profili

- [x] UPF v2 `functional`/önerilen `wfc_cutoff`–`rho_cutoff` metadata incelemesi; karışık XC, açık `input_dft` uyuşmazlığı ve düşük cutoff için **bilimsel uyarı**, yanlış başarı iddiası yok.
- [x] `k_z=1` için hücre normali boyunca en büyük kesirli-z geometrik boşluk üst sınırını inceleme uyarısı olarak raporla; NaN/sonsuz atom koordinatlarını reddet.
- [x] Aşamalı SLURM ZIP'de seri postprocessor süre sınırını ayrı isteğe bağlı seçme ve manifestte tahsis CPU-saat *üst sınırını* gösterme; eski varsayılan süre korunur.
- [x] Mock QE/UPF ve kaynak-süre profili regresyonları.
- [x] P2.2'de isteğe bağlı birleşik fiziksel SLURM işi ve `afterok`/SHA kanıtları eklendi; seri postprocessor sırasında ayrılan çekirdeklerin boşa gitmesi ve gerçek tasarrufun ölçülmesi ayrı iş.
- [ ] Gerçek TRUBA üzerinde cutoff, k-örgüsü, 2B vakum ve projeksiyon/bant sayısı yakınsama kabulü.

### TRUBA P2.2 — Ortak PW/postprocessing tahsisi

- [x] `main` tabanlı isteğe bağlı 56-MPI profilinde `bands+bands.x` ve `nscf+dos.x+projwfc.x` için SHA-256 sabitlenmiş fiziksel grup betikleri üret; 112 MPI veya 72 saat aşımını reddet.
- [x] 6/7 mantıksal aşamanın `prepare`, `finish`, ayrı girdi/çıktı ve SHA-256 kanıtlarını; aşama bazlı hata tuzağını koru.
- [x] Fiziksel grup bazında `afterok` ve `--test-only`; `submissions.txt` aynı fiziksel job ID'yi grup aşamalarında tekrar etsin.
- [x] Python receipt doğrulaması ve `sacct` kaynaklarını tek fiziksel iş olarak sorgulama; farklı gruplar arasında duplicate job ID reddi.
- [x] Varsayılan eski ayrı-iş akışını ve ayrı aşamalı manuel resume betiklerini koru; kullanıcıya seçim ve İngilizce çeviri ekle.
- [x] Sentetik JS, Python ve hata tuzağı regresyonları.
- [ ] Gerçek TRUBA `orfoz` 56-çekirdekli Si/MoS₂ hesaplarında grouped/serial A/B, `sacct` elapsed/CPU, Fermi/DOS/PDOS bilimsel eşdeğerliği ve fail/retry kabulü.
- [ ] **Ölçülecek:** P2.2 ortak tahsis için gerçek CPU-saat/MaxRSS/Elapsed verimliliği; seri süreçte 56 çekirdek tahsisi sürüyor. Alternatif küçük kaynaklı kuyruk veya paralel postprocessing ancak gerçek `orfoz` profil/ölçümlerine göre seçilmeli.

### TRUBA P2.3 — Gerçek küme kabulü ve tekrarlanabilir performans raporu (önerilen sonraki paket)

- [ ] Orijinal `structure.in`, gerçek UPF hashleri, QE/SLURM sürümü, `module list`, `submissions.txt`, ham raporlar ve `sacct` kayıtlarını tek kanıt manifestinde eşleştiren **operatörce çalıştırılan** A/B kabul komutu.
- [ ] **Si:** 56-çekirdekli orfoz üzerinde 6 ayrı iş ↔ 3 ortak tahsis karşılaştırması; aynı UPF, cutoff, k-örgüsü, `nbnd`, Eₙ(k), DOS/PDOS ve `sacct` metrikleri.
- [ ] **MoS₂:** vakum/k-örgüsü/cutoff yakınsama taraması, relaksasyon ve elektron hesapları; aynı ayarlarla ortak/ayrı mod karşılaştırması.
- [ ] **300+ bant:** sabit `nbnd`, 301–380 gibi bant görünüm penceresi, ham dosya/JSON/CSV ve bellek/çalışma süresi kabulü.
- [ ] Kesilen `bands.x`/`dos.x`/`projwfc.x` senaryosunda manuel resume, hatalı/kısmi kayıtta güvenli ret ve failover testi.
- [ ] Kapalı/çalışan job, quota ve bağlantı kesintisi durumlarıyla iş kimliği/kısmi submission güvenliğini doğrulama.
- [ ] Gerçek referanslar yokken `scientific_convergence_verified` işaretini **asla** true yapmama.

### Arayüz P2.3 — Eğitim sayfaları ve üst menü (30 Ekim 2026)

- [x] Toz Kırınımı ve Yarıiletken Fiziği sayfalarından `max-width:1600px` sınırlamasını kaldırıp kullanılabilir yatay alanı tam doldurma; dar ekran iç boşluğu korunur.
- [x] Karşı Uzay sayfasını Toz Kırınımı içinde **alt sekme** yapma; navbar bağlantısını kaldırıp eski `#karsi-uzay` URL'sini yeni sekmeye yönlendirme.
- [x] Kütüphane'yi ana navbar'da DFT'nin **soluna** taşıma; mevcut ayrı Kütüphane sayfasını/arama akışını koruma.
- [ ] Gerçek masaüstü ve mobil tarayıcıda eğitim görsellerinin yeniden boyutlanmasını, tab klavye odağını ve karşı uzay WebGL canvas görünürlüğünü manuel kabul etme.

### Paket V15 — Gerçek VESTA GUI görsel fark protokolü (30 Ekim 2026)

- [x] NaCl, rutil, IUCr K/Na ADP, grafit (001), kısmi CCP4 için 5 sabit kaynak/sahne ve kaynak Git blob SHA-1'leri.
- [x] Ekran SHA-256, gerçek VESTA sürümü/operatör, kaynak SHA-256, kamera ve 1024×768 RGB/RGBA PNG doğrulaması.
- [x] Saf Python foreground IoU, siluet merkez farkı, RGB MAE; yan yana görsel üçlü fark PNG ve CSV/JSON raporu.
- [x] Gerçek GUI yoksa NOT_RUN; ekran yakalanmışsa yalnız CAPTURED_HUMAN_REVIEW_REQUIRED; bilimsel eşdeğerlik asla sahte PASS değil.
- [x] Sahte PNG/test fixture, kötü hash/CRC, path traversal, kamera uyuşmazlığı ve kısmi kanıt sentetik birim testleri.
- [x] **V15.1 operatör altyapısı:** `prepare / seal / status` ile özel kanıt manifesti, operatörce çekilen PNG hashleri, tarih/ROI/format doğrulaması, kaynağa göre P14 GUI raporu bağlantısı; sentetik Python/Node regresyonu.
- [ ] **V15.1 gerçek kabul:** VESTA 3.5.8 GUI ekranları ve P14 gerçek bağ/BVS Text Area kayıtları; **halen yapılmadı, NOT_RUN**.
- [ ] **V15.1:** CCP4 mutlak izoeşik ve birimlerini belirleyip sabitle; mevcut null iken gerçek karşılaştırma engellenir.
- [ ] **V15.2:** Deterministik kamera ve objektif atom/bağ/ADP/Miller/alan-topoloji ölçümleri; platform/GPU A/B testleri.

[V15 yöntem ve durum](tests/validation/PACKAGE_15_STATUS.md).

[V15.1 operatör ve gerçek GUI ölçüm kılavuzu](tests/validation/PACKAGE_15_1_STATUS.md).


---

## VESTA özellik farkı envanteri — V16–V23 (30 Ekim 2026)

**Kapsam:** Referans **VESTA 3.5.8 kararlı sürümü**. Ağustos 2026
**3.90.9a geliştirme sürümü** ve kuasikristal desteği ayrı araştırma
hedefidir; kararlı sürüm paritesine dahil edilmez. DFT/QE/TRUBA, COD
kütüphanesi ve öğretici yarıiletken/karşı-uzay modülleri VESTA'nın
birebir özellik farkları değildir; kendi yol haritalarında kalırlar.

**Resmî dayanaklar:**
[VESTA genel](https://jp-minerals.org/vesta/en/),
[özellikler](https://jp-minerals.org/vesta/en/features.html),
[sürümler](https://jp-minerals.org/vesta/en/download.html),
[kılavuz](https://jp-minerals.org/vesta/archives/VESTA_Manual.pdf).
**Depo dayanakları:** [README](README.md),
[ROADMAP](ROADMAP.md),
[P14 durum](tests/validation/PACKAGE_14_STATUS.md),
[V15.1 durum](tests/validation/PACKAGE_15_1_STATUS.md).

**Etiketler:** Mevcut = temel işlev var; Kısmi = var ama kapsam sınırlı;
Doğrulanmadı = işlev var ancak gerçek VESTA GUI eşdeğerliği ispatlanmadı;
Eksik = belgelenmiş destek yok. Birim/simetri/bilimsel model ayrımı
gizlenmez. README'de geçen özellikleri ikinci kez sıfırdan geliştirme
işi olarak açma.

### VESTA 3.5.8 → KristalYapı fark matrisi

| Özellik | Durum | Gerçek açık ve paket |
| --- | --- | --- |
| CIF, simetri ve hücre dönüşümü | Kısmi | Alternatif setting/origin/Hall, CIF2 ve mCIF varyantları → V18 |
| Ball-stick, space-fill, wireframe, poliedr, ADP | Mevcut / doğrulanmadı | Per-site/bond/facet stilleri, atom dot-surface, ADP geometri eşlemesi → V19 |
| Mesafe/açı, koordinasyon/BVS | Kısmi | 8 gerçek merkez ve VESTA Text Area değerleri; kaynak parametre farkı → V16/V21 |
| Birkaç yapı/alan aynı sahnede | Kısmi | En çok 3 ek faz; otomatik atom/hücre hizalama, RMSD yok → V21 |
| Sınırlar ve Miller düzlemleri | Kısmi | Genel kırpma düzlemleri ve komşuluk/çokyüzlü bütünlüğü → V19 |
| Kristal morfolojisi, yüz aileleri | Kısmi | Kapsamlı non-kübik nokta grupları ve kapalı yüz topolojisi → V21 |
| VESTA proje biçimi | Kısmi | V17.1–17.4: site stilleri, kamera önizlemesi, VECTR/THERI/POLYP içe aktarımı ve P1 dışa aktarma; gerçek VESTA gidiş-dönüşü doğrulanmadı → V17 |
| CUBE/CHGCAR/XSF/CCP4-MRC | Mevcut / kısmi | 24 MB / 2.5M voksel sınırı, birim/orijin, gerçek varyant testi → V20 |
| Çok seviyeli ± izoyüzey ve 2B kontur | Mevcut / doğrulanmadı | Mutlak izoeşik, mesh/topoloji, alanla renklendirme ve sayısal kıyas → V16/V20 |
| Fourier/Patterson ve türetilmiş alan | Kısmi | Deneysel faz/ölçek ve model-FCF-MTZ yorum sınırları → V20 |
| Voronoi yük entegrasyonu | Kısmi | Seyrek örneklem ve gerçek yakınsama/hata bütçesi → V20 |
| Çokyüzlü kimyası / BVS | Kısmi | Parametre çiftleri, occupancy ve hacim/bozulma referansı → V21 |
| PNG/SVG/TIFF/PDF/EPS ve 3B export | Mevcut / doğrulanmadı | #174 + #178 ile mm/DPI, derinliği doğru vektör, fontsuz metin, punto etiket, lejant, Å ölçeği, köken bilgisi; bağımsız VESTA görsel kabulü → V19 |
| Kristalografik bakış yönü (a/b/c, a*/b*/c*, [uvw], (hkl) normali) | Mevcut / doğrulanmadı | V24: Görünüm paneli, sabit açılı döndürme, köken bilgisi; gerçek VESTA kıyası → V16 |
| Arka plan, derinlik sisi, ışık ve hücre çizgi stili | Mevcut / doğrulanmadı | V24: proje, geri al ve tüm export biçimlerinde; çizgi kalınlığı yok |
| Atom yarıçap setleri ve element renk şemaları | Kısmi | V24: Alvarez vdW, Shannon iyonik, Jmol/CPK; VESTA'nın kendi tablosu (elements.ini) kaynağıyla yok |
| Bağ stilleri ve hidrojen bağı | Mevcut / doğrulanmadı | V24 P2: tek/iki renk silindir, ince çizgi, kesikli, çifte özel yarıçap; D–H···A çizimi ve `_geom_hbond`; PLATON/VESTA kıyası açık |
| Geometri tablosu, simetri kodu, s.u. | Mevcut / doğrulanmadı | V24: n_klm kodu, kovaryanssız s.u., CSV ve CIF `_geom_*`; yayınlanmış CIF ile kıyas açık |
| Yapı dışa aktarma formatları | Mevcut / doğrulanmadı | V24 P2: SHELX .res, CASTEP .cell, QE pw.x, XSF, P1 mCIF; uygulama içe aktarıcılarıyla gidiş-dönüş testli, harici programlarla (SHELXL, CASTEP, pw.x) çalıştırılmadı |
| Harici RIETAN/MADEL ekosistemi / ek formatlar | Kısmi | Harici araç sınırı, format talep önceliği → V22 |
| Çok büyük sahneler / çok pencere | Kısmi | 10 workspace, nesne/volume limitleri, gerçek cihaz ölçümü → V22 |
| Kuasikristaller (3.90.9a geliştirme) | Eksik / ayrı karar | 3.5.8 kabul hedefinin dışında → V23 |

### V16 — P0 · Gerçek VESTA 3.5.8 GUI ve bilimsel fark kanıtı

- [x] **V15.2/V16.1 yazılımı:** Gerçek SHA-pimli 5i55 CCP4 başlık/480
  voksel denetimi, mutlak **+1,0 kaynak birimi** izoeşik (fiziksel
  birim UNKNOWN); 5 gerçek kaynak hücresinde [uvw]/[hkl]* doğrudan–karşıt
  örgü kamera çerçevesi ve matematik/bozuk dosya unittest'leri.
  Ayrıntılar: [V15.2 + V16.1](tests/validation/PACKAGE_16_1_STATUS.md).
- [ ] **V16.1 bilimsel kabul:** Gerçek VESTA 3.5.8 kamera bakış işareti,
  fotoğraf çiftleri, P14 Text Area ve CCP4 fiziksel birimi doğrulaması.
  Kodlanmış sayısal referans = GUI/deneysel eşdeğerlik değildir.

- [ ] **Ön koşul:** Var olan V15.1 gerçek GUI kabulünü ve kısmi CCP4
  haritanın mutlak izoeşik/birim sorununu çöz. O zamana kadar
  scientificParity=NOT_ESTABLISHED ve gerçek GUI=NOT_RUN kalsın.
- [ ] VESTA ve KristalYapı için aynı CIF/CCP4, görüntü sınırları,
  kamera/projeksiyon, ışık, renk, atom/bağ yarıçapı, ADP olasılığı
  ve 1024×768 çıktı protokolü; eşlenemeyen ayarlar belgelenmeli.
- [ ] Mevcut beş V15 sahnesinde gerçek VESTA 3.5.8 ekran görüntüsü;
  8 P14 koordinasyon/BVS merkezinde gerçek VESTA Text Area çıktıları.
  Her kayıt için kaynak SHA, VESTA sürümü, operatör, tarih ve ROI.
- [ ] Görsel IoU/MAE yanında atom merkezleri (Å ve piksel), bağ listesi,
  ADP ana ekseni, çokyüzlü hacmi, Miller normal/d(hkl), izoyüzey
  eşik/topoloji ve BVS için **bağımsız Gemmi/ASE**, uygulama ve gerçek
  VESTA değeri ayrı sütunlar; bulunmayan değerler null.
- [ ] **Kabul:** En az 5 gerçek GUI eş sahnesi ve 8 P14 merkezi,
  önceden tanımlanmış fiziksel/görsel toleranslar, kanıt bağlantısı,
  pass/fail/inconclusive/not-run kararı. Gerçek VESTA GUI görülmeden
  parite veya PASS iddiası yok.

### V16.2 — Sayısal referans ve güvenli VESTA fark matrisi (30 Ekim 2026)

- [x] **Kod / kaynak:** Beş gerçek SHA-sabitli V15 sahnesinde bağımsız
  hücre hacmi; Gemmi ile CIF asimetrik site sayısı, koordinat, occupancy
  ve Ueq; NaCl/rutil için seçili periyodik en kısa bağlar;
  grafit (001) için metric d-aralığı ve yönlü normal; CCP4'nin
  kaynak biriminde mutlak isoeşik/voksel/kenar denetimi.
- [x] **Kanıt yazılımı:** Boş (asla GUI uygulanmış gibi görünmeyen)
  operatör JSON şablonu; V15 gerçek PNG SHA/CRC/ROI/ayar/operator/commit
  eşleştirmesi olmadan VESTA sayısal gözlemlerini kabul etmeme.
  JSON+CSV fark matrisi; mutlak tolerans ve PBC Kartezyen metrik
  farkları; geçersiz/çelişkili/tekrarlanan ölçümleri reddetme.
- [x] **Sentetik test kapsamı:** Gerçek CIF/CCP4 kaynak referansları,
  farklı yön işareti, koordinat sarımı, tolerans geçme/kalma,
  kaynak/kanıt tutarsızlığı ve null/NOT_RUN kontrolü için unittest eklendi.
- [ ] **Test yürütümü:** Merge-only CI ve Gemmi'li gerçek çalışma
  ortamında yeni unittest'lerin tamamı koşulup kanıtlanmalı;
  kodun yazılmış olması testlerin geçtiği anlamına gelmez.
- [ ] **V16.2 gerçek GUI kabulü:** VESTA 3.5.8 operatör sahneleri,
  bağımsız P14'ün sekiz BVS/Text Area merkezi, ADP ana eksenleri,
  tüm bağ/çokyüzlü hacimleri ve CCP4 fiziksel birim/topoloji için
  gerçek gözlem ve insan onaylı fark raporları. Bu kanıt yokken
  scientificParity=NOT_ESTABLISHED, VESTA=NOT_RUN.
- [ ] **Sıradaki:** V16.3 için gerçek GUI ölçümü mevcutsa bu eksikleri
  kapat; yoksa V16 bilimsel kabulü açık tutarak V17 proje
  import/export uygulamasına geç.

[Yöntem, örnek komutlar ve bilimsel sınırlar](tests/validation/PACKAGE_16_2_STATUS.md).

### V17.1 — VESTA site görünümü ve aktarım kayıp raporu

- [x] ATOMT element ve SITET site RGB/yarıçapı için sınırlandırılmış
  görünüm aktarımı: site etiket/ID eşleme, yaklaşık ball-mode Å→scale,
  .2–3 sınırı dışını sessizce kırpmadan uyarı ve fallback.
- [x] transferReport: hangi .vesta alanının içe alındığı, kısmi/
  yaklaşık olduğu veya hiç aktarılmadığı; SCENE/LMATRIX kamera/
  ışık, VECTR, THERI, POLYP ve harici dosya bloklarının kaybı açık.
- [x] Site stili ve negatif testler; bağımlı JS Pages paketi ve PWA
  önbellek kapsamına alındı. CI merge-only tetikleme politikası sabit.
- [ ] Gerçek VESTA GUI ile atom yarıçapı/perspektif, ışık, ADP
  ve çokyüzlü görsel paritesini doğrulama (NOT_RUN).
- [ ] Sonraki işler: V17.2 kamera/view, V17.3 ADP/polyhedron/vector
  destek alt kümesi; V17.4 güvenli .vesta export/round-trip.

[V17.1 uygulama ve sınırlamalar](tests/validation/PACKAGE_17_1_STATUS.md).

### V17.2 — SCENE kamera/yön önizlemesi (deneysel)

- [x] SCENE 4×4 matriste katı sağ-elli 3B rotasyon kontrolü;
  yansıma, NaN/Inf, shear, nonrigid / translation/bozuk satır reddi.
- [x] LMATRIX yerel dönüşümü **kamera sanmama**; identity dışı
  LMATRIX sahnesinde kamera önizlemesini kapatma ve kullanıcıya uyarı.
- [x] PROJT 0/1 için **kanıtlanmamış, isteğe bağlı**
  orthographic/perspective mod önizlemesi; zoom/FOV eşitliği
  iddiası yok. Pan, zoom, BKGRC, LIGHT0–3 sahne ayrıntısı
  meta/uyarı olarak okunur, render motoruna zorla aktarılmaz.
- [x] Kullanıcı onayıyla 3B sahne kamera yönünü önizleme; onay
  yoksa normal Fit görünümü. Bağımsız testler ve Pages/PWA
  modül-grafiği güncellendi, CI merge-only tetikleyicisi aynı.
- [ ] **V17.2 bilimsel kabul:** En az 3 gerçek VESTA 3.5.8
  GUI yönü ve perspektif eş görüntüsü, [uvw]/[hkl]* işaretleri,
  SCENE→Three.js matris/eksen/döndürme ve PROJT mod/zoom
  eşlemesi, ışık ve depth-cue kontrolü. GUI NOT_RUN;
  parity NOT_ESTABLISHED.
- [ ] **Sıradaki:** V17.3 ADP/vektör/çokyüzlü güvenli alt-kümesi,
  V17.4 .vesta export ve gerçek VESTA round-trip.

[Protokol ve sınırlamalar](tests/validation/PACKAGE_17_2_STATUS.md).

### V17.3 — VECTR/THERI/POLYP güvenli bilimsel altküme

- [x] VECTR/VECTT/VECTS sınırlı ok verisi (max 200, atom ID/etiket,
  RGB/ölçek), **UNSPECIFIED_DISPLAY_ARROW** semantiği ile ayrı katmanda;
  manyetik moment/kuvvet/yer değiştirme olarak yorumlamama.
- [x] P1/etkin simetri genişlemesi yokken ok görselleştirme,
  simetri altında doğrulanmamış vektör dönüşümü için görselleştirmeyi
  kapatma; proje JSON, Undo/Redo ve workspace'te koruma.
- [x] THERI site faktörlerini metadata olarak okuma, sahte Uiso/Uij
  elipsoidi oluşturmama; POLYP global RGB rengini yaklaşık
  polyColor olarak aktarma, facet/topoloji uydurmama.
- [x] Bozuk VECTR/VECTT/THERI/POLYP kayıtları için negatif testler;
  Pages staging ve PWA modül önbellek, merge-only CI testi.
- [ ] V17.3 gerçek VESTA 3.5.8 GUI ölçümleri, ADP Uij/betaij
  dosya semantiği, vektör fiziksel birimleri ve polyhedron facet
  topolojisi kabulü. Bu kanıtlar hâlâ NOT_RUN/NOT_ESTABLISHED.
- [ ] Sonraki V17.4 — kontrollü VESTA 3.x export, açık kayıp manifesti
  ve gerçek VESTA masaüstünde round-trip.

[V17.3 bilimsel sınırlar ve testler](tests/validation/PACKAGE_17_3_STATUS.md).

### V17.4 — VESTA 3.5 sınırlı P1 dışa aktarma ve kayıp manifesti

- [x] Hücre / atom / doluluk, P1 kimlik simetrisi, BOUND,
  SITET/ATOMT yaklaşık renk-yarıçap, SBOND eşikleri,
  BONDS/LABEL ve POLYP global RGB yazıcısı.
- [x] Etkin SG>1 iken P1 altında sahte eşdeğer atom oluşturmama:
  güvenli ret. Etiket, sayısal sınır, occupancy, hücre metriği
  ve bağ kuralları kontrolleri; dış dosya yolları gömülmez.
- [x] Ayrı VESTA kayıp raporu: SHA-256 dosya özeti,
  aktarılmayan ADP/magnetic/vector/kamera/LMATRIX/polyhedron
  geometri/süperhücre/harita ve harici yoğunluk için null hash.
- [x] Mevcut uygulamanın VESTA importer'ıyla kontrollü
  P1 round-trip ve olumsuz senaryo testleri eklendi.
- [x] Save modal, Pages staging ve PWA/offline shell bağlandı;
  mevcut merge-only CI test komutuna regresyon eklendi.
- [ ] Native Node testleri ve tarayıcı dosya indirme/yükleme
  doğrulaması; bu repo yazma ortamında henüz koşulmadı.
- [ ] **Gerçek VESTA 3.5.8 GUI kabulü:** Üç yapı, bir
  density/sidecar sahnesi ve farklı site stiliyle gerçek
  VESTA→KristalYapı→VESTA görüntü/sayısal fark matrisi;
  halen GUI NOT_RUN, scientificParity NOT_ESTABLISHED.
- [ ] Bir sonraki: V17.5 gerçek desktop test protokolü ve
  isteğe bağlı hash'li kullanıcı seçilmiş yoğunluk
  yan dosyaları; ardından V18 CIF2/simetri/setting.

[Kapsam ve gerçek VESTA kabul kriterleri](tests/validation/PACKAGE_17_4_STATUS.md).

### V17.5a — GUI gerektirmeyen yapısal VESTA doğrulaması

- [x] V17.4 P1 .vesta ve .loss.json dosyalarına bağımsız Python
  kontrolü: SHA-256, sağ-elli hücre hacmi, atom/etiket/doluluk,
  SITET renk/yarıçap ve açık veri kayıpları.
- [x] Opsiyonel ikinci P1 .vesta ile sayısal geometri/occupancy
  farkı; GUI yoksa varsayılan doğrulama yolu.
- [x] Sentetik negatif testler ve mevcut merge-only CI kapsamı.
- [ ] Atomsk gibi ayrı VESTA okuyucularıyla ek karşılıklı
  format testleri ve gerçek kaynak örnekleri.
- [ ] Gerçek masaüstü ekran ölçümü GUI erişimi olursa
  isteğe bağlı ek bilimsel kabul; mevcut ilerlemeyi bloklamaz.

[GUI-free protokol](tests/validation/PACKAGE_17_5_STATUS.md).

### V17.5 — Gerçek VESTA 3.5.8 desktop kabul altyapısı

- [x] Üç SHA-pimli CIF (NaCl, rutil, IUCr K/Na/Ca/Si/O)
  ve kısmi gerçek 5i55 CCP4 için kullanıcı odaklı
  kanıt hazırlama, SHA-256 mühürleme ve raporlama.
- [x] V17.4 app-export .vesta + ayrı kayıp raporu SHA
  doğrulaması; gerçek VESTA Save As .vesta dosyasıyla
  P1 hücre, atom türü, site etiketi, occupancy ve
  periyodik Kartezyen konum farkları.
- [x] V15 kaynak pinleri / kamera / 1024×768
  PNG CRC/SHA/ROI + IoU ve RGB MAE kıyası;
  üç panelli somut karşılaştırma görselleri.
- [x] IUCr ADP kayıp raporu zorunluluğu;
  operatörün gerçekten seçtiği 5i55 CCP4 binary
  SHA-256 eşleşmesi, kaynak biriminin UNKNOWN
  olduğunun korunması; uydurma external grid ret.
- [x] Sentetik kötü durum testleri; mevcut merge-only
  CI içinde ayrıca çalıştırma adımı eklendi.
- [ ] **İsteğe bağlı gerçek GUI kabulü:** VESTA 3.5.8 erişimi
  sağlanırsa dört sahnenin görüntü/Save As kanıtları insan
  değerlendirmesine alınabilir. Bu, GUI-free geliştirmeyi
  veya V18'i BLOKLAMAZ. GUI NOT_RUN, parity NOT_ESTABLISHED.
- [ ] VESTA ileri scientific parity: ADP/tensor,
  aktif non-P1 setting, vektör ve polygon topology,
  gerçek grid dışa aktarma. Sonra V18 CIF2/simetri.

[V17.5 operatör protokolü](tests/validation/PACKAGE_17_5_STATUS.md).

### V17 — P1 · VESTA proje içe/dışa aktarımı

- [ ] Sınırlı 3.x VESTA importunu kamera/view, ışık, site yarıçapı,
  vektör, ADP, poliedr renk/opacity, ISURF görünümü ve sınır
  parametreleri için **aktarılan / uyarıyla atlanan / reddedilen**
  olarak genişlet. Bilinmeyen SYMOP/IMPORT öğesini tahmin etme.
- [ ] Güvenli bir **VESTA 3.x export alt-kümesi** ve veri kaybı matrisi;
  harici CUBE/XSF/CHGCAR/CCP4 dosyalarını kendiliğinden indirme veya
  tarayıcı diskinden okumaya çalışma; kullanıcı kontrollü yan dosya
  manifesti ve hash kullan.
- [ ] Hücre, origin, harita yol/uzamsal eksen, isteğe bağlı renk/izodeğer
  uyumsuzluklarında görünür uyarı veya ret; hacimsel veri proje içine
  gömülmüş gibi gösterme.
- [ ] **Kabul:** En az üç gerçek 3.5.x proje + bir hacimsel proje ile
  VESTA → KristalYapı → VESTA round-trip; atomlar, simetri, kamera ve
  desteklenen stiller için fark matrisi. Kayıplı alanlar başarılı
  **kayıpsız** dönüşüm olarak raporlanmaz.

### V18.2 — CIF2 tipli List/Table ve veri bloğu seçimi

- [x] İç içe CIF2 List/Table ve save frame ayrıştırma;
  metadata tipini kaybetmeden AST olarak koruma.
- [x] Birden çok data_ varsa yalnız tek kristal seçimi;
  otomatik blok birleştirme yok, belirsizlikte açık seçim.
- [x] Bilimsel bileşik değerlerde güvenli ret; 60 KB
  tipli metadata proje/Undo/Redo saklama; sınır aşımı
  ve kaynağın tamamını yanlış dışa aktarmama.
- [x] Sentetik nested metadata ve 2 kristal fixture'ı,
  Node testleri, Gemmi ile yalnız skaler yapısal
  projeksiyon kontrolü, Pages/PWA ve merge-only CI.
- [ ] Gerçek CIF2/DDLm corpus, compound science
  sözlük eşlemesi ve daha erişilebilir blok seçim UI.
- [ ] V18.3 Hall/setting/origin dönüşümleri;
  V18.4 mCIF2 ve ADP/disorder.

[V18.2 kapsamı ve kabul sınırları](tests/validation/PACKAGE_18_2_STATUS.md).

### V18.1 — CIF2 güvenli skaler içe aktarımı ve açık simetri

- [x] CIF2 zorunlu sürüm başlığı, Unicode, üçlü tırnak
  metni ve skaler/loop altkümesi için bağımsız sınırlı lexer.
- [x] List/Table, save/global ve birden fazla data_
  bloğunda sessiz CIF1 yanlış okuması yerine açık ret;
  CIF1 yolu değişmedi.
- [x] Açık xyz işlemleri için tamsayı R, det ±1,
  hücre Gram metriği Rᵀ G R=G, identity ve mod-1
  kompozisyon kapanışı. CIF2 SG>1 operatörsüzse
  setting/origin uydurulmadan ret.
- [x] P−1 ve P2₁ CIF2 fixture, Node parser regresyonu,
  Gemmi 0.7.4 bağımsız karşılaştırması, Pages/PWA
  ve merge-only CI doğrulaması.
- [x] V18.2 typed List/Table ve seçili data_ bloğu;
  gerçek corpus kapsamı ayrıca açık.
- [ ] V18.3 Hall, unique axis, origin ve setting
  dönüşümlerinin Gemmi kaynaklı matematiksel teyidi.
- [ ] V18.4 CIF2 manyetik simetri/ADP/disorder
  fiziksel doğruluğu. Tam CIF2 NOT_SUPPORTED.

[Paket 18.1 kapsamı ve testleri](tests/validation/PACKAGE_18_1_STATUS.md).

### V18 — P1 · CIF2, simetri/setting ve manyetik doğruluk

- [ ] CIF1/CIF2, çoklu blok, karışık/alternatif occupancy, site ADP,
  koordinat hataları ve provenance için güvenli kabul/koruma/ret
  politikası; farklı yapı bloklarını sessizce birleştirme.
- [ ] Moyo tabanlı SG/primitive-conventional işlemlerinde Hall seçimi,
  origin shift, R-merkezleme ve kullanıcının alternatif setting seçimi;
  hacim, atom çokluğu ve periyodik koordinat korunumu.
- [ ] BNS/mCIF 3B, modüle/superspace ve VASP SAXIS eksenleri için
  destek sınırlarını netleştir; metadata yoksa dönüştürmeyi uydurma.
- [ ] **Kabul:** Triklinik, monoklinik, R-merkezli, özel konum ve
  K/Na disordered gerçek CIF/mCIF korpusu; Gemmi/spglib ile SG,
  occupancy, hücre metriği, ADP ve koordinat hata/tolerans tablosu.

### V19 — P1 · Sahne kontrolü, kesim ve yayın çıktısı

- [ ] Site/bond/polyhedron facet/label bazlı renk, yarıçap, saydamlık
  ve görünürlük; katman, proje ve Undo/Redo ile aynı durum modeli.
- [ ] VESTA benzeri van der Waals **dot surface**, ADP ana eksen
  bilgi katmanı ve seçilebilir statik yer değiştirme/moment vektörü
  stilleri; fiziksel yön ve ölçek notu.
- [ ] Kesirli x/y/z penceresine ek keyfî clipping düzlemleri;
  bağ/molekül ve poliedr bütünlüğünü koruyan opsiyon; Miller düzlemi
  sadece görsel katman olduğunda bunu belirt.
- [x] Kamera ve XYZ/abc yön göstergesi için PNG/TIFF/SVG/PDF/EPS
  tutarlılığı; transparan arka plan, etiket, çizgi ve çözünürlük/
  DPI metaverisi. Volumetrik 3B veya vektör desteklenmiyorsa
  raster fallback'i açıkça etiketle. **#174:** 85/120/175 mm + DPI,
  atomlara göre kırpılan bağ/hücre çizgileri, ortak küre gradyanı,
  font gerektirmeyen glif konturları, PNG pHYs, LZW TIFF, kayıpsız PDF.
  **#178:** punto cinsinden etiket ve pusula, italik a/b/c, konum
  etiketi, element lejantı, Å ölçek çubuğu, PNG/TIFF/SVG/PDF/EPS köken
  metaverisi, vektörde dolu izoyüzey; kesit/tel kafes için uyarı.
- [ ] Etiket çakışma önleme; site bazlı özel etiket metni, ofseti ve
  görünürlüğü (yukarıdaki per-site durum modeliyle).
- [ ] Vektör çıktıda kesişen kürelerin tam görünürlüğü (yay kırpma);
  yarı saydam atomların arkasındaki çizgileri soluklaştırma.
- [ ] Vektör izoyüzeyde komşu yarı saydam üçgenler arasındaki
  kenar yumuşatma dikişleri: parça bazlı birleşik yol veya opak
  dolgu + ayrı saydamlık grubu; PDF/EPS/SVG görüntüleyici testi.
- [ ] **Kabul:** Si, NaCl, rutil, ADP, Miller ve volume overlay
  sahnelerinde 1×/4× export; Chromium ve mevcut platformlarda
  bağımsız görsel fark ölçümü, kullanıcı ayarlarının round-trip testi.

### V20 — P2 · Hacimsel alan bilimsel doğruluğu ve ölçek

- [ ] Gerçek CUBE, CHGCAR, XSF, CCP4/MRC ve QE/VASP örnekleri için
  fiziksel nicelik/birim, origin, handedness, periyodiklik ve veri
  sıralaması bağımsız doğrulaması; CCP4 unknown varsayımı korunur.
- [ ] Çok seviyeli ± izoyüzeylerde mutlak eşik, vertex/normal,
  topoloji, görünürlük, ikinci alanla renk ve katman opacity'sini
  VESTA GUI + bağımsız sayısal veri ile kıyasla.
- [ ] 24 MB / 2.5M voksel sınırını büyütmek gerekiyorsa
  Worker/chunk/streaming/iptal/aygıt bütçesi; kontrolsüz downsample
  veya sessiz fazla bellek tüketimi yok.
- [ ] Model Fourier/Patterson, FCF/MTZ gözlenen veriye bağlı
  Fo−Fc/2Fo−Fc, ağırlıklı katsayı ve gerektiğinde Laplasyen için
  faz, sigma/FOM/FREE, ölçek, d_min ve fiziksel model ayrımı.
  Eksik deneysel fazı üretildi sayma.
- [ ] Voronoi ≠ Bader; 2B eğik Miller konturları ve subvoxel
  min/max için grid yakınsaması, sayısal integral ve hata raporu.
- [ ] **Kabul:** Kaynağı sabitlenmiş birer gerçek CUBE/CHGCAR/XSF/
  CCP4 + deneysel FCF/MTZ; voxel/Å, izoyüzey, kontur, integral
  ve tepe sonuçlarında mutlak/bağıl tolerans, hata dosyası testleri.

### V21 — P2 · Kristal morfolojisi, koordinasyon ve faz hizalaması

- [ ] Triklinik–hekzagonal nokta gruplarında eşdeğer {hkl}
  yüzler, yüz normali/mesafesi, kapalı morfoloji çokyüzlüsü ve
  eğik hücre geometrisini bağımsız test et. Wulff/enerji
  hesabı yoksa morfoloji yüz uzaklığını yüzey enerjisi diye sunma.
- [ ] Koordinasyon hacmi, Baur D, Hoppe ECoN, quadratic elongation,
  bond-angle variance, kesilme/occupancy ve VESTA gerçek Text Area
  bağımsız değer karşılaştırması.
- [ ] BVS iyon-pair parametre setini kaynak+sürümle genişlet;
  VESTA kılavuzundaki sabit B=0.37 Å ile uygulamadaki örn.
  Cu(II)-O B=0.36 Å seçiminin model/fizik farkını raporla.
- [ ] Çoklu fazda otomatik atom/site eşleme, rijit RMSD, hücre ve
  orijin hizalama, kimyasal/simetri uyumsuzluklarında güvenli ret.
- [ ] **Kabul:** P14'ün sekiz gerçek iyon merkezi, nonkübik morfoloji
  örnekleri ve iki fazlı model; Å/RMSD, hacim, BVS ve koordinasyon
  tolerans tablosu, kaynak/parametre izi.

### V22 — P3 · Büyük sahneler, formatlar ve ekosistem

- [ ] Mevcut atom/bağ/poliedr/volume sınırlarında mobil ve
  entegre/ayrık GPU gerçek FPS, peak RAM/GPU, context-loss,
  yükleme/iptal ve instanced ADP/LOD benchmarkları.
- [ ] Eksik VESTA formatlarını (WIEN2k struct, GSAS/RIETAN,
  XTL, DL_POLY vb.) **gerçek kullanıcı talebi ve format test
  fixture'ları** ile sırala; her birinin metadata kaybını belirt.
- [ ] VESTA'nın **harici** RIETAN-FP/MADEL bağlantılarını
  yerleşik VESTA hesaplarıymış gibi değerlendirme. KristalYapı
  öğretici toz XRD/Ewald modeliyle eşdeğerlik iddiası kurma;
  gerekirse açık input/output adaptörü ve gerçek referans sonuç
  karşılaştırması tasarla.
- [ ] Çoklu browser workspace/PWA için offline veri geri yükleme,
  klavye ve ekran okuyucu erişilebilirliği, export/import
  dayanıklılığı ve büyük dosya kurtarma.
- [ ] **Kabul:** Cihaz-yapı bazlı FPS/bellek raporu, gerekçeli
  dosya formatı öncelikleri, test edilen ve edilmeyenler matrisi;
  gerçek ölçüm olmadan "VESTA kadar hızlı" iddiası yok.

### V23 — P3 / ayrı karar · VESTA 3.90.9a geliştirme sürümü

- [ ] Resmî 3.90.9a'nın kuasikristal modeli, indeksleme/
  superspace ve örnek verisini bir araştırma notuyla incele.
  VESTA 3.5.8 eşdeğerlik skoruna karıştırma.
- [ ] Gerçek kullanım senaryosu ve bağımsız bilimsel fixture
  olmadan geliştirme taahhüdü verme; ayrıca karar al.

### V24 — P1/P2 · V16–V23 envanterinde olmayan VESTA farkları (30 Ekim 2026)

**Dayanak:** VESTA 3 kılavuzundaki görünüm (View/Style/Properties),
bağ, Utilities ve Export Data bölümleri. jp-minerals.org bu ortamdan
erişilemediği için madde adları kılavuz bilgisinden alındı; her madde
geliştirmeden önce [kılavuz](https://jp-minerals.org/vesta/archives/VESTA_Manual.pdf)
ve gerçek VESTA 3.5.8 ile (V16 protokolü) doğrulanmalı. Doğrulanmayan
madde "VESTA'da var" diye raporlanmaz.

- [x] **P1 · Kristalografik bakış yönü:** editörde a, b, c, a*, b*, c*
  boyunca bakış; [uvw] doğrultusu ve (hkl) normali girişi; ekran
  eksenleri etrafında sabit açılı (ör. 5°/15°/90°) döndürme ve yukarı
  vektörü seçimi. Eğik hücrede doğrudan/karşıt örgü ayrımı (V16.1
  `vesta_16_orientation.py` matematiği yeniden kullanılır), proje ve
  Undo/Redo'da saklanır, dışa aktarılan figürün köken bilgisine yazılır.
  **Yapıldı:** Görünüm panelinde a/b/c/a*/b*/c*, [uvw] ve (hkl) normali;
  5–90° adımlı yuvarlanma/sapma/yunuslama; kamera kıpırdamadıkça figür
  köken bilgisine "view along …" yazılır. Kamera konumu projeye yazılmaz
  (mevcut proje biçimi kamerayı saklamaz).
- [x] **P1 · Görünüm ve aydınlatma:** arka plan rengi (beyaz/siyah/
  özel), derinlik sisi (depth cueing) başlangıç/bitiş, ortam/yaygın/
  parlak ışık şiddeti ve ışık yönü, hücre çizgi rengi/kalınlığı/kesikli
  stili. Ayarlar proje, çalışma alanı ve tüm export biçimlerinde aynı;
  "element renklerini koru" seçeneğiyle çelişmez; vektörde sis ya
  uygulanır ya da açıkça yok sayıldığı bildirilir.
  **Yapıldı:** varsayılanlar eski sahneyi birebir verir; sis vektörde
  doğrusal renk karışımı, kesikli hücre çizgisi raster/SVG/PDF/EPS'te
  kesikli. Açık: hücre çizgisi kalınlığı.
- [x] **P1 · Atom yarıçap setleri ve renk şemaları:** atomik, iyonik
  (Shannon 1976; yükseltgenme durumu ve koordinasyon sayısına göre)
  ve van der Waals yarıçap tabloları; space-filling'de vdW. VESTA /
  Jmol / CPK renk şemaları. Her tablo için kaynak ve sürüm; eksik
  iyon/KS değerini tahmin etmeden uyar ve atomik değere düş.
  **Yapıldı:** `tools/build_element_data.py` ile mendeleev'den kaynaklı
  Alvarez 2013 vdW, Shannon 1976 iyonik (yük/KS/spin seçimi), Jmol ve CPK;
  seçilmeyen iyonlar varsayılan yarıçapta kalır ve listelenir. Bağ araması
  değişmez. Açık: VESTA renk/yarıçap tablosu (kaynaklı elements.ini yok).
- [x] **P2 · Bağ stilleri ve hidrojen bağı:** tek renk / iki renk
  (yarım bağ atom rengi) silindir, çizgi ve kesikli/noktalı stil;
  element çifti bazlı bağ yarıçapı. D–H···A hidrojen bağı araması
  (H···A ve D···A mesafesi + D–H···A açısı ölçütü, kaynaklı varsayılan)
  kesikli çizimle; vektör export'ta kesikli çizgi, ölçüm tablosunda ayrı tür.
  **Yapıldı:** iki renkli bağ gerçek orta noktadan (hücre kesiminde de)
  bölünür; kesikli bağlar ve H-bağları parça silindir olduğu için tüm
  export biçimlerinde kesikli kalır. H-bağı varsayılanları (D–H ≤ 1,2,
  H···A ≤ 2,5, D···A ≤ 3,5 Å, açı ≥ 120°) değiştirilebilir; geometri
  tablosu CSV ve CIF `_geom_hbond_*` (D/H/A simetri kodlarıyla) yazar.
- [x] **P1 · Geometri tablosu:** bağ, açı ve dihedral listesi
  simetri koduyla (ör. `x, y, z+1` / `1_556`); CIF e.s.d.'lerinden
  hücre + koordinat belirsizliğinin yayılımıyla s.u.; CSV ve CIF
  `_geom_bond_*`, `_geom_angle_*`, `_geom_torsion_*` döngüleri.
  s.u. kaynağı yoksa alan boş kalır, sıfır yazılmaz.
  **Yapıldı:** `geometry-table.js`; CIF e.s.d.leri değerleriyle birlikte
  saklanır, hücre/koordinat değişince kullanılmaz; aynı sitenin
  görüntüleri arasındaki korelasyon korunur; CIF çıktısı kodların
  başvurduğu simetri işlem listesini içerir. s.u. kovaryanssızdır.
- [x] **P2 · Yapı dışa aktarma formatları:** SHELX `.res`, CASTEP
  `.cell`, editörden QE `pw.x` girdisi, XSF yapı ve mCIF. Her biri için
  içe→dışa round-trip testi ve kayıp metadata tablosu (occupancy,
  ADP, simetri, manyetik moment). VESTA proje export'u V17'de kalır.
  **Yapıldı:** `structure-export.js`; SHELX asimetrik birimi LATT/SYMM ile
  yazar (inversiyon orijinde değilse negatif LATT), özel konum SOF =
  10 + doluluk·m/M. SHELX içe aktarıcısı da artık SOF'u M/m ile ölçekler
  (önceden özel konumdaki tam atom yarım okunurdu). CASTEP/QE kısmi
  doluluğu reddeder; QE psödopotansiyel/kesme/k-örgüsü yer tutucudur;
  XSF yapı dosyaları artık içe de aktarılır; mCIF yalnız P1 (BNS 1.1).
  Her dosya aktarılamayanları yorum olarak yazar. Açık: harici
  programlarla (SHELXL, CASTEP, pw.x, VESTA) gerçek okuma testi.
- [ ] **Kabul:** Si, NaCl, rutil, triklinik ve H-bağlı (ör. buz Ih
  veya bir hidrat) gerçek CIF'lerde: [uvw]/(hkl) bakışının bağımsız
  vektör hesabıyla açısal hatası, yarıçap tablolarının kaynak değerleriyle
  birebirliği, H-bağı listesinin Gemmi/PLATON benzeri bağımsız
  referansla karşılaştırması, geometri s.u. değerlerinin yayınlanmış
  CIF `_geom_*` değerleriyle farkı; TR/EN arayüz ve proje regresyonu.

### Sıra, bağımlılıklar ve yatay kabul

1. **V15.1 gerçek GUI kabulü → V16 gerçek fark kanıtı.**
2. **V17 proje uyumluluğu → V18 CIF/simetri güvenilirliği.**
3. **V19 sahne/yayın paritesi + V24 bakış yönü, görünüm, yarıçap setleri → V20 alan bilimi → V21 koordinasyon/morfoloji.**
   V24 geometri tablosu V21 koordinasyon karşılaştırmasından önce; V24 bağ stilleri ve formatlar V22 ile birlikte.
4. **V22 ölçülen ihtiyaçlarda; V23 ayrı keşif kararı.**

**Her paket için:** Kaynak SHA/sürümü, sentetik/gerçek fixture ayrımı,
bağımsız bilimsel karşılaştırma veya gerçek VESTA gözlemi, TR/EN uyarı,
Undo/Redo/proje regresyonu, negatif test ve nicel kabul toleransı.
Fiziksel olarak farklı yöntemleri yalnız aynı göründükleri için
eşdeğer işaretleme. **CI tetikleme ve çalışma politikası değişmez.**
