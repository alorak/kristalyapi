# V17.1 — VESTA 3.x atom görünümü ve aktarım kayıp matrisi

**Kod durumu (30 Ekim 2026):** İlk alt paket: SITET ve ATOMT
renkleri ile yarıçaplarının sınırlandırılmış görünüm uyarlaması,
aktarılan/kısmen aktarılan/aktarılmayan bloklar için kayıp listesi.
**Gerçek VESTA 3.5.8 GUI ölçümü NOT_RUN; bilimsel parite
NOT_ESTABLISHED.**

## İçe aktarılan alt küme

- ATOMT: Element bazlı RGB renk, küre yarıçapı. SITET değeri
  yoksa elementin kayıtlı ayarı uygulanır.
- SITET: VESTA site numarası ve atom etiketi birebir eşleşir;
  renk ve yarıçap element varsayılanını geçersiz kılar.
- Küre yarıçapı Å değerinden görünüm ölçeğine **yaklaşık**
  dönüştürülür: min(RADII[symbol] || 1.1, 1.6) × 0.8 × 0.52 × visualScale.
  VESTA radius >0 ve <=10 Å; uygulama visualScale aralığı
  [0.2,3] dışındaysa **sessiz kırpma yok**, uyarı ve default.
  Bu yalnız uygulamanın ball sahne stili için bir dönüştürmedir;
  VESTA sahne ışığı, kamera, küre tessellation ve ellipsoid
  eşdeğerliği değildir.
- RGB 0–255 tamsayı, 1000 satır sınırı, negatif/geçersiz
  radius, site numarası/etiketi, tekrarlanan kayıt ve
  sonlandırma denetimi. Koordinat ve doluluk bozulmaz.
- transferReport: imported, conditional, partial,
  approximated, external_link_only, not_transferred ayrımı.

## Bilerek dönüştürülmeyenler

SCENE, LMATRIX (kamera, ışık); VECTR/VECTT/VECTS (vektörün
bilimsel anlamı); THERI (ADP çizim seçenekleri);
POLYP/POLYS/BONDP (çokyüzlü stilleri), IMPORT_STRUCTURE,
IMPORT_TEXTURE ve IMPORT_ORFFE (harici veriler) aktarılmaz.
Dosya yollarına otomatik erişilmez. CELLP/STRUC ve
önceden mevcut BOUND/SBOND/ISURF/IMPORT_DENSITY kısmi
davranışı korunur.

Bilgilendirici aktarım matrisi, kayıpsız .vesta round-trip veya
gerçek VESTA masaüstü kabulü anlamına gelmez.

## Testler

    node --test tests/vesta-project-style.test.mjs
    node --test tests/offline.test.mjs tests/pages-assets.test.mjs

Mevcut sentetik package9-3-signed.vesta fixture, site/element
renk ve yarıçapları, bozuk kayıt ve eksik sonlandırıcı,
aktarılamayan bloklar için negatif testler eklendi.
Testlerin çalıştırılıp geçtiği henüz doğrulanmadı.

Vesta-project-style.js yeni ES modülü, Pages çıktı paketine ve
PWA offline önbelleğe eklendi. Bu yüzden Pages workflow'unda
yalnız cp ve test -s dağıtım satırları değişti. **CI merge-only
tetikleme/izin politikaları değiştirilmedi.**

## Kalan V17 adımları

- [ ] V17.2: Kamera/perspektif/matris ve ışık ayarlarının gerçek
  VESTA GUI'deki anlamlarını ölç, kanıtsız aktarım yok.
- [ ] V17.3: ADP, vektör ve polyhedron renk/yüzey tanımının
  gerçek dosyalarla referanslı transfer alt kümesi.
- [ ] V17.4: Güvenli .vesta 3.x export; açıkça kayıplı alan
  matrisi ve harici grid referansı için kullanıcı seçimi/hash.
- [ ] En az üç gerçek 3.5.x yapı ve bir hacimsel projenin
  VESTA → KristalYapı → VESTA gerçek round-trip kabulü.

VESTA binary dağıtılmaz veya otomatik çalıştırılmış sayılmaz;
scientificParity=NOT_ESTABLISHED korunur.
