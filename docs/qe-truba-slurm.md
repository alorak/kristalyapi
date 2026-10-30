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

## Sonraki adımlar

- **P1.2 (henüz uygulanmadı):** Relax → SCF → NSCF → bant/DOS için açık
  kaynak/k-yolu/bant sayısı seçimleri, kontrol edilen aşama sınırları,
  `sbatch` aşama bağımlılıkları, ortak `prefix/outdir` yönetimi ve
  bağımsız QE kabul testleri. `tools/qe_pipeline.py` yerel çok aşamalı
  uygulama referansı olabilir fakat mevcut bağımlılıklarıyla
  TRUBA ZIP'inin içine otomatik kopyalanması doğru değildir.
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
