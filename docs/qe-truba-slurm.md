# TRUBA / SLURM: çevrimdışı QE paketi (P0–P1 sonuç toplama)

Kristal Yapı **DFT → Hesap hazırlığı → TRUBA / SLURM paketi** seçeneği, açık periyodik
kristal için **tek bir** Quantum ESPRESSO pw.x `scf` veya sabit hücreli `relax`
işi hazırlayıp ZIP indirir. Tarayıcıdan SSH, `sbatch`, API çağrısı, pseudopotansiyel
indirme veya DFT hesabı yapılmaz. Uygulama GitHub Pages üzerinde statik kalır.

## Kullanım

1. DFT hazırlık ekranında hesap türünü, ecutwfc/ecutrho, k-örgüsü, smearing/fixed,
   atomları ve gerekiyorsa sabit alt tabaka yüksekliğini ayarlayın. UPF haritasına
   her element için doğrulanmış **gerçek dosya adını** `Element=dosya.UPF` olarak yazın.
2. TRUBA hesap/proje adınızı, `orfoz` bölümünü, MPI görev sayısını (56/112) ve
   süreyi (1–72 saat) seçin. Buradaki kaynak sayıları **otomatik performans
   tahmini değildir**; tek düğüm profilinin başlangıç seçenekleridir.
3. UPF dosyalarını isteğe bağlı olarak tarayıcıda seçin. Adları birebir
   eşleşmeli; dosya başlığı/uzunluğu ve SHA-256'sı kontrol edilir, hiçbir
   sunucuya yüklenmez. UPF eklenmemişse ZIP yine hazırlanır ancak eksikler
   açıkça belirtilir; iş betiği bu dosyalar gelmeden QE'yi başlatmaz.
4. ZIP'i TRUBA'daki izinli scratch alanına aktarın ve orada çıkarın. İş
   betiğini **çıkarılmış paket kökünden** gönderin. Örnek:

   ```bash
   # VPN ve SSH bağlantısından sonra, kendi scratch dizininizde:
   unzip mos2_relax_truba.zip -d mos2-relax
   cd mos2-relax
   module avail 2>&1 | grep espresso
   # pseudo/ içinde tüm UPF'ler var mı doğrulayın.
   sbatch run.slurm
   squeue -u "$USER"
   sacct -j JOB_ID --format=JobID,State,Elapsed,MaxRSS,ExitCode
   ```

5. P1'de, `run.slurm` çalışması başarılı ya da başarısız biçimde sona
   ererken (Python 3 mevcutsa) `collect.py` otomatik çalışır. Çalışmazsa
   paket kökünde `python3 collect.py --bundle .` komutunu manuel kullanın.
6. `summary.json` dosyasını indirip **DFT → Sonuçları incele →
   TRUBA / SLURM sonuç özeti** alanında görüntüleyin.
   Küçük (≤512 KB) özet dosyası için ham 1 GiB çıktı aktarımı gerekmez.
   `structure.out` dosyasını bilimsel arşivde ayrıca koruyun; 16 MB altındaki
   ham çıktılar eski geometri önizleme alanında da açılabilir.
7. Kullanılan dosyalar veya `run.slurm` değiştiyse hash doğrulaması uyarı
   verir. `summary.json` veri kaynağının imzalı kanıtı değildir; aynı
   dizindeki dosyaları karşılaştıran yerel bir rapordur.

## Paketin içeriği

- `structure.in`: uygulamanın mevcut ve aynı `qePwInputText` fonksiyonu tarafından
  üretilen QE girdisi (`pseudo_dir='./pseudo'`, `outdir='./tmp'`).
- `run.slurm`: `#SBATCH` kaynak bilgileri, TRUBA QE 7.4 modülü, OpenMP=1,
  `mpirun pw.x`, eksik UPF kontrolü ve eklenmiş UPF'ler için SHA-256 karşılaştırması.
- `manifest.json`: girdi SHA-256'sı, pseudopotansiyel adları, eklenme durumu,
  varsa UPF SHA-256'ları, kaynak ayarları; `execution_performed=false`.
- `pseudo/`: seçilmiş gerçek UPF dosyaları ve eksik dosya talimatı.
- `README.md`: pakete özgü komutlar ve bilimsel sınırlamalar.
- `collect.py` (**P1**): Python standart kütüphanesiyle çalışan sonuç
  toplayıcı. `structure.out` akışını satır satır tarar (en fazla 1 GiB),
  toplam enerji (Ry/eV), kuvvet (Ry/Bohr), son SCF/relax yakınsama
  işaretleri, `JOB DONE.`, SLURM iş kimliği ve varsa çıkış kodunu
  `summary.json` dosyasına kaydeder. Girdi, UPF ve SLURM dosyasının
  SHA-256'larını yeniden hesaplar. Tam bir hesap dökümünü JSON'a gömmez.

ZIP standart "store" yöntemiyle üretilir (harici CDN/JavaScript kütüphanesi
yoktur); dosyalar sıkıştırılmadığından UPF boyutuna yakın ZIP beklenir.
Paket boyutu en fazla 96 MiB, tek UPF en fazla 24 MiB'dir.

