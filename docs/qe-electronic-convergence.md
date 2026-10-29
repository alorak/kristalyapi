# D4.1 — Ön kayıtlı elektronik yakınsama protokolü

Durum: protokol ve otomatik karşılaştırma geliştirmesi; **yeni MoS₂
karşılaştırma koşuları henüz yapılmadı**. D4'ün tek ayardaki işleyiş/veri
kabulü bu yakınsama taramasının yerine geçmez.

Kaynak, tam doğrulanmış D4 kanıt paketi ve D3 son geometrisidir. Yeni
SCF'lerde aynı 120/960 Ry, 16×16×1, c=24 Å, nötr 26 elektron, PBE/skaler/
spinsiz protokol ve SHA-256 eşleşmeli Mo/S UPF'leri kullanılacak.

| Yeni vaka | Bant | NSCF örgüsü | DOS genişliği (Ry) |
| --- | --- | --- | --- |
| nbnd32-k16-s010 | 32 | 16×16×1 | 0.01 |
| nbnd40-k16-s010 | 40 | 16×16×1 | 0.01 |
| nbnd40-k18-s010 | 40 | 18×18×1 | 0.01 |
| nbnd40-k24-s010 | 40 | 24×24×1 | 0.01 |
| nbnd40-k24-s005 | 40 | 24×24×1 | 0.005 |
| nbnd40-k24-s0025 | 40 | 24×24×1 | 0.0025 |

[Sabit makine planı](../tests/fixtures/qe/mos2-electronic-convergence.json)
sonuçlar görülmeden kaydedilir. D4'teki 26 bant/k16/0.01 Ry noktası yalnız
kaynak ve yardımcı karşılaştırmadır. Karar çiftleri sonradan seçilmez:
**32→40 bant**, **18→24 NSCF örgüsü**; genişlik **0.005→0.0025 Ry** ise
ayrı duyarlılık raporudur. 18/24 kaydırılmamış örgüler kesirli üçte-bir
K noktalarını içerir. SCF ve açık 61 noktalı Γ–M–K–Γ yolu sabit tutulur.

## Karar büyüklükleri ve önceden sabit hedefler

- Aynı açık k-yolunda her noktada özdeğerleri sırala, en düşük ortak 24
  durumu karşılaştır: en büyük fark ≤0.01 eV. Dal etiketlerini/çaprazlaşma
  sırasını aynı fiziksel bant gibi eşleme.
- NSCF'nin gerçek eigenvalue ve 2/0 doluluk bloklarından örneklenmiş
  VBM/CBM/aralık türet: ilgili değişimler ≤0.01 eV. NSCF örgüsünü
  değiştirince sabit açık yolun bantları değişmediğinden, o grafikten
  NSCF örgüsü yakınsaması iddia edilmez. Bunlar örneklenmiş PBE aralıklarıdır.
- Toplam DOS ve hücre toplamı Mo-d/S-p için ortak −8…6 eV aralığında
  `∫|y₂−y₁| dE / ∫|y₂| dE ≤0.05`. Son yoğun nokta paydadır; eksik/
  sıfıra yakın paydada sonuç kabul edilmez. S-p iki S atomunun toplamıdır.
- Tam −65…30 eV DOS penceresinde integral `2×nbnd` değerine 0.2 durum
  içinde yakın olmalı. Pencere bütün yeni durumları kapsamazsa koşu geçmez.
- D4'ün mevcut enerji/hata/kuvvet/UPF/raw–API/stage-hash kontrolleri
  her yeni vakada korunur. Farklı geometri, yöntem, kaynak veya sürüm
  karıştırılmaz. Eksik/başarısız vakadan genel kabul üretilmez.

10 meV ve %5 hedefleri bu projenin ön kayıtlı sayısal hedefleridir;
evrensel fiziksel doğruluk ölçütleri veya deneysel hata sınırları değildir.

## Enerji gridi ve DOS genişliği

Yeni dosyalarda DOS/projwfc ortak ve açık `Emin=-65`, `Emax=30`,
`DeltaE=0.01 eV` kullanacak. Genişlik `degauss` **Ry** birimindedir;
Emin/Emax/DeltaE **eV** birimindedir. Her iki postprocessor aynı ayarları
alır. [dos.x](https://www.quantum-espresso.org/Doc/INPUT_DOS.html),
[projwfc.x](https://www.quantum-espresso.org/Doc/INPUT_PROJWFC.html).

Karşılaştırma mevcut ortak noktaları seçer: enerji kaydırması,
interpolasyon veya yeniden ölçekleme yapmaz. Eski D4 yardımcı noktasında
0.02 eV gridi kullanılır; yeni 0.01 eV eğrisinin yalnız birebir karşılığı
olan mevcut noktaları seçilir. Birincil yeni çiftler 0.01 eV gridindedir.

Genişliği azaltmak pikleri tanım gereği değiştirebilir. Bu yüzden genişlik
çiftinin eğri farkı kaydedilir, **sıfır genişlik yakınsaması** diye geçer/
kalır kararı verilmez. Alttaki bağımsız NSCF spektrumunun değişmemesi ve
ham veri tutarlılığı ayrıca denetlenir. Genel D4.1 kabulü bant/örgü
hedeflerini kapsar; genişlik duyarlılığının raporlanması ayrıca belirtilir.

Her vaka en fazla 4 saat, 6 GiB/no-swap ve 2 CPU kullanacak; manuel CI
aynı anda en fazla iki vaka çalıştıracak. Bunlar yalnız üç atomlu referans
içindir; D5 büyük hücre kapasitesi bu protokolden çıkarılmaz.
