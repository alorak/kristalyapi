# D5 4×4 başlangıç pilotu — 6 GiB sınırında OOM

Ön kayıtlı kaynak `4f9173b122383068a1c40cec596fc895ebb0d558`, ARM64
QE 6.7MaX; kabul edilmiş D3'ten hazırlanan dört başlangıç adayında
`nstep=0`, 416 bant, 120/960 Ry, 4×4×1 örgü. Her vaka 2 CPU, 6 GiB,
swap kapalı, ağsız ve salt okunur kökte, 120 saniye üst sınırıyla başlatıldı.

| Aday | Atom | Elektron | QE statik bellek tahmini (GB) | QE üst bellek tahmini (GB) | Sonuç |
| --- | --- | --- | --- | --- | --- |
| pristine | 48 | 416 | 24.76 | 72.41 | OOM / exit 137 |
| V_S | 47 | 410 | 24.62 | 71.76 | OOM / exit 137 |
| V_2S | 46 | 404 | 33.85 | 80.49 | OOM / exit 137 |
| O_S | 48 | 416 | 25.02 | 72.16 | OOM / exit 137 |

Bütün vakalarda gerçek Docker `OOMKilled=true`; istenen 6 GiB/no-swap,
2 CPU ve ağsız/salt okunur profil doğrulandı. Dört konteyner de kaldırıldı.
Raw QE atom/elektron/bant sayıları planla eşleşti. **Başlangıç tamamlanmadı;
SCF başlamadı, toplam enerji veya yakınsama sonucu üretilmedi.**

QE'nin GB satırları programın başlangıçta bastığı tahminlerdir; ölçülmüş
tepe bellek veya başka MPI/diagonalizasyon düzeninde garanti değildir.
Bu pilot 416 bant adayı içindir. Mevcut 6 GiB profilin bu başlangıç için
yetersizliği doğrudan gözlendi; daha az bant, paralelleştirme ve tam SCF
kaynakları ayrı değerlendirme ister. API'nin 128 bant sınırı yükseltilmedi.

17 özgün başarısız pilot dosyası değişmeden korundu. `independent-inspection.json`
ve bu belge sonradan eklendi. Dört kaynak hash'i kayıtlı Git commit'inden
ve her giriş/çıktı/stderr hash'i ham dosyalardan yeniden doğrulandı. İmaj kimliği
`sha256:21d4887dfe9a0fd2123beda7ba9847166b1b39b36fc448e498cb3ba9c2660f00`,
[gerçek Docker ön kontrolünde](../qe-d4-band-preflight-20261029-arm64/summary.json)
kaynak `bbd626b` ile kullanılan aynı imajdır. Resmi Mo/S/O hash'leri
pilot summary'sinde kayıtlıdır.

Sonraki gerçek kusur hesapları için kaynak profili, gerekli bant sayısı,
spin/doluluk ve süperhücre/k/cutoff kabulü ayrı hazırlanmalıdır. Bu klasör
kusur enerjisi, kararlılık veya elektronik yapı kabulü olarak kullanılamaz.
