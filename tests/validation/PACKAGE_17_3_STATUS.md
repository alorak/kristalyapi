# V17.3 — VESTA vektörleri, THERI/ADP ayrımı ve POLYP renk aktarımı

**30 Ekim 2026.** Kısmi görsel aktarım geliştirildi. Gerçek VESTA 3.5.8
GUI karşılaştırması **NOT_RUN**; bilimsel eşdeğerlik **NOT_ESTABLISHED**.

## Aktarılan güvenli altküme

**VECTR / VECTT / VECTS**

- Kaynaktaki 3 satırlı vektör girdilerinin atom ID, label,
  sonlu Kartezyen bileşen, VECTT RGB ve sınırlı VECTS ölçeği
  alınır; VECTT yarıçap/penetrasyon ayarı birebir uygulanmaz.
- Vektörler **manyetik moment, kuvvet, hız veya yer değiştirme
  değildir**; kaynakta fiziksel semantik yoksa yalnız
  UNSPECIFIED_DISPLAY_ARROW olarak ele alınır.
- Ayrı **VESTA çizim okları** katmanı, en fazla 200 ok,
  5 birime kadar görsel uzunluk sınırı. Bu limit fiziksel
  birim dönüşümü değildir. Hatalı atom eşleşmesi, duplicate,
  VECTT uyuşmazlığı, eksik sonlandırıcı, advanced ofset,
  sıfır veya sonlu olmayan değer güvenli reddedilir.
- Oklar sadece listedeki **P1 / simetri genişletmesi kapalı**
  yerleşimle çizilir. Simetriyle eşdeğer site oklarının
  tensör/vektör dönüşümü kanıtlanmadığı için çizilmez.
- Proje JSON, Undo/Redo ve çalışma alanı durumuna fiziksel
  magneticMoment alanından ayrı girer. Atom etiketi silinir
  veya değiştirilirse artık bağlanamayan ok kaldırılır.

**THERI**

- Yalnız site ID, label, görünüm faktörü ve mod kodu
  metadata olarak tutulur; bu değerler Uiso/Biso veya
  Uij/betaij tensörü **değildir**. Otomatik ADP
  elipsoidi oluşturulmaz.
- Anizotropik yer değiştirme gerçek CIF ADP'den geliyorsa
  mevcut bilimsel yol korunur. STRUC continuation / termal
  verinin başka VESTA sürümlerindeki birimleri ve formatı
  gerçek veriyle kanıtlanmadığı sürece tahmin edilmez.

**POLYP**

- Tek satırlı global POLYP RGB, uygun ve geçerliyse
  KristalYapı global polyColor alanına aktarılır.
- Merkez, komşuluk, facet bazlı stil, opaklık,
  polyhedron tipi ve hacim **aktarılmış sayılmaz**.
  POLYP ilk 3 sayısal parametresi yalnız metadata'dır.
- Renk olsa bile çokyüzlü çizim modu kendiliğinden açılmaz.

## Kanıt ve sınırlar

Kullanılan VESTA alanlarına ilişkin kaynaklar:
- https://jp-minerals.org/vesta/en/doc/VESTAch6.html
- https://github.com/lucydot/vesta_vectors
- https://github.com/WMD-group/Phonons/blob/master/2015_MAPbI3/MAPbI3-Cubic.vesta

Birim testleri, bu kamuya açık dosyalardaki VECTR/VECTT
ve THERI/POLYP biçimlerinden **uyarlanmış sentetik**
veriler kullanır; gerçek VESTA GUI ekran/ölçüm paritesi
yerine geçmez.

## Doğrulama

    node --test tests/vesta-project-scientific.test.mjs \
      tests/vesta-project-style.test.mjs \
      tests/vesta-project-view.test.mjs \
      tests/offline.test.mjs tests/pages-assets.test.mjs

Yeni bilimsel stil modülü Pages staging'e, PWA cache'e,
mevcut merge-only CI Node test koşumuna eklendi.
Workflow tetikleme ve izinleri değiştirilmedi.

## Açık kabul

- [ ] VESTA 3.5.8 GUI ok başlangıcı, yön, renk, boyut,
      radius/penetrasyon etkisi; gerçek örneklerle piksel kıyası.
- [ ] Yüksek simetride gerçek site-vektör dönüşümlerini
      matematik ve VESTA GUI ile kanıtla.
- [ ] Termal Uij/betaij/Uiso alanlarının .vesta içindeki
      tam karşılığını, kaynak birimi ve pozitif tanımlılığı
      kanıtlamadan otomatik elipsoid üretme.
- [ ] POLYP/BONDP facet, saydamlık, komşuluk ve
      topoloji karşılaştırmasını bağımsız test et.
- [ ] V17.4 güvenli VESTA 3.x export altkümesi ve gerçek
      VESTA desktop round-trip, veri kaybı manifesti.

**Sıradaki öneri:** V17.4 export ve round-trip altyapısı.