## Sınırlar ve güvenlik

- İlk profil **yalnız** `orfoz` CPU kuyruğu, 1 düğüm, 56–112 MPI görevi ve en fazla
  72 saat ile sınırlandırılmıştır. Bu kaynak isteği küçük hücreler için ekonomik
  olmayabilir; gerçek erişim, uygun MPI yerleşimi ve tahsisleri kullanıcı kontrol eder.
- `module load apps/espresso/7.4-epw-5.9-oneapi-2024` TRUBA QE dokümanında
  gösterilen sürümdür. Canlı TRUBA ortamında modül adını, kuyruk ve hesap
  izinlerinizi mutlaka doğrulayın; bu sürüm, yerel Docker QE 6.7 ile aynı değil.
- UPF başlığı ve SHA-256 **bilimsel uygunluk onayı değildir**. Değerlik elektron
  sayısı, XC işlevseli, relativistik/spin tercihi, kesme enerjisi, k-örgüsü,
  vakum ve yakınsama ayrı doğrulanır.
- `run.slurm` önce UPF varlığını denetler, paketle eklenen UPF'lerde
  içerik hash'lerini de karşılaştırır; sonradan manuel yerleştirilen UPF'lerin
  içeriğini hash'e sabitlemez.
- Başarılı süreç çıkışı ve `JOB DONE.` gözlenmesi fiziksel yakınsama veya
  makale düzeyinde geçerlilik kanıtı değildir.
- ZIP içinde kullanıcı şifresi, SSH anahtarı, API token'ı veya otomatik
  TRUBA bağlantısı bulunmaz. Kullanıcının girdi olarak yazdığı SLURM hesap
  adı manifestte yer alır.

## P1 sonuç toplama kabul kapsamı

- **Uygulandı:** Python standart kütüphanesiyle çevrimdışı
  `summary.json` oluşturma, girdi / mevcut UPF / `run.slurm`
  dosyalarında hash denetimi, başarı ve hata durumlarının ayrımı,
  dosya boyutu sınırlamaları, tarayıcıda şema doğrulaması ve salt okunur
  özet görünümü. Başarısız işlerde de mümkünse özet üretilir.
- **Doğrulama düzeyi:** sentetik QE çıktı birim testleri. TRUBA'da
  gerçek zamanlı `sbatch` veya yüksek atomlu üretim koşumu yapılmadı.
- **Bilimsel sınır:** `completed` statüsü, son QE yakınsama işaretleri ve
  dosya hashlerinin eşleşmesini ifade eder. Kesme enerjisi, k-örgüsü,
  vakum, fonksiyonel, pseudopotansiyel veya fiziksel referansa göre
  **bilimsel yakınsamayı kanıtlamaz**. Hash yalnızca kaydedilen
  dosyalar arasındaki tutarlılığı gösterir, bağımsız bir dijital imza
  değildir. Elle konulan ve hash'i başta sabitlenmeyen UPF'ler için
  `unverified` statüsü kullanılır.

## P1.2 — Bant / DOS için aşamalı SLURM paketi

DFT → Hesap hazırlığı → TRUBA / SLURM paketi içindeki **P1.2 · Çok aşamalı
bant / DOS paketi** ayrıntılarını açın. Önceki P0/P1.1 `run.slurm`
tek iş ZIP'i aynen kullanılabilir; P1.2 bağımsız bir paket üretir.

P1.2 şu parametreleri **açıkça** alır: `nbnd` (1–10000), NSCF için
`kx ky kz` (1–48), `crystal_b` k-yolu (2–32 satır,
`etiket kx ky kz segment`, son satırda `segment=1`),
`Emin/Emax/DeltaE` (eV), Gaussian `degauss` (Ry). K-yolu
kristalin gerçek **karşılıklı örgü bazında** kullanıcı tarafından
belirlenmelidir; arayüzdeki örnek satırlar ilgili kristal için
otomatik yüksek simetri noktası değildir.

```text
G 0 0 0 20
X 0.5 0 0 20
L 0.5 0.5 0.5 1
```

Örnek yalnız **biçim göstermek içindir**. Doğru bant yolu, `nbnd`,
k-örgüsü, enerji referansı, doluluk/smearing, UPF XC-valans
uyumu ve fonon/optik yorumları için ayrıca bilimsel kontrol gerekir.

Paket yapısı:

- `structure.in`: ilk `scf` veya sabit hücreli `relax` QE girdisi.
- `pipeline.json`: sıra, kaynak profili, kullanıcı tarafından verilen
  elektronik parametreler, giriş ve betik SHA-256'ları, bilinen UPF
  hashleri.
- `pipeline.py`: yalnız standart Python 3 kütüphanesiyle çalışan
  yerel hazırlanma/kanıt/sonuç aracı; harici sunucuya istek atmaz.
- `submit.sh` ve `stages/*.slurm`: yalnız TRUBA üstünde, açık
  `bash submit.sh` komutuyla başlatılır. `sbatch --dependency=afterok`
  ile aşama başarılarına seri bağımlıdır; ortak QE `tmp/` dizinine
  paralel yazımı önler. Her aşamanın betiği, ayrılmış MPI görevlerini
  ve QE 7.4 modülünü açıkça seçer.
