# P1.2 — Bağ uzunluğu ve koordinasyonu gerçekten öğrenen pilot; bağımsız TiO₂ polimorf deneyi

Tarih: 10 Kasım 2026 · Amaç: [P1](materials-ml-p1.md) modelindeki "komşuluk hesaplanıyor ama **eğitimde kullanılmıyor**" açığını sınırlı bir pilotla kapatmak ve aynı bileşimli farklı yapılar için *bağımsız* deney yapmak.

## 1. Tam olarak ne yapıldı?

**Gerçek periyodik CIF koordinatları** `oba-group/ZEBRA-dataset` içinden okunup P1'e ait şu tanımlayıcılara dönüştürüldü:

1. Kimyasal element kesirleri.
2. **Atom başına hücre hacmi** (Å³/atom).
3. **Atom başına en yakın periyodik komşu mesafelerinin ortalaması** (Å).
4. **Ortalama ilk-shell koordinasyon sayısı** (her atom için `d <= 1.35 × d_nearest`).
   
En yakın mesafeler için P1 simetriyle genişletilmiş atomlar ve uygun kristal kafesi çevirileri kullanılır. Periyodik komşuluk algoritması hem eğitimde hem kullanıcı CIF'inde aynıdır (`structureDescriptorsP1`). Bu iki yeni tanımlayıcının modele etkisini, sıfır olmayan ve doğrulama verisinde seçilmiş kNN uzaklık ağırlıklarıyla sağladık.

Bu çalışma **GNN, ALIGNN, PINN veya DFT hesaplaması değildir.** Bağ/koordinasyon özellikli *eğitilmiş kNN* prototipidir.

## 2. Verinin gerçek kökeni, bölünmesi ve algoritma

