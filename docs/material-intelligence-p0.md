# P0 — Malzeme veri kartları ve XRD pik eşleştirme

## Uygulanan (P0)
- **Malzemeler** sayfası (`#malzemeler`): etkin çalışma alanından açık P1 atomlarıyla salt okunur anlık yapı kartı. 1–4 kart için bileşim (doluluk ağırlıklı), hücre ölçüleri, hacim ve göreli geometrik farklar. Kaynak kimliği kullanıcı beyanıdır; COD/deney/DFT bağı otomatik kurulmaz. Kartlar sekme belleğinde kalır; JSON ve CSV açık kullanıcı eylemiyle dışa aktarılır.
- Editör > sağ panel > **XRD**: zaten var olan ölçüm CSV + hesaplanan profil üst üste gösterimine, iki-teta **pik konumu** eşleştirmesi eklendi. Sinyal yerel maksimumları (göreli şiddet ve yakın çevre belirginliği) seçer. Kuvvetli teorik yansımalar en yakın kullanılmamış ölçüm pikiyle tolerans içinde bire bir eşleşir. Eşleşen/eşleşmeyen pikler CSV olarak dışa aktarılır.
- **Zorunlu operatör kapısı:** dalga boyu ve 2θ ekseni eşdeğerliğini kullanıcı beyan eder. Model veya çalışma alanı değiştiğinde eski eşleşme temizlenir; ölçüm değişiminde onay sıfırlanır.
- Hesaplar salt-okunur; veri uzak servislere gönderilmez. P0 testleri saf fonksiyonlar üzerinden çalışır. Dosyalar Pages ve çevrimdışı shell'e dahil edilir.

## Bilimsel sınırlar
- Kartlar kimyasal bileşim ve kristal geometrisi sunar; faz kimliği, mutlak yapı doğruluğu, DFT veya ölçülmüş özellik olarak **yorumlanmaz**. Farklı konvansiyonel/primitive hücrelerin hacimleri doğrudan karşılaştırılmamalıdır. Kart kaynağı kullanıcı tarafından girilir, otomatik güvence veya imzalama yoktur. Tam kristal yapısı JSON'a eklenmez; kart bir özet içerir.
- XRD aracı otomatik **faz tayini, safsızlık ölçümü, kalibrasyon, sıfır kayması düzeltmesi, Kα₂ ayrıştırması, pik genişliği/gerinim tayini, arka plan fit, Rietveld rafinmanı, uygunluk skoru ya da kabul/red** sağlamaz.
- Ölçümde pik belirginliği parametreleri eşiğe ve örnekleme yoğunluğuna duyarlıdır. Farklı tarama koşulları, gürültü, üst üste binmiş pikler, tercihli yönelim ve cihaz etkileri yanlış eşleşmelere yol açabilir. Eşleşme sayısı kalite belgesi değildir.
- Kaynak/ölçüm bilgileri GitHub Pages'e yüklenmez; JSON ve CSV yalnız istemcide hazırlanır.

## Kabul ve test
- `node --test tests/materials-p0.test.mjs tests/xrd-peak-match.test.mjs`
- `node --test tests/pages-assets.test.mjs`
- `node tests/browser/materials-xrd.test.mjs` (Playwright/Chromium gerekir; ölçüm sentetiktir, gerçek cihaz kanıtı değildir).
- Tarayıcıda: iki çalışma alanı açın; ilkini Malzemeler'e ekleyin; diğer çalışma alanına geçip ikinciyi ekleyin; hacim, yüzde farkı, JSON ve CSV'yi denetleyin. XRD için hesap oluşturun, ölçüm CSV yükleyin, dalga boyu kontrolünü onaylayın, tolerans ile pik eşleştirin. Farklı çalışma alanına geçince eski raporun kaybolduğunu kontrol edin.

## Sıradaki aşamalar
**P1**
- Numune/hesaplama kanıtları için tipli, doğrulanabilir kaynak kayıtları; hesap/protokol/hash kimlikleri ve birim uyumluluğu.
- Gerçek cihaz dosyaları, Kα çizgisi/cihaz konfigürasyonu ve kalibrasyon kaydı; çoklu faz adayları; bağımsız referans korpusu ve tolerans değerlendirmesi.
- Bulk elektronik yapı (GaN/SiC/AlN) için kaynaklı ve yakınsaması denetlenen QE iş akışları.

**P2**
- Rietveld/peak profile refinmanının bağımsız yöntemlerle doğrulanması; kusur oluşum enerjileri ve yük düzeltmeleri.
- Fonon/termal özellikler, heteroyapı/arayüz analizi ve deneyle kalibre edilmiş belirsizlik farkındalıklı aday sıralama.
