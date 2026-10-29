# İlk D3 gerçek Si işleyiş testi — parser reddi korundu

Kaynak `5363e377d188614de865751dde9520d6b4c1ef4c`. Doğrulanmış Si PBE UPF,
45/360 Ry, 2×2×2 k-örgüsü, ilk Si atomlarından biri x=0.26'ya kaydırıldı.
Bu küçük gerçek deney MoS₂ veya Si bilimsel enerji kabulü değildir.

Gerçek QE BFGS 4 SCF döngüsü / 3 iyonik adımda yakınsadı; ham son en büyük
kuvvet bileşeni 0.00003567 Ry/Bohr, son iyonik enerji değişimi 1.7e-8 Ry.
İlk worker toplam kuvvetlerle ayrıntılı katkı bloklarını birlikte saydığı
 için `Final atomic force count mismatch` hatası verdi. Pipeline başarısız
kaldı ve final SCF başlamadı; bu sonuç sonradan başarılı olarak etiketlenmedi.

Ayrıştırıcı, toplam kuvvetlerin ilk ardışık atom bloğunu kullanacak şekilde
düzeltildi; aynı ham çıktı yerelde doğru okundu ve katkı bloğu regresyon
testi eklendi. Yeni kaynakla yeni bir gerçek iş çalıştırılacak.
