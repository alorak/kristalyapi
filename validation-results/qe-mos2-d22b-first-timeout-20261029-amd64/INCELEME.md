# D2.2b ilk gerçek koşu — zaman aşımı

[Linux CI](https://github.com/alorak/kristalyapi/actions/runs/40778844038),
kaynak `2eb352ac18c00d93d5a0bd4e28db1b8cef4cde9b`, v1 sabit plan.
Bu klasördeki ham API/QE dosyaları artifact baytlarıyla aynıdır.

| ecutwfc/ecutrho, Ry | Son enerji, Ry | SCF hata tahmini, Ry | İterasyon | Durum |
| --- | --- | --- | --- | --- |
| 100/800 | -181.58134678 | 1.3e-09 | 18 | tamamlandı |
| 120/960 | -181.58162387 | 6.1e-09 | 16 | tamamlandı |
| 140/1120 | kabul enerjisi yok | 0.00045160 (kısmi) | 7. iterasyonda kesildi | 900 saniyede timed_out |

Tamamlanan iki işte ham QE/API enerji, 26 elektron, atom/hücre/k-örgüsü,
UPF ve girdi/çıktı hash kontrolleri geçti. Kaynak hash'leri koşu
kaynağıyla eşleşti. [Bağımsız inceleme](inspection.json).
100 Ry noktası önceki D2.2 enerjisi ve girdi hash'ini tam tekrarladı.
100→120 farkı 1.256667169 meV/atom; yalnız yardımcı karşılaştırmadır.

**120→140 Ry birincil kapısı belirlenemedi.** 140 Ry'de `JOB DONE.`
yok; kısmi iterasyon enerjisi toplam kabul enerjisi olarak kullanılmaz.
QE'nin tahmini en yüksek dinamik RAM gereksinimi 3.22 GB, eski worker
sınırı 2 GiB. Bu tahmin OOM/swap olduğunu kanıtlamaz; doğrulanan
sonlanma nedeni API'deki `timed_out` durumudur.

Aynı fiziksel plan, aynı eşik ve yeni üç API işiyle; yalnız kabul worker'ı
6 GiB RAM/swap kapalı ve iş süresi 3600 saniye olacak şekilde ayrı
v2 ön kaydı ve [tekrar koşusu](https://github.com/alorak/kristalyapi/actions/runs/40783454635)
oluşturuldu. İlk koşu başarısız kalır; bu dosyalar sonradan başarılı olarak
etiketlenmez.
