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

## Paket 8.2b — sınırlı MTZ başlangıcı

- Tarayıcıda, ek sunucu olmadan **birleşik P1 MTZ** için IEEE little/big endian, 80 bayt önek, başlık işaretçisi, `NCOL/COL`, `CELL/DCELL`, `SYMINF/SYMM`, `VALM` ve yansıma bloğu boyutları doğrulanır.
- Yalnız belirsiz olmayan türlenmiş **FP/F/FOBS (F), FC (F), PHIC (P)** ve H/K/L (H) sütunları kabul edilir. Birden çok eşleşen sütun otomatik seçilmez; eksik/NaN satırlar sayılarak atlanır; yanlış hücre ve negatif genlik reddedilir.
- MTZ yansımaları mevcut FCF Fo/Fo−Fc model-fazlı FFT hattına bağlanır. Yüklü kristalin bilimsel fingerprint'i değişirse kullanım engellenir.
- **Başarı kapsamı dardır:** P1 olmayan uzay grupları, unmerged/batch MTZ, otomatik ASU/simetri tamamlama, anomali ve ağırlıklı FWT/PHWT gibi harita katsayıları bu okuyucudan geçmez. Genel MTZ desteği tamamlandı iddiası yoktur.
- Sentetik IEEE LE/BE, eksik değer, yanlış veri kümesi hücresi, belirsiz sütun, uzay grubu ve doğrudan Fourier regresyonları eklendi. **Bağımsız gerçek MTZ/Gemmi/CCP4 harita doğrulaması bu PR'da yapılmış sayılmaz.**

## Paket 8.2c — simetri, açık sütunlar ve CI/yerleşim (ilk aşama)

- Birleşik, anomalous olmayan MTZ için P1 (#1), P-1 (#2), P21 (#4), P21/c (#14), P212121 (#19) işlemleri **sınırlı** olarak açıldı; SYMINF sayısı, primitive P kafesi, SYMM dönüşüm det/kimlik/tekrar/grup kapanışı ve metrik tutarlılığı doğrulanır. Diğer gruplar fail-closed kalır.
- `h' = Rᵀh` ve `φ' = φ − 360°(h·t)` ile Fourier için simetri eşdeğerleri oluşturulur; Friedel/sistematik sönüm tutarsızlığında reddedilir. 300.000 işlenmiş hkl bütçesi korunur.
- Belirsiz Fo/Fc/PHIC sütunları kullanıcının açık `datasetId:LABEL` eşlemesiyle seçilebilir; türler denetlenir, FWT/DELFWT/PHWT/PHDELWT ön-ağırlıklı harita katsayıları Fo/Fc gibi alınmaz.
- Ham veya LSQ ölçekli **ağırlıksız model-fazlı 2Fo−Fc** seçeneği eklendi. σA/FOM/FREE refinman haritası olarak gösterilmez.
- Bağımsız analitik P-1, orijini kaymış tersinim, P21 vida ekseni, P21/c/P212121 grup kapanışı, uyumsuz metrik ve yanlış faz/sönüm testleri eklendi. Gerçek MTZ/Gemmi/CCP4 **henüz doğrulanmadı**.
- İngilizce statik sözlükte eksik MTZ metinleri tamamlandı (native regression #88), WebGL smoke testindeki kapalı XRD paneli açma adımı düzeltildi; alt araç çubuğunun yüksekliği artırıldı ve taşma denetimi eklendi.

## Sonraki alt paket (8.2c devamı)

1. Gerçek MTZ/IUCr veri kümelerinde Fo/Fc/PHIC ve Fourier örneklerinin Gemmi/CCP4 ile bağımsız karşılaştırılması; başlangıç için doğrulanmış P1 fixture.
2. ASU/uzay grubu simetrisiyle yansıma tamamlama ve ayrı anomalous Friedel yolu; çoklu dataset/kolon açık eşleme arayüzü.
3. FOM/σ/FREE, harita normalizasyonu ve çözünürlük kabuğu ölçekleri; ağırlıklı `2Fo−Fc` için açık matematiksel model.
4. CCP4/MRC hacimsel harita uyumluluğu ve Paket 9'a aktarım.

## Referanslar

- [IUCr yapı faktörü tanımı](https://dictionary.iucr.org/Structure_factor)
- [CCP4 FFT belgeleri](https://www.ccp4.ac.uk/html/fft.html)
- [CCP4 SFTOOLS Fourier ve çözünürlük açıklaması](https://www.ccp4.ac.uk/html/sftools.html)