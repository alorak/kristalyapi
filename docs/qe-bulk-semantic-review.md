# P1 · QE bulk için bilimsel *semantik tutarlılık* kontrolü

**Durum:** gerçek ham QE giriş/çıkış kanıtlarını ve operatörün **ayrı hazırladığı kaynak-kristal transkripsiyonunu** daha sıkı eşleştiren, yürütme yapmayan CLI. Bu işlem GaN/AlN/SiC malzeme özelliklerini hesaplamaz ve bağımsız fiziksel kabul üretmez.

## Neden ayrı kapı?

Mevcut `tools/qe_bulk_validation.py`, SCF işinin ham çıktı hash'ini ve enerji yakınsamasını ölçer; fakat yalnız aynı atom sayısını taşımak, doğru malzemeyi veya tutarlı elektronik ayarları garanti etmez. Örneğin yüksek `ecutwfc` koşusunda `ecutrho` farklı oranla seçilirse deney, yalın kesme enerjisi yakınsaması sayılmamalı. Ayrıca CIF'in hash'inin bulunması **CIF içeriğinin QE'ye doğru aktarıldığını** garanti etmez.

## Bağımsız kaynak transkripsiyonu

Aşağıdaki dosya, gerçek kaynak CIF veya hakemli birincil referanstan **ayrı bir araştırmacı tarafından** hazırlanmalı ve karşılaştırılmalı. Burada **bilimsel olmayan örnek konumlar** kullanılmıştır; gerçek GaN parametresi değildir.

```json
{
  "schema": "kristalyapi.bulk-geometry-reference.v1",
  "material": "GaN",
  "source_file_sha256": "REPLACE_WITH_RAW_SOURCE_DIGEST",
  "source_identifier": "independent CIF database entry or DOI",
  "cell_unit": "angstrom",
  "coordinates": "fractional",
  "cell_vectors_angstrom": [
    [3.19, 0, 0],
    [-1.595, 2.763, 0],
    [0, 0, 5.18]
  ],
  "sites": [
    {"element": "Ga", "fractional": [0, 0, 0]},
    {"element": "N", "fractional": [0.333333, 0.666667, 0.375]},
    {"element": "Ga", "fractional": [0, 0, 0.5]},
    {"element": "N", "fractional": [0.666667, 0.333333, 0.875]}
  ]
}
```

**Bu tablo eğitim amaçlı uydurulmuş bir örnektir.** `source_file_sha256`, `manifest.json` içindeki gerçek kaynak dosya SHA-256 değeriyle tam eşleşmelidir; gerçek kaynak dosyasının baytları ayrıca yeniden hash'lenir. Dosyanın transkripsiyonunun doğru olduğuna ve belirtilen kristal fazı temsil ettiğine hükmetmek bağımsız araştırmacının işidir.

## Çalıştırma

```sh
python tools/qe_bulk_semantic_gate.py \
  --manifest /secure/real-bulk/manifest.json \
  --geometry-reference /secure/real-bulk/typed-reference.json \
  --output /secure/real-bulk/semantic-review.json
```

- Kaynak kristal hücresinin **Å cinsinden 3B vektörlerini** ve kesirli atom koordinatlarını QE'nin `CELL_PARAMETERS angstrom` ve `ATOMIC_POSITIONS crystal` kartlarıyla karşılaştırır. Atom sıralaması değişebilir; element ve tüm üç koordinat eşleşmek zorundadır. İzin verilen sayısal yuvarlama farkı hücrede **0.0005 Å**, kesirli koordinatta **0.00001**'dir. Bu toleranslar transkripsiyon için yazılım eşikleridir; fiziksel hata payı değildir.
- İki ayrı elementin **1:1** nominal bileşimi, sitelerin sayısı, `nat`, `ntyp` ve atom adları kontrol edilir. İlgili referans aynı geometrinin tüm SCF ve band girdilerinde yer almalıdır.
- Pseudopotansiyellerin ham baytları SHA-256 ile doğrulanır; UPF `PP_HEADER` içindeki `element`, `functional` (PBE beyanı) ve `z_valence` sayısal aralıkları karşılaştırılır. **Metadata tutarlılığı üretici/orijin kimliği doğrulaması değildir.**
- `ibrav=0`, `input_dft='PBE'`, `occupations='fixed'`, `nbnd`, `conv_thr`, `ecutwfc` ve `ecutrho` ayarları incelenir. İlgili parametrelerin ölçüm serisinde istemsiz değişmesi reddedilir. Bu dar protokolden farklı spin, Hubbard veya noncollinear çalışmalar ayrıca bilimsel plan gerektirir.
- `ecut-refined` koşusunun `ecutrho/ecutwfc` oranını temel koşuyla eş tutar; `k-refined` ve `bands` koşularının diğer cutoff değerlerini temel koşulla karşılaştırır.
- Önce mevcut `qe_bulk_validation.verify` tekrar çalışır: ham UPF/input/output hash doğrulama, 3B grid, `JOB DONE`, solver sürümü, enerji yakınsaması. Ayrı yeni araç temel doğrulamanın yerini almaz.

## Ne **yapmaz**?

- Ham CIF'i gerçek bir kristalografi ayrıştırıcısıyla kendisi çözüp bağımsız atom tablosu üretmez. Ayrı transkripsiyon kullanıcı beyanı olarak kalır.
- UPF kaynağını kriptografik olarak üreticiye veya PSlibrary sürümüne bağlamaz, dış kurumsal imzayı/incelemeyi doğrulamaz.
- K-örgüsü simetrisi, band yolunun yüksek-simetri doğruluğu, fonon, kuvvet/stres veya hücre relaksasyonu yakınsamasını fiziksel olarak ispatlamaz.
- Solver'ın gerçek QE ikilisiyle hesap yaptığını bağımsız olarak doğrulamaz.
- Sonuç her koşulda `scientific_acceptance=false`, `reference_transcription_independently_verified=false` ve `reviewer_signature_verified=false` içerir. Başarılı `software_semantic_gates_passed` yalnız belirtilen kayıtlar arası **yazılımsal tutarlılığı** ifade eder.

Gerçek iki-cihaz XRD ölçümleri ve GaN/AlN/SiC fiziksel yürütme/bağımsız kabul işlemleri hâlâ açıktır; deney cihazı ve gerçek iş ortamı olmadan **tam P1 kabulü verilemez**.

Test: `python -m unittest discover -s tests -p 'test_qe_bulk_semantic_gate.py' -v`. Testlerde sahte UPF ve sentetik QE stdout kullanılır.
