# V18.2 — CIF2 tipli List/Table ve seçilmiş data_ blokları

**31 Ekim 2026.** Bu paket CIF2 formatının güvenli bir
**altkümesini** genişletir. Tam CIF2/DDLm uyumluluğu
ve VESTA masaüstü paritesi iddia edilmez.

## Yapılanlar

- CIF2 List [1 2 3] ve Table {"key":[1 2] 'name':"α"}
  değerleri nested, **tipli AST** olarak ayrıştırılır.
  CIF2 listelerinde virgül değil boşluk ayırıcıdır;
  Table anahtarı tırnaklıdır ve kapanış tırnağından
  hemen sonra iki nokta gelir.
- UTF-8/Unicode, üçlü tırnak, semicolon text, save_
  frame ve birden fazla data_ birbirine karıştırılmaz.
  Çoklu yapıda kullanıcı açıkça **yalnız bir**
  yapı bloğu seçer; iptal veya eşleşmeyen ad reddedilir.
- Seçili yapıdan hücre, atom, doluluk ve skaler
  simetri alanları V18.1'in bilimsel doğrulamasına
  aktarılır. Bilimsel değer List/Table ise
  **otomatik dönüştürülmez** ve reddedilir.
- Yapısal olmayan bileşik üstveri tipli AST halinde,
  60 KB proje-snapshot sınırına kadar korunur;
  .kristal.json, çalışma alanı ve Undo/Redo
  verileriyle taşınır. Sınır aşılırsa üstverinin
  korunamadığı açıkça bildirilir.
- Çoklu CIF2 kaynağından yalnız bir data_ seçildiyse,
  tüm çoklu kaynak sonradan tek kristal dosyası
  gibi kayıpsız dışa aktarılmış gösterilmez.
- Tırnak içindeki CIF2 loop_/data_/_tag sözcükleri
  eski string-only parser'a kontrol direktifi
  olarak sızmaz. Yanlış bilimsel anlamdan kaçınılır.
- 4 MB belge, 2048 karakter satır, 100k lexical
  token, 8192 AST düğümü, 12 iç içe katman,
  64 data_ bloğu sınırları.

## Test ve dağıtım

Yeni modül: cif2-document.js.
Yeni sentetik fixture: s13_cif2_multiblock_containers.cif
(metadata bloğu, save frame, nested List/Table,
ayrı alpha ve beta kristalleri).

- tests/cif2-v18-2.test.mjs: typed AST,
  block seçimi, üretim parser'ı, yanlış yönlendirme,
  bozuk tablo/loop ve project metadata kontrolleri.
- tests/validation/test_cif2_v18_2_gemmi.py:
  Gemmi 0.7.4 ham bileşik CIF2 verisini
  parse eden referans değildir; seçili yapıdan
  üretilen **CIF1 skaler yapısal projeksiyonu**
  ayrı doğrulanır.
- Eski V18.1 ve CIF1 regresyonları sürer.
  Pages, PWA offline ve mevcut **merge-only**
  CI yolları güncellendi. Trigger değişmedi.

    node --test tests/cif2-v18-1.test.mjs tests/cif2-v18-2.test.mjs
    python -m unittest discover -s tests/validation -p 'test_cif2_v18_2_gemmi.py' -v

**Açık:** typed bilimsel DDLm eşlemesi, gerçek
CIF2 corpus ve karmaşık satır katlama protokolleri,
seçim için özel erişilebilir modal; ardından V18.3
Hall/setting/origin ve V18.4 magnetic CIF2/ADP.

Standartlar:
- https://journals.iucr.org/j/issues/2016/01/00/aj5269/
- https://github.com/COMCIFS/cif_core/blob/main/CIF2-EBNF.txt
- https://gemmi.readthedocs.io/en/latest/cif.html

**Durum:** typedCIF2=BOUNDED_SUBSET;
multiBlock=EXPLICIT_CHOICE;
compoundScientificField=REJECTED;
GemmiCrossCheck=SCALAR_CIF1_PROJECTION_ONLY;
fullCIF2=NOT_SUPPORTED; VESTA_GUI=NOT_REQUIRED.
