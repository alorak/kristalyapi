# Paket 7 doğrulama matrisi

Bu tablo yalnızca depoda bulunan kontrolleri listeler; PR açılması testlerin çalıştığı anlamına gelmez.

| Alan | Üretim fonksiyonu / bağımsız kaynak | Mevcut kontrol | Açık nokta |
|---|---|---|---|
| CIF içe/dışa aktarma | cifData / cifExportText | tests/core.test.cjs: metadata ve ADP round-trip | Bilinmeyen CIF etiketlerinin kayıpsız korunması garanti değil |
| ADP | adpToCartesian / adpFromCartesian / adpEllipsoid | tests/core.test.cjs ve test_scientific_invariants.py | Her uzay grubu için simetri operatörleriyle karşılaştırma |
| Hücre dönüşümü | transformCrystal / primitiveFromSetting / niggliReduceCell | tests/core.test.cjs | Çoklu standart ayar ve orijin seçiminin bağımsız karşılaştırması |
| Kırınım | structureFactor / powderPattern | tests/core.test.cjs ve Gemmi temelli invariant testleri | Gerçek deneysel Fo/Fc veri setleri |
| Görsel regresyon | tests/browser/visual.test.mjs | Gerçek Chromium/WebGL test dosyası mevcut | Otomatik CI çalıştırılması ve baseline karşılaştırma |
| Bilimsel gate | tests/validation/validate.py | 30 gerçek + 10 sentetik CIF | Bilinen iki belirsiz kaynak |

## Raporun yorumlanması

`combined_report.py` bilimsel gate ile görsel test sonucunu ayrı tutar.
Görsel metrik dosyasının varlığı tek başına başarılı test anlamına gelmez:
`visual.status=pass` yalnız açıkça sağlanan başarı statüsüyle üretilir.
Görsel test hiç çalıştırılmadıysa `not_run`, yalnız metrik varsa `inconclusive`
olarak raporlanır. Bu rapor gerçek Chromium testinin yerini almaz.

## Yerel kontrol

```bash
python -m pip install gemmi==0.7.4
python -m unittest discover -s tests/validation -p 'test_*.py' -v
node --test tests/core.test.cjs
python tests/validation/validate.py --gate --out-dir validation-results
python tests/validation/combined_report.py --scientific validation-results/report.json --out validation-results/combined-report.json
```

Görsel test için ayrıca Playwright, Chromium ve uygulamanın yerel WASM varlıkları
kurulu olmalıdır. Bilimsel raporun görsel bölümü bu komutlarla `not_run` kalır.