Kaynak: [ZEBRA-Dataset](https://github.com/oba-group/ZEBRA-dataset) — CC BY 4.0. Kaynağın id/target tablosundan ve orijinal CIF'lerinden **10 satırda 1** deterministik örnek alınmış, **170** yapı geometri denetimlerinden geçmiştir. Orijinal 2.202 malzeme yerine kasıtlı olarak yalnız 170 yapı kullanıldığından sonuçlar **pilot** düzeyindedir.

Kimyasal bileşim (atom kesirlerinin sıralanmış imzası) için FNV-1a 32-bit hash mod 10 ile *bileşim-gruplu* bölünme yapılmıştır: **118 eğitim, 15 hiperparametre doğrulama, 37 bağımsız test**. Model paketinde eğitim + doğrulama **133 kaynak** bulunur. TiO₂ polimorf kayıtlarının hiçbirisi bu 170 kayda ya da hiperparametre seçimine dahil edilmemiştir.

Uzaklık:

```text
D = Σ_element (x_i - y_i)^2
    + 0.03 × [ln(V_atom,x / V_atom,y)]²
    + w_bond × [ln(d_nearest_mean,x / d_nearest_mean,y)]²
    + w_coord × [(CN_mean,x - CN_mean,y) / 6]²
```

7 komşulu regresyon ve `1/(D+0.01)^2` ağırlığı kullanılmıştır. Doğrulamada `w_bond` ve `w_coord` için `{0.005, 0.02, 0.08, 0.25}` ızgarası taranmış, hedefe göre ayrı katsayılar seçilmiştir. Doğrudan bant aralığı için **(0,25; 0,25)**; oluşum enerjisi için **(0,08; 0,08)**. Sıfır ağırlıklı karşılaştırma ise **aynı 170 kaynak, aynı split ve aynı algoritmadır**; yalnız yeni özellikler kapalıdır.

### Ayrılmış 37 kaynak üzerinde

| Hedef | Bileşim+hacim (ablasyon) MAE | Bağ+koordinasyon öğrenilmiş MAE | Değişim |
|---|---:|---:|---:|
| Hibrit-DFT **doğrudan bant aralığı**, eV | 1,264599 | **1,230362** | −0,034237 eV |
| DFT **oluşum enerjisi**, eV/atom | 0,305205 | **0,291134** | −0,014071 eV/atom |

Bu kazanımlar **küçük**, test kümesi yalnız 37 yapı ve mevcut P1'in 1.759 örnekli modeline karşı daha iyi sonuç iddiası **yok**. Uzaklık, güven aralığı veya deney sonucu değildir.

## 3. Bağımsız sekiz TiO₂ polimorfu: olumsuz sonuç

Harici kaynak: [mcgalcode/tio2-paths-data](https://github.com/mcgalcode/tio2-paths-data). Dosyanın `structures/manifest.json` kaydıyla eşlenen sekiz gerçek CIF:

- Anatase (mp-390)
- Brookite (mp-1840)
- Rutile (mp-2657)
- Pbcn (mp-1439)
- C2/m (mp-554278)
- Pnma (mp-2420244)
- Pnma (mp-754769)
- P2₁/c (mp-430)

**Aynı TiO₂ bileşimine sahip sekiz ayrı atomik yapı** eğitimden tamamen dışlandı. Kaynak, her yapı için **energy above hull** (eV/atom) verir. Bu, eğitimdeki DFT **formation energy** ile mutlak olarak aynı büyüklük değildir. Ancak aynı bileşim için, bütün hesaplamalar karşılaştırılabilir bir enerji referansındaysa **enerji farklarının** enerji üst-hull farklarıyla karşılaştırılması *keşif niteliğinde* anlamlıdır; burada işlevseller arası farklar, verilerin metodoloji farkı ve küçük örnek açık belirsizliktir. Modelden çıkan mutlak oluşum enerjileri doğrudan `E_hull` ile karşılaştırılmamıştır.

28 farklı ikili eşleştirmenin `ΔE` hatası ve işaret sıralaması:

| Ölçüt | Bileşim+hacim (aynı 133 eğitim satırı) | Eğitilmiş bağ+koordinasyon |
|---|---:|---:|
| İkili enerji farkı MAE (eV/atom) | **0,030037** | 0,035064 |
| Doğru ikili sıralama | **15/28 (%53,57)** | 14/28 (%50) |

**Sonuç: Polimorf dış doğrulaması İYİLEŞMEDİ.** Bu set, modelin farklı polimorfları başarıyla sıraladığını **kanıtlamaz**. `50%` ikili sıralama başarısı uygulanabilir bir malzeme seçimi sonucu değildir. Bu açık bir *negatif sonuçtur*; eğitimdeki küçük kazancı gizlemek için kullanılmamıştır.

## 4. Tekrar üretilebilirlik ve CI kanıtı

Kaynak koordinatlarının ve etiketlerin küçük, sabit JSON kopyaları:
- `models/p12/cohort-0.json`–`cohort-10.json` (170 ZEBRA CIF'inin P1 koordinatları ve hedefleri).
- `models/p12/tio2-polymorphs.json` (8 harici TiO₂ fazının koordinatları ve ayrı referans `E_hull`).
- `models/p12/learned-knn.json` (133 eğitilmiş giriş, kNN ağırlıkları, 37 örneğin ve 8 polimorfun sabit test metrikleri).

`tests/materials-ml-p12.test.mjs`, kaynak koordinatlarından **uygulamanın kendi PBC geometri fonksiyonuyla** bağ/koordinasyon özelliklerini tekrar çıkarır; eğitim satırlarının değerleriyle eşleştirir, 37 ayrılmış test MAE değerlerini yeniden hesaplar ve sekiz TiO₂ kaynağındaki **olumsuz** ikili sıralama sonucunu doğrular. Bu, yalnızca önceden yazılmış metriklere bakılan bir test değildir. `tools/train-materials-ml-p12.mjs --check`, çevrimdışı 170 CIF girdisinden geometri özelliklerini ve öğrenilmiş ağırlık seçimini yeniden üretir; kaynak ayrımını, eğitim satırlarını, 37 test MAE'sini ve 8 TiO₂ polimorfunun negatif dış sıralama ölçütlerini kaydedilmiş değerlerle karşılaştırır. `--write` parametresi yalnızca bu denetimler geçtiğinde yerel model dosyasını yeniden yazar.

Çalıştırma:

```bash
node --test tests/materials-ml-p12.test.mjs tests/materials-ml-p1.test.mjs
node tools/train-materials-ml-p12.mjs --check
```

Sadece son iki model dosyası ve JS modülleri GitHub Pages/offline pakete konur; tüm eğitim CIF'leri statik arayüzün offline önbelleğine zorla eklenmez. Kullanıcı CIF içeriği sunucuya aktarılmaz.

## 5. Bu pilot hangi ihtiyacı karşılamıyor?

- ZEBRA'daki 170 farklı formül ile **aynı formülün çoklu polimorflarını eğitme** henüz yapılmadı. Dış TiO₂ sekizli test *transfer/zero-shot* niteliğindedir.
- Farklı kaynakların hesaplama parametreleri, relativistik ve manyetik durumları tam eşitlenmedi.
- Bağ değerleri, 1,35× ilk-shell kuralına duyarlıdır; koordinasyon sayısı kristal kimyasında her sistem için tek doğru tanım değildir.
- Doğrudan bant aralığı ≠ temel/optik bant aralığı; oluşum enerjisi ≠ enerji-hull veya kusur enerjisi.
- Kalibre edilmiş hata bandı, fizik bilgilendirilmiş loss, E(3)-equivariant mesajlaşma, GNN ya da referans QE yeniden hesabı yok.
- Daha güçlü iddia için yeterince geniş **aynı bileşimli polimorf + aynı DFT işlevsel** datasetinde, bütün polimorfları aynı grupta tutan ve ayrıca polimorf içi yapı transferini sınayan iki ayrı split gerekir. Bu P1.2 dış kontrolünde gerçekleşmemiştir.

**Karar:** P1, kullanıcıya sunulan ana ML tahmin modeli olarak kalır. P1.2 ayrı, açıkça "araştırma" etiketli ve negatif dış doğrulaması görünür bir seçenek olarak sunulur.
