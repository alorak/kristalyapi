# P1 XRD — iki fiziksel cihazın ham dosya ve bağımsızlık kanıtı için ek kapı

Mevcut `tools/xrd_acceptance.py` iki ayrı **cihaz ID'si** istemektedir; ancak aynı tarama dosyası kopyalanıp farklı cihaz ID'si yazılması, tek başına donanımsal bağımsızlığa kanıt değildir. Bu PR'ın `tools/xrd_device_custody_gate.py` denetleyicisi aynı dosyanın tekrar kullanımını yakalar ve ayrıca cihaz seri beyanını, ham üretici tarama dosyasını, kalibrasyon belgesini ve kör numune protokolünün ham byte SHA-256'sını kontrol eder.

Bu kapı **henüz gerçek cihaz kanıtı değildir**: sahte numara/operatör etiketleri ve sıfırdan üretilen farklı sahte dosyalar yine geçebilir. `physical_device_independence_confirmed=false`, `calibration_certificates_authenticated=false`, `blind_randomization_verified=false`, `scientific_acceptance=false` sonuçların hepsinde korunur.

## Giriş

`cohort.json`: `kristalyapi.xrd-experimental-cohort.v1`, iki cihazdan standart ve kör numune kayıtları.

`custody.json`: `kristalyapi.xrd-device-custody.v1`; `cohort_manifest_sha256` özgün JSON'un **ham byte digest'i**; `records` içinde cohort'daki **her dataset id** için:

```json
{
  "dataset_id": "instrument-A-standard",
  "instrument_serial": "PHYSICAL-SERIAL-CLAIM",
  "instrument_make_model": "Manufacturer and model",
  "sample_id": "sample-001",
  "operator_id": "operator-001",
  "acquired_at_utc": "2026-11-01T10:00:00Z",
  "wavelength_angstrom": 1.5406,
  "xray_source": "Cu-Kalpha",
  "kalpha2_handling": "recorded-doublet",
  "conversion_software": "device-native-to-CSV converter and version",
  "native_raw_file": {
    "path": "raw/instrument-A-standard.xrdml",
    "sha256": "real-64-character-lowercase-hex"
  },
  "calibration_document": {
    "path": "certificates/instrument-A-calibration.pdf",
    "sha256": "real-64-character-lowercase-hex"
  },
  "standard_or_blind_protocol_id": "pre-registered experimental protocol ID",
  "standard_batch_id": "standard certificate batch / lot"
}
```

JSON yukarıda **şema şablonudur**; dosyalar/seri no/numune kodu gerçek sahaya göre doldurulmalıdır. Kör numune satırında `standard_batch_id` yerine `blind_protocol: {path, sha256}` kullanılır. CSV ve cihazın ham orijinal kaydının farklı dosyalar olması zorunludur. Ham üretici formatı (`xrdml/raw/ras` vb.) dış parser kullanılmadan açılmaz; içerik sadece byte düzeyinde doğrulanır. Kaynağın gerçek cihazdan geldiğini yalnız dosya türü veya imza olmayan SHA-256 kanıtlamaz.

## Yazılım kontrolleri

- Dört veya daha fazla cohort dosyasının orijinal hash'leri `xrd_acceptance.assess` aracılığıyla kontrol edilir; aynı CSV dosyasının farklı cihaz/numune ID'siyle tekrar kullanılması reddedilir.
- Her `native_raw_file` dosyasının ham SHA-256'sı tekrar hesaplanır ve her edinim için **farklı olmalıdır**; aynı taramanın dosyası ikinci cihazmış gibi tekrar kullanılamaz.
- Aynı cihaz ID'si için standard ve blind kaydı aynı seri numara/model beyanını vermelidir; iki farklı cihaz ID'sinin aynı seri numarası olamaz.
- Her kaydın cihaz modeli, operator ID, numune ID, UTC acquisition timestamp, ölçüm dalga boyu ve Kα2 işleniş beyanı bulunmalıdır.
- Kalibrasyon belgesi ve kör protokol dosyalarının SHA-256'sı orijinal baytlardan hesaplanır; **imza, cihaz/operatör ve sertifika gerçekliği otomatik doğrulanmaz**.
- `numeric_position_gate` ayrı raporlanır. “Dört eşsiz byte dizisi” bilimsel kabul kriteri değildir; veri bireysel kaynaktan üretildiğini belgelemez.

## Komut

```sh
python tools/xrd_device_custody_gate.py \
  --cohort /private/xrd/cohort.json \
  --custody /private/xrd/custody.json \
  --output /private/xrd/custody-review.json
```

Girdiler uyuşmazsa veya dosya hash'i yanlışsa işlem hata verir. `numerical_standard_position_gate_passed` false ise exit code 2 döner. Gerçek laboratuvar bağımsız kabulü için iki farklı seri numarasını fiziksel cihaz loglarıyla doğrulayan operatör ve bağımsız ikinci araştırmacının imzaladığı inceleme gerekir.

Test: `python -m unittest discover -s tests -p 'test_xrd_device_custody_gate.py' -v`. Test girdileri **yalnız sentetiktir**.

**P1 kabul sonucu:** İki gerçek cihazdan gerçek standart/kör numune ölçümleri ve fiziksel kaynak onayı bulunmadığı sürece P1 tamamlanmış değildir.
