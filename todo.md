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
- [ ] Kullanıcı atomu, doluluğu ve hücreyi değiştirdiğinde `F(hkl)` kompleks
  fazörleri ile eşzamanlı pik/eksilme gösterimi. BCC (100), FCC (100),
  diamond Si (200) sönme regresyonları.
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

- [ ] Atomik ayrık seviyeler → iki atom → N atom zinciri → bant animasyonu,
  enerjilerin sayısı ve düzey yoğunluğu açık tutulsun.
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
