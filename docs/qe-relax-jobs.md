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
