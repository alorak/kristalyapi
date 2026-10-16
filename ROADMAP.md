# Kristal Yapı — VESTA farkları ve geliştirme sırası

## Görselleştirme, workspace ve mimari paketi · Ekim 2026

| Başlık | Uygulanan ilk kapsam | Kalan doğrulama / geliştirme |
| --- | --- | --- |
| Aç / kaydet ve kütüphane | Favoriler (COD yer imi + örnek yapı), hazır yapılar ve yerel dosyaları birleştiren Aç modalı; simgeli kompakt üst butonlar, Kütüphane içinde etkin workspace göstergesi | Çoklu dosyayı aynı anda açma, yeniden adlandırılmış favori koleksiyonları, tam klavye/ekran okuyucu denetimi |
| Dil ve panel başlıkları | TR/EN için statik Türkçe başlık kaynakları; düğmelerin hover görünürlüğü, UI çevirileri | Dinamik bilimsel hata mesajlarının tam çift dilliliği |
| Çizim ölçeği | Atomlar element bazlı, bağlar toplu `InstancedMesh`; atom sınırı 20.000, bağ sınırı 65.000; 5.000+ atomda basit küre | Farklı cihazlarda FPS/GPU bellek ölçümü, instanced ADP/etiketler, daha büyük yapı için LOD ve WebGPU |
| Çokyüzlü ve site stilleri | Alt model listesinde polyhedra, seçilebilir merkez türü, varsayılan/atom sitesi bazında renk ve opaklık, atom sitesi rengi/ölçeği | Çokyüzlü sayısı 64 merkezle sınırlı; yoğun/karmaşık sahne optimizasyonu, per-facet stiller |
| Sınırlar ve çıktı | x/y/z için −1…2 kesirli pencere, periyodik görüntüler; 1×–4× beyaz/şeffaf PNG (24 MP/8192 px sınırı) | TIFF/SVG, 3B STL/glTF, tipografi/vektörel makale çıktıları |
| Dosya mimarisi | HTML iskeleti + `styles.css` + `crystal-app.js` + `translations.js`; GitHub Pages ve test dağıtımı güncellendi | Tek büyük uygulama modülünü domain modüllerine bölme, import/export API sınırları, offline vendor bundling |

Bu pakette bildirilen atom/bağ sayıları **koruyucu uygulama sınırlarıdır, ölçülmüş performans hızlanması değildir**. Canlı COD ve Three.js CDN'i ağ gerektirmeye devam eder.

## P1 ilerleme · Ekim 2026

Bu bölüm önceki faz notlarını günceller; aşağıdaki işler P1 geliştirme dalında gerçekleştirildi ve regresyonlarla sınanıyor:

| Başlık | Eklenen kapsam | Bilimsel ve teknik sınır |
| --- | --- | --- |
| Hacimsel matematik | Eş birim/koordinat kontrolüyle `A+k·B`, farklı çözünürlükte trilineer örnekleme, 26 komşulu 3B ekstremum araması ve CSV | Birim etiketi bilinmeyen CUBE niceliklerini kimyasal olarak doğrulamaz; 2,5 milyon voksel sınırı geçerli |
| Miller kesitleri | Kristalin gerçek karşı-örgü metriğiyle `(hkl)` yönlü 2B sayısal kesit, ızgara sınırlarına kırpma, PNG/CSV ve kontur | Hesaplanan kesit veri olmayan alanda extrapolasyon yapmaz; inceleme çözünürlüğü sınırlıdır |
| Kinematik saçılma | 98 nötr element için IT92 X-ışını form faktörü; 90 element için koherent nötron uzunluğu, tam Kartezyen ADP, isteğe bağlı Bragg–Brentano LP | İyonik form faktörleri, anomal katkı, özel izotoplar, pik profili/absorpsiyon ve Rietveld yok |
| Türetilmiş model haritası | Hesaplanan `F(hkl)` ile 16³/24³ periyodik Fourier/Patterson ters dönüşümü | Fobs/Fo−Fc değildir; sonlu yansıma kesimi ve Gibbs artefaktları vardır |
| Voronoi | E/Å³ periyodik elektron yoğunluğunda en yakın çekirdeğe sayısal integral ve CSV | Bader sıfır-akı havzaları değildir; örnekleme ve site limiti nedeniyle yakınsama gerektirir |
| Madelung | Açık iyon yükleriyle nötr P1 hücrede gerçek/karşı-uzay + self terimli Ewald, site potansiyeli ve eV/cell | Noktasal iyon modeli; kısmi doluluk, polarizasyon/dielektrik etki ve elektronik yapı yok |
| Dosya kapsamı | PDB/ENT CRYST1, ATOM/HETATM, ilk MODEL, ANISOU; PDB P1 dışa aktarımı | `.vesta`, geniş biyomoleküler topoloji, manyetik mCIF/setting dönüşümleri tamamlanmadı |

**Kalan P1 önceliği:** deneysel Fobs/MTZ kaynağı ve doğrulaması; özgül izotop/anomal saçılma; yüksek performanslı büyük-ızgara analizi; gelişmiş CIF/mCIF/PDB ve VESTA proje biçimi; manyetik moment vektörleri; ayrıntılı Hall setting/orijin dönüşümleri.

Bu plan gerçek VESTA özellikleriyle statik HTML/CSS/JavaScript tabanlı tarayıcı uygulamasını karşılaştırır. Sıra hem bilimsel doğruluğu hem de kullanıcı arayüzünün anlaşılabilirliğini esas alır. **Bir özellik UI'da mevcut diye bilimsel olarak doğrulanmış sayılmaz.** Canlı COD araması internet/CORS'a; 3B görüntü Three.js CDN'ine bağlıdır.

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
- Çalışma yapılırken tek dosya düzeni, harici Three.js CDN bağımlılığı ve çevrimdışı kullanım hedefi birlikte değerlendirilmelidir.

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
