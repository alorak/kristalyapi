# CIF bilimsel doğrulama hattı

Bu test hattı, **`index.html` içinde çalışan gerçek CIF ayrıştırıcısını** bağımsız [Gemmi](https://gemmi.readthedocs.io/) referansına karşı ölçer. Ayrı bir CIF parser kopyası test edilmez. Kullanıcı uygulaması yine yalnızca frontend/tek HTML'dir; Python ve Node.js **yalnızca GitHub Actions/test ortamında** kullanılır.

## Veri kümesi

- **30 gerçek CIF:** [pymatgen](https://github.com/materialsproject/pymatgen/tree/main/test-files/cif) açık kaynaklı CIF test koleksiyonundan, değiştirilmeden depoya kopyalanmıştır. Kaynak bağlantıları ve dosya başına Git blob SHA-1 `manifest.json` içindedir. [MIT lisansı](fixtures/PYMATGEN_LICENSE.txt) da korunur. Bazıları COD/ICSD kökenli test örnekleridir; 30 dosyanın tamamı COD indirmesi olarak sunulmamaktadır.
- **10 sentetik zorlayıcı CIF:** P1, P-1, screw, triklinik metrik, sınırı aşan koordinatlar, karma/kısmi doluluk, simetri işlemi verilmeyen Fm-3m ve iki kasıtlı geçersiz dosya. Geçersiz iki örneğin **hem Gemmi hem tarayıcı tarafından reddedilmesi** beklenir.
- Dosyalar ağdan test sırasında indirilmez. `git_blob_sha1` değişirse doğrulama ölçüm dışı altyapı hatası verir. Raporlarda her dosyanın SHA-256 özeti bulunur.

## Nasıl ölçüyor?

1. Node.js (harici npm paketi kullanmadan) mevcut `index.html` içindeki `cifData()` fonksiyonunu alır ve 40 CIF'yi okuyarak `browser.json` üretir.
2. Gemmi **0.7.4** referans okuyucuyla aynı dosyaları, simetri genişletmesini, atom türlerini, kısmi dolulukları ve örgüyü işler; `reference.json` üretir.
3. Python; hücrenin `a,b,c,α,β,γ` değerlerini, hacmi, element/doluluk gruplarını, simetri ile genişletilmiş atom çokluklarını ve atom konumlarını **periyodik metrikte birebir eşleştirir**. Mümkünse ortak orijin kaymasını kabul eder. Sadece gösterim için çizilen sınır atomlarını veya geometrik bağ sayısını karşılaştırmaz.
4. `report.json` tüm farkları; `report.md` tablo ve başarı/başarısız/belirsiz sayılarını verir. Referans çıktısı **her koşuda sabitlenmiş Gemmi sürümünden yeniden hesaplanır**; statik, elle uydurulmuş beklenen sonuç dosyası kullanılmaz.

| Eşik | Değer |
|---|---:|
| Hücre uzunluğu | 0,001 Å |
| Hücre açısı | 0,01° |
| Bağıl hacim farkı | 0,0001 |
| Periyodik atom konum farkı | 0,001 Å |
| Doluluk gruplama çözünürlüğü | 0,001 |

**Durumlar:**
- `pass`: bağımsız referans ve JS eşleşir; geçersiz fixture iki okuyucu tarafından da reddedilebilir.
- `fail`: Gemmi okuyabiliyorken JS hata verir veya hücre/atom/occupancy farkı bulunur.
- `inconclusive`: referans CIF'yi güvenilir şekilde yorumlayamaz veya alternatif hücre ayarı bağımsız dönüşüm gerektirir; **pass sayılmaz**.
- `error`: kaynak hash'i bozulmuş veya karşılaştırma altyapısında hata vardır.

Önemli: CIF meta verilerinin kayıpsız round-trip korunması, en yakın komşu **kimyasal bağ tanımı**, deneysel olarak doğru oksidasyon durumları ve otomatik lattice-setting dönüşümünün kapsamlı doğrulanması bu ilk ölçüm hattının **dışındadır**. Testler, mevcut uygulama kodundaki sorunları ölçer, düzeltmez.

## Yerelde çalıştırma

```bash
python -m pip install gemmi==0.7.4
node --version   # Node.js 22 önerilir
python tests/validation/validate.py --out-dir validation-results
```

Gerektiğinde hata veren CIF'lerin otomatik test kapısı olması için:

```bash
python tests/validation/validate.py --strict --out-dir validation-results
```

## GitHub Actions

[**CIF crystal accuracy · Gemmi reference**](../../.github/workflows/cif-validation.yml) iş akışı **yalnızca `main` dalına ilgili dosyalar merge/push edildiğinde** veya elle `workflow_dispatch` ile çalışır. PR açılınca tetiklenmez. Sonuçlar GitHub Actions **Summary** görünümüne yazılır ve `browser.json`, `reference.json`, `report.json`, `report.md` dosyaları 30 günlük artifact olarak saklanır.

- Varsayılan: **ölçüm modu**, bilimsel uyumsuzluklar raporlanır ama mevcut GitHub Pages dağıtımı bloke edilmez. Kaynak bütünlüğü veya ölçüm altyapısı hatası job'ı başarısız yapar.
- **Run workflow → strict: true**: uyumsuz veya belirsiz test varsa job başarısız olur; artifact yine yüklenir.

Bu ayrım, henüz düzeltilmemiş kristallerin "başarılı" sayıldığı anlamına gelmez; gerçek değerler raporda açıkça görünür.
