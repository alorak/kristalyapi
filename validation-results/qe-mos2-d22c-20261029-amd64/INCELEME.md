# D2.2c gerçek SCF kabulü — üç kapı geçti

[Başarılı Linux CI](https://github.com/alorak/kristalyapi/actions/runs/40786532333),
kaynak `78d116baec28419072a6d63c9d0842d28af79ac3`, altı yeni API işi.
Bu klasördeki ham QE/API dosyaları indirilmiş artifact baytlarıyla aynıdır;
`inspection.json`, `comparison-to-d22b.json`, `github-actions.json` ve bu
belge sonradan bağımsız inceleme olarak eklendi.

| Vaka | Enerji, Ry | Son SCF hata tahmini, Ry | İterasyon |
| --- | --- | --- | --- |
| ecut120-k8-c24 | -181.58162387 | 6.1e-09 | 16 |
| ecut120-k12-c24 | -181.58163973 | 3.3e-09 | 17 |
| ecut120-k16-c24 | -181.58163993 | 7.2e-09 | 14 |
| ecut120-k16-c18 | -181.58163997 | 5.8e-09 | 15 |
| ecut120-k16-c30 | -181.58163993 | 4.5e-09 | 14 |
| ecut140-k16-c24 | -181.58169896 | 1.0e-08 | 14 |

- k=16, c=24'te 120→140 Ry: **0.267714688 ≤1 meV/atom**.
- 120 Ry, c=24'te k=12→16: **0.000907046 ≤1 meV/atom**.
- 120 Ry, k=16'da c=24→30 Å: **0.000000000 ≤2 meV/atom**.
  Bu, basılı 8 ondalık Ry hassasiyetinde eşit enerjidir; fiziksel etkileşimin
  matematiksel olarak tam sıfır olduğunu kanıtlamaz.

6/6 `JOB DONE.`, SCF yakınsama/hata ≤1e-8 Ry, 26 nötr elektron,
API/raw Ry-eV enerjileri, girdi/çıktı/staged UPF SHA-256, hücre/atom/k-örgüsü
ve kaynak hash'leri yeniden doğrulandı. Kaynak dosyaları kayıtlı Git
commit'inin içeriğiyle eşleşti. Gerçek worker 6 GiB RAM, swap kapalı;
kaynaklar kaldırıldı. 120/k8/c24 noktası eski D2.2b enerji, girdi, yapı,
UPF ve sürümünü tam tekrarladı.

Yardımcı 8→12 farkı 0.071928764, c=18→24 farkı 0.000181409 meV/atom.
Bunlar ön kayıtlı üç karar çiftinin yerine kullanılmadı.

**Seçilen sonlu SCF referansı: 120/960 Ry, 16×16×1, c=24 Å, ideal aynı
üç atomlu PBE/spinsiz 1H-MoS₂; enerji -181.58163993 Ry.** İlk D2.2'nin
80→100 Ry başarısızlığı tarihsel olarak korunur. Bu yeni referans enerji
duyarlılığını geçti; kuvvet/geometri/relaksasyon, bağımsız fiziksel referans,
elektronik yapı ve optik sonuçlar ayrıca kabul gerektirir.

```bash
python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-d22c-20261029-amd64 --protocol d22c
```
