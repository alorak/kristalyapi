# D3 gerçek Si işleyiş testi — geçti

Kaynak `429bee2502795619600799ee03945d9a39a06692`. Doğrulanmış Si UPF SHA-256:
`669fb75395a9d26973b0ea1ce8223bbcb30d3396c5d48bf5e794d1243c52375a`.
Si ilkel hücre, 45/360 Ry, 2×2×2, başlangıç atomu x=0.26. Bu küçük deney
yalnız gerçek Docker/API `relax → scf` yolunu doğrular; Si/MoS₂ bilimsel
enerji veya makale kabulü değildir.

QE 6.7MaX relaksasyonu 4 SCF döngüsü / 3 BFGS adımında tamamladı.
Son en büyük kuvvet bileşeni 3.567e-5 Ry/Bohr. Yeni yapı ile ayrı SCF
başladı ve tamamlandı: enerji -22.65199796 Ry, en büyük son kuvvet
3.855e-5 Ry/Bohr, istenen sınır 1e-4. Kaynak/son yapı hash'leri farklı;
6 ham dosyanın SHA-256 değeri API sonucuyla yeniden eşleştirildi.

İlk gerçek koşuda bulunan verbose kuvvet katkısı ayrıştırıcı hatası ayrı
`qe-d3-si-smoke-first-parser-20261029-arm64` klasöründe başarısız olarak
korundu. Buradaki sonuç yeni imaj ve yeni API işinden gelir.

Gerçek sonuç 3B karşılaştırmada da incelendi. Son atomlar başlangıçla
periyodik görüntü seçimiyle eşlenir; görüntüleme aktif yapıyı değiştirmez.
Bu görsel eşleme yeni bir fizik hesabı veya değişmiş koordinat verisi değildir.
