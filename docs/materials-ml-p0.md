# P0 — Malzemeler / ML Tahminleri: yerel kNN başlangıç modeli

**Durum (10 Kasım 2026):** Tarayıcıda çalışan, **bileşim tabanlı deneysel bant aralığı** (eV) kestirimi. Bu bir PINN, GNN, ONNX/WebGPU uygulaması, kuantum hesaplaması, oluşum enerjisi veya DOS motoru **değildir**. Geliştirme önceliği olarak küçük ve doğrulanabilir bir vekil modelle başlayıp ağır çıkarımı sonraya bırakır.

## Kullanım

1. Editörde periyodik bir CIF açın ve üstteki **Malzemeler** sekmesine gidin.
2. **ML Tahminleri → Etkin kristal için ML tahmini** düğmesine basın. Mevcut P1 atom konumlarının element ve tam doluluk bilgisi kullanılır.
3. Model aynı kaynaktan paketlenmiş statik JSON dosyasını **ilk istekte**, yalnız aynı origin'den okur. Veriler veya CIF üçüncü taraf bir API'ye gönderilmez. Sonuç, en yakın eğitim bileşimleri, kaynak ve modelin test MAE'siyle gösterilir; JSON dışa aktarılabilir.
4. Yapı değiştirildiğinde önceki tahmin geçersiz kılınır.

## Model / sayısal doğrulama

- Model: **5-komşulu ağırlıklı kNN regresyonu**, atomik stokiyometrik kesirler (kompozisyon vektörü).
- Uzaklık: `d²(x,y)=Σₑ(xₑ-yₑ)²`; ağırlık: `1/(d²+0.0001)²`. Sonuç birimi eV.
- Kaynak: **Matbench v0.1, matbench_expt_gap**; özgün veri Zhuo, Mansouri Tehrani ve Brgoch (2018), [DOI](https://doi.org/10.1021/acs.jpclett.8b00124). [Matbench makalesi](https://doi.org/10.1038/s41524-020-00406-3).
- Verilerin bu sürüme alındığı [açık ayna](https://github.com/MasterAI-EAM/Darwin/blob/main/dataset/matbench_expt_gap/matbench_expt_gap.json) (4.604 satır; `input` formül, `output` bant aralığı). Bu bir **ikincil ayna**; resmi Matbench benchmark dosyasıyla satır bazında karşılaştırma henüz yapılmadı.
- Normalize edilmiş kimyasal bileşimler üzerinden 3 tekrar kaydı ayıklanınca **4.601** örnek kalır.
- Aynı bileşimin eğitim/teste dağılmasını önlemek için sıralı element kesirlerinden (beş ondalık) oluşturulmuş imzanın FNV-1a 32-bit değeri kullanılır: `hash mod 10 < 8` eğitim, diğerleri test.
- **3.696 eğitim, 905 bağımsız tutulan test örneği**. Test MAE **0,490473 eV**, RMSE **yaklaşık 1,053 eV**; pozitif hedefli 438 test örneğinde MAE **0,628283 eV**. Her zaman 0 tahmini yapan basit tabanın MAE'si **0,997536 eV**.
- Bu değerler **yalnız P0 sabit tek bölünmenin iç doğrulamasıdır**; resmi Matbench beşli CV benchmark skoru veya güven aralığı değildir. Bazı kaynaklarda 0 eV olarak kodlanmış metallere/çok küçük aralıklara duyarlıdır.
- En yakın bileşimin `d² > 0.08` olduğu durumlarda model **tahmin üretmeyi reddeder**. Bu mühendislik eşiği ampirik kalibrasyon/garanti değildir. Aynı bileşim eğitimde varsa değer açıkça *eğitim kaydı* olarak etiketlenir; bağımsız tahmin sayılmaz.

## Sınırlar

1. **Sadece formül:** CIF koordinatları ve simetri sadece geçerli giriş/atom sayısı için kullanılır; geometrik ağ, PBC, polimorf, kusur, faz ve sıcaklık özellikleri modele girmez. Aynı bileşimli farklı fazlar aynı tahmini alabilir.
2. **Kısmi doluluk reddedilir.** Molekül, boş/bozuk P1, bilinmeyen element, 1.000'in üzerinde atom veya eğitim alanından uzak bileşimler reddedilir. `0 eV`, bu veri kümesinin etiketidir; metal fazının kesin teşhisi değildir.
3. **Kalibrasyon yok:** Tekil kristal için doğruluk, güven aralığı, aleatorik/epistemik belirsizlik ve deneysel doğrulama sunulmaz. XRD veya DFT kabul/red kararı için kullanılmaz.
4. **Oluşum enerjisi gösterilmez:** Eğitim hedefi farklıdır; mevcut Materials Project hesaplanmış değerleri de bu kestirimle karıştırılmamalıdır.
5. **ONNX/WebGPU gerekmez:** 3.696 eğitim örneği için saf JavaScript yeterlidir. Sonraki aşama bağımsız geometri özellikleri veya doğrulanmış ONNX/GNN ve gerçek WebGPU/WASM hız kıyası olabilir.

## Testler / servis sınırı

```bash
node --test tests/materials-ml.test.mjs tests/pages-assets.test.mjs tests/offline.test.mjs
node tests/browser/materials-xrd.test.mjs    # Chromium / Playwright + Moyo WASM kurulumu gerektirir
```

- `materials-ml-core.js`: saf fonksiyon; formül ayrıştırıcı, P1 bileşim kapıları, d² ve kNN.
- `materials-ml-page.js`: yalnız opt-in model yükleme, DOM gösterimi, eski sonuç geçersizliği, JSON dışa aktarım.
- `models/matbench-expt-gap-knn-p0.json`: yerel, sabit eğitim paketi ve ayrılmış test metrikleri. Tüm işlemler tarayıcıda.
- `sw.js` ve `pages.yml`: model ve iki JS dosyasını aynı origin'de çevrimdışı paketler.
- QE API, GANSU, grafen TB ve mevcut geometri/kanıt akışları değiştirilmedi.

## P1 / P2 önerisi

- P1: Doğrulanmış PBC komşuluk grafını ve koordinasyon/metrik tanımlayıcılarını modele eklemek; gerçek referans hesaplarla tekrarlı ayrılmış testler, faz/kompozisyon sızıntısı kontrolleri ve kalibrasyon sağlamak.
- P2: PBC duyarlı GNN (ALIGNN benzeri) / ONNX Runtime WebGPU prototipi, katman/operatör ve WebGPU-WASM benchmarkı. Güvenilir gerçek DFT'ye ikame olarak sunmamak.
