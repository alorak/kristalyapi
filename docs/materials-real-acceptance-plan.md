# P1: Gerçek XRD + 3B QE kanıtına geçiş — bağımsız kabul protokolü

Bu doküman iki farklı eşiği ayırır: **(a) yazılımın gerçek veri üzerinde çalışması** ve **(b) laboratuvar/hesaplama fiziği sonuçlarının bağımsız bilimsel kabulü**. Bunlar aynı değildir.

## Mevcut, doğrulanmış durum

- Önceki [P1 XRD korpus denetleyicisi](../tools/xrd_acceptance.py) iki ayrı cihazdan her biri için referans standart ve kör numune CSV'si gerektirir. Ölçüm dosyaları, cihazın ham kalibrasyon günlükleri, sertifika ve operatörün imzalı çalışma kayıtları **bu depoda mevcut değil**.
- [IUCr CPD-QARR gerçek toz ölçüm arşivi](https://www.iucr.org/who-we-are/commissions/commission-on-powder-diffraction/projects/qarr/data) yararlı bir **bağımsız kamu verisi referansıdır**. Ancak sayfadaki çeşitli dosya biçimleri aynı veri setinin dönüşümleri; iki farklı fiziksel XRD cihazının ölçümleri değildir. Arşivin genel cihazı Philips 3020/PW3710, makalesinde Philips X'Pert olarak tanımlanır. Çelişkili ayrıntılar araştırmacı tarafından kaynak üzerinden çözümlenmelidir; iki cihaz şartı karşılanmış sayılmaz.
- NIST [SRM 640g sertifikasyon raporu](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.260-245.pdf) silisyum tozu için çizgi konumu ve şekli referansı sağlar. **Bir sertifikasyon raporunun bulunması, bu çalışma için gerçek standart numune ölçümü yapıldığı anlamına gelmez.**
- Repo geçmişinde **gerçek Si/MoS₂ QE** hesap çıktıları ve CI kanıtları vardır; bunlar **GaN/AlN/SiC 3B hesap yakınsaması** olarak yeniden adlandırılamaz.

## XRD fiziksel ölçüm kabulü

İki ayrı cihaz: A ve B. Her biri için aynı standart malzeme partisi ve birbirinden bağımsız hazırlanmış kör numune:
- Cihaz üretici/model, benzersiz seri no, bakım/kalibrasyon tarihi, dedektör, X-ray anodu, kV/mA, yarık geometrisi, Kα1/Kα2 işlenişi ve ölçüm saatleri kaydedilmeli.
- Ham cihaz dosyası (`.xrdml`, `.raw`, `.ras` gibi) **değiştirilmeden** SHA-256 ile sabitlenmeli; o dosyadan üretilen 2θ/intensity CSV'si **ayrı hash** olarak tutulmalı. Karşılaştırma için CSV gerekli ama tek başına ham cihaz kaydının yerine geçmez.
- Standart doğrulaması için sertifikanın kendisi ve laboratuvarın gerçekten o standardı ölçtüğünü gösteren örnek/operatör zinciri gerekir. Özellikle NIST SRM 640g için kullanılan parti ve ölçüm geometrisi raporlanmalı.
- Her cihazda standart/kör örnek kayıtları, birim ve dalga boyu, 2θ sıfır kayması, tekrarlanabilirlik ve pik-konumu hata bütçesi hesaplanmalı. Aynı dosyanın format dönüşümleri veya sentetik taramalar farklı cihaz sayılamaz.
- `python tools/xrd_acceptance.py --manifest cohort.json --output xrd-review.json`; sonra bağımsız aday için `python tools/xrd_candidate_review.py --manifest cohort.json --output xrd-candidates.json`.
- Bağımsız araştırmacı cihaz kimliklerinin, sertifikanın, gerçekten uygulanan ölçüm protokolünün ve körleme düzeninin doğruluğunu ayrıca değerlendirip imzalamalı. Çıktıdaki `scientific_acceptance:false` alanı bu aşamaya kadar değiştirilmemeli.

## Gerçek QE 3B hesaplar: aday girdiler, gerçek yürütme, sonra inceleme

`.github/workflows/qe-bulk-real.yml` yalnız `workflow_dispatch` ile **manuel** çalışır ve gerçek `pw.x` paketini Ubuntu deposundan kurar. Her seferinde bir malzeme: **GaN, AlN, SiC**. Beş elementin UPF dosyaları için program sabit resmi PSlibrary PBE URL'lerini kullanır; operatör **iki dosyanın gerçek SHA-256'sını işlemden önce bağımsız gözden geçirip** girdilere verir. Hash yanlışsa kaynak yürütülmez.

- GaN ve AlN için **wurtzite aday** 4 atomlu primitif hücre, SiC için **3C zincblende aday** 2 atomlu fcc primitif hücre. Parametreler yaklaşık başlangıç değerleridir. **Kaynak CIF ve kafes parametreleri bağımsız doğrulanmış değildir.** İş akışındaki `candidate-source.txt` açıkça böyle işaretlenir.
- Varsayılan dört aşama: 3B `4×4×4` SCF (60 Ry), `4×4×4` SCF (75 Ry), `6×6×6` SCF (60 Ry), ek `crystal_b` band yolu. Diğer değişkenler gibi bunlar **ön araştırma örnekleri**, fiziksel yakınsamanın garantisi değildir.
- Sağlanan UPF'lerin element başlıkları ve ham içerik SHA-256'ları denetlenir. Program `input_dft='PBE'` ile koşar; UPF içindeki XC, valans, relativistik durum ve önerilen cutoff uzman tarafından ayrıca incelenir.
- `tools/qe_bulk_execute.py --execute` gerçek çözümleyiciyi, açık verilen CPU ortamında çalıştırır; bütün girdileri, çıktıları, UPF'leri ve yürütücü hash'ini `validation-results/qe-bulk-run` dizinine kaydeder.
- `tools/qe_bulk_validation.py` tekrar hesaplama yapmadan dört ham kaydın SHA-256, atom/hücre, 3B k-mesh, UPF adı, QE logu, total-energy birim/nümerik yakınsama karşılaştırmalarını değerlendirir.
- GitHub Actions gerçek çıktı kanıt paketini sadece **30 gün** tutar. Deney sahibi dışarı indirip kalıcı, imzalı veri deposuna almalıdır.
- Kullanıcının kendi `pw.x` ortamında `tools/qe_bulk_real_protocol.py` ile de hazırlık yapılabilir. Komutlar: `python tools/qe_bulk_real_protocol.py --help`, `python tools/qe_bulk_execute.py --help`.

### Bağımsız fizik incelemesi: gerçek veri olmadan kabul yok

GaN/AlN/SiC için her birinde:
1. Faz/polimorf ve kafes koordinatlarını hakemli birincil kaynak veya referans CIF ile **karşılaştır**. Kullanılan yaklaşık başlangıç hücresi **deneysel kaynak yerine geçmez**.
2. PSlibrary ve/veya SSSP pseudopotansiyel kimliği, PBE/XC, atom başlıkları, valans ve cutoff'ları bağımsız denetle. [Quantum ESPRESSO resmi pseudopotansiyel rehberi](https://pseudopotentials.quantumespresso.org/) ve [SSSP](https://www.materialscloud.org/discover/sssp).
3. Enerji ve gerilim/kuvvet yakınsaması için daha yüksek `ecutwfc/ecutrho` ve yoğun k-grid referansları, yakınsamış hücre relaksasyonu, gerekirse spin/SOC, k-yolu simetrisi ve en az bir bağımsız tekrar gerekli.
4. Fonksiyonel kaynaklı bant aralığı hatası, deney sıcaklığı ve polimorf farkları açıkça tartışılmalı. Mikrodalga/anten cihaz verimi veya RF kazancı bu hesaplardan türetilmiş sayılmamalı.
5. Bağımsız reviewer **kimliği, kurum, inceleme tarihi, hakemlik protokol sürümü** ve imzalı sonucu; ham dosya digestleri üzerinden ayrı ve kalıcı biçimde saklanmalı. Yalnız bir runner'ın başarılı olması, bağımsız bilimsel hakemlik değildir.

**Şu anki durum:** Her iki gerçek XRD cihazında yeni ölçüm alınmadı, bu oturumda fiziksel QE/UPF koşusu yapılmadı ve kaynak/kristal+ yakınsama bağımsız kabulü verilmedi. Kod/dokümantasyon var; gerçek cihaz ve bilimsel iş ortamı gereksinimleri açık.

## Kullanıcı aksiyonu: fiziksel kanıt hazırlığı

Cihaz laboratuvarından A/B cihaz ham taramalarını (standart ve kör numune, toplam 4 dosya) ve sertifikalarını alın. QE için resmi PBE UPF'lerin beş elementte incelenmiş hash'lerini sağlayın, sonra GitHub > Actions > **Real 3D bulk QE GaN AlN SiC (operator-reviewed, manual)** > Run workflow üzerinden ayrı ayrı 3 malzemeyi çalıştırın. Nihai rapor, `scientific_acceptance=false` diyerek veri bütünlüğü/nümerik kapıları fiziksel kabulden ayırmayı sürdürür.
