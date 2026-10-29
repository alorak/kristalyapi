# D2.2c — Yüksek cutoff'ta MoS₂ k-örgüsü ve vakum kabulü

Bu [sabit plan](../tests/fixtures/qe/mos2-kvac-acceptance.json) ve ölçütler
gerçek koşudan önce commit edilir. [D2.2b](qe-mos2-cutoff-validation.md)
120→140 Ry farkını k=8, c=24'te 0.268123 meV/atom olarak doğruladı.
Bu deney önerilen **120/960 Ry, 16×16×1, c=24 Å** son SCF referansını
üç sonlu enerji duyarlılığı kapısıyla sınar. **Gerçek kabul geçti.**

İdeal üç atomlu 1H-MoS₂, a=3.18 Å, S düzlemi uzaklığı 1.56 Å, PBE,
26 nötr elektron, sabit occupations, spin/SOC yok. Mo/S UPF baytları ve
[incelemedeki SHA-256 değerleri](../validation-results/qe-mos2-d22-upf-review-20261029.json)
aynıdır ve plan tarafından sabittir. Atomik relaksasyon yapılmaz.

| Yeni gerçek iş | ecutwfc/ecutrho, Ry | k-örgüsü | c, Å |
| --- | --- | --- | --- |
| ecut120-k8-c24 | 120/960 | 8×8×1 | 24 |
| ecut120-k12-c24 | 120/960 | 12×12×1 | 24 |
| ecut120-k16-c24 | 120/960 | 16×16×1 | 24 |
| ecut120-k16-c18 | 120/960 | 16×16×1 | 18 |
| ecut120-k16-c30 | 120/960 | 16×16×1 | 30 |
| ecut140-k16-c24 | 140/1120 | 16×16×1 | 24 |

**Önceden sabitlenen üç kabul kapısı:**

- Kesme enerjisi: k=16, c=24'te 120→140 Ry **≤1 meV/atom**.
- K-örgüsü: 120 Ry, c=24'te k=12→16 **≤1 meV/atom**.
- Vakum: 120 Ry, k=16'da c=24→30 Å **≤2 meV/atom**.

Bu üçü aynı `ecut120-k16-c24` referansına bağlanır. Eski k=8 cutoff
sonucu yoğun k-örgüsüne varsayım yoluyla aktarılmaz. 8→12 ve c=18→24
farkları ayrıca raporlanır; sonradan kabul çifti değiştirmek için kullanılmaz.
100/800 Ry'lik eski D2.2 başarısızlığı tarihsel kayıt olarak korunur.

İlk yeni 120/k8/c24 işi D2.2b'deki -181.58162387 Ry enerji ve girdi/yapı/UPF
hash'leriyle karşılaştırılır; altı noktanın tamamı yeni API job kimlikleriyle
hesaplanır. Her işte `JOB DONE.`, SCF hata tahmini ≤1e-8 Ry, 26 elektron,
ham girdi/çıktı ve staged UPF SHA-256, API/raw enerji ve atom/hücre/k
uyumu zorunludur. Herhangi bir kapı veya iş başarısızsa kabul başarısız kalır.

Kabul ortamı: 6 GiB worker RAM, swap kapalı, 2 CPU, iş başına 3600 s
wall-time; worker'ın 4000 CPU-s sınırı da geçerli. Kaynak Compose varsayılanı
değişmez. Gerçek bellek/swap sınırları kayıt altına alınır. Manuel workflow
`protocol=d22c` ile 180 dakika üst sınır kullanır; başarısız ham çıktılar korunur.

```bash
python3 tools/qe_mos2_acceptance.py --run --protocol d22c \
  --mo-sha256 0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd \
  --s-sha256 90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4 \
  --output validation-results/qe-mos2-kvac-local
python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-kvac-local --protocol d22c
```

Geçerse yalnız belirtilen ideal monolayer SCF protokolünün sonlu enerji
hassasiyeti kabul edilir. Bağımsız deneysel doğruluk, kuvvet/geometri,
relaksasyon, elektronik yapı ve optik/tek-foton sonuçları ayrıca doğrulanır.
D3 `relax → scf` gerçek koşusu bu kabulün başarılı referansından başlar.

## Gerçek sonuçlar

[CI koşusu](https://github.com/alorak/kristalyapi/actions/runs/40786532333),
kaynak `78d116baec28419072a6d63c9d0842d28af79ac3`, **6/6 gerçek SCF** ve
üç kapı geçti. [Ham kanıtlar ve bağımsız inceleme](../validation-results/qe-mos2-d22c-20261029-amd64/INCELEME.md).

| Ölçüt | Fark, meV/atom | Sınır | Sonuç |
| --- | --- | --- | --- |
| 120→140 Ry, k=16/c=24 | 0.267715 | 1 | geçti |
| k=12→16, 120 Ry/c=24 | 0.000907 | 1 | geçti |
| c=24→30, 120 Ry/k=16 | 0.000000 | 2 | geçti |

Vakum farkı basılı 8 ondalık Ry hassasiyetindedir; tam sıfır fiziksel
etkileşim iddiası değildir. Referans **120/960 Ry, 16×16×1, c=24 Å**,
enerji **-181.58163993 Ry**. 120/k8/c24 tekrarı D2.2b ile enerji/girdi/yapı/
UPF/sürüm bakımından tam eşleşti. Altı işin 26 elektron, SCF hata tahmini,
API/raw enerji ve hash'leri yerelde yeniden denetlendi.

Bu yeni sonlu SCF referansı D3'e geçiş için enerji kapılarını kapatır.
İlk D2.2 başarısızlığı korunur; relaksasyon/kuvvet ve genel fiziksel
bağımsız doğruluk ayrıca değerlendirilir.
