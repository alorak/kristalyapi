# Paket 7 — bilimsel doğrulama durumu

Bu belge uygulama kodunda ve `main` dalı geçmişinde doğrulanabilen kapsamı
özetler. Bir PR'ın merge edilmiş olması testlerin tamamının yürütüldüğünü
veya VESTA ile bilimsel eşdeğerliği **kanıtlamaz**.

| Paket | Gerçekleşen | Kalan |
|---|---|---|
| 7.1 · CIF accuracy gate (#52) | 30 gerçek + 10 sentetik yapı için bağımsız Gemmi kıyaslaması; beklenmeyen `inconclusive` sonucu başarısız kabul eden gate | Bilinen belirsiz kaynaklar ve daha geniş veri kümesi |
| 7.2 · Koordinasyon (#53) | SC/BCC/FCC/triklinik periyodik komşu mesafeleri bağımsız brute-force oracle ile kıyaslanıyor | Polyhedron köşe geometrisi, kısmi doluluk, dar/çarpık hücrelerde geniş görüntü araması |
| 7.3–7.4 (#54) | ADP tensör invariantları, hücre metriği, sistematik sönüm ve Bragg referansları; mevcut JS round-trip testleri | Daha geniş bağımsız karşılaştırma ve simetri operasyonları |
| 7.5 (#54) | Bilimsel ve görsel sonuç durumlarını ayrı bildiren rapor | Gerçek Chromium/WebGL testi merge-only CI'da çalışmıyor; görsel metriklerin otomatik toplanması yok |
| 7.6 · CIF round-trip (#56) | Orijinal kaynağın birebir saklanması, düzenleme sonrası yeniden üretim, doluluk/ADP regresyonları | Düzenlenmiş CIF'de bilinmeyen tüm etiketlerin kayıpsız round-trip garantisi yok |
| 7.7 · ADP simetri (#57) | Hücreye özgü ADP genişletmesi; fiziksel olmayan simetri işlemlerinin reddi; mCIF bileşik dönüşüm; ortorombik/monoklinik/hekzagonal, CIF/mCIF testleri | Gerçek deneysel ADP veri setleri ve özel konum site-symmetry tensör kısıtları |
| 7.8 · Koordinasyon (#58, #59) | Metrik tabanlı periyodik görüntü sınırları; minimum görüntü, bağ ağı ve çizim; kısmi doluluk ağırlıklı CN; eşsiz çokyüzlü köşeleri; bağ açıları, alan/hacim; bağımsız Node ve Chromium kontrolleri | Kimyasal bağ sırası/oksidasyon, karşılıklı bağımlı düzensizlik modelleri, hacimsel belirsizlik ve geniş deneysel kıyaslama |
| 7.9 · Kristal kimyası (bu PR) | BVS için tam periyodik görüntü araması; Baur D, Hoppe ECoN, doğrulanmış tetra/octa için quadratic elongation ve bağ açısı varyansı; BVS referans bağ uzunluğu; bağımsız analitik ve görsel testler | Kapsamlı valans-parametre tablosu, düzensizlik korelasyonları, genel iyonik yük dağılımı ve deneysel ölçüm belirsizlikleri |

## 7.7 ile düzeltilen önceki doğrulama açıkları

- `expandSites(sites,key,limit,cell)` artık verilen yapının **kendi** hücresini
  ADP dönüşümünde kullanabiliyor. Eski UI çağrılarını korumak için dördüncü
  parametrenin varsayılanı `state.cell` olarak tutuldu.
- `adpRotateBySymmetry`, `R Rᵀ ≈ I` koşulunu sağlayamayan,
  dolayısıyla o hücrenin gerçek simetrisi olmayan dönüşümleri reddediyor.
  Yalnızca pozitif tanımlı ADP kontrolü bu hatayı yakalayamıyordu.
- mCIF'de konumlara uygulanan manyetik simetri + merkezleme bileşkesi
  anisotropik ADP tensörüne de uygulanıyor (zaman tersleme ADP'yi değiştirmez).
- Önceki #54 merge'inden sonra dalda kalmış 7.5 düzeltmesi bu PR'da
  tekrar işlendi: görsel metrik dosyasının yalnız varlığı başarı sayılmıyor.
- 7.2'nin `tests/coordination-reference.test.cjs` dosyası önceden Pages CI
  test komutunda **yoktu**; artık merge-only doğrulamada çalıştırılacak.

## 7.8 koordinasyon doğrulaması

- Periyodik koordinasyon, minimum görüntü, bağ ağı ve bağ çizimi
  yalnız ±1 örgü hücresiyle sınırlandırılmıyor. Arama kutusu, gerçek
  **kartezyen kesim yarıçapının karşılık gelen ters örgü bileşenlerindeki
  izdüşümünden** hesaplanıyor; bu sınır içindeki tüm görüntüler inceleniyor.
- Arama kutusu 200.000 (koordinasyon/minimum görüntü) veya 300.000
  (bağ ağı/bağ çizimi) görüntü adayından fazla olduğunda algoritma
  **açıkça hata veriyor**, komşuları sessizce eksiltmiyor.
  Poligonlar için seçilen maksimum 24 komşu sınırı kullanıcı tercihidir;
  küresel koordinasyon sayısı garantisi olarak yorumlanmamalı.
- Geometrik komşu sayısı (\`CN\`) ve doluluk ağırlıklı \`Σoccupancy\`
  ayrı değerlerdir. Alternatif türler aynı konumu işgal ediyorsa
  geometrik çokyüzlüde **tek köşe** kullanılır; buna rağmen ağırlıklı
  katkıları ayrı kalır. Ortak işgal olasılıkları/bond valence çıkarılmaz.
- Seçilen atomun komşuluk panelinde en küçük/en büyük merkez açıları
  ve kapalı bir konveks gövde oluşuyorsa çokyüzlü alan/hacmi gösterilir.
  Üretilen 3B çokyüzlülerin alan/hacim toplamı da mesh metadata'sında
  bulunur; kristal hücre hacmi ile karıştırılmamalıdır.
- \`tests/coordination-reference.test.cjs\` üzerinde bağımsız -6…+6
  görüntü taraması, SC/BCC/FCC/triklinik/çok eğik hücre, doluluk,
  oktahedral açılar, tetrahedral hacim ve yozlaşmış geometri testleri var.
- \`tests/browser/visual.test.mjs\` için 125 ideal TiO6 oktahedronun
  analitik \`V=a³/6\`, \`A=√3 a²\` sonuçlarına kıyaslama eklendi;
  bu Chromium testi standart merge-only CI'da **henüz çalıştırılmıyor**.

## 7.9: nicel kristal-kimya ve VESTA formülleri

- **Baur bozulma indisi**: `D = mean(|li - lmean|) / lmean`.
- **Hoppe ECoN**: `lmin` için `wi0 = exp(1-(li/lmin)^6)`;
  `lav = sum(li*wi0)/sum(wi0)`; son olarak
  `ECoN = sum(exp(1-(li/lav)^6))`.
  Bu değer, 7.8'deki `Σoccupancy` ile **aynı değildir**.
- **Quadratic elongation**, ancak **gerçek 4-köşeli tetrahedral** veya
  **6-köşeli oktahedral** yüz topolojisi kanıtlanınca
  `mean((li/l0)^2)` ile hesaplanır. `l0`, ölçülen konveks hacimle
  eşdeğer düzenli tetra/octa için merkez-köşe uzaklığıdır.
- **Bağ açısı varyansı**: yalnız çokyüzlünün gerçek kenarlarının
  merkezde gördüğü açılarla; tetra için `acos(-1/3)`, octa için `90°`
  referans ve `m-1` böleni kullanılır. Kesişen düzlemsel üçgenler
  veya üçgen prizmanın yüz üçgenlemesi oktahedron sayılmaz.
- **Kısmi / alternatif doluluk** durumunda yalnız eşsiz *geometrik*
  köşeler için ECoN/D raporlanır, yorum kısıtı açıkça belirtilir.
  `24` komşu sınırına gelmiş kabukta nicel sonuçlar güvenilir
  sayılmaz; bu duruma uyarı verilir.
- **BVS**: önceden sabit `-2…+2` örgü kaymaları bütün eğik hücreler
  için yeterli değildi. 7.8'in ters-örgü metriğinden türetilen
  `coordinationImageBounds` ile tüm fiziksel kesim küresi kapsanır.
  Arama 200.000 görüntü, sonuç 20.000 komşu sınırında fail-closed
  davranır. BVS hesaplaması katyon site'sinin *var olmasına koşulludur*;
  ligand dolulukları ağırlıklandırılır.
- **Beklenen eşit bağ uzaklığı** (deneysel geometri tahmini değil):
  `R = R0 - B ln(q / Σoccupancy)`; seçili iyon çifti, referans
  formal yük ve bağ-değerliği sabiti ile hesaplanır. Tüm gerçek
  bağların eşit uzunlukta olduğunu iddia etmez.

**Kaynak:** VESTA resmî [Kılavuz §11.4.3](https://jp-minerals.org/vesta/en/doc/VESTAch11.html).
Analitik referanslar düzenli tetra/octa, bozulmuş octa, üçgen
prizma ve ±7 brute-force periyodik komşuluk testlerini içerir.

## CI ve bilimsel kapsam ayrımı

- Pages iş akışı `main` push sonrası native Node regresyonlarını çalıştırır.
- CIF bilimsel workflow'u uygun yol değişikliklerinde Gemmi doğrulamasını yürütür.
- **Üçüncü workflow** olan `.github/workflows/browser-visual.yml`, uygun
  `main` push olayında gerçek Playwright/Chromium WebGL testini çalıştırır.
  Artık test sonucunu ayrıca `visual-status.json` olarak artifact içinde
  yazar (`pass`/`fail`/`not_run`).
- `cif-validation.yml` içindeki bilimsel birleşik rapor farklı bir
  workflow'da üretildiği için görsel artifact'i **kendiliğinden
  içeri almaz**. `combined_report.py --visual visual-status.json`
  ile dosya dışarıda birleştirilebilir; merkezi otomatik aggregator
  hâlâ ayrı bir iş olarak kalır.
- Daha kapsamlı bir bilimsel doğrulama için gerçek deneysel ADP/Uij referansları,
  alternatif uzay grubu ayarları ve özel konum tensör kısıtları gerekir.
