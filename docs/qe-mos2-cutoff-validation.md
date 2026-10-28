# D2.2b — MoS₂ kesme enerjisi yakınsaması

Bu belge ve [sabit plan](../tests/fixtures/qe/mos2-cutoff-acceptance.json)
gerçek koşudan önce kaydedilir. İlk D2.2'nin yedi vakası ve başarısız
80→100 Ry sonucu korunur. D2.2b yalnız kesme enerjisi kapısını yeniden
sınar; tek başına genel D2.2, relaksasyon veya elektronik yapı kabulü değildir.

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
kontrolleri zorunludur. Her iş için 900 saniye sınırı geçerlidir.
Ölçütler geçmezse durum başarısız kalır; daha yüksek ecut veya farklı
UPF seçimi ayrı, önceden kaydedilmiş bir deney gerektirir.

## Çalıştırma ve kanıt denetimi

```bash
python3 tools/qe_mos2_acceptance.py --run --protocol d22b \
  --mo-sha256 0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd \
  --s-sha256 90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4 \
  --output validation-results/qe-mos2-cutoff-local

python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-cutoff-local
```

`--run` varsayılanı hâlâ eski `d22` protokolüdür; yeni üçlü tarama açıkça
`--protocol d22b` ister. `--verify`, kaydedilmiş schema'dan yalnız kaynakta tanımlı
protokollerden birini seçer; değiştirilmiş plan veya bilinmeyen
schema reddedilir. Doğru protokol CLI'dan ayrıca sabitlenebilir.

Manuel [GitHub Actions workflow'unda](../.github/workflows/qe-mos2-acceptance.yml)
`protocol=d22b` ve aynı iki hash seçilir. Her noktanın yeni job ID'si,
ham QE/API dosyaları, sürüm/imaj ve kaynak hash'leri saklanır; başarısız
çıktılar da arşivlenir. API anahtarı kaydedilmez.

## Bu aşamadan sonra

D2.2b geçerse seçilecek kesme enerjisinde k-örgüsü ve vakumun kritik
karşılaştırmaları ayrıca doğrulanmalıdır. D2.2'nin 100 Ry'de geçen k/vakum
sonuçları 120 veya 140 Ry protokolünün yerine konulmaz. D3 `relax → scf`
ve kuvvet/geometri kabulü bu adımlardan sonra ele alınır.

## İlk koşu ve ön kayıtlı kaynak tekrarı

[İlk Linux koşusu](https://github.com/alorak/kristalyapi/actions/runs/40778844038),
`2eb352ac18c00d93d5a0bd4e28db1b8cef4cde9b` kaynağıyla 100 ve 120 Ry
SCF işlerini tamamladı. 100 Ry enerjisi önceki D2.2 ile tam aynı çıktı.
140 Ry işi 900 saniyede `timed_out` oldu; son hata tahmini 0.00045160 Ry,
`JOB DONE.` yok. Bu nedenle 120→140 kapısı **henüz belirlenemedi**;
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
kullanmaya devam eder. İkinci koşunun sonucu henüz bekleniyor.
