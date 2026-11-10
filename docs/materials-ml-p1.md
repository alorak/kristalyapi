# P1 — Malzemeler / ML Tahminleri: geometri duyarlı başlangıç

Tarih: 10 Kasım 2026. P1, [P0 Matbench deneysel aralık modeline](materials-ml-p0.md) **alternatif** değil; *ayrı hedefleri* olan ikinci araştırma prototipidir.

## Hedef ve bilimsel ayrım

| Kaynak | P0 | P1 |
|---|---|---|
| Kaynak veri | Matbench `matbench_expt_gap` | [ZEBRA-Dataset](https://github.com/oba-group/ZEBRA-dataset), CC BY 4.0 |
| Hedef | Deneysel bant aralığı | Hibrit-DFT **doğrudan** bant aralığı ve DFT oluşum enerjisi |
| Model | 5 komşulu bileşim-kNN | 7 komşulu bileşim + atom başına hacim kNN |
| Kristal koordinatları | Kullanılmaz | PBC komşulukları ve bağ uzunlukları **ayrı giriş doğrulamasında** kullanılır; henüz eğitim özelliği değildir |
| Çalışma | Aynı kökenli statik JS/JSON | Aynı kökenli statik JS/JSON; sunucu, ONNX ve WebGPU gerekmez |

Doğrudan bant aralığı, temel/dolaylı bant aralığı veya cihazın optik aralığı ile eşit **değildir**. PBE/PBE0/HSE, deney, kristal kusuru ve hesap koşulları birlikte değerlendirilmeden mutlak değer karşılaştırması yapılmamalıdır. P1 yalnız modelin yeniden üretilebilir tahminini sunar, DFT çalıştırmaz.

## Eğitim verisi ve değerlendirme

ZEBRA tablosundan **2.202** tam satır ve aynı anahtarla eşlenen `DensityFeatures.csv` verisindeki **vpa** (Å³/atom) kullanılmıştır. Eğitim girdi vektörü element stokiyometrik kesirleri ve log(vpa)'dır. Küçük kNN modeli, kristal yapıya duyarlı **atom başına hacim** içerir. Bu özellik primitive/konvansiyonel ve tam süperhücre dönüşümlerinde değişmez.

Kompozisyon imzasının FNV-1a değeri ile kalıcı bölünme: `hash mod 10` 0–6 eğitim (1.555), 7 doğrulama (204), 8–9 test (443). Modelde eğitim + doğrulama birlikte **1.759** satır bulunur. KNN uzaklığı `d²=Σ_e(x_e-y_e)² + α(log(vpa_x/vpa_y))²`, 7 komşu ve `1/(d²+0.01)²` regresyon ağırlığı. `α=0.03` için doğrudan aralık doğrulama MAE 0,799 eV (α=0 için 0,806 eV); oluşum enerjisinde doğrulamada en düşük MAE α=0 idi (0,211 eV); P1 prototipi her iki hedef için α=0,03 seçerek geometri duyarlılığını korumuştur (oluşum enerjisi doğrulamada 0,213 eV).

**Dokunulmamış 443 test örneğinde:**
- Doğrudan bant aralığı MAE: **0,843475 eV** (RMSE 1,139902 eV).
- Oluşum enerjisi MAE: **0,179675 eV/atom**.
- Basit mühendislik mesafe sınırı (kompozisyon d² ≤0,12 ve |Δ log(vpa)| ≤0,6) ile **425/443 (%95,9)** örnek kabul edilir; kabul edilen alt kümede MAE sırasıyla **0,807723 eV** ve **0,168065 eV/atom**. Bunlar kalibre edilmiş güven aralıkları değildir. Model sonrasındaki bu seçici kapı, örnek dışında başarı kanıtı değildir.

**Önemli kanıt eksikliği:** ZEBRA veri kümesinde farklı kimyasal formüllü 2.202 satır bulunur ve aynı kimyasal formülün çoklu polimorf karşılaştırma korpusu **yoktur**. V/atom değişikliği tahmini değiştirse de aynı formül ve aynı V/atom değerine sahip farklı fazları ayırt ettiği gösterilemez. P1 bunu kanıtlamış gibi sunmaz.

## Gerçek kristalden özellik türetme

`materials-ml-p1-core.js`, aktif CIF'in **simetriyle genişletilmiş P1 atom konumlarını** okur ve aynı sayfadaki `geometry-table.js` periyodik komşuluk fonksiyonunu kullanır:

- Triklinik geçerli hacim `V=abc√(1+2cosαcosβcosγ-cos²α-cos²β-cos²γ)`.
- Hacim / gerçek P1 atom konumu sayısı; `ρ=1.66053906660×(Σ atom kütlesi)/V` (g/cm³).
- Periyodik sınırlarla en yakın atom mesafesi, ortalama ilk-komşu mesafesi, her merkezden `≤ 1.35×d_min` olan yakın komşuluk sayısı.
- Aynı periyodik noktada çakışan atom, aşırı kısa mesafe, dejenere hücre, kısmi doluluk, periyodik olmayan yapı veya 128'den büyük P1 atom sayısı reddedilir.

**Komşuluk sayıları henüz regrese edilmemiştir:** Bu değerlerin hesaplanması PBC farkındalıklı grafik eğitimi değildir. Eğitimde atomların **hacim dışındaki konumsal verisi** bulunmadığından, bağ/koordinasyon değişikliğinin tahmini nicel olarak ne kadar iyileştirdiği iddia edilmez.

## Kullanım

Malzemeler → ML Tahminleri altındaki **P1 · Yapısal ML tahminleri** kısmında "Etkin kristalde yapısal tahmin" tıklayın. Ayrı hibrit-DFT doğrudan aralığı ve oluşum enerjisi kartları, yapı/komşuluk özellikleri, en yakın kaynak bileşimleri, test MAE ve geçerlilik uyarıları sunulur. JSON dışa aktarılır. Etkin kristal değişirse önceki P1 sonucu geçersiz olur. P0 kontrol ve sonuçları aynı şekilde çalışmaya devam eder.

## Sınırlar ve P1.2

P1 model çıktısı ne QE hesaplaması ne deneydir. Oluşum enerjisi, toplam enerji, hull üstü enerji, faz kararlılığı ve kusur oluşum enerjisi birbirine karıştırılmamalıdır. Veri kaynağının filtreleri (non-magnetic, kararlı materyaller), hedef fonksiyonel ve oluşturulan CIF yapılarının temsil gücü gerçek malzemeyi sınırlar.

**P1.2'de gerekli:** Birden çok polimorfun deneysel/DFT hedefini içeren yapı kaynakları, güvenilir atomik bağ/komşuluk etiketleri ve polimorf-gruplu eğitim/test ayrımı; sonra geometrik komşuluk istatistiklerini **eğitilmiş** regresyon vektörüne katmak veya ALIGNN/CHGNet benzeri yapı-duyarlı GNN'yi doğrulamak. Bağ/cutoff/atom sayısı yakınsaması ve faz-ayrımlı dış doğrulama olmadan fiziksel doğruluk iddiası yapılamaz.

## Test ve dağıtım

```bash
node --test tests/materials-ml-p1.test.mjs tests/materials-ml.test.mjs tests/pages-assets.test.mjs
node tests/browser/materials-xrd.test.mjs
```

- Kaynak: [ZEBRA-Dataset](https://github.com/oba-group/ZEBRA-dataset), CC BY 4.0. Modeldeki iki hedef kaynağı: `data/id_prop/id_prop.csv`. Hacim/atom: `data/descriptor/DensityFeatures.csv`, matminer özellikleri.
- Akademik atıf: Yamamoto, Takahashi, Terayama, Kumagai ve Oba (2026), *ZEBRA-Prop*, [arXiv:2603.26060](https://doi.org/10.48550/arXiv.2603.26060).
- `models/zebra-structural-p1.json` yerel paket; kullanıcı geometrisi üçüncü taraf sunuculara gönderilmez.
