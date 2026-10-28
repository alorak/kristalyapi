# MoS₂ D2.2 — Ham kanıt incelemesi

**Genel kabul: başarısız. 7/7 gerçek SCF işi yakınsadı.**

Kaynak commit: `588881e8cf37463fd78ec10317a9f2aa9554b146`. [CI koşusu](https://github.com/alorak/kristalyapi/actions/runs/40770083516).

| Vaka | Enerji, Ry | SCF hata tahmini, Ry | İterasyon |
| --- | ---: | ---: | ---: |
| ecut60-k8-c24 | -181.57954599 | 5e-09 | 27 |
| ecut80-k8-c24 | -181.58082320 | 6.1e-09 | 19 |
| ecut100-k8-c24 | -181.58134678 | 1.3e-09 | 18 |
| ecut100-k12-c24 | -181.58136250 | 3.6e-09 | 16 |
| ecut100-k16-c24 | -181.58136264 | 4.1e-09 | 18 |
| ecut100-k16-c18 | -181.58136261 | 4.8e-09 | 14 |
| ecut100-k16-c30 | -181.58136256 | 3.4e-09 | 16 |

## Değişmeyen kabul eşikleri

- cutoff: 2.374556268 meV/atom; sınır 1; geçti=False.
- kmesh: 0.000634932 meV/atom; sınır 1; geçti=True.
- vacuum: 0.000362819 meV/atom; sınır 2; geçti=True.

Her vakada ham JOB DONE/SCF yakınsaması, 26 elektron, API enerji/Ry-eV uyumu, kaynak yapı ve dosya/UPF hash zinciri doğrulandı. Kaydedilen çalıştırma kaynak hash’leri yerel inceleme kaynaklarıyla eşleşti.

`--verify` komutunun genel duyarlılık ihlaliyle reddi `offline-verification.txt` dosyasında saklıdır. Eşikler gevşetilmedi. Geometri optimize edilmedi; bu kayıt optik/SOC/kuvvet yakınsaması değildir.
