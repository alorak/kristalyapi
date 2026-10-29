# İlk D4.1 Si işlev denemesi — başarısız, korunmuş kanıt

Kaynak: `196e793b3d4520d2fe5c30814c57b3b85c59378e`, QE 6.7MaX/arm64.
API isteği −65…30 eV ortak DOS/projwfc penceresi ve 0.005 Ry genişlik
istedi. `dos.x` −65.000 eV'den; `projwfc.x` −5.643 eV'den başladı.
Ham eksenler eşleşmedi ve API işini başarısız kapattı; sonuç JSON'u
üretilmedi. QE 6.7 `partialdos` özdeğer uçları ±3σ ile pencereyi sınırlar.

Bu davranış üzerine MoS₂ taraması başlamadan iç ortak eğri penceresi ve
ayrı geniş DOS integral kontrolü tanımlandı. Başarılı tekrar kardeş
`qe-d41-si-smoke-20261029-arm64` paketindedir. Bu dizin başarısız olarak
saklanır; eğriler düzeltilmedi, kaydırılmadı veya interpolasyon yapılmadı.
