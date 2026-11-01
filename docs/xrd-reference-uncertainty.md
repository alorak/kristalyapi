# P1.2 · Bağımsız XRD referans adayları ve ölçüm belirsizliği taraması

**Durum:** çoklu referansın sayısal karşılaştırılması uygulanmıştır. Bu, faz tanısı, kalibrasyon, Rietveld veya gerçek cihaz kabulü değildir.

Önce P1'in `tools/xrd_acceptance.py` korpusunu hazırlayın: **iki ayrı gerçek cihazın** her biri için standart ve kör numune taraması. Tüm dosyalar gerçek bayt SHA-256 ile bağlı olmalı. Standart ve kör numune koşulları karşılanmazsa adaylar incelenmez.

Aynı manifest'e `reference_candidates` dizisi ekleyin; her kayıt aşağıdaki gibi, ayrı bağımsız referans dosyası ve bu dosyanın SHA-256'sını taşır. Verilen açılar yalnız **örnektir** ve doğrudan gerçek kristal sertifikası olarak kullanılmamalıdır:

```json
"reference_candidates": [
  {
    "id": "candidate-A",
    "source_reference": "Independent powder reference ID / literature DOI",
    "reference_document": {
      "path": "references/candidate-A-reference.pdf",
      "sha256": "replace-with-real-64-character-lowercase-hex"
    },
    "wavelength_angstrom": 1.5406,
    "reference_peaks_two_theta_deg": [20.0, 30.0, 40.0]
  }
]
```

Yukarıdaki `reference_document` gerçek **lisanslı** veya izinli kanıt dosyanız olabilir; PDF'nin kendisi matematiksel olarak okunup değerlendirilmiyor, yalnız **ham dosya bütünlüğü** kontrol ediliyor. Pikler operatörce referanstan girilir; bağımsız transkripsiyon kontrolü gereklidir.

```bash
python tools/xrd_candidate_review.py --manifest /private/cohort/manifest.json --output /private/cohort/candidate-review.json
python -m unittest discover -s tests -p 'test_xrd_candidate_review.py' -v
```

## Algoritma ve rapor

- **Ön koşul:** İki cihazın standart + kör örneklerini ve referans piklerini içeren korpusun `numeric_position_gates_passed` sonucu. Sonuç negatifse aday taraması `skipped-standard-numerical-gate-failed` olarak durur.
- **Dalga boyu:** Referans ve ölçüm `|Δλ| ≤ 0.0005 Å` kontrolünden geçmeli; farklı dalga boylarındaki 2θ değerleri sessizce karşılaştırılmaz veya Bragg dönüşümüyle otomatik düzeltilmez.
- Her kör örnek ve **her aday ayrı ayrı**, 2θ toleransı içinde *bire bir* eşleştirilir; ölçülen pik farklı adaylar için bağımsız olarak kullanılabilir. Faz yüzdesi veya göreli ihtimal çıkarılmaz.
- `matchedReferencePeakCount`, `unmatchedReferencePeakCount`, `unmatchedObservedPeakCount`, `positionCoverageFraction`, `medianSignedPositionOffsetDeg`, `medianAbsoluteDeviationDeg`, `maximumAbsolutePositionResidualDeg` raporlanır.
- Medyan işaretli sapma **olası sıfır kayması uyarısı için bir gösterge**; cihaz düzeltmesi, parametre fit'i ya da fiziksel kalibrasyon olarak kullanılmaz. Dolayısıyla `zeroShiftAutomaticallyCorrected=false`, `instrumentCalibrated=false`.
- Referans kimliği, kör örnek kimliği ve cihaz seri bilgisi operatör beyanıdır; `phaseIdentified=false` ve `scientificAcceptance=false` her zaman korunur.

## Gerçek deneysel kabulden önce

1. Bağımsız referans sertifikalarını ve 2θ listelerinin doğruluğunu ikinci bir kişi kontrol etmeli.
2. Farklı Kα alt bileşenleri, cihaz sıfır kayması, tercihli yönelim, ortak/çakışan pikler, numune hatası ve gürültü için gerçek cihaz ölçümleri değerlendirilmeli.
3. Sentetik fixture testlerinin başarısı fiziksel performans ölçümüne eşitlenmemeli; cihazdan doğrudan alınmış ham dosyalar şarttır.
4. Faz tayini istenirse uzman tarafından onaylanan çoklu referans modeli ve bağımsız deneysel kabul ayrı fazda eklenmeli.

Bu PR **eksik P1.2 cihaz kanıtını üretmez**; ölçüm temin edildiğinde değerlendirilebilir, denetlenebilir sayısal taramayı ekler.