- `pseudo/`: istenirse ZIP'e eklenmiş gerçek UPF dosyaları. Eksikler
  yüklenmeden ilk hesap başlayamaz.
- Başarılı koşum sonrası `reports/<stage>.json`, `scf.out`,
  `bands.out`, `bands.dat.gnu`, `nscf.out`, `dos.dat`,
  `pdos.pdos_tot`, `pipeline-summary.json`.

İş akışı sırası:

```text
[relax] → SCF → bands (pw.x) → bands_pp (bands.x)
        → NSCF (pw.x) → DOS (dos.x) → PDOS (projwfc.x)
```

`relax` seçildiğinde `pipeline.py` yalnız tamamlanmış, BFGS
yakınsamış ve *crystal* son koordinatlarını içeren sabit hücreli QE
çıktısından yeni `scf.in` türetir. Atom sırası ve sayısı eşleşmezse
veya değişken hücre bilgisi tespit edilirse sonraki işi reddeder.
Bant ve NSCF aşamaları **SCF** girdisinden türetilir; ortak
`tmp/kristalyapi.save` QE ara verileri **silinmez**. Aşama başlangıcında
önceki rapordaki girdi/çıktı ve en güncel QE XML SHA-256'ları
yeniden kontrol edilir. Sonraki PW aşaması XML'i değiştirebileceği
için geçmiş hashler aşamaya ait kanıt olarak saklanır.

Örnek çalıştırma (VPN/SSH ile bağlandıktan sonra):

```bash
unzip si_truba_pipeline.zip -d si-pipeline
cd si-pipeline
# Eksik UPF'leri pseudo/ içine yerleştirip modül/kuyruk uygunluğunu kontrol edin.
bash submit.sh
cat submissions.txt
squeue -u "$USER"
sacct -j JOB_ID --format=JobID,State,Elapsed,MaxRSS,ExitCode
# Zincir bittikten sonra veya manuel kontrol için:
python3 pipeline.py summary
```

`pipeline-summary.json` dosyası **DFT → Sonuçları incele** ekranındaki
TRUBA özet alanına yerel olarak yüklenebilir. **Bu görünüm aşama
durumu ve kayıt sayılarını gösterir; bant/DOS grafiğini otomatik
oluşturmaz.** Ham `bands.dat.gnu`, `dos.dat` ve `pdos*` dosyaları
ayrıca saklanmalıdır; mevcut yerel `tools/qe_pipeline.py` aracı
farklı bağımlılıklarla elektronik sonuç dönüştürme özelliklerine
sahiptir ve bu bağımsız TRUBA ZIP'ine aktarılmamıştır.

Sınırlamalar: P1.2 yalnız kollineer olmayan spin/SOC içermeyen,
sabit hücreli, P1 açık atomlu frontend `scf/relax` girdileri içindir.
Kullanıcı UPF'lerinde SHA olmayan dosyalar özet içinde
`all_upfs_pinned=false` olarak işaretlenir. `afterok`, QE'nin
rapor edilen çıktı/tamamlanma işaretleri ve dosya hashleri
**bağımsız bilimsel doğruluk veya fiziksel yakınsama kanıtı değildir**.
İşleri otomatik yeniden deneme veya kalan kısımda otomatik
devam etme yoktur. Eski `submissions.txt` veya kilit varsa
tekrarlama önlenir; yeni hesap için yeni dizin/paket gerekir.
Gerçek TRUBA SLURM, MPI ve QE bilimsel kabul koşuları henüz yapılmadı.

## P1.3 — QE ham bant/DOS/PDOS çıktısından grafik JSON'una dönüşüm

**P1.3 dönüştürücüsünü dahil et** varsayılan olarak seçilidir. P1.2
aşamalı ZIP'ine ayrıca SHA-256 ile sabitlenmiş, yerel çalışan
`electronic.py` ve `qe_pdos.py` eklenir. `projwfc.x` çalışmasından
sonra, **projwfc aşaması başarılı sayılmadan önce**, şu komut çağrılır:

```bash
python3 electronic.py --bundle .
```

Başarılı dönüşümde `electronic-results.json` yazılır; bundan sonra
`pipeline.py finish projwfc` bu JSON'u eser olarak hash'ler ve
`pipeline-summary.json` üretilir. Tarayıcıda **DFT → Sonuçları incele
→ Bant, DOS ve PDOS** bölümünden `electronic-results.json` dosyasını
yükleyerek mevcut bant çizgilerini, DOS'u ve atom/element/orbital PDOS
katkılarını görüntüleyebilirsiniz. Dönüştürme yerel TRUBA Python'unda
olur, istemci sunucuya hesaplama veya UPF içeriği göndermez.

