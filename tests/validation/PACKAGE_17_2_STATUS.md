# V17.2 — VESTA SCENE kamera yönü (isteğe bağlı, deneysel önizleme)

**30 Ekim 2026** — V17.1 üzerine kurulan VESTA 3.x **kamera
önizleme** aşaması. Gerçek VESTA masaüstü GUI ölçümü **NOT_RUN**;
VESTA ile bilimsel/görsel parite **NOT_ESTABLISHED**.

## Gözlenen biçim ve kaynaklar

VESTA 3.x gerçek kamuya açık kayıtlarında
SCENE satırını 4×4 dönme matrisi ve ardından kaydırma/ölçek
değerleri, PROJT satırını izdüşüm modu ve sayısal bir
perspektif katsayısı, LMATRIX satırını ise ayrı bir yerel
örgü/faz dönüşümü izler.

- Resmî yön tanımı: https://jp-minerals.org/vesta/en/doc/VESTAch10.html
- Resmî perspektif/parallel görsel davranışı:
  https://jp-minerals.org/vesta/en/doc/VESTAch13.html
- Kayıt biçimine gerçek örnekler (WMD-group/Phonons):
  https://github.com/WMD-group/Phonons/blob/master/2015_MAPbI3/MAPbI3-Cubic.vesta
  ve MAPbI3-Tetragonal.vesta (VESTA 3.3/3.1).
- Alternatif açık kaynak yazar referansı:
  https://aiida-crystal17.readthedocs.io/en/stable/_modules/aiida_crystal17/parsers/raw/vesta.html

Resmî kılavuz View Orientation için doğrudan/karşıt
kafes yönlerini tanımlar ancak .vesta SCENE dörtlü matrisinin
OpenGL→Three.js kamera **yön işareti, satır/sütun ve
rotasyon çarpım kuralını** eksiksiz garanti etmez. Bu nedenle
buradaki aktarım fiziksel bir **hipotez** olarak etiketlidir;
gerçek VESTA GUI ekran karşılaştırması yapılmadan eşdeğer
sayılmaz.

## Uygulanan güvenli alt küme

- SCENE 4×4 matrisinin tamamı sayısal ve son satırı
  (0,0,0,1), son sütunu (0,0,0,1) olmalıdır.
  3×3 alt-blok sağ-elli rigid rotasyon olmalıdır; satır
  normları, ortogonallik ve determinantı doğrulanır.
  Bozuk/NaN/Inf/reflection/shear/translation durumunda
  hiç kamera aktarımı yapılmaz.
- **Deneysel yön hipotezi:** SCENE satırlarını sırasıyla
  sağ, üst ve göz/ekrandan dışarı vektörleri olarak alır;
  göz konumu sabit sahne hedefi etrafında mevcut Fit
  mesafesine yerleştirilir. Gerçek VESTA'nın görüntü
  dönüşümüne ait ters/işaret olasılıkları henüz açık.
- **LMATRIX** yerel faz/örgü dönüşümüdür, kamera değildir.
  Kimlik (identity) dışındaki LMATRIX için kamera aktarımı
  **bloklanır**; yerel dönüşüm kameraya uydurulmaz.
- **PROJT 0/1** isteğe bağlı preview içinde sırasıyla
  ortografik/perspektif modu olarak yorumlanır;
  bu yorum gerçek GUI ile hâlâ doğrulanmamıştır.
  İkinci parametre (perspektif şiddeti) ve SCENE
  zoom/pan sayıları **yalnız okuma** düzeyindedir.
  VESTA'nin FOV/kadrajı ve fiziksel eksen işareti ile
  birebir koruma iddiası yoktur.
- **BKGRC** renkleri ve **LIGHT0–LIGHT3** etkinlik
  bilgileri metadata'ya alınır, uygulama teması ve
  mevcut ışıklandırma **değiştirilmez**. Böylece
  yayın kalitesinde ışık paritesi iddia edilmez.
- Dosya içe aktarma sonunda kullanıcıya yalnız
  desteklenebilir bir SCENE matrisi varsa onay sorulur.
  Onay verilirse deneysel görünüm önizlenir; reddedilirse
  normal Fit görünümü kalır. Sonradan Fit ile sıfırlama
  mümkündür.

Bu özellik yapı atomlarına, hücreye, simetriye, BVS
hesaplarına, seçilen fiziksel anotasyonlara veya harita
verisine müdahale etmez. Kamera ayrı bir workspace
snapshot olarak yönetilmeye devam eder.

## Test ve entegrasyon

    node --test tests/vesta-project-view.test.mjs
    node --test tests/vesta-project-style.test.mjs
    node --test tests/offline.test.mjs tests/pages-assets.test.mjs

Birim testler gerçek bir kamuya açık .vesta
dosyasından SCENE sayıları kullanır; kodun
kristalografik render eşdeğerliği değil,
**rigid matris kabulünün** doğruluğunu sınar.
Ek negatif senaryolar: sol-elli/reflected SCENE,
anizotropik ölçek/shear, translation, eksik satır,
NaN, bilinmeyen PROJT kodu, kimlik-dışı LMATRIX,
geçersiz göz uzaklığı, operatör onayı ve uyarılar.

Yeni vesta-project-view.js ES modülü Pages staging ve
offline önbelleğe eklendi, cache adı yenilendi.
Github Actions'ın **merge-only tetikleme**, yetki ve
iş akışı kuralı değiştirilmedi.

**V17.3 güvenli VECTR/THERI/POLYP altkümesi eklendi:** [durum ve bilimsel sınırlar](PACKAGE_17_3_STATUS.md). Termal ve çokyüzlü GUI paritesi hâlâ doğrulanmadı.

## Bekleyen bilimsel kabul

- [ ] VESTA 3.5.8 ile en az 3 farklı SCENE
  (identity, 90° veya bilinen eksen, genel 3D yön)
  ve ortografik/perspektif gerçek GUI eş görüntüsü.
- [ ] VESTA Orientation GUI'de [uvw]/[hkl]* vektörleri
  ve üç kristal ekseninin piksel projeksiyonu ile
  yön işareti/satır–sütun yorumunun doğrulanması.
- [ ] SCENE zoom/pan, PROJT perspektif şiddeti ve
  clipping için gerçek piksel/merkez/ölçek denetimi.
- [ ] Nonidentity LMATRIX, çoklu faz ve LORIENT
  durumunda bilimsel dönüşüm tanımı ve bağımsız test.
- [ ] LIGHT0–3 fiziksel yön/renk ile VESTA GUI eşlemesi;
  BKGRC/detaylı appearance seçeneklerinin kontrollü
  aktarımı.
- [ ] V17.4 .vesta export ve masaüstü round-trip
  gerçek GUI kabulü.

**Önerilen devam:** V17.3 gerçek dosyaya dayalı ADP/
vektör/polyhedron metaverisi ve güvenli altküme,
ardından V17.4 .vesta export. Gerçek GUI kabulü
beklerken V17.2 ölçüm kapısı açık tutulmalıdır.
