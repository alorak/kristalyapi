# D5.3 — Tek aday, ölçümlü QE başlangıç pilotu (operatör onaylı)

Bu aşama D5.2'nin önceki başarısız dört vaka denetiminden farklıdır:
**yalnız açıkça onaylanırsa** tek MoS₂ adayı için QE `nstep=0`
başlangıç kontrolü yapabilir. Varsayılan komut **salt okunur plan** üretir,
Docker/QE/Slurm/HTTP çağırmaz. Bilimsel SCF veya relaksasyon yapmaz.

## Plan modu — güvenli varsayılan

```bash
python3 tools/qe_defect_metered_pilot.py --case pristine \
  --memory-gib 96 --scratch-gib 4 --cpus 2 --timeout-seconds 180

python3 -m unittest discover -s tests -p 'test_qe_defect_metered_pilot.py' -v
python3 -m unittest discover -s tests -p 'test_qe_defect_metered_verify.py' -v
```

Aracın eski D5.1 hazırlık dosyalarını, D3 kaynak kimliğini ve D5.2'nin
dondurulmuş OOM/hash kanıtlarını doğrulaması gerekir. 96 GiB **yeterli RAM
iddiası değildir**; yalnızca örnek bir operatör planlama değeridir.
İlk başarısız 6 GiB pilotta ölçülmüş tepe RAM yoktur. QE'nin bastığı
71,76–80,49 GB değerleri süreç başına `>` işaretli tahminlerdir.

## Gerçek pilot — yalnız uygun hesap sunucusundaki operatör

Aşağıdaki komut **gerçek kaynak tüketir**. Bu repodaki PR/CI tarafından
çalıştırılmaz. Önce uygun Docker Engine host/VM, gerçek RAM boşluğu,
disk/CPU, izolasyon ve lisansı incelenmiş UPF dosyalarını doğrulayın.

```bash
python3 tools/qe_defect_metered_pilot.py \
  --execute --acknowledge-resource-risk \
  --case pristine --memory-gib 96 --scratch-gib 4 --cpus 2 \
  --timeout-seconds 180 --architecture arm64 \
  --image sha256:21d4887dfe9a0fd2123beda7ba9847166b1b39b36fc448e498cb3ba9c2660f00 \
  --pseudo-dir /operatörün/kontrol-edilmiş/UPF-klasörü \
  --output /yeni/d5-3-tek-vaka
```

Üretilen `report.json` ve ham dosyaları ayrı bir komutla yeniden denetleyin:

```bash
python3 tools/qe_defect_metered_verify.py --output /yeni/d5-3-tek-vaka
```

Bu denetleyici Docker veya QE başlatmaz. Ham girdi, stdout, stderr,
metrik ve rapor hash'lerini; orijinal D5.1/D5.2 input kimliğini;
yalnız kanıtlı `initialized_only_metered` durumunu yeniden kontrol eder.
Rapor ve ham dosyaların birlikte değiştirilmesini önleyen bağımsız imza
ya da harici zaman damgası değildir.

İmaj, **mevcut yerel Docker image ID** olarak bulunmalı; otomatik pull
veya internet bağlantısı yoktur. Mimarisi ve imaj SHA-256'sı Docker
tarafında doğrulanır. Mo/S/O operatör UPF dosyaları hazırlık
manifestindeki hash'lerle karşılaştırılır. Yol ve komutlar shell'e
aktarılmaz. Çalışma sırasında:

- Tek ve sınırlı `docker create/start`, 16–512 GiB bellek,
  swap kapalı, 1–32 CPU, 30–900 saniye; `--network none`,
  `--read-only`, `no-new-privileges`, `--cap-drop ALL`,
  `--pids-limit 128`, giriş/UPF bağları salt okunur.
- Hesap scratch alanı sınırlı **tmpfs** olup cgroup belleğinden de
  tüketir; ayrı bir /work tmpfs'i ve writable /evidence dışa çıktı
  bağlaması bulunur. Tek vaka dışına geçilmez.
- Konteyner içindeki sarmalayıcı `pw.x`'i `nstep=0` ile başlatır,
  `memory.peak`, `memory.max`, `memory.swap.max`, `memory.events`,
  `cpu.stat`, scratch dosya sistemi ve wall time ölçümlerini kaydeder.
- Docker `inspect` bellek, swap, CPU, ağ izolasyonu, read-only kök,
  exit/OOM ve konteyner temizliğini teyit eder.
- `initialization.in/out/stderr`, `container-metrics.json`, Docker
  başlangıç günlükleri ve `report.json` saklanır. Ham eser hash'leri
  `report.json` içinde yazılır; orijinal D5.1/D5.2 klasörleri
  değiştirilmez. Çıktı dizini **yeni** olmalıdır, üzerine yazılmaz.

`initialized_only_metered` yalnız QE'nin gerçekten `JOB DONE.`
ile başlangıcı bitirdiği, doğru atom/elektron/416 bant raporladığı,
SCF/enerji üretmediği ve cgroup/izolasyon metrikleri tam olduğu durumda
verilir. `oom_observed`, `timed_out`, `invalid_initialization_proof`
ve `incomplete_resource_evidence` kabul değildir. OOM sırasında
cgroup sampler ölürse gerçek peak bilinmeyebilir; boşluk tahminle
doldurulmaz.

**Kritik sınır:** Başarılı `nstep=0` dahi tam SCF, relaksasyon,
DOS/PDOS, spin/elektron doluluğu, kuvvet/yakınsama veya defect formation
energy için kaynak/bilimsel kabul oluşturmaz. API'nin varsayılan
64 atom ve 128 bant sınırları değiştirilmez. Gerçek SCF denemesinden önce
MPI/OpenMP/rank dağılımı, iş başına bellek/CPU/scratch ve kimyasal
protokol için ayrı D5.4 kabul kaydı gereklidir.
