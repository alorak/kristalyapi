# Paket 8.2 — FCF/Fourier bilimsel güvenilirlik (ilk uygulama)

## Gerçekleşen

- SHELXL LIST 6 `_refln_index_h/k/l` ve ölçülen F²/F, hesaplanan F²/F ve `_refln_phase_calc` okuması korunmuştur.
- Negatif ölçülen F², ölçümde mümkündür: Fo sıfıra kırpılır; etkilenen yansıma sayısı rapor edilir. Geçersiz hesaplanan F² reddedilir.
- FCF içinde hücre varsa 6 parametreyle aktif kristalin hücresi kıyaslanır. Ölçü uyuşmazlıkları hata verir. Hücre yoksa aktif hücre varsayılır; bu bir doğrulama değildir.
- FCF içe aktarıldıktan sonra kristalin bilimsel fingerprint'i değişirse aynı FCF kullanılmaz, yeniden içe aktarma istenir.
- İnvers hkl/Friedel çiftlerinin Fobs, Fcalc ve φcalc uyumu non-anomal/gerçek yoğunluk varsayımıyla sınanır. Çelişki durumunda veri sessizce atılmaz.
- Kullanılan ve tekrarlanan yansıma sayıları; `d_min` ve Nyquist nedeniyle dışlananlar; hücre ile eşleşme ve P1 örgü ızgara kapsamı ayrıca rapor edilir.
- Deneysel harita için varsayılan ham Fo−Fc sürdürülür; kullanıcı isteğe bağlı sabit-katsayı LSQ ölçeği (Fcalc→Fo) seçebilir.
- `Fo` ve `Fo−Fc` hâlâ hesaplanan model fazlarını kullanır; fazsız Fobs haritası iddiası yoktur.

## Matematiksel kabul koşulları

Yapı faktörü `F(hkl)=|F| exp(iφ)` ve yoğunluk `ρ(x)=V⁻¹ Σ_h F(h) exp(-2πi h·x)`.
Gerçek yoğunluk için `F(-h)=conj(F(h))`. Ters işaretli fazlarla birlikte doğrudan ±h eşlemeleri analitik regresyonla doğrulanır.
Fo−Fc ham katsayı `(Fo-Fc) exp(iφcalc)`; isteğe bağlı sabit ölçekli katsayı `(Fo-sFc) exp(iφcalc)`.
`s = Σ(Fo Fc) / Σ(Fc²)` çözünürlük ve grid filtresinden geçen benzersiz hkl üzerinden hesaplanır.
Bu, gelişmiş B-factor/anisotropik refinman ya da anomalous scattering modeli değildir.
Yalnızca izin verilen ±h FFT matris koordinatlarında katsayılar yerleştirilir; Nyquist sınırı aşılırsa alias olarak FFT'ye yerleştirilmez.

## Testler

- Hücre ve açı uyuşmazlığı; eksik hücre; hata durumunda fail-closed.
- Friedel fazı modulo-360 eşdeğerliği; çelişkili çift ve amplitüd farklarının reddi.
- Fo−Fc ham ve LSQ kurgularının sayısal karşılaştırması.
- Bağımsız tek-yansımalı doğrudan ters-Fourier toplamının faz ve uzaysal örnek karşılaştırması.
- Nyquist/d_min eleme, negatif ölçülen F² sayımı, hesaplanan negatif F² ve fazsız dosya reddi.
- Chromium smoke testi, ölçek kontrolünün görünür olduğu ve benzersiz yansıma göstergesinin çıktığı durumları da kapsar.

## Paket 8.1'den kalanlar

CIF2, çoklu data_/save_ blokları, alan bazlı kayıp raporu, tüm ADP özel konum sınıfları, Hall/orijin ve deneysel belirsizlik modelleri.
8.2 kapsamında bu alanlara geri dönüş yapılmadı; ayrı bilimsel veri bütünlüğü işleri olarak açık tutuluyor.

## Sonraki alt paket (8.2b)

1. MTZ binary girişinin doğrulanmış okuması (header, endianness, dataset hücresi, sütun türleri, boş/NaN değerler).
2. MTZ/IUCr referans kümelerinde Fo,Fc,PHIC ve örneklenmiş Fourier haritalarının Gemmi/CCP4 ile bağımsız karşılaştırılması.
3. Uzay grubu simetrisine göre yansıma tamamlama, anomali ayrımı, FOM/sigma/FREE seçenekleri.
4. Harita normalizasyonu, çözünürlük kabuğu ölçeği, `2Fo−Fc` ve hacimsel CCP4/MRC dosya uyumluluğu.

## Referanslar

- [IUCr yapı faktörü tanımı](https://dictionary.iucr.org/Structure_factor)
- [CCP4 FFT belgeleri](https://www.ccp4.ac.uk/html/fft.html)
- [CCP4 SFTOOLS Fourier ve çözünürlük açıklaması](https://www.ccp4.ac.uk/html/sftools.html)