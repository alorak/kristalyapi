# V15.2 + V16.1 — CCP4 isoeşik ve kristalografik kamera referansı

**Durum (30 Ekim 2026):** Kod/gerçek dosya referansı eklendi.
**VESTA GUI NOT_RUN; scientificParity NOT_ESTABLISHED.** Bu paket gerçek
V15.1 operatör çekimi ve P14 Text Area değerlerinin yerini almaz.

## V15.2 — Kaynak haritaya göre +1,0 mutlak izoeşik

SHA-pimli Gemmi 5i55 kısmi CCP4 dosyasının tüm 480 float32 vokseli,
1024 baytlık CCP4 başlığı ve 160 baytlık simetri bölümünden sonra
gerçek veri kaynağından okunur. Kaynakta MODE=2, C/R/S=8/6/10,
başlangıç=50/-8/40 ve MAPC/MAPR/MAPS=2/1/3'tür.

| Gerçek CCP4 niceliği | Ölçülen değer |
| --- | --- |
| Min / maks | -0,53103828 / +2,39882803 |
| Ortalama / RMS | 0,34712049 / 0,69122291 |
| Sabit mutlak izoeşik | +1,0 *native source-map units* |
| Eşik üstünde voksel | 103/480 |
| Komşu grid kenarında eşik geçişi | 188 |
| Fiziksel nicelik / birim | **UNKNOWN** |

Bu seçim 1σ veya 1 e/Å³ olarak sunulamaz. **Gerçek CCP4 başlığı
birim/nicelik söylemediği için fiziksel skaler eşdeğerlik hâlâ açık
kaldı.** Ayrıca bu harita tam periyodik hücre değil: eşik geçiş
sayısı mesh alanı/topolojik eşdeğerlik kanıtı değildir.

Çalıştırma (repo kökünden):

    python3 tests/validation/vesta_15_ccp4_reference.py
    python3 -m unittest tests/test_vesta_15_ccp4_reference.py

Başlık min/maks/ortalama/RMS alanları bütün gerçek örneklerden yeniden
hesaplanır. Eşik yüzey oluşturmuyorsa, kayıt bozuk/eksikse, NaN/Inf
varsa veya V15 kaynak hashleri uyuşmazsa güvenli ret uygulanır.

## V16.1 — Doğrudan/karşıt örgü metric kamera yönü

V15 dosyalarında viewDirection=[uvw] **doğrudan örgü yönü**,
upDirection=[hkl]* **karşıt örgü düzlem normali** olarak ele alınır.

- Görünüm normali = normalize(u*a + v*b + w*c).
- Yukarı normali = normalize(h*a* + k*b* + l*c*).
- Birliktelik: h*u + k*v + l*w = 0; a_i·b_j=δ_ij.
- Sağ = yukarı × görünüm; pozitif determinantlı sağ/üst/görünüm
  Kartezyen çerçevesi.
- Triklinik, monoklinik ve hekzagonal kafes metriği hesaplanır;
  kesirli uzaydaki eksenler keyfî olarak dik sayılmaz.

Beş gerçek kaynak sahnede hücre (4 CIF + 1 CCP4 header) ve kaynak
SHA kontrol edilir. VESTA'nın GUI bakış yönünün işareti, kamera
konumu, ışık ve kadrajı **otomatik çıkarılmaz**; çıktı yalnız
operatöre deterministik kristalografik referans sağlar.

Çalıştırma:

    python3 tests/validation/vesta_16_orientation.py --out v16-camera-reference.json
    python3 -m unittest tests/test_vesta_16_orientation.py

Özel operatör verilerini kamuya açık depoya koymayın. Kamera
referans raporunu gerçek VESTA çekimleriyle birlikte özel kanıt
klasöründe tutun. Bu raporun VESTA gerçek GUI ölçümü yerine geçtiği
iddia edilmez.

## Gerçek kabulde kalanlar

- [ ] VESTA 3.5.8 ile 5 gerçek ekran çifti ve 8 P14 BVS/koordinasyon
  Text Area ölçümü; operatör, dosya SHA, tarih ve ROI.
- [ ] V16 referansı ile VESTA bakış işareti, ortografik ölçek,
  ışık, ADP, atom/bağ yarıçapı, görünür yüzey, clipping eşleme.
- [ ] CCP4'nin fiziksel niceliğini ve kalibre mutlak ölçeğini
  kaynak üretici kanıtıyla bağımsız saptama.
- [ ] Gemmi/ASE bağımsız atom/bağ/ADP/Miller/mesh sayısal fark tablosu,
  kapsamlı negatif test ve bilimsel toleranslar.
- [ ] Gerçek ölçüm olmayan satırların null/not-run olarak raporlanması.

Bu aşamadaki unittest'ler gerçek kaynak matematiğini ve sentetik
bozuk dosya/görünüm senaryolarını sınar; gerçek VESTA GUI
doğrulaması değildir. CI ayarları değiştirilmedi.
