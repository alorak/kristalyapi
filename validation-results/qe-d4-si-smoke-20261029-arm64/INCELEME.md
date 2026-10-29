# D4 gerçek Si bant/DOS/PDOS işleyiş testi — geçti

Kaynak `55e683e40967ffb3ae2b5eb1f7e596e3d0290fc0`. Doğrulanmış Si UPF ve
D3 gerçek Si son geometrisi; 45/360 Ry, SCF/NSCF 2×2×1, nbnd=8,
Gamma→X açık yolu (3 bölüm). Bu küçük gerçek deney API/pipeline işleyişini
doğrular; Si/MoS₂ bant aralığı doğruluğu veya bilimsel yakınsama kabulü değildir.

Altı gerçek aşama tamamlandı: SCF, bands, bands.x, NSCF, dos.x, projwfc.x.
API 8 bant, 1145 enerji noktasında DOS ve iki Si atomunun s/p PDOS
verisini döndürdü. Ham bant/DOS/PDOS dosyaları yeniden ayrıştırıldı ve
API JSON'uyla eşleştirildi; manifestteki tüm artifact SHA-256 değerleri geçti.
Atom/wfc LDOS toplamının toplam PDOS'tan en büyük basılı farkı
0.012 states/eV; okuyucunun basılı hassasiyet toleransı içinde.

QE PDOS 1146 nokta, DOS 1145 nokta üretti. Ortak aralıktaki noktalar
birebir eşleşir; bir yüksek enerji uç noktası dışarıda kaldı. İnterpolasyon,
enerji hizalaması veya yoğunluk ölçekleme yapılmadı. Bu seçim toplam ve
atomik PDOS metadata'sında kaynak/seçilen/dışarıda kalan sayılarla kayıtlıdır.
İlk katı-uzunluk reddi ayrı klasörde başarısız olarak korunur; bu sonuç
yeni imaj ve yeni API işinden gelir.

Gerçek veriler tarayıcıda çizildi; tek atom p orbital seçiminin grafiği
[görsel kanıtta](spectra.png) doğrulandı. D3/MoS₂ kabulü ve onun son
geometrisinden gerçek MoS₂ elektronik yapı hesabı ayrıca bekliyor.