Dönüştürücü için girdiler: `bands.dat.gnu` (ayrı bant blokları, her
satırda k-uzaklığı ve enerji), `dos.dat` (enerji, DOS, integral),
`pdos.pdos_tot` (enerji, toplam DOS, projeksiyon toplamı) ve
`pdos.pdos_atm#N(X)_wfc#M(s|p|d|f)` (LDOS ve manyetik olmayan
m-projeksiyonları). `scf.in` nihai atom sırası ve periyodik hücre
metriğini verir. Önceki aşamaların tamamlanma raporlarının hash'leri,
girdi ve betik hash'leri ve atom/orbital PDOS toplam tutarlılığı denetlenir.

**Kabul edilme koşulları:** Kollineer spin-polarize olmayan veri; 3
sütunlu DOS/PDOS toplamı, 2 sütunlu GNU bant blokları, tüm atom/WFC
projeksiyon dosyaları ve kaynak ile tutarlı tek enerji ekseni.
\(nbnd\) ile gerçek bant sayısı eşleşmeli. `crystal_b` segment
noktası sayıları bant veri uzunluğuyla uyuşmalı. Yüksek simetri
düğüm çizgileri, ancak kullanıcının verdiği etikete karşılık gelen
örneklenmiş uzaklıklar **gerçek hücre metrikleriyle tutarlıysa**
çizilir; otomatik simetri tanısı yapılmaz. Fermi/vakum enerji kaydırması,
interpolasyon veya otomatik bant aralığı yorumu yapılmaz.

P1.4 ile grafik için **en fazla 300 seçilmiş bant ve 120.000 bant
örneği**, **20.000 DOS örneği** desteklenir. Kaynak `bands.dat.gnu`
için 96 MiB ve **4 milyon okunacak bant noktası**, PDOS için ayrıca
dosya/örnek bellek limitleri ve sonuç JSON için 16 MB sınırı vardır.
Bu kaynak sınırları bilimsel `nbnd` seçimi değildir. Çok büyük ham QE
çıktılarında dönüştürücü seçimini kaldırıp normal P1.2 paketini
çalıştırabilirsiniz.

## P1.4 — 300'den fazla hesaplanmış bantta grafik penceresi

DFT → Hesap hazırlığı → TRUBA → Çok aşamalı bant/DOS paketi alanında
`nbnd` tüm hesaplanacak bantların sayısıdır. **Grafikte ilk bant**
ve **Grafikte son bant** alanları yalnızca `electronic-results.json`
içindeki görüntüleme seçimini belirler. Örnek:

| Parametre | Örnek |
|---|---|
| Hesaplanan bant sayısı (`nbnd`) | 800 |
| Grafikte ilk bant (dahil) | 301 |
| Grafikte son bant (dahil) | 380 |
| Ham QE çıktısı | 800 bandın tamamı |
| Görselleştirilen bant eğrisi | 80 adet, özgün indeksleri 301–380 |

Yalnızca dönüştürücü açık olduğunda seçim etkindir. `nbnd ≤ 300`
ve toplam çizim yükü uygunsa iki alan boş bırakılabilir; mevcut P1.3
davranışında bütün bantlar çizilir. `nbnd > 300` için
başlangıç/bitiş **zorunludur**. Bant penceresi 1 tabanlı ve dahilidir:
`1 ≤ first ≤ last ≤ nbnd`, `last − first + 1 ≤ 300`.
Buna ek olarak seçilen bant sayısı × k-noktası sayısı en fazla
120.000, toplam hesaplanan bant sayısı × k-noktası sayısı en fazla
4.000.000 olmalıdır; büyük kaynaklar için JSON seçeneği kapatılabilir.

Dönüştürücü `bands.dat.gnu` dosyasını **baştan sona akışla tarar**;
seçilmeyen bantların tüm satırlarında k-uzaklığı, sonlu sayılar,
k-nokta sayısı ve tam `nbnd` eşleşmesi yine doğrulanır.
Bellekte yalnızca seçilen bant enerjileri saklanır. `bands`
alanında `band_index_start=301` ve `total_bands=800`
gibi özgün indeksler korunduğundan, DFT grafik başlığı ve CSV
bant adları fiziksel hesap bandı numarasını doğru gösterir.
**VBM/CBM veya Fermi seviyesine göre otomatik seçim yapılmaz.**
Enerji ölçeği, k-yolu ve bilimsel doğrulama kuralları değişmez.

P1.2/P1.3 eski paketleri (pencere alanı olmayan ve toplam ≤300 bant
içerenler) aynı biçimde çalışır. Aşama manifestindeki
`electronic.band_window` yalnız açık seçimde yazılır; Python
aşama doğrulayıcısı geçersiz/eksik sınırları, kaynak/çıktı
bütçesini ve SHA-256 eşleşmelerini reddeder.
Gerçek TRUBA üzerinde büyük sistem kabul testi hâlâ beklemektedir.

**Kanıt:** `truba_provenance` altında giriş ve manifest SHA-256,
kaynak dosya SHA-256'ları, UPF hash bütünlüğü durumu ve
`scientific_convergence_verified=false` korunur. Hash kayıtları
şifreli imza değildir ve fiziksel doğruluk/bağımsız yakınsama
testlerinin yerini tutmaz. Kullanıcının seçtiği `crystal_b` yolu,
öngörülen yüksek simetri sınıflandırmasının fiziksel uygunluğunu
ayrıca kontrol etmelidir. Dönüştürücü eksik/bozuk/spinli veriyle
başarılı rapor üretmez.

