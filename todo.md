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
- [ ] Her geometri için `relax` → `scf` → `nscf`/bands/PDOS sırasını durum makinesiyle yönet; hesabı tamamlanmış gibi gösterme.- [ ] Her geometri için `relax` → `scf` → `nscf`/bands/PDOS sırasını durum makinesiyle yönet; hesabı tamamlanmış gibi gösterme.
- [ ] DFT sonuçlarına: solver/sürüm, işlevsel, pseudopotential SHA256, k-ızgara, toplam enerji, kuvvet, çalıştırma tarihi, yakınsama ve model kimliği ekle.
- [ ] Farklı atom sayısı ve kimyasal potansiyeller için doğru kusur oluşum enerjileri; yalnız toplam enerjileri doğrudan karşılaştırma.

### M-P2 — Makale Şekil 4(c,g): bantlar ve PDOS

- [x] **İlk görselleştirme:** yerel `electronic-results.json` üzerinden ham QE bant ve toplam DOS/PDOS SVG grafiklerini göster; biçim/sayı kontrolü ve boyut sınırlaması; yanlış Fermi/vakum hizalaması iddiası olmadan.
- [x] **Atom/orbital PDOS teknik ilk paket:** `projwfc.x` atom indeksi ve elementleri son SCF atom sırasıyla doğrulanır; s/p/d/f LDOS toplamları `pdos.pdos_tot` ile karşılaştırılır ve Mo-d, S-p, O-p ile tek atom görünümleri sağlanır. Yalnız kollineer-spin-polarize olmayan sonuçlar; gerçek MoS₂ DFT koşumu henüz doğrulanmadı.
- [ ] Quantum ESPRESSO `bands.x`, `dos.x`, `projwfc.x` çıktılarının kaynak/birim doğrulamalı içe aktarımı.
- [ ] Band / DOS / PDOS grafiklerinin ortak enerji referansı, spin kanalı, orbital ve atom projeksiyonları; yoğunluk–bant enerjisi ayrımını koru.
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
