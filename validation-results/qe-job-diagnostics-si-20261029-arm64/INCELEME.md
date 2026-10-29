# Gerçek Si iş tanısı doğrulaması — geçti

Kaynak commit: `600a7413eb46b862a3126adc5e3c5690322ac11e`. Container içindeki server kaynak
hash'leri host kaydıyla eşleştirildi; imaj `sha256:4a90e69e16649a88490b798ae43552ef83d6f238f7043d143c9f4002c222d2a4`.
API işi `d334fb1ddd0e4ed690aa554b58f89814`, QE 6.7MaX/arm64; iki Si atomu, 45/360 Ry,
8 bant, k2, ortak DOS/PDOS −4…10 eV, σ=0.005 Ry.

Altı gerçek QE aşaması ve ham/API eğri/hash eşleşmesi geçti. Tanı endpointi
`completed` döndürdü; toplam worker süresi 13.659 s,
çocuk süreç CPU süresi 13.314 s.
15 yoklama örneğinde en büyük worker cgroup bellek değeri
153505792 bayt. Bu değer worker ve önbelleği içerir;
garantili tepe RAM veya süreç RSS'si değildir. RAM sınırı 2 GiB, ayrı swap
sınırı 2 GiB; iş süresinde `oom_kill` artışı sıfırdır.

Her aşamanın süresi `diagnostics.json` içinde ve ham `pipeline.json`
kaydındaki sürelerle eşleşir. Tanı kabulü Si/MoS₂ fiziksel yakınsama
kabulü değildir. Geçici container ve volume'ler kaldırıldı.

Bu paketten önce yanlış eski imajla endpointin bulunamadığı geliştirme
denemesi kabul edilmedi. Başarılı tekrarda container kaynak hash'lerinin
birebir eşleşmesi iş gönderilmeden önce zorunlu kontrol edildi.
