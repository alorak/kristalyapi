# D4.1 — Ön kayıtlı elektronik yakınsama protokolü

Durum: altı gerçek MoS₂ vakası tamamlandı ve ham kanıtlardan bağımsız
olarak yeniden doğrulandı. Ön kayıtlı **sonlu bant sayısı ve NSCF örgüsü kabulü geçti**.
[Kanıt paketi ve sınırlar](../validation-results/qe-mos2-d41-20261030-amd64/INCELEME.md).
DOS genişliği yalnız duyarlılık olarak raporlanır; `broadening_converged=null`.

Kaynak, tam doğrulanmış D4 kanıt paketi ve D3 son geometrisidir. Yeni
SCF'lerde aynı 120/960 Ry, 16×16×1, c=24 Å, nötr 26 elektron, PBE/skaler/
spinsiz protokol ve SHA-256 eşleşmeli Mo/S UPF'leri kullanıldı.

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
- NSCF'nin gerçek eigenvalue ve QE 6.7'nin yazdığı 1/0 normalize doluluk bloklarından (13 dolu durum × iki spin = 26 elektron) örneklenmiş
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

Yeni dosyalarda DOS/projwfc ortak ve açık `Emin=-8`, `Emax=6`,
`DeltaE=0.01 eV` kullanacak. Tam durum sayısı ayrıca aynı API işinin
değişmeyen NSCF kaydından `dos.x` ile −65…30 eV ve sabit 0.01 Ry
genişlikte doğrulanır; bu ek ham çıktı API eğrisiyle karıştırılmaz. Genişlik `degauss` **Ry** birimindedir;
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

Her vaka için en fazla 4 saat, 6 GiB/no-swap ve 2 CPU sınırı kullanıldı; manuel CI
aynı anda en fazla iki vaka çalıştırdı. Bunlar yalnız üç atomlu referans
içindir; D5 büyük hücre kapasitesi bu protokolden çıkarılmaz.

## Çalıştırma ve bağımsız doğrulama

Önce kayıtlı plan ve tam D4/D3 kanıt zincirini kontrol et (DFT çalıştırmaz):

```sh
python tools/qe_electronic_convergence.py --preflight
```

Manuel `qe-mos2-acceptance.yml` iş akışında `protocol=d41` seçilir;
Mo/S SHA-256 girdileri sabit plandaki değerlerle birebir eşleşmelidir.
Altı vaka iki paralel Linux/x86_64 runner üzerinde bağımsız API işleri
olarak çalışır. Her vaka tamamlanmış olsa bile tek başına yakınsama kabulü
vermez. Son iş bütün vakaları toplayıp ham çıktılardan yeniden türetir.
Eksik veya başarısız bir vakada genel sonuç başarısızdır; ham kanıt saklanır.

Yerelde aynı x86_64 kohortu vaka vaka üretmek için temiz, commit edilmiş
kaynakla şu komut her sabit vaka kimliği için çalıştırılır:

```sh
python tools/qe_electronic_convergence.py --run-case nbnd32-k16-s010 --output validation-results/qe-mos2-d41
# Diğer beş vaka da aynı kök dizine, aynı kaynak commit ile çalıştırılır.
python tools/qe_electronic_convergence.py --report validation-results/qe-mos2-d41
python tools/qe_electronic_convergence.py --verify validation-results/qe-mos2-d41
```

`comparison.json` karar çiftlerini, yardımcı çiftleri, ham NSCF kenarlarını,
DOS/PDOS farklarını ve başarısızlıkları içerir. `--verify` raporu ham
kanıtlardan yeniden hesaplar ve kayıtla eşleştirir. `broadening_converged`
alanı daima `null` kalır. Yalnız bant/örgü için ön kayıtlı sonlu kabul vardır.
Kaynak hash'leri kayıtlı git commit içeriğiyle denetlenir; doğrulayan
checkout ilgili commit nesnelerini içermelidir (`fetch-depth: 0`).

API'deki isteğe bağlı `electronic.dos` nesnesi tam dört alan alır:
`delta_e_ev`, `degauss_ry`, `energy_min_ev`, `energy_max_ev`. Aralıklar
sırasıyla 0.005–0.2 eV, 0.001–0.05 Ry ve −500…500 eV; grid tam sayı
aralıklı ve en fazla 10001 noktalı olmalıdır. `dos.x` ve `projwfc.x`
aynı ayarları kullanır. Alan verilmezse önceki D4 girişleri korunur.
Bu PR bir UI ayar paneli eklemez; operatör/API protokolünü hazırlar.

## QE 6.7 pencere düzeltmesi (MoS₂ taramasından önce)

İlk gerçek Si işlev testi başarısız oldu ve API sonuç yayımlamadı:
`projwfc.x` istenen −65…30 eV aralığını özdeğer uçları ±3σ ile
sınırlayıp DOS ile farklı başlangıç fazı üretti. Bu davranış
[QE 6.7 partialdos kaynağında](https://github.com/QEF/q-e/blob/qe-6.7.0/PP/src/partialdos.f90#L41-L56)
açıktır. Enerji kaydırmak, interpolasyon veya sıfırla doldurmak yerine,
MoS₂ eğri penceresi mevcut durum aralığının içindeki −8…6 eV olarak
önceden sabitlendi; geniş pencerede durum integrali ayrı `dos.x` çıktısıyla
korundu. Sayısal kabul eşikleri değiştirilmedi. İlk başarısız Si kanıtı
saklanır; bu düzeltmeden önce yeni bir MoS₂ D4.1 vakası çalıştırılmadı.

## D4.2 — Uygulamada raporu inceleme

Karşılaştırma raporunu ham kohorttan yeniden hesapladıktan sonra görünümü üret:

```sh
python tools/qe_convergence_view.py validation-results/qe-mos2-d41 --output convergence-view.json
```

Araç kayıtlı `comparison.json` ile yeniden türetilen ham rapor eşleşmezse
çıktı vermez. Eksik/başarısız kohort da kendi başarısız durumuyla incelenebilir;
olmamış vaka için eğri üretilmez. Devam eden eski bir CI sürümünün paketinde
görünüm dosyası yoksa indirilmiş kanıt kökünde bu komut kullanılabilir.

DFT panelindeki **Elektronik yakınsama ve kanıt raporu** bölümünde dosyayı aç.
Plan, karşılaştırma ve eğri JSON hash'leri tarayıcıda eşleştirilir; karar
bayraklarının sayısal eşiklerle tutarlılığı kontrol edilir. Bu dosya kontrolü
ham QE kanıtının bağımsız doğrulamasının yerine geçmez; ekranda kabul
**dosyada raporlanan** sonuç olarak belirtilir.

Panel örneklenmiş NSCF VBM/CBM/aralık değerlerini, karar ve yardımcı
çiftleri, genişlik duyarlılığını, DOS/Mo-d/S-p eğri çiftlerini, kaynak commit
ve ham dosya özetlerini gösterir. Tablo CSV olarak indirilebilir. Eski D4
0.02 eV, yeni vakalar 0.01 eV ham ortak örneklerle çizilir; enerji kaydırılmaz.
