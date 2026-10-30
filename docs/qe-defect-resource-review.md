# D5.2 — Kaynak kanıtı denetimi ve çalıştırmasız RAM bütçesi değerlendirmesi

Bu araç **yeni bir Quantum ESPRESSO hesabı çalıştırmaz**. D5.1'deki
4×4×1 MoS₂ kusur adaylarının daha önce yapılmış, başarısız 416 bant
`nstep=0` başlangıç denemesini doğrulayıp bir **kaynak karar tablosu**
oluşturur. Araç Docker, `pw.x`, Slurm, ağ veya QE API uç noktası çağırmaz.
İşlerin başlatılması ve ajanlı denemeler daha sonraki ayrı aşamalardır.

```bash
python3 tools/qe_defect_resource_review.py --output /tmp/d5-resource-review.json
python3 tools/qe_defect_resource_review.py --budgets-gib 6,16,32,64,96,128
python3 -m unittest discover -s tests -p 'test_qe_defect_resource_review.py' -v
```

`--output` mevcut dosyayı **asla ezmez**. Varsayılan olarak JSON stdout'a
yazılır. `--pilot`, `--prepared` ve `--plan` ile doğrulama girdi yolu
açıkça verilebilir; her dosya boyut ve symlink/kaçış kontrollerinden geçer.

## Doğrulanan kanıt zinciri

1. Sabit 2026-10-29 ARM64 pilot kaynak commit'i, Docker imajı, 6 GiB /
   2 CPU / swap kapalı / 120 s / 416 bant kaydı; hazırlanmış
   `preparation.json` dosyasının sabit SHA-256 değeri ve Mo/S/O UPF
   kimlikleri.
2. `pristine`, `V_S`, `V_2S`, `O_S` sırası ve her adayın
   `initialization.in/out/stderr` içerik SHA-256 değeri, her vaka
   `inspection.json` ile ortak `summary.json` tutarlılığı.
3. Ham QE çıktısındaki atom, elektron, 416 Kohn–Sham durum sayısı,
   QE sürümü, bastırılmış bellek tahminleri; bunların bağımsız pilot
   incelemesindeki kayıtlarla karşılaştırılması.
4. Docker `OOMKilled=true`, exit 137, kaynak izolasyonu,
   `container_removed=true`; hiçbir enerji, SCF adımı veya yakınsama
   işaretinin bulunmaması.

Yanlış/eksik hash veya sayı, sahte hesap başarı bilgisi, değişmiş bellek
profili ve eski çıktıya eklenen enerji satırı **raporu reddeder**.
Bu doğrulama, birlikte değiştirilebilen tüm dosyalara karşı kriptografik
uzak taraf kanıtlaması değildir; bağımsız imzalı veri zinciri ayrı iştir.

## Bulgular ve bilimsel sınır

| Vaka | Atom | Elektron | Asgari dolu bant (spinsiz) | QE statik `>` GB | QE dinamik `>` GB | Deney |
|---|---:|---:|---:|---:|---:|---|
| pristine | 48 | 416 | 208 | 24,76 | 72,41 | 6 GiB OOM |
| V_S | 47 | 410 | 205 | 24,62 | 71,76 | 6 GiB OOM |
| V_2S | 46 | 404 | 202 | 33,85 | 80,49 | 6 GiB OOM |
| O_S | 48 | 416 | 208 | 25,02 | 72,16 | 6 GiB OOM |

**Önemli:** QE, tahminlerini *işlem başına* ondalık GB birimiyle, `>`
işaretiyle verir. Bunlar ne ölçülmüş tepe bellek ne de toplam MPI belleği
veya yeterli RAM garantisidir. 6 GiB sınırı ile karşılaştırma ikili
GiB → bayt çevrimiyle yapılır. `32/64/96/128 GiB` satırları **yalnız
hipotetik bütçelerdir**. Bir bütçe basılı alt sınırın üzerinde olsa bile
başlatma, tam SCF, relaksasyon veya DOS kabulü sağlanmış sayılmaz.

Asgari dolu bant sayısı nötr, spinsiz ve doluluğu tam kabul eden
elektron muhasebesinden gelir; kusurlarda doğru spin temel durumunu,
boş bant gereksinimini veya kimyasal kararlılığı **doğrulamaz**.
Mevcut elektronik API'nin 128 bant ve varsayılan 64 atom sınırı
**değiştirilmez**.

## Daha sonraki gerçek denemenin ön kayıt kapıları

Operatör ayrı olarak izin verdiğinde, ilk aday ve kaynak profili
önceden sabitlenmeli; gerçek host/cgroup bellek sınırı, scratch alanı,
MPI/rank, OpenMP thread, diagonalizasyon yöntemi, QE sürümü,
UPF ve görüntü hash'leri birlikte kaydedilmelidir. Ayrı ve izole
`nstep=0` pilotunda ölçülmüş cgroup bellek, exit/OOM, elapsed time
ve ham loglar tutulmalı; başarılı başlangıç olsa bile **tam SCF kaynak
kabulü sayılmamalıdır**. Aynı anda dört OOM denemesi otomatik
tekrar edilmemelidir.

Sonraki fizik aşamasında spin/doluluk alternatifleri, boş bant sayısı,
cutoff/k-örgüsü/süperhücre yakınsaması, BFGS relaksasyonu ve bağımsız
SCF kabul kapıları önceden tanımlanmalıdır. Bu pakette gerçek
DFT kusur enerjisi, PDOS, oluşum enerjisi veya bandgap üretilmemiştir.
