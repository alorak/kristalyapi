# Gerçek Si kollineer spin işlev doğrulaması

- Kaynak commit: `e64c9237c33c1ca147536386415abeca96ce434b`.
- Gerçek Docker/API işi: `d79c82561e3e406aa8d289852d711feb`; QE 6.7MaX, arm64.
- API ve worker imajındaki kaynak dosyaları başlamadan önce host kaynak SHA-256 değerleriyle karşılaştırıldı. İmaj kimliği ve 2 GiB / 2 CPU sınırları `summary.json` içinde.
- İki atomlu Si, PBE, 45/360 Ry, SCF/NSCF 2×2×1, her spin için nbnd=8. Başlangıç Si polarizasyonu 0.1; Gaussian SCF genişliği 0.01 Ry. DOS genişliği ayrı olarak 0.005 Ry, −4…10 eV, 0.01 eV adım.
- `scf → bands → bands_pp_up → bands_pp_down → nscf → dos → projwfc`: yedi aşama başarılı. Son SCF doğruluk hatası `1.2e-9 Ry ≤ 1e-8 Ry`, enerji `−22.47662949 Ry`.
- Her spin kanalında 8 bant, 1401 DOS örneği ve iki atomun s/p PDOS katkıları. Son toplam ve mutlak manyetizasyon QE'nin basılı hassasiyetinde 0 μB/hücre.
- `source.in`, her aşamanın ham girdisi/çıktısı, DOS/PDOS dosyaları, API sonucu ve SHA-256 kanıtları tutuldu. Yeniden ayrıştırılan her iki spin kanalı API ve ham JSON ile tam eşleşti. DOS integralinin son kolonu iki spinin toplamıdır; kanallara ayrı integral olarak kopyalanmaz.
- `diagnostics.json` örneklenen worker cgroup belleğidir; süreç RSS tepe değeri veya HPC kapasite garantisi değildir.

Yeniden doğrulama (hesap başlatmaz):

```sh
python tools/qe_spin_acceptance.py --verify validation-results/qe-spin-si-20261030-arm64
```

Bu küçük Si denemesi işlevsel entegrasyon kanıtıdır. Manyetik temel durum, fiziksel spin yakınsaması, MoS₂ kusur hesabı, SOC, optik geçiş veya PL kabulü değildir. DOS penceresi sonludur; tam durum sayısı yakınsaması iddia edilmez. Büyük D5 veya HPC işi çalıştırılmadı. Testin Docker projesi ve hacmi kanıtlar alındıktan sonra kaldırıldı.
