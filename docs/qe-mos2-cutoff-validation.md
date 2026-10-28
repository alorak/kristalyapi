# D2.2b — MoS₂ kesme enerjisi yakınsaması

Bu belge ve [sabit plan](../tests/fixtures/qe/mos2-cutoff-acceptance.json)
ilk gerçek koşudan önce kaydedildi. İlk D2.2'nin yedi vakası ve başarısız
80→100 Ry sonucu korunur. D2.2b yalnız kesme enerjisi kapısını yeniden
sınar; tek başına genel D2.2, relaksasyon veya elektronik yapı kabulü değildir.

## Gerçek sonuç — geçti

[Başarılı Linux/Docker/API koşusu](https://github.com/alorak/kristalyapi/actions/runs/40783454635),
kaynak `7a80999b4c23fa0258326b5d7334a84e4f9a18ca`, üç yeni SCF işi.
Ham çıktılardan bağımsız denetim de **3/3** geçti. [Kalıcı ham kanıtlar ve
inceleme](../validation-results/qe-mos2-d22b-20261029-amd64/INCELEME.md).

| ecutwfc/ecutrho, Ry | Enerji, Ry | Son SCF hata tahmini, Ry | İterasyon |
| --- | --- | --- | --- |
| 100/800 | -181.58134678 | 1.3e-9 | 18 |
| 120/960 | -181.58162387 | 6.1e-9 | 16 |
| 140/1120 | -181.58168299 | 7.2e-9 | 16 |

**120→140 Ry: 0.268123 meV/atom ≤1 — kabul geçti.** 100→120 yardımcı
farkı 1.256667 meV/atom; önce belirlenen birincil çift değiştirilmedi.
100 Ry tekrarının eski D2.2 ile enerji farkı sıfır; girdi/yapı/UPF hash'leri
ve QE sürümü aynı. Her üç işte 26 elektron, SCF/`JOB DONE.`, Ry-eV,
girdi/çıktı ve staged UPF SHA-256 denetimleri doğrulandı.

Başarılı koşu, v2'de önceden kaydedilen 6 GiB worker belleği ve iş başına
3600 saniye sınırıyla çalıştı. Docker bellek ve memory+swap sınırları
6442450944 bayt olarak kaydedildi; swap kapalı. Genel D2.2 ve D3 öncesinde
yüksek cutoff'ta k-örgüsü/vakum kontrolleri hâlâ gereklidir. Kuvvet ve
relakse edilmiş geometri kabulü bu sonuçtan çıkarılmaz.

## Değişmeyen sistem

D2.2 ile aynı ideal, relakse edilmemiş üç atomlu 1H-MoS₂, a=3.18 Å,
S düzlemi uzaklığı 1.56 Å, nötr 26 elektron, PBE, spin polarizasyonu yok,
sabit occupations. Tüm noktalarda k=8×8×1, c=24 Å, gamma-centered
kaydırma `0 0 0`. Yapı, fonksiyonel ve UPF baytları değiştirilmez.

- Mo SHA-256: `0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd`
- S SHA-256: `90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4`

Kaynak, lisans ve metadata incelemesi
[önceki doğrulama kaydında](../validation-results/qe-mos2-d22-upf-review-20261029.json).
Bu iki hash yeni planda da sabittir; başka bir 64 karakterli hash kabul edilmez.

## Önceden kaydedilen üç gerçek iş

| Vaka | ecutwfc/ecutrho, Ry | k-örgüsü | c, Å |
| --- | --- | --- | --- |
| ecut100-k8-c24 | 100 / 800 | 8×8×1 | 24 |
| ecut120-k8-c24 | 120 / 960 | 8×8×1 | 24 |
| ecut140-k8-c24 | 140 / 1120 | 8×8×1 | 24 |

Her nokta yeni API işi olarak çalıştırılır. 100 Ry noktası,
[önceki gerçek sonucun](../validation-results/qe-mos2-d22-20261029-amd64/cases/ecut100-k8-c24/result.json)
(−181.58134678 Ry) tekrarı ve izlenebilir karşılaştırma içindir; eski çıktılar
başka bir işmiş gibi yeniden etiketlenmez.

**Birincil kabul ölçütü:** son iki nokta, **120/960→140/1120 Ry**, arasında
mutlak toplam enerji farkı **≤1 meV/atom**. 100→120 farkı da raporlanır,
ancak birincil karar çiftini koşudan sonra değiştirmek için kullanılmaz.

Her üç işte SCF yakınsaması, `JOB DONE.`, son SCF hata tahmini ≤1e-8 Ry,
API/raw Ry-eV uyumu, kaynak yapı, girdi/çıktı ve staged Mo/S UPF hash
kontrolleri zorunludur. İlk v1 planda her iş için 900 saniye;
başarılı v2 kaynak tekrarında 3600 saniye sınırı geçerlidir.
Ölçütler geçmezse durum başarısız kalır; daha yüksek ecut veya farklı
UPF seçimi ayrı, önceden kaydedilmiş bir deney gerektirir.

## Çalıştırma ve kanıt denetimi

```bash
python3 tools/qe_mos2_acceptance.py --run --protocol d22b-extended \
  --mo-sha256 0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd \
  --s-sha256 90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4 \
  --output validation-results/qe-mos2-cutoff-local

python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-cutoff-local
```

`--run` varsayılanı hâlâ eski `d22` protokolüdür; yeni üçlü tarama açıkça
`--protocol d22b-extended` ile başarılı v2 tekrarını veya `--protocol d22b`
ile ilk v1 planını seçer. `--verify`, kaydedilmiş schema'dan yalnız kaynakta tanımlı
protokollerden birini seçer; değiştirilmiş plan veya bilinmeyen
schema reddedilir. Doğru protokol CLI'dan ayrıca sabitlenebilir.

Manuel [GitHub Actions workflow'unda](../.github/workflows/qe-mos2-acceptance.yml)
`protocol=d22b-extended` ve aynı iki hash seçilir (ilk v1 planı için `d22b`). Her noktanın yeni job ID'si,
ham QE/API dosyaları, sürüm/imaj ve kaynak hash'leri saklanır; başarısız
çıktılar da arşivlenir. API anahtarı kaydedilmez.

## Bu aşamadan sonra

D2.2b geçti; seçilecek yüksek kesme enerjisinde k-örgüsü ve vakumun kritik
karşılaştırmaları ayrıca doğrulanmalıdır. D2.2'nin 100 Ry'de geçen k/vakum
sonuçları 120 veya 140 Ry protokolünün yerine konulmaz. D3 `relax → scf`
ve kuvvet/geometri kabulü bu adımlardan sonra ele alınır.

## İlk koşu ve ön kayıtlı kaynak tekrarı

[İlk Linux koşusu](https://github.com/alorak/kristalyapi/actions/runs/40778844038),
`2eb352ac18c00d93d5a0bd4e28db1b8cef4cde9b` kaynağıyla 100 ve 120 Ry
SCF işlerini tamamladı. 100 Ry enerjisi önceki D2.2 ile tam aynı çıktı.
140 Ry işi 900 saniyede `timed_out` oldu; son hata tahmini 0.00045160 Ry,
`JOB DONE.` yok. Bu ilk koşuda 120→140 kapısı **belirlenemedi**;
son iterasyon enerjisi kabul enerjisi yerine kullanılmaz.
[İlk ham kanıtlar](../validation-results/qe-mos2-d22b-first-timeout-20261029-amd64/README.md)
ve eski v1/900 saniye planı değiştirilmeden korunur.

QE 140 Ry için en fazla 3.22 GB dinamik bellek öngörüyor; varsayılan
worker sınırı 2 GiB. Bu tahmin tek başına OOM veya swap kanıtı değildir;
zaman aşımı API kaydından doğrulanmıştır. Tekrarda yalnız kabul ortamına
6 GiB worker belleği, swap kapalı ve iş başına 3600 saniye verilir.
Üretim `compose.qe.yml`, solver girdileri, UPF baytları ve 1 meV/atom
ölçütü değişmez. Gerçek Docker bellek/swap sınırları ayrıca kaydedilip
hem koşuda hem offline denetimde kontrol edilir.

[Yeni sabit v2 planı](../tests/fixtures/qe/mos2-cutoff-extended-acceptance.json),
`--protocol d22b-extended` ile çalıştırılır; üç nokta da yeni API işleridir.
Bu plan tekrar başlamadan commit edilir. Eski `d22b` seçeneği v1 planını
kullanmaya devam eder. İkinci koşu **başarılı**; sonuçları yukarıda ve
[kalıcı kanıt paketinde](../validation-results/qe-mos2-d22b-20261029-amd64/INCELEME.md).

## Başarısız işlerin kod düzeyinde tanısı

Güncel kabul aracı, tamamlanmamış bir API işi için `failure.json` yazar:
terminal durum/job kimliği, son başlayan SCF iterasyonu, son hata tahmini,
girdi/kısmi çıktı SHA-256 ve ham `JOB DONE.` varlığı. Bu kayıt daima
`acceptance_eligible=false` taşır ve kabul enerjisi içermez. Özet rapor
`failed_case` alanıyla bu dosyaya bağlanır; hata mesajı `timed_out` gibi
somut API durumunu gösterir. Eksik veya bozuk metin çıktısı tanıyı bozmaz.

İlk koşu bu koddan önce çalıştığı için ham artifact değiştirilmez;
[yeni yardımcıyla sonradan türetilen tanı](../validation-results/qe-mos2-d22b-first-timeout-20261029-amd64/failure-analysis.json)
ayrı kaydedilmiştir. Başarılı ikinci fiziksel koşu `7a80999`
kaynağına sabittir; bu tanı eklemesi solver girdisini, başarılı iş denetimini
veya kabul eşiğini değiştirmez. Worker ayrıca zaman aşımında süre sınırını açıklayan bir API `error` mesajı
döndürür. API testi, ham başarı işaretlerine rağmen çalışmaya devam eden
sentetik süreç zaman aşımına uğradığında sonuç endpointinin 409 kaldığını
doğrular. Güncel **84 Python QE testi** geçti.
