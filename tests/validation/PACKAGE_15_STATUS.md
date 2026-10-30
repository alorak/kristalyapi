# Paket V15 — VESTA / Kristal Yapı görsel karşılaştırması

**Durum: kaynak/araç ve sentetik testler hazır; gerçek VESTA GUI kanıtı YOK (NOT_RUN).**

V15, VESTA 3.5.8 ile Kristal Yapı'da **aynı kaynak ve gösterim koşullarında**
dışa aktarılmış PNG'leri karşılaştırmak için bir protokoldür. İkili dosya,
telife tabi kurulum veya VESTA adına üretilmiş uydurma ekran görüntüsü
depo/CI içinde bulunmaz. Paket 14'ün VESTA **kılavuz formülü**
karşılaştırması GUI ölçümü yerine geçmez.

Resmî VESTA kılavuzu: [kristalografik yön seçimi](https://jp-minerals.org/vesta/en/doc/VESTAch10.html),
[raster/vektör dışa aktarımı](https://jp-minerals.org/vesta/en/doc/VESTAch18.html),
[raster kalite ayarları](https://jp-minerals.org/vesta/en/doc/VESTAch16.html).

## V15.0 sabit test sahneleri

Sahne/format ve Git blob SHA-1 kaynak pinleri:
[vesta_15_cases.json](vesta_15_cases.json).

| Kimlik | Kaynak | Görünüm ve önemli kontrol |
| --- | --- | --- |
| `nacl-001-structure` | NaCl gerçek CIF | [001] kamera, atom/bağ/kafes ve bağ kesimi |
| `rutile-110-polyhedron` | Rutil TiO₂ gerçek CIF | [110], Ti–O kesimi ve çokyüzlü saydamlık |
| `iucr-mixed-occupancy-adp` | IUCr K/Na/Ca silikat CIF | K1/Na1 doluluk, Uij olasılık elipsoitleri |
| `graphite-001-miller` | Grafit gerçek CIF | [100], (001) düzlem ve normal yönü |
| `5i55-ccp4-isosurface` | Gemmi 5i55 küçük kısmi CCP4 | eşik, ızgara, orijin ve izoyüzey |

Her sahnede ortografik kamera, `[uvw]` projeksiyon yönü,
perpendiküler karşı-örgü `[hkl]*` ekran-yukarı yönü, kesirli
görüntü sınırı `[0,1]³`, beyaz arka plan ve **1024×768 RGB** PNG
kullanılır. VESTA / Kristal Yapı'da atom yarıçapları, bağ koşulları,
çokyüzlü, etiket, kesit, izoyüzey seviyesi ve kamera kadrajını
**operatör** eşitler. Bunlar otomatik atanmadığı için yalnız eşit
dosya ve aynı `[uvw]` yönü, aynı görüntüyü garanti etmez.

**Önemli harita sınırı:** CCP4 sahnesinde `isoLevel: null` kasten
seçilmemiştir. Önce gerçek kaynağın skaler birimi/değer aralığı
incelenip sabit bir **mutlak** seviye yeni manifest commit'inde
belirlenmelidir. Araç `null` ile "gerçek izoyüzey kıyası"nı reddeder.
Bu kısmi CCP4 haritası tam hücre/periyodik yoğunluk gibi
yorumlanamaz.

## Gerçek VESTA GUI kayıt prosedürü

1. Sahnedeki *aynı SHA-pimli* kaynak CIF/CCP4 dosyasını VESTA 3.5.8
   ve Kristal Yapı'da açın; iki uygulamada farklı CIF/setting kullanmayın.
2. VESTA **Objects → Orientation** ile `[uvw]` görünüşünü ve
   karşılıklı uzaydan `[hkl]*` ekran-yukarı yönünü ayarlayın.
   İki tarafta ortografik projeksiyon, hücre sınırı, atom görünürlüğü,
   renklendirme, arka plan, bond cutoff, poliedr ve ellipsoid olasılığını
   aynı tutun. Görünüm yön göstergesini iki tarafta da aynı tutun.
3. VESTA **File → Export Raster Image...** ile
   **1024×768 8-bit RGB/RGBA gerçek PNG** oluşturun; Kristal Yapı'da
   **Kaydet → PNG** üzerinden aynı tuvali ve kadrajı üretin. Sahneyi
   sonradan otomatik hizalamayın. Vektör PDF/SVG ayrı bir protokoldür.
4. İki PNG'yi, operatörün VESTA sürüm/OS, ekran yakalama yöntemi,
   uygulamanın 40 haneli Git commit'i ve her PNG'nin SHA-256'sını
   **depo dışındaki** `v15-private/` klasöründe saklayın. Kanıt
   şablonu: [vesta_15_gui_capture_template.json](vesta_15_gui_capture_template.json).
   `vestaGuiExecuted` yalnız gerçek VESTA GUI kullanıldıysa `true` olur.
   Her görüntü aynı **1024×768** tuvaldir; ROI `[x,y,w,h]` iki tarafta
   aynı **w,h** olmalıdır. Gizlice etiket/ok/atom çıkarma kabul değildir.
5. Kaynak hashini doğrulayın (macOS için `shasum -a 256`):
   
   ```sh
   sha256sum tests/validation/fixtures/experimental/COD_1000041_NaCl.cif
   sha256sum v15-private/actual-vesta.png v15-private/actual-kristalyapi.png
   ```

6. Çalıştırın:

   ```sh
   # Gerçek GUI kanıtı yok: NOT_RUN, bilimsel parite NOT_ESTABLISHED
   python3 tests/validation/vesta_15_visual.py

   # İki gerçek PNG ve doldurulmuş operatör manifesti varsa:
   python3 tests/validation/vesta_15_visual.py \
     --evidence v15-private/capture.json \
     --out-dir validation-results/vesta15

   # Tüm sahnelerin gerçek ekranları zorunlu olsun:
   python3 tests/validation/vesta_15_visual.py \
     --evidence v15-private/capture.json \
     --out-dir validation-results/vesta15 --require-all
   ```

7. `report.json`, `metrics.csv` ve `<case>-comparison.png`
   dosyalarını inceleyin. Üçlü PNG: **VESTA crop | Kristal Yapı crop |
   mutlak RGB farkı**. Bağlar, etiketler, hücre köşeleri, kısmi
   doluluk ve seçilmiş yön oku ayrıca **insan tarafından** kontrol edilir.

## Metriklerin sınırları

- **Foreground IoU:** beyaz arka plandan herhangi RGB kanalında
  24/255'ten fazla farklı piksellerin örtüşmesi.
- **BBox merkez farkı:** aynı ROI'deki görünür siluet konum farkı (px).
- **RGB MAE:** tüm ROI'deki kanal bazında ortalama mutlak 0–255 fark.
- Işıklandırma, anti-aliasing, kamera ölçeği ve yazı fontları metrikleri
  değiştirir. **Bu rakamlar atom konumu, Miller düzlemi, BVS/ADP,
  izoyüzey topolojisi veya bilimsel yakınsama doğrulaması değildir.**
- Gerçek GUI PNG'si yüklendiğinde bile rapor
  `CAPTURED_HUMAN_REVIEW_REQUIRED` ve
  `scientificParity=NOT_ESTABLISHED` olarak kalır.
  **Sistem VESTA paritesi için otomatik PASS yazmaz.**
- PNG okuyucu yalnız **8-bit RGB/RGBA, non-interlaced** destekler;
  diğer PNG çeşitlerini ve bozuk CRC / arka kapı dosya yollarını reddeder.
- Sentetik PNG testleri ekran/kanıt aracının doğruluğunu sınar;
  **gerçek VESTA çalıştırması değildir**.

## Sonraki V15.1/V15.2 kabulü

- [ ] Operatörce gerçek VESTA 3.5.8 GUI ekranlarının ve
  VESTA Text Area bağ/BVS kayıtlarının toplanması (P14 ile çapraz).
- [ ] Ortak kamera/projeksiyon matrisinin ve renk/alpha/ışık koşullarının
  platformdan bağımsız sabitlenmesi.
- [ ] Görsel bbox/IoU dışında Gemmi/ASE tabanlı merkez, bond, ADP,
  Miller normal, izoyüzey ağ/topoloji/alan farklarının değerlendirilmesi.
- [ ] Hacimsel skaler eşik ve 32³/48³/64³ yakınsama A/B kanıtları.
- [ ] Fark matrisini gerçek GUI kanıtlarıyla insan değerlendirmesi
  altında açmak; kanıt olmadan eşdeğerlik ilan etmemek.
