# D2.2b gerçek kabul — kesme enerjisi kapısı geçti

[Linux CI](https://github.com/alorak/kristalyapi/actions/runs/40783454635)
**başarılı**, kaynak `7a80999b4c23fa0258326b5d7334a84e4f9a18ca`,
`d22b-extended` v2 planı. Bu klasörde ham QE/API artifact baytları korunur;
`inspection.json`, `comparison-to-d22.json`, `github-actions.json` ve bu
rapor indirme sonrası bağımsız inceleme kayıtlarıdır.

| ecutwfc/ecutrho, Ry | Toplam enerji, Ry | Son SCF hata tahmini, Ry | İterasyon | Toplam kuvvet, Ry/Bohr |
| --- | --- | --- | --- | --- |
| 100/800 | -181.58134678 | 1.3e-09 | 18 | 0.006070 |
| 120/960 | -181.58162387 | 6.1e-09 | 16 | 0.006000 |
| 140/1120 | -181.58168299 | 7.2e-09 | 16 | 0.006059 |

**Birincil 120→140 Ry farkı: 0.268122859
meV/atom ≤1.0 — geçti.** 100→120 Ry yardımcı farkı
1.256667169 meV/atom; birincil çift veya eşik
koşudan sonra değiştirilmedi. 100 Ry tekrarının önceki D2.2 ile enerji
farkı **0.0 meV/atom**; girdi/yapı/UPF hash'leri ve QE sürümü eşleşti.

Her üç iş yeni API job kimliğiyle çalıştı. Ham `JOB DONE.`, SCF yakınsama,
≤1e-8 Ry son hata, API/raw Ry-eV, atom/hücre/k-örgüsü, 26 nötr elektron,
staged Mo/S ve girdi/çıktı SHA-256 denetimleri tekrar geçti. Kaynak
hash'leri kayıtlı `7a80999` Git içeriğiyle doğrulandı. Docker gerçek worker
belleği ve memory+swap sınırı aynı **6442450944 bayt** (6 GiB; swap kapalı)
olarak kaydedildi. İş başına 3600 saniye sınırı; kaynaklar kaldırıldı.

İlk v1 koşusunun 140 Ry zaman aşımı ayrı klasörde korunur; buradaki
başarılı sonuçlar üç yeni hesaptan gelir. İlk iki enerjinin tekrarında da
fark yoktur. Sonraki kod eklemeleri yalnız tanı/hata açıklaması ve testleri
kapsar; bu koşunun solver girdileri ve kabul ölçütleri değişmez.

Bu kabul sabit ideal geometride, k=8×8×1 ve c=24 Å için **sonlu kesme
enerjisi duyarlılığıdır**. Seçilecek yüksek cutoff için k/vakum kontrolleri
ve D3 kuvvet/relaksasyon/geometri kabulü bekliyor. Tablodaki kuvvetler
relakse edilmiş yapı kanıtı değildir. İlk D2.2'nin başarısız 80→100 Ry
sonucu ve genel kabulün açık durumu korunur.

Tekrar bağımsız doğrulama:

```bash
python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-d22b-20261029-amd64 --protocol d22b-extended
```
