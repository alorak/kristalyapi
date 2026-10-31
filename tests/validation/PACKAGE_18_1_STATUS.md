# V18.1 — CIF2 güvenli skaler ayrıştırma ve simetri

**31 Ekim 2026.** IUCr CIF2 formatının **sınırlı skaler/loop
altkümesi** desteklenir; tüm CIF2 standardının uygulandığı
iddia edilmez. VESTA masaüstü GUI gerekli değildir.

## Uygulanan altküme

- İlk satırda zorunlu CIF2 sürüm belirteci (#\#CIF_2.0),
  BOM, Unicode, triple single/double quote, tek/double
  tırnak ve semicolon metin alanı.
- Belge boyutu <=4 MB, satır uzunluğu <=2048, sınırlı
  token sayısı. Sonlandırılmamış tırnak, tekrarlı etiket,
  bozuk loop, kontrol karakteri güvenli reddedilir.
- Tek data_ bloğu. CIF2 List/Table, çoklu data_,
  save frame ve global_ bölümü **şimdilik açık hata ile
  reddedilir**; sessizce yanlış CIF1 okuması yapılmaz.
- CIF1 eski tokenizer yolunda kalır. Düzenlenmiş CIF2
  metadata'sı CIF1 provenance parser'ıyla kopyalanmaz;
  orijinal değişmemiş kaynak dosya korunabilir.

## Hücre metriği ve simetri

- Açık symmetry xyz ifadelerinin dönüşüm matrisleri
  tamsayı, determinantları ±1 ve kafes metriğine
  uygun olmalıdır: R transpose × G × R = G.
- Kimlik, operatör tekrarı ve mod-1 periyodik
  bileşim altında grup kapanışı kontrol edilir.
- CIF2 P1 dışı IT numarası verip **operatör listesi
  vermiyorsa** kanıtlanmamış setting/origin
  varsayılanı kullanılmaz: içe aktarım reddedilir.
- Açık işlemler kaynağın kendi origin/setting
  konvansiyonunda uygulanır. IT numarasından
  Hall, unique-axis ve origin kayması otomatik
  türetilmez; IT ile tam setting eşdeğerliği
  NOT_ESTABLISHED durumundadır.
- manyetik CIF2 kombinasyonları V18.1'de
  henüz desteklenmez; mevcut CIF1/mCIF korunur.

## Test ve bağımsız referans

- Sentetik CIF2 P−1 (2 işlem, 4 genişletilmiş atom,
  0,5 O doluluğu, Unicode ve çok satırlı metadata).
- Sentetik CIF2 P2₁ (2 işlem, beta=101°).
- Node testleri: tests/cif2-v18-1.test.mjs
- Gemmi 0.7.4 bağımsız kontrol:
  tests/validation/test_cif2_v18_1_gemmi.py
- Browser modülünü tarayıcısız çalıştıran CIF
  runner yeni pure CIF2 yardımcılarını da yükler.
- Modüller Pages + PWA offline cache'e alındı.
  CI tetikleyicileri **merge-only** kalır.

Test komutları:

    node --test tests/cif2-v18-1.test.mjs
    python -m unittest discover -s tests/validation -p 'test_cif2_v18_1_gemmi.py' -v
    node --test tests/validation/test_runner.cjs

Bu özellik gerçek VESTA GUI ve tüm CIF2 varyantları
üzerinde onaylandığı anlamına gelmez.

## Sonraki V18 işleri

- [ ] V18.2 CIF2 typed List/Table, seçili data_
      bloğu ve save-frame; gerçek CIF2 corpus
- [ ] V18.3 Hall/setting/origin, alternatif
      baz dönüşümleri, bağımsız Gemmi kontrolü
- [ ] V18.4 Manyetik CIF2 ve ADP/disorder
      dönüşümlerinin fiziksel testleri

## Kaynaklar

- https://journals.iucr.org/j/issues/2016/01/00/aj5269/
- https://www.iucr.org/what-we-do/digital-standards/cif/cif2
- https://gemmi.readthedocs.io/en/latest/cif.html

Durum: CIF2 scalar subset IMPLEMENTED, symmetry
metric/closure IMPLEMENTED, complete CIF2 NOT_SUPPORTED,
IT-origin equivalence NOT_ESTABLISHED,
VESTA GUI NOT_REQUIRED.