**Test sınırı:** Sentetik SCF/bands/DOS/atomik PDOS dosyaları ve
deponun gerçek spin-polarize Si QE DOS dosyası için hata kabul
testleri eklendi. Gerçek TRUBA modülünde uçtan uca P1.3 koşumu,
malzemeye özgü veri seti ve bağımsız fiziksel yakınsama **henüz
ölçülmedi**.

## Sonraki adımlar

- **P1.2 (uygulandı; TRUBA kabul testi bekleniyor):** Açık k-yolu,
  `nbnd`, NSCF k-örgüsü ve DOS genişliği/penceresiyle aşamalı SLURM
  ZIP; seri `afterok` bağımlılıkları ve yeniden kullanılan ortak
  `prefix='kristalyapi'` / `outdir='./tmp'`.
- **P1.3 (kodlandı; gerçek TRUBA kabulü bekleniyor):** Ham bant/DOS/PDOS çıktısını atomik projeksiyonlarla birlikte mevcut elektronik grafik JSON'una dönüştürme.
- **P1.2 gerçek TRUBA smoke ve bilimsel kabul (beklemede):**
  `sbatch`/MPI/QE modüllerinin doğrulanması, Si ve MoS₂ örneklerinde
  SCF/relax/bands/NSCF/DOS/PDOS dosya semantiği, bant yolu ve
  yöntem parametrelerinin bağımsız yakınsama testleri.
- **P2:** SLURM job array ile cutoff/k-point yakınsama ve MoS₂ kusur serileri,
  kaynak ve yöntem bazında bilimsel kabul raporları.
- **P3:** Kullanıcı onaylı VPN/SSH üzerinden iş gönderme/durum izleme; ayrı
  sunucu katmanı, kimlik yönetimi, güvenlik ve kuyruk yetkilendirmesi.

Bu P0 kodu, depodaki yalnız başlangıç (`nstep=0`) odaklı
`tools/qe_hpc_prepare.py` ve `tools/qe_hpc_init.py` paketinden
**ayrıdır**. Onların D5 kanıtlarını veya kabul koşullarını değiştirmez.

Resmî kaynaklar:

