# CIF bilimsel doğrulama hattı

Bu test hattı, **`index.html` içinde çalışan gerçek CIF ayrıştırıcısını** bağımsız [Gemmi](https://gemmi.readthedocs.io/) referansına karşı ölçer. Ayrı bir CIF parser kopyası test edilmez. Kullanıcı uygulaması yine yalnızca frontend/tek HTML'dir; Python ve Node.js **yalnızca GitHub Actions/test ortamında** kullanılır.

## Veri kümesi

- **30 gerçek CIF:** 29 örnek [pymatgen test koleksiyonundan](https://github.com/materialsproject/pymatgen/tree/main/test-files/cif) (MIT, [lisans](fixtures/PYMATGEN_LICENSE.txt)), ayrıca VESTA ekran görüntüsünde karşılaştırılan **[COD 4335507](https://www.crystallography.net/cod/4335507.cif)** (COD kaydında kamu malı/public-domain ibaresi). COD dosyası açık kaynak GitHub aynasından sabitlenmiştir. Her dosyanın kaynak adresi ve Git blob SHA-1 özeti `manifest.json` içinde kayıtlıdır.
- **10 sentetik zorlayıcı CIF:** P1, P-1, screw, triklinik metrik, sınırı aşan koordinatlar, karma/kısmi doluluk, simetri işlemi verilmeyen Fm-3m ve iki kasıtlı geçersiz dosya. Geçersiz iki örneğin **hem Gemmi hem tarayıcı tarafından reddedilmesi** beklenir.
- Dosyalar ağdan test sırasında indirilmez. `git_blob_sha1` değişirse doğrulama ölçüm dışı altyapı hatası verir. Raporlarda her dosyanın SHA-256 özeti bulunur.

## Yeni ölçüm bulguları (2026-10-14)

GitHub Actions [38632658918](https://github.com/alorak/kristalyapi/actions/runs/38632658918) çalışmasında **35 başarılı, 3 başarısız, 1 belirsiz, 1 ölçüm hatası** görülmüştü. Bu PR ile:

- **Fe.cif:** `z+.5` gibi başında sıfır olmayan kesirli simetri kaydırmaları okunuyor.
- **FePO4.cif:** Tek sütunlu `loop_ _cell_angle_alpha 91.0` hücre etiketi de okunuyor.
- **Graphite.cif:** Dört ondalıklı Wyckoff koordinatlarında birbirine yakın periyodik eşdeğerler **0,001 Å** eşiğinde, aynı element ve doluluk korunarak birleştiriliyor.
- **ICSD59959.cif:** Tanımsız `.` atom koordinatları keyfi biçimde 0 alınmıyor veya sessizce atılmıyor. Gemmi'nin bu alanları NaN olarak vermesi **inconclusive** (belirsiz kaynak), **pass** değil. Bu durumda normal ölçüm modunda CI'ın `exit code 2` ile çökmesi önleniyor.
- **srycoo.cif:** Kaynağın sonlandırılmamış çok satırlı metni nedeniyle Gemmi referansı yok; **inconclusive** kalıyor, değiştirilmiş/geçerli CIF gibi gösterilmiyor.

2026-10-16 yerel Gemmi 0.7.4 testi: **38 pass, 2 inconclusive, 0 fail, 0 error**.
FePO4 dosyasındaki tek elemanlı `_cell_angle_alpha` döngüsü, Gemmi üst seviye küçük-yapı
okuyucusunu yanlışlıkla 1 Å varsayılan hücreye düşürüyordu. Referans hücre artık
Gemmi'nin düşük seviye CIF etiketlerinden bağımsız okunuyor; referansın simetri
genişletmesi de korunuyor. İki belirsiz kaynak (`real-15`, `real-30`) manifestte
beklenen hata nedeniyle açıkça kayıtlıdır; başarılı kabul edilmez.

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
python -m pip install gemmi==0.7.4 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2 ase==3.26.0
node --version   # Node.js 22 önerilir
python tests/validation/validate.py --out-dir validation-results --gate
```

Bilinen bozuk kaynaklar dahil **her** belirsizliği başarısız saymak için:

```bash
python tests/validation/validate.py --strict --out-dir validation-results
```

## Paket 8.1 — düzenlenmiş CIF ve özel konum ADP doğrulaması

- **28 sabitlenmiş gerçek CIF:** `tests/core.test.cjs` gerçek
  deneysel koleksiyondan real-01–14 ve real-16–29 için
  birebir kaynak koruması, düzenlenmiş CIF'nin yeniden
  içe aktarması, atom çokluğu ve güvenli bibliyografi
  kaydı regresyonlarını yürütür.
- **İki bilinçli dışlama:** real-15 eksik/NaN atom konumu,
  real-30 kaynak referansındaki sonlanmamış dizge
  nedeniyle önceki `inconclusive` kayıtlarıdır;
  yanlışlıkla başarılı CIF olarak raporlanmaz.
- **ADP site symmetry:** simetriyle aynı konuma dönülen
  noktalarda anizotropik Kartezyen kovaryans tensörünün
  invariantlığı, ayna ve dörtlü dönme için analitik
  referanslarla test edilir.
- **Bağımsız sözdizimi kapısı:** `test_package81_gemmi.py`
  Node'daki gerçek üretim CIF dışa aktarma fonksiyonundan
  oluşturduğu düzenlenmiş CIF dosyasını **Gemmi 0.7.4**
  ile yeniden açar. Yazar loop'u, çok satırlı alıntı,
  koordinat güncellemesi ve güncelliği kalmayan depo/rafinman
  kayıtlarının dışlanmasını doğrular.

Bu testler mevcut 40 dosyalık referans karşılaştırmasının
yerine geçmez. Kaynağın tüm CIF2/sözlük verilerinin
kayıpsız taşındığı veya tüm ADP site-symmetry sınıflarının
doğrulandığı iddia edilmez. [Paket 8.1 sınırları](PACKAGE_8_1_STATUS.md).

## GitHub Actions

[**CIF crystal accuracy · Gemmi reference**](../../.github/workflows/cif-validation.yml) iş akışı **yalnızca ilgili dosyaları değiştiren bir PR `main` dalına birleştirildiğinde** veya elle `workflow_dispatch` ile çalışır. Doğrudan push ya da PR açılışıyla tetiklenmez; testler birleştirme commit'i üzerinde koşar. Sonuçlar GitHub Actions **Summary** görünümüne yazılır ve `browser.json`, `reference.json`, `report.json`, `report.md` dosyaları 30 günlük artifact olarak saklanır.

- Varsayılan: **scientific gate**, herhangi bir `fail` / `error` veya yeni/
  nedeni değişen `inconclusive` CI işini başarısız yapar. Yalnız manifestte
  sabitlenmiş iki hatalı kaynak belirtilen nedenleriyle belirsiz kalabilir.
- **Run workflow → strict: true**: uyumsuz veya belirsiz test varsa job başarısız olur; artifact yine yüklenir.

Bu ayrım, henüz düzeltilmemiş kristallerin "başarılı" sayıldığı anlamına gelmez; gerçek değerler raporda açıkça görünür.
