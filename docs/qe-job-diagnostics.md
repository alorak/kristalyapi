# QE iş tanısı ve kaynak raporu

API 0.4.2 ile `GET /api/v1/calculations/{job_id}/diagnostics` aynı iş
kimliği, Bearer anahtarı ve HTTPS/loopback kurallarıyla okunur. İş durumu
Yenile düğmesine basıldığında tanı paneli de güncellenir. Tanı verisi
bilimsel kabul veya hesap sonucu üretmez.

`reason_code` zaman aşımını, iptali, worker kesintisini, SCF yakınsamamasını,
DOS/PDOS grid uyuşmazlığını, disk yetersizliğini ve süreç sonlanmasını ayırır.
**OOM** yalnız iş süresince worker cgroup `memory.events:oom_kill` sayacı
artmışsa teyit edilir. Tek başına 137 veya SIGKILL yeterli değildir.
Sayaç mevcut değilse belirsizlik korunur.

Kaynak raporundaki bellek `memory.current` değerinin worker yoklama
noktalarındaki en büyük örneğidir; worker ve dosya önbelleğini de içerir.
Garantili tepe kullanım veya işlem RSS'si değildir. RAM ve ayrı swap
sınırları cgroup v2 dosyalarından okunur. Desteklenmeyen veya erişilemeyen
ölçümler `null` kalır; sıfır kullanılmış gibi gösterilmez. Çocuk süreç CPU
süresi worker'ın reaped-child rusage farkıdır; tek worker/tek iş düzeni içindir.

Aşama süreleri elektronik pipeline'ın ham manifestinden, SCF/relaksasyon
süreleri worker'ın monoton saatinden alınır. Canlı tanı atomik küçük bir
JSON yan dosyasıdır; veritabanına sonuç veya durum yazma kurallarını değiştirmez.
Ek örnekleyici thread kullanılmaz. Telemetri dosyası yazılamazsa mevcut
hesap sonucunun yerini bir telemetri hatası almaz. Eski işlerde ölçüm yoksa
`availability=unavailable` döner.

```sh
python -m unittest discover -s tests -p 'test_qe_job_diagnostics.py' -v
node --test tests/qe-job-diagnostics-view.test.mjs
```
