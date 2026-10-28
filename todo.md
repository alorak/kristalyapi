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

### D2.2 — Pristine 1H-MoS₂ gerçek SCF kabulü (uygulama ve test altyapısı, fizik hesabı bekliyor)

- [x] D2.1'deki gerçek Si kabul API/Docker/worker alt yapısını yeniden kullanan **MoS₂ kabul planı**: ideal üç atomlu 1H yapı, sabit PBE, 8/12/16×k×1, 60/80/100 Ry ve c=18/24/30 Å; vaka parametreleri ve test öncesi duyarlılık ölçütleri.
- [x] Gerçek Mo ve S PSlibrary 1.0.0 UPF kaynak URL/lisans; **her iki SHA-256 operatör tarafından açıkça sağlanmadan hesap başlatma**. Dosyalar doğrulanmadan "pinned" denilmez.
- [x] `tools/qe_mos2_acceptance.py --run/--verify`: gerçek QE/API işlerinin ham çıktısı, SCF yakınsama, Ry/eV, input/cell/atom/k-örgüsü, pseudo ve çıktı hash'leri ve ortak kabul eşiği kanıt denetimi.
- [x] `tests/test_qe_mos2_acceptance.py` negatif/sentetik testleri, manuel iş akışı ve CI/usage rehberi; **gerçek veri oldukları iddia edilmez**.
- [ ] **D2.2 gerçek bilimsel kabul:** operatörün doğruladığı Mo/S UPF SHA-256 değerleriyle manuel Docker/CI koşusu; gerçek başarısızlık/başarı paketlerinin incelenmesi, tekrarlanabilir koşum ve sınırlı k/c/ecut duyarlılığı.
- [ ] **D3 (sonraki PR):** gerçek MoS₂ kabulünden sonra `relax → scf` sunucu worker iş şeması, atomik kuvvet/geometri doğrulaması ve kaynak eşleşmeli 3B önizleme.
- [ ] **D4:** gerçek `bands.x`, `dos.x`, `projwfc.x` zinciri; spin, referans enerji ve yakınsama kanıtı olmadan fiziksel sonuçları birleştirme.
- [ ] **D5:** V_S / V₂S / O_S / O₂@V_S kusur karşılaştırması ve spin/SOC; bağımsız araştırma kabulü.

**Bilimsel sınır:** D2.2'nin ideal monolayer SCF enerji duyarlılığı optik/tek-foton doğrulaması veya makalenin SIESTA sonuçlarının yeniden üretimi değildir. [Kabul protokolü](docs/qe-mos2-validation.md).

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

