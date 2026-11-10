# P1.3 · Veri kalite ve çapraz doğrulama denetimi

**Durum:** Araştırma prototipi, 10 Kasım 2026. P0 deneysel, P1 ZEBRA hibrit ve P1.2 JARVIS OptB88vdW hedefleri karıştırılmaz. **Bu sürüm veri korpusunu genişletmez; 184 kaynaktan ön denetim sonrası kalan 179 yapı üzerinde P1.2'nin belirsizliklerini ve veri özelliklerini görünür kılar.** Test sonuçları ancak kod koşulduğunda ölçülür; modelin iyileştiği varsayılmaz.

## Veri kalitesi
- Sabit sürümlü JARVIS/SCLib kaynağı, kaynak edisyonu ve hash metadata'sı P1.2 ile aynı. PBC bağ ve koordinasyon çıkarımı `preparePolymorphCorpus` üzerinden **aynı kodla** yapılır. Hatalı atom sayımı, bozuk geometri ve hedefler kaynak denetiminin mevcut retlerini korur.
- Kabul, ret (nedenleri), formül, farklı uzay grubu sayıları ve birbirine çok benzeyen **kaba tanımlayıcı** çiftleri raporlanır.
- Yakın tanımlayıcı (V/atom %2, bağ %2, koordinasyon 0,3) farklı SG arasında gerçek polimorf olup olmadığını kanıtlamaz. `pymatgen StructureMatcher` ile tam kristal eşdeğerlik kontrolü **yapılmamıştır**. Dosya içinde yer alan hash metadata'sı dış kaynağın kendisinin yeniden indirilip doğrulandığı anlamına gelmez.

## Grup ayrımlı, tekrarlı iç doğrulama
- Her formülün SG grupları sıralanır; 4 dönen fold'un her birinde farklı SG grubu **test**, 3+ SG varsa başka bir grup yalnız **hiperparametre doğrulama**, diğer SG grupları **eğitim** olur. 2 SG olan formüllerde diğer grup eğitimde kalır. Tek SG formülleri yalnız eğitimdir.
- Aynı JID ve `formula|SG` grubu tek fold içinde eğitim/doğrulama/test arasında çakışamaz. Test formülü eğitimde farklı SG ile temsil edilir.
- Dokuz pozitif bağ/koordinasyon ağırlığı **yalnız o foldun iç doğrulamasında** seçilir. Test, ağırlık seçimine dahil edilmez.
- Aynı holdout örnekleri üzerinde bileşim+hacim (sıfır bağ/koordinasyon ağırlığı) ile yapı-duyarlı modeli eşit kNN ayarıyla karşılaştırır.
- Dört fold arasındaki örnekler bağımsız değildir; bazı yapılar başka foldlarda tekrar görülebilir. Bu **dış test değil tekrarlı grup-CV/stres testidir**.
- Formül seviyesinde kümelenmiş 256 tekrarlı bootstrap, eşleştirilmiş MAE farkı için **keşifsel aralık** sağlar. Bu bir %95 tahmin aralığı veya garantili kapsama değildir.

## Ürün arayüzü
Malzemeler → ML Tahminleri → P1.3 Veri ve doğrulama. Kullanıcı isteğiyle aynı-origin JSON yüklenir, `Web Worker` içerisinde veri denetimi ve rapor hesaplanır; tahmin edilen yeni hedef veya gerçek DFT sonucu üretilmez. Kabul/ret, çok-SG formül sayısı, iki hedefin MAE ve ablation farkları, bootstrap aralığı ve fold ayrıntıları gösterilir. JSON raporu indirilebilir. Çevrimdışı PWA ve GitHub Pages paketi korunur.

## Kabul ve açık işler
`node --test tests/materials-ml-p13.test.mjs tests/materials-ml-p12.test.mjs tests/pages-assets.test.mjs`

**Sonraki veri sürümü için gerekenler:** JARVIS'ten özgün lisans/kaynak/hash ile geniş ve çeşitlendirilmiş yapılar; atomik yapı eşdeğerliği/duplicate temizleme; kaynaklar ve fonksiyoneller arası hedef tutarlılığı; eğitimden bağımsız *kilitli* harici polimorf test korpusu; CI regresyonu. Bu gereksinimler karşılanmadan modele "daha iyi" veya "bağımsız doğrulandı" etiketi verilmez.
