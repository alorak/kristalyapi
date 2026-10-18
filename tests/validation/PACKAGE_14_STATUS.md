# Paket 14 — VESTA 3 hesap tanımıyla gerçek CIF fark matrisi

## Teslim edilen ve teslim edilmeyen

**Otomatik olarak geçen iş:** Orijinal üç deneysel CIF / sekiz kimyasal merkez
üzerinde [resmî VESTA 3 kullanıcı kılavuzunun §11.4.3 denklemleri](https://jp-minerals.org/vesta/en/doc/VESTAch11.html)
ile uygulamanın geometrik/BVS hesaplarını, bağımsız Gemmi 0.7.5 + ASE 3.26.0
sonuçlarıyla **tam atom görüntüleri üzerinden** karşılaştırma.

**Henüz yapılmayan iş:** Masaüstü VESTA GUI'nin gerçek ölçüm menüsünden
alınmış bağ uzunluğu/BVS veya VESTA penceresinin ekran görüntüsü.
Bu konuda CSV/JSON hücreleri **boş / `not-run`** kalır. Bir formülün VESTA
kılavuzunda yazması, o formülün gerçek GUI'de aynı sonuçla çalıştığını
otomatik olarak kanıtlamaz. Paket 13 gibi bu paket de yanlış bir GUI başarısı
iddiasında bulunmaz.

## VESTA 3.5.8 kaynak incelemesi (gerçek dağıtım, GUI değil)

- Resmî [VESTA indirme sayfası](https://jp-minerals.org/vesta/en/download.html):
  kararlı sürüm **3.5.8**, Linux GTK3 arşivi `VESTA-gtk3.tar.bz2`.
  İndirilen yürütülebilir dosyalar **depo veya CI'a eklenmedi**. VESTA'nın
  lisansı dağıtımın izinsiz yeniden dağıtılmasını yasaklar.
- Paketten okunan özgün `bvparm2016.cif` dosyasının SHA-256 değeri:
  `73b13e36009c89312535e934e2fe9a72b1356201d050d0e7d0b38e77414545cc`.
  Bu dosyanın kendisi de projeye kopyalanmadı (ayrı I. David Brown atıf/
  lisans koşulları var). İstenirse `--vesta-bvparm` ile **kullanıcının kendi
  VESTA kurulumundan** okunup 19 çiftin tamamı yeniden denetlenir.
- Denetlenen **19 iyon çiftinin tamamı** VESTA 3.5.8'in 2016 tablosunda
  aynı `R₀` ile `B=0,37 Å` uyumlu bir satıra sahip.
- **Gerçek parametre farkı:** Kristal Yapı `Cu²⁺–O²⁻` için IUCr 2020
  referans `bj`, `R₀=1,679 Å`, `B=0,36 Å` seçmiştir. VESTA 3 kılavuzu
  sabit **`B=0,37 Å`** kullanır; aynı `R₀` değeri 2016 tablosunda
  `ref=a`, `B=0,37 Å` olarak vardır. Fark hesap geometrisinden önce
  parametre seçimiyle açıklanabilir. Öteki 18 çiftin uygulama `B`'si
  zaten `0,37 Å`.
- Resmî VESTA GUI'yi başsız Linux ortamında açma denemesinde `DISPLAY`
  yoktu; Xvfb sanal ekran kurulumu ortamın `setgroups` kısıtına takıldı.
  Yürütülebilir dosyanın terminal denemesi de `Bus error` ile sonuçlandı.
  **Bunlar başarılı VESTA ölçümü değildir.**

## İki ayrı sayı: kılavuz denklemi ve gerçek VESTA GUI

VESTA 3 kılavuzunun denklem ve tanımları:

\[
V_\mathrm{manual}=\sum_i\exp[(R_0-d_i)/0.37]
\]

\[
D=\frac{1}{n}\sum_i\frac{|d_i-\bar d|}{\bar d},\quad
d_\mathrm{Hoppe}=\frac{\sum_i d_i\exp[1-(d_i/d_\min)^6]}{\sum_i\exp[1-(d_i/d_\min)^6]},\quad
\mathrm{ECoN}=\sum_i\exp[1-(d_i/d_\mathrm{Hoppe})^6]
\]

Paket 14 BVS panelinde **aynı merkez, aynı komşu görüntüleri ve aynı `R₀`**
üzerinde iki referans hesabı gösterilir:

1. `manualVesta37Full`: Yukarıdaki kılavuz denklemi, ligand başına tam katkı.
2. `manualVesta37OccupancyWeighted`: Tamamen **hipotetik** ikinci hesap,
   aynı `B=0,37 Å` denklemi ancak katkılar ligand doluluğuyla çarpılmış.

`appBvs - manualVesta37OccupancyWeighted` yalnız `B` parametresi duyarlılığını;
`manualVesta37OccupancyWeighted - manualVesta37Full` doluluk varsayımının
sayısal etkisini ayırır. VESTA GUI'nin karma doluluk mekanizması veya seçili
bağ koşulları **bu hesaplardan çıkarılmaz**. Farklı bir VESTA `R₀` seçimi,
kesim, simetri/setting veya görünür atom sayısı gerçek GUI sonucunu değiştirir.

| Deneysel merkez | CN | Baur D | Hoppe ECoN | Gerçek VESTA GUI |
| --- | ---: | ---: | ---: | --- |
| NaCl Na1–Cl | 6 | 0,000000 | 6,00000 | Henüz yok |
| Rutil Ti4–O | 6 | 0,008449 | 5,98364 | Henüz yok |
| IUCr K1–O / Na1–O | 7 | 0,054502 | 5,85768 | Henüz yok |
| IUCr K2–O / Na2–O | 8 | 0,035094 | 7,41019 | Henüz yok |
| IUCr Ca1–O | 6 | 0,033980 | 5,66644 | Henüz yok |
| IUCr Si1–O | 4 | 0,004570 | 3,99685 | Henüz yok |

Her satırın atomları, kesimi, sembolü, gerçek ölçümden farklı model BVS'si,
sonlu periyodik görüntüleri ve dolulukları VESTA'dan bağımsız, kaynak
SHA-256'lı deneysel Gemmi/ASE referansıyla yeniden hesaplanır.

## Yeniden üretim

```sh
node --test tests/core.test.cjs tests/coordination-reference.test.cjs
python -m pip install gemmi==0.7.5 ase==3.26.0 numpy==2.1.3
python tests/validation/bvs_13_experimental.py
python tests/validation/vesta_14_manual_reference.py

# İsteğe bağlı: VESTA 3.5.8'i kendiniz kurduysanız, parametre tablosunu denetleyin.
python tests/validation/vesta_14_manual_reference.py \
  --vesta-bvparm /kendi/VESTA-gtk3/bvparm2016.cif

# Gerçek VESTA GUI ekranları daha sonra hazır olduğunda ayrı kanıt denetimi:
python tests/validation/vesta_14_manual_reference.py \
  --vesta-gui-evidence /kendi/p14/gui-capture.json
```

CI iki çıktı arşivler:

- `validation-results/vesta-14-manual-reference.json` — teknik sayılar,
  kaynak/varsayım, `vestaGuiStatus: NOT RUN`.
- `validation-results/vesta-14-difference-matrix.csv` — sekiz karşılaştırma
  satırı; `actualVestaBvs` boş, `vestaGuiStatus: not-run`.

WebGL testinde ayrıca P14 panelinin kılavuz denklem değerleri ve
`GUI ölçümü DEĞİL` uyarısı doğrulanır. Ekran:
`tests/browser/artifacts/p14-vesta-manual-projection.png`.

## Gerçek VESTA GUI çıktıları geldiğinde yapılacak ölçüm

1. Resmî VESTA **3.5.8** kurulumunda kaynağı değiştirilmemiş
   `COD_1000041_NaCl.cif`, `COD_9009083_rutile.cif` ve
   `IUCr_wm5651_KNaCaSiO.cif` dosyalarını açın.
2. IUCr dosyası `data_global` + `data_I` ve sonda SHELX rafinman arşivi
   içerir; ilk yapı bloğu ve **K1=0,722 / Na1=0,278** doluluğu açıkça
   seçildiğinden emin olun. VESTA çok-faz davranışını ayrı kayıt edin.
3. Görünür sınırı `[0,1]³`, atom etiketleri ve simetriyi aynı tutun.
   K1/Na1–O için **3,2 Å**, K2/Na2–O için **3,5 Å**, Ca1–O için
   **3,1 Å**, Si1–O için **2,0 Å** kesimi seçin. Tam komşu görüntülerinin
   listelenmesiyle yalnız ekranda çizilen bağları karıştırmayın.
4. Gerçek **Distance** veya poliedr seçimiyle alınmış bağ uzunluklarını
   ve VESTA **Text Area** kaydını saklayın. BVS'yi karşılaştıracaksanız
   `R₀` ve `B=0,37` seçimini, iyonun formal durumunu ve doluluk yorumunu
   açıkça belirtin. VESTA kılavuzunda BVS için bu sabit B geçerlidir.
5. Ekran PNG'sini yerel kanıt dizinine koyun, `sha256sum` ile özetini alın;
   `tests/validation/vesta_14_gui_capture_template.json` alanlarını gerçek
   ölçümlere göre doldurun. Henüz ölçüm yapılmadıysa `vestaGuiExecuted:false`
   bırakın; test gerçek GUI kanıtı gibi sunulmasını reddeder.
6. `--vesta-gui-evidence` denetimi geçerse geometrik uzaklıkların **0,03 Å**
   toleransında eşleştiği doğrulanır. Ekran bağlamı/etiketlerin anlamlılığı
   ayrıca insan tarafından kontrol edilmelidir; sayıların uyuşması bile tek
   başına bütün VESTA davranışının eşdeğer olduğunu göstermez.

## Sonraki Paket 15

Gerçek VESTA GUI ekran/mesafe/BVS kayıtları elde edilirse fark matrisi
kapalı veriyle doldurulacak; özellikle kesim, VESTA'nın `B=0,37` modeli,
karma doluluk ve `GROUP`/özel setting dönüşümleri ayrı sınıflandırılacak.
Bu kanıtlar gelmeden uygulama veya CI `VESTA GUI parity PASS` yazmayacak.
