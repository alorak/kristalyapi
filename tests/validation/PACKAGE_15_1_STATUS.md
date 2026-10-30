# V15.1 — VESTA 3.5.8 gerçek GUI kanıtını toplama ve P14 eşleme

**Kod durumu:** Operatör için kanıt hazırlama / kilitleme / denetleme uygulandı.
**Gerçek durum:** VESTA GUI ekranları ve VESTA Text Area ölçümleri bu depoda
yoktur. **VESTA GUI kıyasının sonucu hâlâ NOT_RUN ve bilimsel parite
NOT_ESTABLISHED.**

Bu sürümde VESTA'yı başsız olarak sahte biçimde taklit etmiyoruz.
Resmî VESTA 3.5.8 yalnız **operatörün kendi makinesinde** çalıştırılır.
VESTA yazılımı veya dağıtım dosyaları GitHub'a eklenmez. VESTA
[resmî lisansı](https://jp-minerals.org/vesta/en/download.html) orijinal
program dosyalarının izinsiz yeniden dağıtımını yasaklar.

## 1. Tek sahne ile başlangıç (NaCl)

Depoyu doğru commit'te açıp çalıştırın (Linux/macOS):

```sh
# Çalışma ağacındaki commit'i 40 haneli olarak sabitleyin.
git rev-parse HEAD

python3 tests/validation/vesta_15_capture.py prepare   --dir v15-private   --commit "$(git rev-parse HEAD)"   --case nacl-001-structure

python3 tests/validation/vesta_15_capture.py status --dir v15-private
```

Komut repo dışında tutulması önerilen ve Git tarafından yok sayılan
§v15-private/capture.json§ dosyasını oluşturur. Her sahne için iki gerçek
PNG ismi ayrılır: §<id>-vesta.png§ ve §<id>-kristalyapi.png§.
Görüntü henüz yoktur ve §vestaGuiExecuted=false§ sabitlenir.
Birden fazla §--case§ ile sahneler seçilebilir; parametre verilmezse beş
sahnenin tamamı hazırlanır. Aynı dizine ikinci kez hazırlık yapmak
mevcut kanıtı ezmesin diye reddedilir.

## 2. Gerçek VESTA 3.5.8 ve tarayıcı çekimi

1. §vesta_15_cases.json§ dosyasındaki **aynı** kaynak CIF/CCP4
   VESTA'da ve Kristal Yapı'da açılır. VESTA'nın kabul ettiği
   ayar/orijin, bileşim, ADP ve simetri genişletmesini kontrol edin.
2. VESTA'da **Objects → Boundary** bölümünden §§[0,1]³§ sınırını
   belirleyin. Resmî kılavuza göre sınır değişikliği gizli/işaretli
   atomların durumlarını sıfırlayabilir; sonrasında bağ, polyhedron
   ve etiketleri yeniden doğrulayın.
3. **Objects → Orientation** ile görünüşü §[uvw]§ ve ekran-yukarıyı
   §[hkl]*§ olarak seçin (resmî eşitlik: §hu+kv+lw=0§).
   Aynı açılar, ortografik projeksiyon, atom yarıçapı, renk, ışık,
   kalınlık, gizli nesneler, hücre çizgileri, yön okları ve kamera
   ölçeği uygulanmalı. Bu eşitleme **henüz otomatik değil**.
4. **File → Export Raster Image** ile VESTA PNG'yi elde edin.
   VESTA kılavuzunda raster çıktı boyutu Graphics Area'nın
   *katları* olarak ayarlanır: örneğin 1024×768 için Graphics Area
   boyutu/scale faktörü buna göre seçilmelidir. Kontrol araçlarını
   içeren masaüstü ekran görüntüsü yerine **gerçek sahne exportu**
   kullanın. Aynı 1024×768 boyutu Kristal Yapı PNG'sinde de olmalı.
5. Çekilen gerçek PNG'leri §v15-private/§ içine ayrılan
   isimlerle koyun. VESTA'ya ait görüntüyü otomatik üretilmiş
  /sentetik görselle **değiştirmeyin**.

VESTA resmî yönlendirme/boundary açıklaması:
https://jp-minerals.org/vesta/en/doc/VESTAch10.html

Raster dışa aktarım ve Graphics Area ölçek bilgisi:
https://jp-minerals.org/vesta/en/doc/VESTAch18.html

## 3. PNG bütünlüğünü kilitle ve operatör bilgilerini gir

```sh
python3 tests/validation/vesta_15_capture.py seal --dir v15-private
python3 tests/validation/vesta_15_capture.py status --dir v15-private
```

§seal§ yalnız mevcut *gerçek dosyaların baytlarını* SHA-256 ile
kilitler; 8-bit RGB/RGBA PNG yapısı, CRC, tam çıktı boyutu
ve kırpılmamış ROI doğrulanır. Dosya sonradan değiştirilirse
yeniden seal edilmesi engellenir. Dış klasöre geçiş, symlink kaçışı
ve yanlış kaynağın kullanılması reddedilir.

Operatör daha sonra §capture.json§ dosyasını açarak
§operator§, §platform§, iki §captureDate§ alanı (YYYY-MM-DD)
ile kullanılan ekran ayarlarını kaydeder. **Yalnız VESTA GUI gerçekten
çalıştırıldıysa** §vestaGuiExecuted§ alanını elle §true§ yapabilir.
§seal§ bunu asla otomatik yapmaz. Tek başına bir kullanıcının
§true§ demesi kriptografik olarak VESTA çalıştırmasını ispatlamaz.

```sh
python3 tests/validation/vesta_15_capture.py status --dir v15-private
python3 tests/validation/vesta_15_visual.py   --evidence v15-private/capture.json   --out-dir validation-results/vesta15

# Tüm 5 sahne hazır olmalıysa:
python3 tests/validation/vesta_15_visual.py   --evidence v15-private/capture.json   --out-dir validation-results/vesta15 --require-all
```

§status§, her sahnede eksik görüntü, kaynak, ayar, tarih, operatör
kanıtı gibi **engelleri ayrı ayrı** raporlar.
§visual.py§ iki PNG'nin aynı ROI koordinatlarını kullanmasını da
zorunlu kılar; aynı ölçüde fakat farklı yerlerden kesilmiş görseller
birebir eşleştirilmiş gibi karşılaştırılamaz.
Rapor **yalnız morfolojik RGB/siluet farkını** ölçer.
§scientificParity=NOT_ESTABLISHED§ değişmez.

## 4. P14'ün gerçek bağ/BVS kanıtlarını ayrıca bağla

P14 sayısal protokolü NaCl, TiO₂ ve IUCr dosyalarında Gemmi/ASE
referanslarını kullanır. Gerçek VESTA *Text Area* ekran/mesafe
kaydı alındıktan sonra **ayrı P14 script'i** ile denetlenir:

```sh
python3 tests/validation/vesta_14_manual_reference.py   --vesta-gui-evidence /kendi-guvenli-dizininiz/p14-gui-capture.json

python3 tests/validation/vesta_15_visual.py   --evidence v15-private/capture.json   --p14-report validation-results/vesta-14-manual-reference.json   --out-dir validation-results/vesta15
```

P14 çalıştırması `gemmi==0.7.5`, `ase==3.26.0` ve
`numpy==2.1.3` gerektirebilir (P14 dokümanını izleyin).
V15.1 `--p14-report` ile **yalnız P14'ün oluşturduğu raporun**
protokol/GUI durumu, dosya kaynak SHA-256 eşleşmesi,
kaydedilmiş ölçüm hata sınırı ve ekran/rapor SHA-256 metaverisini
çapraz bağlar. Kullanıcı tarafından sunulmuş JSON dosyası
imzalı bir kanıt değildir; orijinal P14 GUI **burada tekrar
çalıştırılmaz**. Bu bağlantı, P14 ölçümlerinin V15 PNG'lerinde
otomatik olarak görüldüğü anlamına gelmez.

## 5. Açık kalan işler

- [ ] VESTA 3.5.8'in çalıştırıldığı fiziksel ortamda 5 gerçek PNG çifti.
- [ ] P14'te gerçek VESTA Text Area ve ölçülen bağ/BVS kayıtlarının
  referans 0.03 Å toleransı içinde doğrulanması.
- [ ] CCP4 kısmi haritanın fiziksel mutlak izoeşik seviyesinin
  ayrı sabit commit ile seçilmesi: `isoLevel: null` olduğu sürece
  isoyüzey karşılaştırması **bloklanır**.
- [ ] İki uygulamanın kamera/ışık/doluluk/atom/bağ/
  ADP/izoyüzey ayarlarının insan tarafından eşlenmesi.
- [ ] Sayısal yoğunluk/koordinat karşılaştırmasının tek başına
  görüntü metriklerine değil Gemmi/ASE sonuçlarına bağlanması.

**V15.1'de yapılan iş operatör kanıtı toplama otomasyonu ve kaynak
eşleştirmesidir; GUI'yi gerçekten çalıştırmak veya parite
kanıtını üretmek henüz tamamlanmamıştır.**
