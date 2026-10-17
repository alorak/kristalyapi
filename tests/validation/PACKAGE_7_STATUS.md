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
| 7.7 · ADP simetri (bu PR) | Hücreye özgü ADP genişletmesi; fiziksel olmayan simetri işlemlerinin reddi; mCIF bileşik dönüşüm; ortorombik/monoklinik/hekzagonal, CIF/mCIF testleri | Gerçek deneysel ADP veri setleri ve özel konum site-symmetry tensör kısıtları |
| 7.8 · Koordinasyon (sonraki) | Henüz geliştirilmedi | Komşuluk/köşe/çokyüzlü alan-hacim, sınır atomları, çoklu görüntüler ve kısmi doluluk eşleştirmeleri |

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

## CI ve bilimsel kapsam ayrımı

- Pages iş akışı `main` push sonrası native Node regresyonlarını çalıştırır.
- CIF bilimsel workflow'u uygun yol değişikliklerinde Gemmi doğrulamasını yürütür.
- `tests/browser/visual.test.mjs` mevcut fakat iki workflow'un standart
  doğrulama adımlarında yürütülmüyor; bu nedenle birleşik raporda görsel
  statü normalde `not_run` olmalıdır.
- Daha kapsamlı bir bilimsel doğrulama için gerçek deneysel ADP/Uij referansları,
  alternatif uzay grubu ayarları ve özel konum tensör kısıtları gerekir.
