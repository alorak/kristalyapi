# V16.2 — Sayısal VESTA/KristalYapı fark matrisi

**Tarih:** 30 Ekim 2026. **Kod:** Kaynağa sabitlenen bağımsız
referans ve isteğe bağlı operatör ölçümünü denetleyen Python aracı.
**Gerçek VESTA GUI:** NOT_RUN (depoda gerçek operatör kanıtı yok).
**Bilimsel parite:** NOT_ESTABLISHED.

Bu paket V16.1 kamera/CCP4 kaynak denetimini tüketir; VESTA
binary dosyalarını indirip çalıştırmaz, GUI sonuçlarını uydurmaz.

## Karşılaştırılan sayısal özellikler

| Ölçüm | Bağımsız referans | Tolerans ve sınırlama |
| --- | --- | --- |
| Hücre hacmi | CIF hücresi + analitik determinant | max(0,0001 Å³, %0,01); beş kaynak |
| Asimetrik site sayısı | Gemmi CIF yapısal bloğu | Tam sayı; görünen tüm periyodik kopyalar değil |
| Atom kesirli koordinatı | Gemmi asimetrik site | PBC minimum Kartezyen mesafe 0,01 Å |
| Atom doluluğu | Gemmi CIF occupancy | Mutlak 0,001; karışık K/Na dahil |
| Eşdeğer izotropik ADP | Gemmi Ueq veya kaynak Uiso | Mutlak 0,002 Å²; ADP ana eksen kıyası DEĞİL |
| En yakın Na–Cl ve Ti–O | Gemmi genişletilmiş kristal + periyodik görüntü | 0,03 Å; yalnız NaCl ve rutil |
| Grafit (001) d-aralığı | Karşı örgü metric, 1/|G| | 0,001 Å |
| Grafit (001) normal | Kartezyen karşı örgü yönü | 0,5°; ± normal eşdeğer sayılmaz |
| CCP4 mutlak izoeşik | V15.2 gerçek 480 vokseli | 1e-7 kaynak harita birimi; fiziksel birim UNKNOWN |
| CCP4 eşik üstü voksel ve kenar geçişi | Binary CCP4 | Tam sayı; mesh topolojisi/alanı DEĞİL |

±1 periyodik görüntü araması **yalnız** NaCl (kübik) ve rutil
(tetragonal) için kullanılır; genel eğik hücre minimum-image
algoritması yerine geçmez. Gemmi referansı uygulamanın kendi
JS hesaplarını test etmiş sayılmaz. Atomlar **asimetrik site** olarak
karşılaştırılır; VESTA ekranındaki simetri/boundary kopyaları
bu sayıdan farklı olabilir.

## Gerçek GUI olmadan bilimsel referans raporu

Depo kökünden:

    python3 tests/validation/vesta_16_2_numeric.py \
      --out-dir validation-results/v16-2-reference

Beş SHA-pimli gerçek dosyadan referans oluşturulur. Raporlar
report.json ve matrix.csv'dir. VESTA/KristalYapı ölçüm
sütunları null, durumlar NOT_RUN, scientificParity
NOT_ESTABLISHED olarak kalır.

Test komutu:

    python3 -m unittest tests/test_vesta_16_2_numeric.py \
      tests/test_vesta_16_orientation.py \
      tests/test_vesta_15_ccp4_reference.py

Testlerdeki karşılaştırma değerleri **sentetik**, gerçek VESTA
görüntüleri değildir. İzole testlerde dış PNG denetleyicisi
mock'lanır; üretim CLI'sinde gerçek hash/PNG kontrolü zorunludur.

## Gerçek operatör kanıtı ile karşılaştırma

1. V15.1 ile VESTA 3.5.8 ve KristalYapı PNG çiftlerini
   gerçekte yakalayın, mühürleyin ve operatör/platform/git SHA
   bilgilerini doğru girin.
2. Açıkça onaysız sayısal şablon oluşturun (özel dizini önce açın):

       mkdir -p v16-private
       python3 tests/validation/vesta_16_2_numeric.py \
         --template-out v16-private/numeric-evidence.json

3. V15 capture.json operatör/platform/commit bilgisini aynı
   şekilde sayısal şablona geçirin. availableKeys listesinden
   **gerçekte ölçülen** anahtarları measurements içine ekleyin.
   Örnek JSON biçimi (aşağıdaki 3,4 sayısı TEMSİLİDİR):

       {
         "key": "miller.001.dA",
         "vesta": 3.4,
         "kristalyapi": 3.4
       }

   Ölçülmeyen metrikler boş kalır; sadece gerçekten VESTA GUI
   kullanıldıysa vestaGuiExecuted true yapılır.

4. Gerçek kanıtlı fark raporu üretin:

       python3 tests/validation/vesta_16_2_numeric.py \
         --evidence v16-private/numeric-evidence.json \
         --v15-capture v15-private/capture.json \
         --out-dir validation-results/v16-2-audited

Kaynak SHA-256, V15 capture kaynak/ayar eşitliği, PNG CRC/boyut/
SHA-256/tarih/ROI, operatör ve commit kimliği, geçersiz metrik ve
NaN/Inf güvenli reddedilir. İki sayı da bağımsız referansa
tolerans içindeyse WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED,
değilse OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED yazılır.
Hiçbir şekilde otomatik bilimsel PASS veya fiziksel parite
üretmez. PNG hash kanıtı tek başına görüntünün gerçekten
VESTA uygulamasında oluşturulduğunu kriptografik ispatlamaz.

## Tamamlanmayan V16 kabulü

- [ ] Gerçek VESTA 3.5.8'den 5 PNG çifti ve 8 P14 BVS/Text Area
  gözlemi, insan incelemesi ve sürüm/operatör kayıtları.
- [ ] Tüm P14 koordinasyon merkezlerinin Gemmi/ASE bağımsız
  sonuç ve gerçek Text Area kayıtlarının ortak fark matrisine bağlanması.
- [ ] ADP anizotropik ana eksen/eigenvektörlerin Kartezyen
  tensör üzerinden nicel kıyası; probabilite/ellipsoid görseli.
- [ ] Çokyüzlü hacmi ve hacimsel izoyüzey alan/topoloji kıyası.
- [ ] CCP4 fiziksel birim/ölçek kaynağının kesinleştirilmesi.
- [ ] V16.1 kamera işareti/ölçek ve gerçek VESTA GUI kabulü.

**Sonraki sıra:** GUI kanıtı gelirse V16.3 insan onaylı bilimsel
ölçümler; mevcut değilse kabul açık bırakılarak V17 (VESTA proje
import/export) uygulamasına geçilebilir.

CI tetikleme, DFT, uygulama arayüzü ve backend değiştirilmedi.