- [TRUBA Quantum ESPRESSO rehberi](https://docs.truba.gov.tr/2-temel_bilgiler/uygulamalar/QEspresso/index.html)
- [TRUBA kuyruklar ve kaynaklar](https://docs.truba.gov.tr/2-temel_bilgiler/hesaplama_kumeleri.html)
- [TRUBA SLURM betik özellikleri](https://docs.truba.gov.tr/2-temel_bilgiler/slurm-betik-ozellik.html)


## P1.5 — TRUBA kaynak uygunluğu ve fail-closed submit

- `orfoz` kuyruk profili için yalnız **56 veya 112** MPI görevine izin verilir; 57–111 gibi ara değerler reddedilir. [TRUBA kuyruk kuralları](https://docs.truba.gov.tr/1-kaynaklar/arf/arf_kuyruk_bilgisi.html).
- Paralel `pw.x` aşamaları `--ntasks=56/112 --cpus-per-task=1` kullanır. Seri `bands.x`, `dos.x`, `projwfc.x` aşamaları ise `--ntasks=1 --cpus-per-task=56` ile **56 çekirdek tahsis eder fakat 1 çekirdek kullanır**. Bu asgari orfoz tahsis koşulunu sağlar ama 55 çekirdek boş kaldığından pahalıdır; postprocessing birleştirme sonraki optimizasyondur.
- `bash submit.sh` ilk gerçek işten önce `python3 pipeline.py preflight` ile ZIP/UPF/hash bütünlüğünü ve eski çalışma kanıtlarını denetler, ardından **bütün 6/7 aşama** için `sbatch --test-only` çağırır. Tek bir test başarısızsa hiçbir gerçek iş gönderilmez. Bu denetim ilerideki kuyruk kota/hesap başarısını garanti etmez.
- `preflight` mevcut `submissions.txt`, `.submission-lock` veya dolu `reports/` dizinini reddeder. Yeni hesap için temiz bir dizin gerekir.
- Çalışma loglarına SLURM job/düğüm/görev/CPU bilgileri ve `module list` yazılır; hata yakalama tuzağı modül yüklemeden önce kurulur.
- **Henüz yapılmadı:** gerçek orfoz üzerinde iş gönderme, SLURM/MPI/QE 7.4 çalışması ve bağımsız bilimsel kabul. Seri postprocessing aşamalarını mevcut tahsis altında birleştirme ve güvenli aşama yeniden başlatma da açık işlerdir.


## P1.6 — Kontrollü postprocessing yeniden gönderimi

Yeni P1.6 ZIP paketinde SHA-256 ile sabitlenmiş `resume.sh` bulunur. Kullanıcı **açıkça** çalıştırmadıkça hiçbir işi göndermez. Yalnız seri `bands_pp` (`bands.x`), `dos` (`dos.x`) ve `projwfc` (`projwfc.x`) aşamalarından **bir kez** devam etmeye izin verir. `relax`, `scf`, `bands` ve `nscf` aşamalarında yarım kalmış `pw.x` hesabı **yeniden kullanılmaz**; QE `prefix.save` içeriği eksik/yazılır durumda olabileceğinden yeni temiz paket gerekir.

Örnek, `bands.x` henüz başlamamış veya başarısız olmuşsa:

```bash
# Önce orijinal submissions.txt içindeki tüm iş ID'lerini kontrol edin.
cat submissions.txt
squeue -u "$USER"
# Yanlış bağımlılık nedeniyle PENDING kalan eski işler için gerekli
# scancel komutlarını operatör kararıyla ve yalnız kendi job ID'lerinizde çalıştırın.
# Başarısız bant dosyalarını ve .out loglarını silmeyin; ayrı bir
# arşiv dizinine elle taşıyıp hashlerini ayrıca saklayın.
python3 pipeline.py resume-check bands_pp
bash resume.sh bands_pp
cat resubmissions.txt
```

- `resume-check`, mevcut `pipeline.json`, betik ve UPF hashlerini, orijinal `submissions.txt` sırasını, önceki aşamaların tüm tamamlanma raporlarını ve mevcut QE XML hashini kontrol eder.
- Devam edilecek aşamadan sonraki herhangi bir çıktı veya tamamlanmış rapor varsa reddeder. Kısmi çıktıların silinmesini veya üstüne yazılmasını **otomatik yapmaz**.
- `resume.sh`, orijinal işlerden hiçbiri `squeue` içinde aktif/pending değilse ve geriye kalan aşamaların tümü `sbatch --test-only` aşamasından geçerse yeniden `afterok` bağımlılık zinciri oluşturur.
- Orijinal `submissions.txt` korunur; yeniden gönderilen ID'ler `resubmissions.txt` içine yazılır. `.resume-lock` ikinci otomatik denemeyi engeller. Kısmi yeniden gönderim başarısız olursa güvenli biçimde yeni paket/operatör değerlendirmesi gerekir.
- **Sınırlama:** Bu akış gerçek TRUBA sisteminde test edilmemiştir. Restart XML hash eşleşmesi tek başına bütün wavefunction dosyalarının sağlamlığını kanıtlamaz; bu nedenle `pw.x` aşamalarında resume desteklenmemektedir.


## P1.7 — SLURM kaynak telemetrisi ve gerçek kabul kanıtları

P1.7 paketi `pipeline.py accounting` komutunu destekler. **Yalnız kullanıcı açıkça çağırdığında**, Python `subprocess.run([...], shell=False)` yoluyla salt okunur `sacct` sorgusu yapar. QE/Slurm işi göndermez, kuyruktaki işleri değiştirmez.

```bash
# İşi bitmiş/orijinal iş ID'leri için operatör tarafından:
python3 pipeline.py accounting > truba-accounting.json
# Bu dosya değişmeden arşivlenir; varsa resubmissions.txt içindeki
# manuel devam işlerinin kimlikleri de rapora dahil edilir.
```

JSON şeması `kristalyapi.truba-qe-accounting.v1` içerir. `submissions.txt` ve varsa `resubmissions.txt` güvenli, sıralı, sayısal SLURM job ID olarak doğrulanır. `sacct --parsable2 --noheader` sonuçlarından işin `State`, `ExitCode`, `ElapsedRaw`, `AllocCPUS`, `ReqMem`, `MaxRSS`, disk I/O ve `NodeList` alanları saklanır. `.batch` ve diğer step kayıtları ana iş satırından ayrı tutulur; bazı kurulumlarda **MaxRSS yalnız step satırında** bulunabilir. Bir işin muhasebe kaydı henüz erişilebilir değilse `status=partial` yazılır, sahte başarılı durum oluşturulmaz.

### TRUBA kabulünde saklanması gereken asgari dosyalar

1. Değişmeyen ilk ZIP, `pipeline.json`, gerçek UPF dosyalarının SHA-256 değerleri ve kullanılan `structure.in`.
2. Her aşamanın ham `*.in`, `*.out`, `logs/*.out`, `logs/*.err`, `reports/*.json` dosyaları; `submissions.txt` ve varsa `resubmissions.txt`.
3. `pipeline-summary.json`, `electronic-results.json`, `truba-accounting.json`; gerçek `bands.dat.gnu`, `dos.dat`, `pdos*`.
4. `module list` ve `pw.x` QE sürüm/derleme kaydı; TRUBA orfoz düğüm/hesap tahsisi ve `sacct` ölçümleri.
5. Önceden tanımlanmış bilimsel kabul ölçütleri ve bağımsız Si/MoS₂ referansları (aynı UPF, fonksiyonel, kesme enerjisi, k-örgüsü ve karşılaştırılabilir QE sürümü). Bu araç yalnız dosyaları raporlar; bilimsel kabulü **otomatik geçirmez**.

Öncelik önce **2 atomlu Si SCF → bands → NSCF → DOS/PDOS** smoke; ardından MoS₂ sabit hücreli relax ve 300+ bantlı büyük referanstır. TRUBA üzerinde gerçekten çalışmadan bu adımlara tamamlandı işareti verilmemelidir.


## P1.8 — Bilimsel kapasite ön kontrolü (UPF v2)

`python3 pipeline.py science-check` komutu ve `submit.sh` tarafından otomatik çağrılan `pipeline.py preflight`, `structure.in` içindeki `nat`, atom türleri, k-örgüsü ve `ecutwfc/ecutrho` değerlerini inceler. Hash doğrulaması geçmiş gerçek UPF v2 dosyasındaki `<PP_HEADER element=... z_valence=...>` özelliklerini okuyarak **nötr ve spin-polarize olmayan** hesap için asgari işgal edilen bant sayısını belirler:

`N_e = Σ (atom sayısı × UPF z_valence)`, `nbnd_min = ceil(N_e / 2)`.

- Bilinen UPF v2 değerlik sayılarıyla seçilen `nbnd` fiziksel olarak **yetersizse**, gönderim ön kontrolü başarısız olur; kaynak tüketmeden önce düzeltme istenir.
- Eski UPF, eksik `PP_HEADER` veya eksik valans metaverisinde elektron sayısı **tahmin edilmez**, `status=valence-unverified` döner; geriye uyumluluk için tek başına eski UPF nedeniyle gönderim engellenmez.
- `status=necessary-capacity-checked` yalnız **gerekli elektron kapasitesini** ifade eder, yeterli boş bant sayısını veya bilimsel yakınsamayı garanti etmez.
- `ecutrho ≥ ecutwfc > 0` kontrolü gerçekleştirilir, ancak UPF/XC işlevsel uyumu, PAW/ultrasoft özel cutoff koşulları, k-yolu, vakum, spin/SOC, manyetizma ve deneysel özellikler hâlâ **bağımsız inceleme gerektirir**.
- Bu aşamada yalnız dosya incelenir; yeni bir Quantum ESPRESSO hesabı veya SLURM işi çalıştırılmaz.


## P1.9 — İçe aktarılan sonuç ile etkin DFT girdisinin eşleşmesi

DFT → Sonuçları incele ekranındaki `summary.json`, `pipeline-summary.json` ve TRUBA P1.3 `electronic-results.json` dosyaları açıldığında uygulama aktif kristalden **mevcut DFT hazırlık ayarlarıyla** yeniden `structure.in` metnini üretir. HTTPS/WebCrypto SHA-256 ile kaydedilen **başlangıç girdi hash'i** karşılaştırılır ve üç durumdan biri açıkça gösterilir: `eşleşiyor`, `farklı`, `karşılaştırılamadı`.

Bu, **byte düzeyinde girdi + ayar eşleşmesidir**; sadece atom düzeninin geometrik kimliği veya bağımsız bilimsel geçerlilik garantisi değildir. Aynı kristalde farklı cutoff, k-örgüsü, atom sabitleme veya UPF dosya adları **farklı hash** oluşturabilir; bu beklenen davranıştır. İçe aktarılan belge üzerinde SHA değeri kullanıcı tarafından değiştirilebilir; JSON bağımsız imzalı değildir. Sonuçlar ve relaksasyon koordinatları mevcut kristale otomatik uygulanmaz.

Dosya seçimi/çalışma alanı SHA hesaplaması sırasında değişirse önceki sonuç görünümü kabul edilmez.

## P2.0 — Güvenli `squeue` sorgusu

`resume.sh` artık her orijinal işin durumunu sorgularken yalnızca boş çıktıyı değil, **`squeue` komutunun başarılı çıkış kodunu** da zorunlu tutar. SLURM kontrolcüsüne erişim reddi, zaman aşımı veya diğer `squeue` hatalarında `resume` **hiçbir `sbatch` çağrısı yapmadan** durur; geçici sorgu başarısızlığı işin tamamlandığı anlamına gelmez. Devam edilmeden önce küme bağlantısı düzeltilmeli, orijinal iş kimlikleri ve `sacct` kayıtları elle incelenmelidir.

## P2.1 — Bilimsel ön inceleme uyarıları ve süre profili

- UPF v2 `PP_HEADER` üzerinde bildirilen `functional`, isteğe bağlı `wfc_cutoff` ve `rho_cutoff` değerleri okunur. Aynı pakette fonksiyonel etiketlerinin farklı olması, açık `input_dft` uyuşmazlığı ve seçili kesme enerjilerinin UPF önerisinin altında kalması **uyarı** üretir; bunlar ölçülmüş cutoff yakınsaması değildir. `nbnd` için zorunlu elektron kapasitesi kontrolü eskisi gibi hata verir.
- Kaynak `K_POINTS` içinde `k_z=1` ve `CELL_PARAMETERS angstrom` varsa, hücre düzlemi normalindeki yüksekliği ve en büyük *kesirli z boş aralığı* hesaplanır. Bu aralık atomların sonlu boyutunu içermediği için **gerçek vakumun iyimser bir üst sınır göstergesidir**; 10 Å altında inceleme uyarısı gösterilir. `k_z=1` tek başına 2B malzemeyi kanıtlamaz.
- Aşamalı ZIP için yeni **Seri son işlemler süre sınırı** seçeneği `bands.x`, `dos.x`, `projwfc.x` işlerindeki `#SBATCH --time` değerini, ana PW süre sınırından ayrı belirler (1–72 saat). Varsayılan aynı süreyi kullanır; eski davranış korunur. Gereğinden kısa süre PDOS veya 300+ bant için işi sonlandırabilir; önce gerçek `sacct` sürelerini inceleyin.
- `pipeline.json` içinde `resource_estimate` ve `max_reserved_core_hours` alanları vardır. İkincisi her aşamanın çekirdek sayısıyla **talep edilen üst süre sınırının çarpımlarının toplamıdır**, gerçek CPU-zamanı tüketimi, hesap maliyeti veya kuyruğa girme tahmini değildir. Seri aşamalar hâlâ 56 CPU tahsis edip tek işlem kullanır; birleştirilmiş postprocessing henüz uygulanmadı.

Referanslar: [Quantum ESPRESSO UPF standardı](https://pseudopotentials.quantum-espresso.org/home/unified-pseudopotential-format), [TRUBA orfoz CPU kuralları](https://docs.truba.gov.tr/1-kaynaklar/arf/arf_kuyruk_bilgisi.html).

## P2.2 — İsteğe bağlı ortak fiziksel SLURM tahsisi (TRUBA üzerinde deneysel)

Aşamalı ZIP üretiminde **Ortak SLURM tahsisi** işaretlenirse ve MPI görev sayısı **56** ise, beklenen 6 veya 7 bilimsel aşama korunurken iş gönderim planı sırasıyla **SCF**, **bands + bands.x**, **NSCF + dos.x + projwfc.x** (isteğe bağlı en başta **relax**) olarak 3 veya 4 **fiziksel SLURM işi** oluşturur. Her mantıksal aşama hâlâ ayrı `prepare`, ham `*.in`/`*.out`, `finish` kanıtları ve `reports/<stage>.json` SHA-256 verileri üretir. Ortak tahsiste aynı SLURM job ID, `submissions.txt` içinde birden çok ardışık aşamaya atanır; `pipeline.py accounting` bu tekrarları **tek fiziksel iş** olarak yalnız bir kez `sacct` ile sorgular. Saklanan mantıksal iş eşleştirmesini farklı tahsisler olarak **toplamayın**.

İş bağımlılıkları **fiziksel gruplar arasında** `afterok` olarak zincirlenir; grup içindeki `pw.x`, `bands.x`, `dos.x`, `projwfc.x` komutları sırayla çalışır. `current_stage` ile başarısız aşama `reports/<stage>.failure.json` dosyasına yazılır. Normal koşumda `bands-coallocated.slurm` ve `nscf-coallocated.slurm` çağrılır; desteklenen operatör `resume.sh` akışı için SHA-256 ile sabitlenmiş eski **tek aşamalı** SLURM betikleri ZIP içinde tutulur. Başarısız `pw.x` aşamaları otomatik yeniden başlatılmaz.

**Sınırlar ve maliyet doğruluğu:**

- Ortak tahsis **yalnız 56 MPI görevi** için desteklenir; 112 görevi seçen kullanıcı ayrı seri planla devam etmelidir. Daha büyük 112-çekirdekli fiziksel grup, postprocessing sırasında gereksiz tahsisi artırabilir.
- `bands+bands.x` işi için `PW_saat + seri_saat`, `NSCF+DOS+PDOS` için `PW_saat + 2×seri_saat` ayırtılmış süre sınırları talep edilir; **72 saatten fazla** ise paket güvenli biçimde reddedilir. Tek işte maksimum saat, her aşamanın bağımsız çalışma zamanını garanti etmez; operatör `sacct` verileriyle değerlendirmelidir.
- **Kuyruğa gönderilen iş sayısı düşer; 56 çekirdek, seri son işlem boyunca da tahsisli kalır.** Bu nedenle daha az gerçek çekirdek-saat, daha iyi performans, daha düşük kuyruk süresi veya TRUBA kotası tasarrufu **kanıtlanmış değildir**. `max_reserved_core_hours` yalnız talep edilen tahsis-süre *üst sınırıdır*; gerçek kullanım için bağımsız `sacct` kayıtlarını kullanın.
- Varsayılan **işaretlenmemiştir**; geçmiş ZIP, tek aşamalı gönderim ve operatör resume davranışı korunur. Gerçek TRUBA ve QE koşumu ile Si/MoS₂ kabulü yapılmadan üretim doğrulaması iddia edilmez.

Quantum ESPRESSO paralel başlatma, MPI ve OpenMP davranışı çalıştırıldığı kurulumun `module` ve başlatıcı yapılandırmasına bağlıdır: https://www.quantum-espresso.org/Doc/user_guide/node19.html .
