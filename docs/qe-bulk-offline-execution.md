# P1.3 — Yerel QE 3B bulk yürütücüsü (GaN / AlN / SiC)

**Sınır:** Bu modül `pw.x` benzeri harici bir ikiliyi *operatörün açık isteğiyle* çalıştırır ve çıktıyı mevcut P1 `qe_bulk_validation.py` doğrulayıcısına bağlar. **Burası bir sandbox değildir**; yalnız güvenilir Quantum ESPRESSO kurulumunda, izole kullanıcı hesabıyla çalıştırın. PR/CI'da yalnız sahte çözücü kullanılır; fiziksel 3B hesap sonucu henüz elde edilmedi.

## Plan şeması

`kristalyapi.qe-bulk-run-plan.v1` JSON'u kullanıcı hazırlar:

```json
{
  "schema": "kristalyapi.qe-bulk-run-plan.v1",
  "material": "GaN",
  "polytype_claim": "operator-claimed wurtzite candidate; independent verification required",
  "structure_reference": {
    "path": "input/structure.cif",
    "sha256": "REPLACE-WITH-REAL-SHA256"
  },
  "pseudopotentials": {
    "Ga": {"path": "input/Ga.upf", "sha256": "REPLACE-WITH-REAL-SHA256"},
    "N": {"path": "input/N.upf", "sha256": "REPLACE-WITH-REAL-SHA256"}
  },
  "criteria": {
    "max_energy_delta_mev_per_atom": 1.0,
    "max_scf_accuracy_ry": 0.000001
  },
  "runs": {
    "baseline": {"input": {"path": "input/base.in", "sha256": "REPLACE-WITH-REAL-SHA256"}},
    "ecut-refined": {"input": {"path": "input/ecut.in", "sha256": "REPLACE-WITH-REAL-SHA256"}},
    "k-refined": {"input": {"path": "input/k.in", "sha256": "REPLACE-WITH-REAL-SHA256"}},
    "bands": {"input": {"path": "input/bands.in", "sha256": "REPLACE-WITH-REAL-SHA256"}}
  }
}
```

Her SHA-256 alanı gerçek dosyanın *ham baytlarından* hesaplanmalıdır, örneğin `sha256sum input/Ga.upf`. Bunlar gerçek hesap parametreleri değil, şema örnekleridir.

## QE girdisinin zorunlu koşulları

Her `pw.x` input içinde `&CONTROL` namelist'te **aynen**:
```text
prefix='bulk'
pseudo_dir='./pseudo'
outdir='./scratch'
```

Bu göreli dizinler sonuç klasörü içinde oluşturulacaktır. `ATOMIC_SPECIES` satırlarında kullanılmış UPF dosya adları planın SHA-256 ile sabitlenmiş UPF adlarıyla eşleşmelidir. Bütün aşamalarda aynı kaynak hücre/konumlar kullanılmalı, `ibrav=0`, `CELL_PARAMETERS` ve `ATOMIC_POSITIONS` açıkça yazılmalıdır. K noktası koşulları:

- `baseline`: `calculation='scf'`, `K_POINTS automatic` içinde bütün 3 eksende 2+ grid.
- `ecut-refined`: aynı grid, daha yüksek `ecutwfc`.
- `k-refined`: aynı cutoff, 3B k örgüsü bir veya daha fazla eksende sıklaştırılır.
- `bands`: `calculation='bands'`, `K_POINTS crystal_b` ve kullanıcı tarafından **kaynak üzerinden doğrulanmış** yüksek simetri band yolu, en az bir noktanın kesirli k_z koordinatı sıfırdan farklı.

`K_POINTS crystal_b` içinde k_z≠0 bulunması **gerçek yüksek-simetri yolun fiziksel doğruluğunu kanıtlamaz**. SiC için 3C/4H/6H polimorflarını, GaN için wurtzite/zincblende farkını ayrıca teyit edin. `ecutwfc`/`ecutrho`, fonksiyonel, UPF valansı, spin ve hücre relaksasyonu için ayrı kaynak ve yakınsama değerlendirmesi gerekir.

## Açık onayla gerçek yürütme

```bash
python tools/qe_bulk_execute.py \
  --plan /secure/bulk/run-plan.json \
  --qe-binary /opt/qe/bin/pw.x \
  --output-dir /secure/bulk/results-001 \
  --timeout-seconds 3600 \
  --execute
```

- **`--execute` olmadan program herhangi bir hesap çalıştırmaz.**
- Sonuç klasörü **önceden mevcut olmamalıdır**; üzerine yazılmaz.
- Her aşama yalnız `[pw.x]` (kabuk kullanmadan) çağrısıyla başlar, girdisi standart girişten geçer, aynı scratch dizinini kullanır. Toplam yürütme 1–14.400 saniye ile sınırlıdır; 8 MB'tan fazla solver çıktısı veya tamamlanmamış aşama hata verir. Başarısız işlem kalan aşamaları çalıştırmaz.
- Kaynak CIF/UPF/girdi hash'leri yürütme **öncesinde** kontrol edilir. Araç kaynakları yeni sonuç klasörüne kopyalar. Sonuçta `stages/*.in`, `stages/*.out`, `pseudo/*.upf`, `reference/*`, `manifest.json`, `review.json` oluşturulur. `manifest.json` mevcut `qe_bulk_validation.py` ile tekrar denetlenebilir.
- Çıktıda `software_numeric_gates_passed`, energy delta (meV/atom), hash kayıtları ve kullanıcının verdiği ikilinin SHA-256 özeti bulunur.
- Kullanıcı tarafından belirtilmiş yürütülebilir dosyanın gerçekten QE olduğunu program **kanıtlayamaz**; testteki sahte çözücü de benzer çıktı üretebilir. Dolayısıyla `realQeBinaryIdentityAuthenticated=false` ve `scientific_acceptance=false` kalır.

## Bağımsız bilimsel kabul

Ham dosyaları ayrı bir ortamda doğrulayın; gerçek QE dağıtımı ve derleme sürümünü, kullanılan pseudo/XC eşleşmesini, deneysel kristal referansını, primitif/konvansiyonel hücreyi, yakınsama adımlarını ve gerekirse SOC/spin/fonon hesaplarını fizik uzmanına teyit ettirin.

Bu PR **web frontend backend'inin 2D elektronik sınırlamasını kaldırmaz**. İlk fiziksel hesaplar tamamen operatörün yerel ortamında yapılır. Veriler sağlandığında web entegrasyonu ayrı PR'dır.

Testler:

```sh
python -m unittest discover -s tests -p 'test_qe_bulk_execute.py' -v
```

Testler gerçek `pw.x` değil, geçici **sahte Python yürütücüsü** kullanır; fiziksel kanıt sayılamaz.
