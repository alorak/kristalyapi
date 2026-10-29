# İlk D4 gerçek Si denemesi — ortak enerji aralığı reddi

Kaynak `7e406018c92b16386cebe1d5ba3b4c9526037024`, doğrulanmış Si UPF,
D3'ten gerçek son Si geometrisi, 45/360 Ry, SCF/NSCF 2×2×1, nbnd=8,
Gamma→X açık yolu (3 bölüm). Bu küçük deney işleyiş testidir; Si veya
MoS₂ bilimsel bant/DOS kabulü değildir.

Gerçek SCF, bands, bands.x, NSCF, dos.x, projwfc.x adımları tamamlandı.
Son pipeline ayrıştırıcısı DOS/PDOS enerji dizisi uzunluğu yüzünden reddetti;
API işi başarısız kaldı ve sonuç yayınlanmadı. `dos.dat` 1145 nokta,
`pdos.pdos_tot` 1146 nokta içeriyor. Başlangıç -5.847 eV ve adım 0.020 eV
ortak; PDOS'ta yalnız yüksek enerji ucunda ek 17.053 eV satırı var.

Yeni okuma, DOS aralığındaki birebir eşleşen mevcut PDOS satırlarını seçer;
interpolasyon, enerji kaydırma veya yoğunluk ölçekleme yapılmaz. Kaynak/seçilen
nokta sayıları ve dışarıda bırakılan uçlar metadata'da kaydedilir. Eksik,
kaymış veya tekrarlanan iç enerji noktaları reddedilir. Atom/orbital LDOS
toplamı aynı ortak aralıkta tekrar denetlenir. İlk başarısız kayıt korunur;
yeni imaj ve yeni API işiyle tekrar doğrulanacaktır.
