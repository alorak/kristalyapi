# D3 — Sabit hücreli relax → bağımsız SCF işleri

Durum: kod ve negatif/sentetik süreç testleri hazır; gerçek MoS₂ kabulü
[D2.2c](qe-mos2-kvac-validation.md) referansı geçtikten sonra çalıştırılacak.
Sentetik test çıktıları gerçek DFT kanıtı değildir.

Yeni `kristalyapi.qe-relax-scf-job.v1` şeması aynı yapı/PBE/spinsiz
parametrelerine `calculation=relax-scf` ve kesin alanlı `relaxation` ekler:
`max_steps` 1–60, `force_threshold_ry_bohr` 1e-5–5e-3,
`energy_threshold_ry` 1e-8–1e-3. Eski SCF şeması ve girdi derleyicisi korunur.
Yalnız sabit hücre ve tüm atomların serbest olduğu BFGS desteklenir.

[QE pw.x belgeleri](https://www.quantum-espresso.org/Doc/INPUT_PW.html)
enerji değişimi ve tüm kuvvet bileşenlerinin eşiklerini birlikte tanımlar.
Backend her iki aşamada son SCF hata tahminini ≤1e-8 Ry, ham `JOB DONE.`,
son kuvvet bileşenlerini, atom sıra/kimliğini ve sabit hücreyi denetler.
Relaksasyonun son iki iyonik enerjisi varsa değişim ayrıca hesaplanır.

Worker `relax.in/out/stderr`, ayrı `relax-tmp` ve final
`structure.in/out/stderr`, `tmp` kullanır. Son SCF yeni kesirli koordinatlarla
bağımsız olarak başlar. Kaynak/son yapı hash'leri, her iki aşamanın kuvveti,
enerjisi ve tüm ham dosya SHA-256 değerleri sonuç JSON'unda saklanır.
Başarısız relaksasyon SCF'ye geçmez. Zaman aşımı/iptal iki aşama için ortak
wall-time sınırını ve süreç grubu sonlandırmasını kullanır; kısmi loglar
ve `pipeline.json` korunur. D3 CPU sınırı 2 iş parçacığı için wall-time ile
uyumludur; eski tek SCF'nin 4000 CPU-s sınırı korunur.

API `0.3.0`, `relax-scf` yeteneğini duyurur. Mevcut yetki/HTTPS, UPF hash,
kuyruk ve iptal yolları kullanılır. Sonuç ancak iki aşama ve son kuvvetler
geçerse yayınlanır. Relaksasyon sırasında log endpointi `relax.out` döndürür.

Arayüzde hesap türü Relaksasyon seçilince yeni şema gönderilir; atom
sabitleme sıfır olmalıdır. Sonuç, ortak ölçekli ve eş zamanlı döndürülebilen
iki 3B görüntü ve atom/koordinat tablosuyla karşılaştırılır. Konum farkı
kesirli koordinatların hücreye sarılmış farkıdır; keyfi aşırı eğik hücrelerde
küresel en kısa yol iddiası değildir. Aktif çalışma alanı otomatik değiştirilmez.
Kaynak hash, hücre/atom sırası ve her iki aşamanın yakınsama kaydı uyuşmazsa
karşılaştırma reddedilir. Eski iş kaydı kendi kaynak/son yapısını gösterir.

Docker kurulumu [iş kılavuzundaki](qe-jobs.md) gibidir. MoS₂ yüksek cutoff
kabul profili 6 GiB RAM ve kapalı swap gerektirir; varsayılan üretim Compose
bellek sınırı operatör ayarıdır. Gerçek MoS₂ kabulü ayrıca kaydedilecek.

## Gerçek Si işleyiş ve tarayıcı denetimi

[Gerçek Si raw/API kanıtları](../validation-results/qe-d3-si-smoke-20261029-arm64/INCELEME.md):
yeni `relax → scf` işi geçti. Relaksasyon kuvvet bileşeni 3.567e-5,
son SCF bileşeni 3.855e-5 Ry/Bohr; sınır 1e-4. Son enerji -22.65199796 Ry.
İlk verbose-kuvvet parser reddi korunarak gerçek çıktıyla regresyonu giderildi.
98 Python QE testi ve 437 JavaScript testi geçti. 3B görünüm gerçek Si
sonucuyla tarayıcıda incelendi; periyodik sınırı geçen atomların büyük
sıçrama gibi görünmesini engelleyen görüntü eşlemesi eklendi.

Bu küçük Si denemesi MoS₂ D3 bilimsel kabulü değildir; D2.2c referansı
ve o referanstan gerçek MoS₂ relaksasyon/kuvvet denetimi ayrıca gerekir.

## MoS₂ D3 gerçek kabulünün ön kaydı

[Sabit D3 planı](../tests/fixtures/qe/mos2-relax-acceptance.json) gerçek
koşudan önce commit edilir. `tools/qe_relax_acceptance.py --run`, kaynak
`78d116baec28419072a6d63c9d0842d28af79ac3` olan D2.2c'nin altı ham işini
ve üç enerji kapısını yeniden doğrulamadan Docker hesabı başlatmaz.
İlk yapı `ecut120-k16-c24` referansının aynısıdır; Mo/S UPF hash'leri sabittir.

Önceden belirlenen hesap ve eşikler:

- 120/960 Ry, 16×16×1, c=24 Å, sabit hücre BFGS; en fazla 30 iyonik adım.
- İyonik enerji eşiği 1e-6 Ry, kuvvet bileşeni eşiği 1e-4 Ry/Bohr.
- Yeni son koordinatlarla bağımsız 120/960 Ry SCF.
- Aynı son geometride ayrı 140/1120 Ry SCF: 120→140 farkı ≤1 meV/atom.
- Relaksasyon, son SCF ve 140 Ry SCF'nin en büyük kuvvet bileşenleri
  ayrı ayrı ≤1e-4 Ry/Bohr; 120/140 kuvvet bileşeni farkı da ≤1e-4.
- Relaksasyon / bağımsız son SCF enerji farkı ≤1e-6 Ry. Kaynak ideal
  geometri enerjisine artış ≤1e-6 Ry; her atomun sarılmış konum farkı ≤0.5 Å.
- Her üç solver aşamasında 26 elektron, SCF hata tahmini ≤1e-8 Ry,
  ham `JOB DONE.`, API/raw Ry-eV, kimlik/hücre/koordinat ve UPF/dosya
  SHA-256 denetimleri. Son iki basılı iyonik enerjinin farkı 1e-6 Ry
  eşiğiyle, çıktı yuvarlaması için 2e-8 Ry payıyla ayrıca kontrol edilir.

Kabul worker'ı 6 GiB RAM, swap kapalı, 2 CPU ve iş başına 10800 s
wall-time kullanır; D3 CPU-s sınırı buna göre ayarlanır. Son 140 Ry
tek SCF'de mevcut 4000 CPU-s sınırı da geçerlidir. Manuel workflow
240 dakika üst sınıra sahiptir. Yanlış/eksik referansla deneme iş göndermeden
durur; başarısız/eksik işler ve ham çıktılar korunur.

```bash
python3 tools/qe_relax_acceptance.py --run --output validation-results/qe-mos2-relax-local
python3 tools/qe_relax_acceptance.py --verify validation-results/qe-mos2-relax-local
```

`--reference` verilmezse plandaki repoya göreli D2.2c kanıt klasörü kullanılır.
D3 özeti, ön koşul summary/result/output hash'lerini kaydeder; yeniden
doğrulamada aynı kanıt zorunludur. 103 Python QE testi geçti. Gerçek MoS₂
D3 sonucu henüz bekleniyor.
