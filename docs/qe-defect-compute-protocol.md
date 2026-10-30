# D5 hesap protokolü hazırlığı — çalıştırma kapalı

Durum: kaynak geometri ve aday dosyaları hazır. D3 geometri/kuvvet ve D4
sonlu elektronik veri kabulü geçti. Kusur SCF/relaksasyonu yapılmadı.
Kullanıcı tercihi doğrultusunda bu aşama kod/protokol hazırlığıyla sınırlıdır.

## Sabit başlangıç dosyaları

[Hazırlama planı](../tests/fixtures/qe/mos2-defect-preparation.json)
D3 kaynak commit, summary/result ve son yapı hash'lerini sabitler.
Dört 4×4×1 adayın atom kimlikleri, bir/iki boşluk konumları ve O ikamesi
belirlidir; O₂ adayı iki açık O konumu gelmeden oluşturulmaz.

Her vaka için `initial.cif`, `structure.json`, `site-map.json`,
`candidate-relax-request.json` ve **`candidate-relax.in`** üretilir.
Son dosya sunucunun D3'te kullanılan girdi derleyicisinden çıkarılır:
PBE, nötr/spinsiz başlangıç hipotezi, sabit hücre, bütün atomlar serbest,
120/960 Ry, 4×4×1, BFGS en fazla 30 adım, iç kuvvet hedefi 2e-5 Ry/Bohr,
iyonik enerji hedefi 1e-6 Ry, SCF conv_thr=1e-8 Ry. Bunlar doğrulanmış
ilkel referanstan türetilen **aday** ayarlardır; kusur yakınsama kabulü değildir.

Girdi `pseudo_dir='./pseudo'`, `outdir='./relax-tmp'` kullanır. UPF dosya
adları operatör profilinden gelir; kaynak/lisans/hash'ler aynı pakettedir.
Dosya üretmek hesap başlatmaz. Bu metinler mevcut sunucunun ham QE girdisi
kabul etmeyen HTTP uçlarına gönderilmez; API yapı JSON'unu derler.

```bash
python3 tools/qe_defect_prepare.py --output /tmp/mos2-d5-candidates
python3 tools/qe_defect_prepare.py --verify /tmp/mos2-d5-candidates
```

## D5.2 çevrimdışı kaynak kanıtı incelemesi

[Kaynak bütçesi ve ham OOM kanıtı denetimi](qe-defect-resource-review.md):
`python3 tools/qe_defect_resource_review.py --output /tmp/d5-review.json`.
Araç daha önce kaydedilmiş dört başarısız denemenin ham dosya hash'lerini,
süreç başına QE bellek tahminlerini ve Docker OOM/izolasyon kayıtlarını
kontrol eder. 6/32/64/96/128 GiB karşılaştırmaları **hipotetik**tir;
yeni koşum, güvenli kapasite garantisi veya bilimsel kabul değildir.

## Gerçek hesap açılmadan çözülmesi gereken kararlar

1. **Kaynak profili:** 416 bantlık `nstep=0` pilotu dört adayda da 6 GiB
   sınırında OOM/137 verdi. [Özgün kanıtlar](../validation-results/qe-mos2-d5-init-first-20261029-arm64/INCELEME.md)
   ve 71.76–80.49 GB basılı QE tahminleri korunur. Bunlar ölçülmüş peak
   veya farklı MPI düzeni için garanti değildir. Gerekli dolu bantlar
   202–208; boş bant sayısı, diagonalizasyon/paralelleştirme ve gerçek
   RAM/wall-time ayrı ön kayıtlı kaynak denemesi ister. Mevcut elektronik
   API üst sınırı 128 ve atom sınırı 64'tür; bunlar değiştirilmedi.
2. **Spin/doluluk:** mevcut API ve PDOS okuyucu spinsiz akış içindir.
   Kusur temel durumu için spinsiz ve uygun başlangıçlarla spin-polarize
   çözümler değerlendirilmelidir. Bu destek ve ortak karşılaştırma şeması
   kodlanmadan aday JSON'daki `unpolarized` fiziksel kabul sayılmaz.
   Yük durumları/elektrostatik düzeltmeler ayrıca kapsamlandırılmalıdır.
3. **Yakınsama matrisi:** aynı kusurda cutoff, k-örgüsü, hücre boyutu,
   boş bant ve DOS genişliği kontrolleri önceden kaydedilmeli; karar
   çiftleri ve hedefler sonuç görülmeden sabitlenmelidir. İlkel hücrenin
   enerji/kuvvet kabulü bunların yerine geçmez. 5×5 pristine 75 atomdur
   ve mevcut 64 atom API sınırını aşar; yalnız tekrar çarpanını değiştirip
   aynı backend'e göndermek desteklenmez.

## Her adayın gelecekteki veri zinciri

- Hash eşleşmeli başlangıç → BFGS relax → **yeni scratch'te bağımsız SCF**.
  Tür/sıra/hücre korunmalı; ham final koordinatları, atomik kuvvetler ve
  SCF yakınsama/hata tahmini sonuç JSON'uyla eşleşmelidir. D3'teki
  ≤1e-4 Ry/Bohr kuvvet ve ≤1e-8 Ry SCF ölçütleri başlangıç hedefleridir;
  kusur duyarlılığı ayrıca test edilir.
- Aynı son geometride ayrı cutoff ve protokol kontrolü. Başarısız/eksik
  vakadan kabul enerjisi veya elektronik sonuç üretilmez.
- Kabul edilmiş son yapı → SCF/bands/NSCF/DOS/projwfc; bütün aşamaların
  sürümü, girdi/çıktı/UPF hash'leri, elektron/bant sayıları, ham eksenler,
  atom/orbital toplamları ve state-count aralığı doğrulanır.
- Sonuçlar [mevcut karşılaştırma aracına](qe-defect-comparison.md) ancak
  eş yöntem, aynı hücre/örnekleme ve ortak elementlerin aynı UPF'leriyle
  alınır. Spin-polarize sonuçlar mevcut spinsiz karşılaştırıcıya verilmez.

Farklı stokiyometrilerde toplam enerjiyi doğrudan kararlılık sıralamasına
çevirmeyin. Oluşum enerjisi için kimyasal potansiyel/referans ve gerekiyorsa
yük düzeltmeleri tanımlanmalıdır. Vakum potansiyeli kanıtı olmadan farklı
hesapların ham özdeğer eksenleri birleştirilmez. Bu hazırlık SOC, optik veya
tek-foton kabulü değildir.
