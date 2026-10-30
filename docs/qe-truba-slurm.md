# TRUBA / SLURM: çevrimdışı QE paketi (P0)

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

5. `structure.out` ve gerekirse `slurm-JOB_ID.err` dosyasını yerel
   bilgisayarınıza alın. DFT → Sonuçları incele alanından tamamlanmış
   `structure.out` içe alınabilir (mevcut arayüzde 16 MB dosya sınırı vardır).

## Paketin içeriği

- `structure.in`: uygulamanın mevcut ve aynı `qePwInputText` fonksiyonu tarafından
  üretilen QE girdisi (`pseudo_dir='./pseudo'`, `outdir='./tmp'`).
- `run.slurm`: `#SBATCH` kaynak bilgileri, TRUBA QE 7.4 modülü, OpenMP=1,
  `mpirun pw.x`, eksik UPF kontrolü ve eklenmiş UPF'ler için SHA-256 karşılaştırması.
- `manifest.json`: girdi SHA-256'sı, pseudopotansiyel adları, eklenme durumu,
  varsa UPF SHA-256'ları, kaynak ayarları; `execution_performed=false`.
- `pseudo/`: seçilmiş gerçek UPF dosyaları ve eksik dosya talimatı.
- `README.md`: pakete özgü komutlar ve bilimsel sınırlamalar.

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

## Sonraki adımlar

- **P1:** Python tabanlı sonuç toplama (`summary.json`, SCF/relax ölçüleri),
  girdi/UPF hash yeniden doğrulaması ve büyük çıktı için daha güçlü import.
- **P1:** Relax → SCF → NSCF → bant/DOS zinciri için çok aşamalı `sbatch`
  ve QE ara dosyalarının doğru korunması; eşdeğer Docker/QE sürümleriyle kabul testleri.
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
