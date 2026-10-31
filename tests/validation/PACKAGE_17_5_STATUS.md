# V17.5 — Gerçek VESTA masaüstü kabul protokolü

**30 Ekim 2026:** Kanıt toplama/denetleme yazılımı eklendi.
**VESTA 3.5.8 gerçek GUI: NOT_RUN.**
**Bilimsel/görsel eşdeğerlik: NOT_ESTABLISHED.**

Bu aşama V17.4 sınırlı P1 dosyalarının gerçek VESTA
masaüstünde açılıp yeniden kaydedilmesini, KristalYapı
ile karşılaştırılmasını ve bilinen volumetrik veri
kaybının belgelenmesini hedefler. Araç herhangi
bir VESTA binary indirmez, çalıştırmaz veya
gerçek GUI ekranı ürettiğini iddia etmez.

## Dört kaynak ve görevleri

| Kaynak (SHA-sabitli V15) | Kontrol | Bilinçli sınırlama |
| --- | --- | --- |
| COD NaCl | P1 export → VESTA aç/kaydet → KristalYapı tekrar aç | Simetri, bağ, renk |
| COD rutil TiO2 | Aynı P1 döngüsü | Ti–O, polyhedron geometrisi |
| IUCr K/Na/Ca/Si/O | Aynı P1 döngüsü | Mixed occupancy, ADP kaybı |
| Gerçek 5i55 kısmi CCP4 | Aynı orijinal binary ile iki uygulamada görüntü | V17.4 density yazmıyor; fiziksel birim UNKNOWN |

Kaynaklar V15 manifestindeki Git blob SHA-1 ile
sabitlenmiştir; SHA-256 değerleri gerçek
dosyalardan yeniden hesaplanır. V17.4 aktif P1
dışı simetriyle export'u reddeder: uygulamada
P1 ile listelenen atomların anlamını operatör
bilinçli olarak kontrol etmelidir. Bu çalışma
tüm uzay grubu kopyalarının korunmasını kanıtlamaz.

## GUI olmadan: programatik doğrulama (varsayılan)

VESTA 3.5.8 masaüstü arayüzüne erişim gerekmez.
V17.4 ile üretilen P1 .vesta ve SHA-256 bağlı .vesta.loss.json
dosyalarını bağımsız Python okuyucusuyla kontrol edin:

    python3 tests/validation/vesta_17_5_offline.py \
      --vesta mycrystal.vesta \
      --loss-report mycrystal.vesta.loss.json \
      --report-out validation-results/v17-5-offline.json

İsteğe bağlı başka bir P1 .vesta varsa
--reference-vesta reference.vesta seçeneğiyle
hücre/atom/occupancy farklarını hesaplayın.

Kontrol: P1 grup ve sağ-elli pozitif hacim, atom etiketleri,
elementler, doluluk, SITET RGB/yarıçap kayıtları,
dosya/manifest SHA-256 eşitliği, kamera/ADP/vector/harita
kayıplarının açık raporlanması. Yoğunluk yan dosyasına
sahte yol veya hash yazılmaz.

Çıktı OFFLINE_STRUCTURAL_CONTRACT_CHECKED_HUMAN_REVIEW_REQUIRED
olarak işaretlenir; desktopVesta=NOT_RUN ve
scientificParity=NOT_ESTABLISHED değişmez.
Bu yöntem gerçek VESTA'nın dosyayı açabildiğini veya
görsel eşdeğerlik sağlandığını KANITLAMAZ.

    python3 -m unittest discover -s tests \
      -p 'test_vesta_17_5_offline.py' -v

Testlerdeki tüm örnekler sentetik P1 metinleridir.
Bağımsız format referansı:
https://atomsk.univ-lille.fr/doc/en/format_vesta.html

Aşağıdaki gerçek GUI prosedürü erişim sağlanırsa
isteğe bağlı bilimsel kabul olarak kullanılabilir.

## Operatör işlemleri

1. Depoda kullanılacak sabit commit'in tam SHA'sını alın:

       git rev-parse HEAD

2. Yeni/boş ve Git'e eklenmeyecek özel klasör açın:

       python3 tests/validation/vesta_17_5_acceptance.py prepare \
         --dir vesta-17-5-private \
         --commit FULL_40_CHARACTER_GIT_SHA

   Program dört sabit senaryolu evidence.json üretir.
   Başlangıçta vestaGuiExecuted=false'dur.

3. Üç CIF için aynı commit'teki KristalYapı
   üzerinden P1 sınırlı VESTA dışa aktarması
   ve ayrıca SHA-256 kayıp raporunu indirin.
   evidence.json içindeki exportedProject.path ve
   lossReport.path dosya adlarına göre aynı
   özel klasöre taşıyın veya path değerlerini
   **gerçek dosya adları** ile eşleyin.
   Kayıp raporundaki generatedVestaFile, o
   adla birebir eşleşmelidir. Kaynak dosya
   değişmediyse yeniden adlandırma hash'i
   değiştirmez; SHA kaynak adını ayrıca kontrol eder.

