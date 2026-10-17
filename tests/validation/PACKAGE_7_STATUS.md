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
| 7.8 · Koordinasyon (bu PR) | Metrik tabanlı periyodik görüntü sınırları; minimum görüntü, bağ ağı ve çizim; kısmi doluluk ağırlıklı CN; eşsiz çokyüzlü köşeleri; bağ açıları, alan/hacim; bağımsız Node ve Chromium kontrolleri | Kimyasal bağ sırası/oksidasyon, karşılıklı bağımlı düzensizlik modelleri, hacimsel belirsizlik ve geniş deneysel kıyaslama |

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

## CI ve bilimsel kapsam ayrımı

- Pages iş akışı `main` push sonrası native Node regresyonlarını çalıştırır.
- CIF bilimsel workflow'u uygun yol değişikliklerinde Gemmi doğrulamasını yürütür.
- `tests/browser/visual.test.mjs` mevcut fakat iki workflow'un standart
  doğrulama adımlarında yürütülmüyor; bu nedenle birleşik raporda görsel
  statü normalde `not_run` olmalıdır.
- Daha kapsamlı bir bilimsel doğrulama için gerçek deneysel ADP/Uij referansları,
  alternatif uzay grubu ayarları ve özel konum tensör kısıtları gerekir.
