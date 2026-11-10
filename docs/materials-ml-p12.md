# P1.2 — Atomik bağ ve koordinasyon özellikleriyle **eğitilmiş** yerel model

**Durum:** Araştırma prototipi · 10 Kasım 2026 · P0/P1 modellerinden ayrı; yeni DFT hesabı yapılmaz.

## Gerçek eğitim veri seti ve hedeflerin ayrılması

Kaynak: NIST [JARVIS-DFT 3B](https://doi.org/10.6084/m9.figshare.6815699) (Kamal Choudhary, **CC BY 4.0**), kaynak kimliklerini/sayısal hedefleri ve atomik koordinatları koruyan [SCLib referans altkümesi](https://github.com/JackZH26/SCLib_JZIS/blob/main/frontend/public/research-pilots/jarvis-host-records-2025-09-24.json). Kaynak edisyonu 24 Eylül 2025; 22 formül için 184 satır. İndirilen özgün dosya hash'i ve kaynağın iç JSON hash'i `models/jarvis-polymorph-p12-source.json` içinde tutulur. Beş satırdan biri JSON içindeki `NaN` nedeniyle, dördü atom sayımı uyumsuzluğu nedeniyle en başta çıkarılmıştır; **179** başlangıç satırı kalır.

P1.2 tahmin hedefleri:
- `optb88vdw_bandgap`, eV — **JARVIS OptB88vdW hesaplanmış elektronik bant aralığı**.
- `formation_energy_peratom`, eV/atom — **JARVIS OptB88vdW kökenli oluşum enerjisi**.

Bu hedefler **P0 deneysel aralık**, **P1 ZEBRA hibrit-DFT doğrudan aralığı**, DFT toplam enerji, hull üstü enerji veya gerçek deneysel doğrulama ile birleştirilmez. Kullanılan kaynak yalnız seçilmiş 22 formüldür; malzemeler uzayında geniş genelleme sonucu değildir.

## Periyodik fiziksel tanımlayıcılar

Kaynağın 3×3 örgü matrisinden gerçek `a,b,c,α,β,γ` hesaplanıp kartezyen koordinatlar ters örgüyle kesirli koordinatlara çevrilir. P1 simetriyle genişletilmiş atomların konumları, var olan `geometry-table.js:neighbourLists` fonksiyonu kullanılarak **periyodik komşular** halinde değerlendirilir; hem eğitimde hem kullanıcı CIF'inde **aynı** `structureDescriptorsP1` kod yolu kullanılır.

Eğitimde **sıfırdan farklı ağırlıkla** bulunan girdiler:

1. Normalize element atomik kesirleri.
2. `V/N` (Å³/atom); tam süperhücre dönüşümüne göre değişmez.
3. **Ortalama en yakın periyodik komşu mesafesi** (Å).
4. **Ortalama ilk koordinasyon kabuğu sayısı** (komşular: merkez atomun en kısa mesafesinin 1,35 katı içinde).

Normalize edilmiş uzaklık:

```text
d² = Σ_element (x_e-y_e)²
     + 0.05 × [ln((V/N)_x / (V/N)_y)]²
     + w_bond × [ln(mean_bond_x / mean_bond_y)]²
     + w_coord × [(coord_x - coord_y)/6]²
```

`w_bond` ve `w_coord` pozitif adaylar içinden **yalnız doğrulama gruplarında** hata minimizasyonuyla seçilir. Ağırlıklı 5-komşulu kNN (`w=1/(d²+0.01)²`) ile bant aralığı ve oluşum enerjisi ayrı ayrı kestirilir. Eğitim girdileri gerçekten bağ/koordinasyon içerir: bunlar sadece UI göstergeleri değildir. Açıkça **GNN veya PINN değildir**; atom-atom kenarlarından mesaj geçirmez.

## Polimorf ayrımlı bağımsız test protokolü

- **Grup anahtarı:** `(kimyasal formül, kaynak uzay grubu numarası)`.
- Her formül için SG grupları sabit FNV-1a hash ile sıralanır; yeterli sayıda grubu olan bir formülde bir SG grubu **test**, ikinci SG grubu **hiperparametre doğrulama**, kalanlar **eğitim** olur.
- İki SG grubu bulunan formüllerde bir SG testte, diğeri eğitimde kalır. Tek SG içeren formüller yalnız eğitime katılır; başka bir fazla eşlenmemiş formüller testte kullanılmaz.
- Eğitim, doğrulama ve test **JID olarak da, formül + SG grubu olarak da** çakışamaz. Test edilen her formül eğitim kümesinde bulunur fakat test SG'si eğitimde bulunmaz.
- Hiperparametreler doğrulamada seçildikten sonra eğitim + doğrulama birleştirilir ve yalnız **bir kez ayrılmış test** tahmin edilir. Testteki hata model seçmek için kullanılmaz.
- Aynı test satırlarında kompozisyon + hacim tabanı (`w_bond=w_coord=0`) ile bağ/koordinasyon modeli yan yana değerlendirilir: **MAE, RMSE, uzay-grubu makro MAE ve ablation farkı**.
- **Önemli sınır:** Farklı SG, farklı polimorf için yararlı ancak kusurlu vekil tanımdır. Tam yapısal eşdeğerlik analizi (örneğin StructureMatcher + standardizasyon), CIF kimliği ve fazın bağımsız karakterizasyonu bu P1.2 prototipinde uygulanmamıştır. Aynı SG içinde farklı polimorflar da olabilir.

## Ölçülen bağımsız test sonuçları (PR #238)

`node --test tests/materials-ml-p12.test.mjs` üzerinden kaynak kodla yeniden üretildi:

| Kayıt | Sayı |
|---|---:|
| Özgün JARVIS/SCLib kayıt | 184 |
| Atom envanteri / JSON ön kontrolden geçen | 179 |
| PBC özellik denetiminden geçen | 179 |
| Eğitim | **143** |
| Hiperparametre doğrulama | **17** |
| Tutulan farklı-SG polimorf testi | **19** |
| Farklı-SG ve kaba tanımlayıcılara göre daha ayrık alt test | **15** |

`formula|spacegroup` grubu sayıları sırasıyla **91 eğitim**, **16 doğrulama**, **19 test**; 19 test formülünün tamamı eğitimde farklı uzay grubuyla bulunur. Her test kaydında kimlik/SG grubu çakışmaz.

| Hedef ve test | Bileşim + V/atom MAE | Bağ + koordinasyon MAE | Sonuç |
|---|---:|---:|---|
| OptB88vdW bant aralığı, 19 test (eV) | 0,776855 | **0,869589** | **Kötüleşti** |
| OptB88vdW oluşum enerjisi, 19 test (eV/atom) | 0,532135 | **0,491389** | **İyileşti** |
| Bant aralığı, geometrik açıdan daha ayrık 15 test (eV) | 0,904105 | **1,039235** | **Kötüleşti** |
| Oluşum enerjisi, daha ayrık 15 test (eV/atom) | 0,662339 | **0,615082** | **İyileşti** |

Seçilen ağırlıklar: bant aralığında `w_bond=0,05`, `w_coord=0,4`; oluşum enerjisinde `w_bond=0,8`, `w_coord=0,1`. Eşit bileşimli örnekler için doğrudan **uzay grubu grup ayırmalı** tutma kullanıldı. İkinci 15 örnekli analiz, eğitimde aynı formüle ait hacmi %2, bağ mesafesi %2 ve koordinasyonu 0,3 toleransları içinde birbirine çok yakın yapı bulunmayan test girdilerinden oluşur; *tam kristal yapı eşdeğerliği* yerine geçmez.

**Yorum:** İyileşme tek hedefte görülüyor; bant aralığı için ilave tanımlayıcılar performansı düşürüyor. 19 yapı ve yalnız seçilmiş 22 formül üzerinde bu farkların istatistiksel güvenilirliği veya yeni malzemelere genellenebilirliği kanıtlanmış değildir. P1.2 bilimsel **pilot** olarak kullanılmalı, fiziki doğruluk/güven aralığı/üretim kabul modeli sayılmamalıdır.

## Fail-closed ve ürün sınırlamaları

Periyodik olmayan/kısmi doluluklu yapı, bozuk hücre, üst üste gelen atomlar, çok yakın atomlar ve P1 128 konumdan büyük hücreler reddedilir; JARVIS kaynak satırları da aynı kapılardan geçer. Kompozisyon, hacim, bağ uzunluğu veya koordinasyon eğitim ortamından aşırı uzaksa **sayısal tahmin gösterilmez**. Uzaklık eşikleri ampirik kapsama sınırlarıdır; %95 güven veya kalibre edilmiş belirsizlik değildir.

Tarayıcı uygulamasında P1.2 düğmesi ilk çalıştırıldığında yerel kaynak JSON'u okuyup **ayrı Web Worker içinde** eğitim/ayrım/değerlendirme işlemlerini gerçekleştirir ve sonucu bellekte önbellekler; tekrar çalıştırmada ikinci kez veri okunmaz. Worker olmayan tarayıcıda kontrollü eşzamanlı yedek yol bulunur. Tam kaynak verisi siteyle aynı kökende PWA olarak paketlenir. Kullanıcının kristal dosyası JARVIS/SCLib'e gönderilmez.

## Kaynak kod / yeniden üretme

```bash
node --test tests/materials-ml-p12.test.mjs
node --test tests/pages-assets.test.mjs tests/core.test.cjs
node tests/browser/materials-xrd.test.mjs
```

`tests/materials-ml-p12.test.mjs` test çıktısında `P12_POLYMORPH_METRICS_JSON` satırı gerçek örnek sayıları, seçim ağırlıkları, faz-gruplu test MAE'leri ve bağ/koordinasyonsuz baseline MAE'lerini üretir. Yukarıdaki sayılar bu test çıktısındaki doğrulanmış `P12_POLYMORPH_METRICS_JSON` değerleridir; **yeni veri üzerinde iyileşme garantisi verilmez**. Kullanıcı arayüzü aynı raporu hesaplanan sonuçla gösterir.

Teknik dosyalar: `materials-ml-p12-core.js`, `materials-ml-p12-page.js`, `materials-ml-p12-worker.js`, `models/jarvis-polymorph-p12-source.json`, `tests/materials-ml-p12.test.mjs`.