4. VESTA **3.5.8** ile her yazılmış projeyi
   gerçekten File/Open üzerinden açın.
   V15 sahne ayarlarını (1024×768, beyaz fon,
   ortografik, görünüm [uvw], up [uvw],
   birim hücre sınırları) ayrı ayrı elle uygulayın.
   VESTA PNG'sini screenshot vestaOpened.path
   alanına uygun kaydedin. VESTA Save As
   üzerinden kaydettiğiniz dosyayı
   desktopResavedProject.path olarak kopyalayın.
   KristalYapı'da hem ilk export'u açıp
   kristalyapiOpened.png, hem VESTA'nın
   kaydettiği dosyayı açıp
   kristalyapiReopened.png üretin.
   **Üçünün ROI'si tamamen aynı olmalı.**
   Kamera/projeksiyon GUI işareti gerçek
   kaynakla ayrıca kontrol edilmeli.

5. Hacimsel vaka için repodaki değişmemiş
   tests/fixtures/gemmi-5i55_tiny.ccp4 dosyasını
   evidence.json volumeCompanion.path adıyla
   özel klasöre kopyalayın. Her iki GUI'de
   **aynı binary'yi kullanıcı seçerek** açın.
   Eşik +1.0 mutlak kaynak-map birimidir;
   birim e/Å³ diye adlandırılmamalıdır.
   İki ekran görüntüsünü vestaOpened ve
   kristalyapiOpened path'lerine kaydedin.
   Bu vakada V17.4 export veya density sidecar
   varmış gibi gösterilmez: veri **bilerek
   dahil edilmiyor**.

6. evidence.json içerisinde tüm screenshot
   alanlarında doğru captureMethod, YYYY-MM-DD
   captureDate, ayrıca operator ve platform
   bilgilerini elle doldurun. **GUI beyanını
   henüz false bırakarak** tüm kanıt dosyalarını
   SHA-256 ile mühürleyin:

       python3 tests/validation/vesta_17_5_acceptance.py seal \
         --dir vesta-17-5-private

   Seal, gerçek GUI beyanını otomatik true
   yapmaz. PNG CRC, boyut, mevcut pinned
   hash değişimlerini doğrular.

7. Ancak VESTA GUI'yi gerçekten çalıştırıp
   belirtilen tüm eylemleri yaptıysanız
   evidence.json içindeki vestaGuiExecuted
   alanını **elle true** yapın. Yeni/boş
   rapor klasörü kullanarak denetleyin:

       python3 tests/validation/vesta_17_5_acceptance.py audit \
         --dir vesta-17-5-private \
         --out-dir validation-results/v17-5-real \
         --require-all

   report.json, matrix.csv ve üç panelli
   PNG fark görselleri üretilir.

## Denetleyici neyi doğrular?

- Üç gerçek CIF, bir kısmi gerçek CCP4
  kaynak hash ve kamera/ROI/izoeşik sabitliği.
- Gerçek dışa aktarılmış dosya ve
  V17.4 kayıp manifesti SHA-256 eşleşmesi;
  uydurma harici grid yolu/hash'i reddi.
- VESTA'dan Save As ile alınmış P1
  dosyasının başlangıç P1 export'u ile
  aynı atom/element etiketleri, altı hücre
  parametresi, kesirli koordinat ve occupancy
  eşlemesi. Tolerans: hücre uzunluğu
  0,0001 Å; açı 0,0001°; periyodik min
  Kartezyen atom kayması 0,01 Å;
  occupancy farkı 0,0001.
- IUCr ADP'nin V17.4 kayıp raporunda
  açıkça DROPPED olması ve kamera/ışık
  kaybının da raporlanması.
- VESTA'da seçilmiş kısmi CCP4 binary'nin
  gerçek orijinal kaynak SHA-256 ile aynı
  olması. Fiziksel birim UNKNOWN.
- V15 sıkı 8-bit PNG CRC, hash,
  tarih, çözünürlük/ROI ve foreground
  IoU / RGB MAE karşılaştırması.
  Bu metrikler ışık, AA ve kameraya
  duyarlıdır; fiziksel denklik değildir.

Eşik içinde bile sonuç
WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED
olarak kalır. Bilimsel parite
NOT_ESTABLISHED ve insan kabulü REQUIRED
olarak kalır. Program PNG kaynağının
kriptografik olarak VESTA GUI olduğunu
kanıtlayamaz. require-all dört sahne
tamamlanmadan bilimsel kabul üretmez.

## Sentetik test ve kalan işler

    python3 -m unittest discover -s tests \
      -p 'test_vesta_17_5_acceptance.py' -v

Bütün test PNG'leri **sentetiktir**,
gerçek VESTA GUI'den alınmamıştır.
Testlerde hash/substitution, görünüm/ayar,
density kaybı, ADP kaybı, bozuk manifest,
resave hücre farkı, periyodik sarma ve
başarısız kanıt reddi sınanır.

- [ ] Gerçek VESTA 3.5.8 desktop ekranları,
      kaydetme çıktıları ve operatör beyanı
- [ ] Otomatik çıkan farkların bilimsel
      insan incelemesi; V16 BVS ile bağlantı
- [ ] VESTA format sürümü, non-P1 simetri,
      ADP Uij, P1-dışı vektör, polyhedron,
      kamera zoom, harita birimi
- [ ] Sonra V18 CIF2 ve setting/origin

**Bilimsel not:** Bu araç kaynak dosyaları
ve görüntüleri doğrulayabilir, ancak gerçek
VESTA kurulumuna veya desktop GUI'ye
erişim olmadan PASS veremez.
