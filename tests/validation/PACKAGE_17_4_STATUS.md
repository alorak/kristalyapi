# V17.4 — Kayba duyarlı VESTA 3.x dışa aktarma (P1)

**30 Ekim 2026.** V17.1/17.2/17.3 içe aktarma altkümeleri
üzerine iki ayrı tarayıcı kaydetme işlemi eklendi:

- **VESTA (.vesta) — P1 altkümesi:** yalnız listelenen
  asimetrik/temel atomları, hücreyi, doluluğu, görsel renk/
  yaklaşık yarıçapı, sınırları ve açıkça girilmiş SBOND
  eşiklerini yazar.
- **VESTA kayıp raporu (.vesta.loss.json):** o anda aynı
  çalışma alanından üretilecek UTF-8 VESTA metninin
  SHA-256 özeti, dışarı aktarılan site/bağ sayıları, açıkça
  yazılmamış bilimsel/görsel alanların listesi.

İki indirme kullanıcının **ayrı ayrı tıklamasıyla** başlar.
İki tık arasında yapı değişirse dosyalar uyuşmaz;
rapordaki SHA-256 özetinin indirilen .vesta dosyasının
hash'iyle eşleşmesini kontrol edin. Herhangi bir dış
VESTA binary çalıştırılmış gibi davranılmaz.

## Bilimsel sözleşme

**Yazılanlar (sınırlı veya yaklaşık):**

| Alan | Yazılma kuralı |
| --- | --- |
| VESTA 3.5 header | Sadece CRYSTAL yapısı, sürüm 3.5.0 |
| GROUP/SYMOP | **Sabit P1** ve kimlik dönüşümü |
| CELLP | a,b,c, alpha,beta,gamma; 6 ondalık basamak |
| STRUC | En çok 1.000 atom; kesirli x/y/z 6 hane, occupancy 4 hane; tek token ASCII label |
| BOUND | 3 kesirli eksen sınırı, [−1,2] |
| SITET/ATOMT | RGB ve KristalYapı ball modu küre yarıçapından **yaklaşık** görünüm boyutu |
| SBOND | Açıkça tanımlanmış 80 adede kadar element çifti min/max mesafe kuralı |
| STYLE/BONDS/LABEL/POLYP | Basit toggle ve POLYP global RGB; **tam sahne paritesi değil** |

Etkin uzay grubu P1 dışındaysa **dışa aktarma reddedilir**;
simetriyi sessizce kaldırıp tek asimetrik siteyi tüm fiziksel
yapı gibi göstermeyiz. SG numarası farklı, ancak kullanıcı
simetriyi bilinçli olarak kapattıysa yalnız **listelenen P1
siteleri** yazılır ve özgün SG kaybı raporlanır. Periyodik
olmayan yapı, bozuk kafes metrikleri, sayısal olmayan/duplike
etiket, eksik/taşkın koordinat ve kontrolsüz bond eşikleri
güvenli reddedilir. Yansıma, simetri setting veya origin
uydurulmaz.

**Yazılmayanlar:**

- ADP Uiso/Uij/betaij: VESTA birim konvansiyonu kesin
  doğrulanmadan tensör yazılmaz.
- MagneticMoment ve VECTR: vektör çizim okları fiziksel
  moment sayılmaz; eksik VECTT kalınlık/penetrasyon ayrıntısı
  olduğu için yazılmaz.
- SCENE, LMATRIX, PROJT, lighting: Gerçek VESTA 3.5.8
  satır-sütun/orientasyon ve zoom eşlemesi kanıtlanmadı.
- POLYP çokyüzlü merkez/komşu, facet/opacity ve hacim.
- Supercell repetition, overlays, morfoloji ve Miller
  görsel katmanları.
- IMPORT_STRUCTURE / IMPORT_TEXTURE / IMPORT_ORFFE /
  IMPORT_DENSITY: Tarayıcıdan dış disk/URL taranmaz,
  **hacimsel veri gömülmez veya harici dosya yolu
  tahmin edilmez**. Density mevcutsa manifest
  externalFiles nesnesi yalnız role= density-grid,
  path=null, sha256=null, NOT_BUNDLED_NOT_HASHED
  alanlarını içerir. Gerçek binary kaynak hash'i
  hesaplanmış gibi gösterilmez.

**Alternatifler:** Tüm KristalYapı düzenleme bilgilerini
korumak için .kristal.json; kristalografik atom ve ADP
aktarımı için CIF/mCIF veya uygun fiziksel format.

## Aynı uygulamanın round-trip testi

    node --test tests/vesta-project-export.test.mjs \
      tests/vesta-project-style.test.mjs \
      tests/vesta-project-view.test.mjs \
      tests/vesta-project-scientific.test.mjs \
      tests/offline.test.mjs tests/pages-assets.test.mjs

Yeni unittest dosyası üretici metnini uygulamanın
**üretimdeki vestaProjectData** okuyucusuna, test ortamında
uygun yardımcı fonksiyonlarla verir; P1 hücre parametreleri,
atom sayısı, doluluk, kaynak etiketleri, yaklaşık küre boyutu,
SBOND, POLYP gibi alanları tekrar kontrol eder. Bu VESTA
binary/GUI yükleme doğrulaması **DEĞİLDİR**.
Kayba ilişkin negatif girdiler ve SHA-256
metin-bağımlılığı da test edilir.

Merge-only CI Node test koşumuna yeni dosya eklendi;
vesta-project-export.js, Pages dağıtımında ve
offline/PWA shell içinde. CI trigger/yetki değişmedi.

**V17.5 operatör kanıt/kabul altyapısı eklendi:** [üç CIF + bir gerçek CCP4 için hazırlama, SHA mühürleme ve gerçek GUI fark protokolü](PACKAGE_17_5_STATUS.md). Bu bir gerçek desktop VESTA testinin tamamlandığı anlamına gelmez; GUI NOT_RUN, scientificParity NOT_ESTABLISHED.

## Gereken gerçek bilimsel kabul

- [ ] En az üç VESTA 3.5.x gerçek yapıda export edilen
  .vesta dosyasının VESTA GUI'de **başarıyla açılması**.
- [ ] En az bir kaynakta 3D density grid + ayrı binary dosya
  ve manifest. Hacimsel verinin kayıpsız yazımı
  **henüz uygulanmadı**; kaynak hash ve fiziksel birim
  kanıtı olmadan referans yolu oluşturma.
- [ ] P1 site koordinatı/occupancy/cell, çizim
  atom yarıçapları, bağ görünümü ve facet renginin
  gerçek GUI ekran/ölçüm fark matrisi.
- [ ] ADP/setting/SCENE/vektör birimlerinde eksik alan
  durumunun VESTA UI üzerinde açık teyidi.
- [ ] VESTA → KristalYapı → VESTA → KristalYapı
  tüm kontrollü altkümelerde SHA-pimli, sayısal
  kabul raporu. Mevcut test **yalnız
  KristalYapı → .vesta → KristalYapı**.
- [ ] VESTA format özelliklerinin desteklenen
  kullanıcı sürümleri için bağımsız belgelenmesi.

**Durum:** codeImplemented=YES, nativeNodeTests=NOT_RUN
(bu PR hazırlama ortamında), desktopVesta=NOT_RUN,
scientificParity=NOT_ESTABLISHED.

VESTA format belgeleri:
- https://jp-minerals.org/vesta/archives/VESTA_Manual.pdf
- https://atomsk.univ-lille.fr/doc/en/format_vesta.html
