# KristalYapı — Quantum ESPRESSO yerel DFT yürütücüsü (M-P1 başlangıcı)

Bu belge KristalYapı web arayüzünde hazırlanan **Quantum ESPRESSO `pw.x`**
dosyasını Linux/Mac bilgisayarınızda veya Linux VM'nizde gerçek çözücüyle
çalıştırmayı anlatır. Tarayıcı GitHub Pages üzerinde statik çalışmaya devam
eder. Bu bir web API'si, kuyruk servisi, GPU otomasyonu veya DFT yerine geçen
AI modeli **değildir**.

**Makale:** Wang ve ark., *ACS Nano* (2022),
[DOI: 10.1021/acsnano.2c09209](https://doi.org/10.1021/acsnano.2c09209).
Yazarlar SIESTA 4.1 b4 ile PBE/DZP kullanmıştır; QE ile aynı sayısal girdileri
bire bir taşıyarak makaleyi yeniden üretmiş sayılmayız.

## Ön koşullar

- Python 3.10+ (standart kütüphane yeterlidir).
- Sisteminizde **gerçek** `pw.x` kurulumu: [Quantum ESPRESSO](https://www.quantum-espresso.org/).
  PATH üzerinde değilse `--pw /tam/yol/pw.x` kullanın.
- KristalYapı'nın DFT panelinden indirilen `relax` veya `scf` girdisi.
- O yapıda bulunan **her element için** uygun, geçerli **UPF** pseudopotansiyel
  dosyaları. Tarayıcının `Mo=Mo.UPF`, `S=S.UPF` gibi adlandırması gerçek
  dosyanın varlığı, kimliği ve uygunluğu anlamına **gelmez**.

## İş akışı

1. [KristalYapı](https://alorak.github.io/kristalyapi/) içinde kristali
   hazırlayın. MoS₂ için tek S–Mo–S tabakası, gerçek açık P1 süperhücresi ve
   uygun hesaplama vakumu seçildiğini **ayrı ayrı** doğrulayın.
2. Üst menüde **DFT → Hesap hazırlığı** bölümünde `relax` veya `scf` seçin;
   pseudopotansiyel dosya adlarını, k-ağını ve kesme enerjilerini ayarlayıp
   `.in` dosyasını indirin. Bu parametreler için yakınsama testi şarttır.
3. Yerel kopyanızda veya VM üzerinde aşağıdaki komutları kullanın.
   `/data/pp` klasörü, elinizde bulunan gerçek UPF dosyalarını içermelidir:

```bash
# Yalnız dosyaları ve manifesti hazırla; DFT çalışmaz.
python3 tools/qe_run.py \
  --input ~/Downloads/mos2_relax.in \
  --pseudo-dir /data/pp \
  --workdir ./runs/mos2-relax-001

# Gerçek Quantum ESPRESSO'yu çalıştır. YENİ/BOŞ iş dizini seçin.
python3 tools/qe_run.py \
  --input ~/Downloads/mos2_relax.in \
  --pseudo-dir /data/pp \
  --workdir ./runs/mos2-relax-002 \
  --pw pw.x --timeout 14400 --run
```

Yürütücü `subprocess` ile **kabuk kullanmadan** `pw.x -in structure.in`
komutunu başlatır. Her çalışma yeni ayrı bir dizindedir; önceden mevcut
dosyaların üstüne yazmaz ve pseudopotansiyelleri ağdan indirmez.

## Üretilen dosyalar

| Dosya | İçerik |
| --- | --- |
| `run.json` | `prepared`, `completed`, `not_converged_or_incomplete`, `timeout` veya `execution_error` durumu; hesaplama ve dosya köken bilgileri |
| `structure.in` | Orijinal QE girdisinin kopyası |
| `pseudo/*.UPF` | Gerçek pseudopotansiyel dosyalarının kopyası ve manifestte SHA-256 özeti |
| `structure.out` | Gerçek `pw.x` stdout, ancak `--run` verilirse |
| `structure.stderr.txt` | Çalıştırma hataları |
| `tmp/` | QE'nin kendi geçici çıktı klasörü (büyük olabilir) |

`completed` yalnızca başarılı süreç çıkışı, `JOB DONE.`, son toplam enerji,
SCF yakınsama göstergesi ve `relax` için iyonik yakınsama ile nihai koordinatlar
birlikte görülürse raporlanır. Bu kontrollere rağmen sonuç **bilimsel olarak
yakınsamış/doğru olduğu kanıtlanmış** sayılmaz.

`structure.out` dosyasını KristalYapı'daki **DFT → Sonuçları incele →
Tamamlanan hesabın sonucunu oku** alanında açabilirsiniz. Sadece görüntülenen
enerji ile farklı atom sayılı yapıların oluşum enerjisi karşılaştırılamaz:
kimyasal potansiyeller, kusur yükleri ve hücre düzeltmeleri de gerekir.

## Kapsam ve sınırlamalar

- Bu ilk sürüm **tek bir `pw.x` girdisini** çalıştırır. Otomatik
  `relax → scf → nscf → bands → projwfc.x` zinciri, AiiDA/HPC kuyruğu,
  otomatik yakınsama, SIESTA uyarlaması ve bant/PDOS grafikleri sonraki
  paketlerdedir.
- İzin verilen girdi alt kümesi KristalYapı'nın geçerli `scf`/`relax`,
  `ATOMIC_POSITIONS crystal`, `K_POINTS automatic`, `./pseudo` ve `./tmp`
  biçimidir. Rastgele el yazımı QE girdileri veya ileri yöntemler için genel
  QE arayüzü olarak kullanılmamalıdır.
- `run.json` araştırma manifestidir; gerçek laboratuvar sonucu, UV ışınlama
  simülasyonu, fotolüminesans veya tek-foton emisyonu kanıtı değildir.
- Yürütücü hiçbir genel ağ servisi açmaz. Güvenilmeyen kullanıcılara
  rastgele QE girdisi çalıştırma yetkisi verilmemeli; sunucuya açılacaksa
  ayrı kimlik doğrulama, sandbox, kota ve görev kuyruğu gerekecektir.
- Makaledeki **deneysel vakum**, periyodik hücreye eklenen z-yönü boşlukla
  aynı şey değildir.

## Geliştirici testleri

```bash
python3 -m unittest discover -s tests -p 'test_qe_runner.py' -v
```

Bu testler **sahte bir çalıştırılabilir dosya** kullanır; işlem yönetimini,
UPF güvenliğini, sonuç metninin değerlendirilmesini ve başarısız senaryoları
kontrol eder. QE kurulumunu ve gerçek MoS₂ DFT hesaplamasını test etmez.

Resmî girdiler ve yürütme: [Quantum ESPRESSO PWscf User Guide](https://www.quantum-espresso.org/Doc/pw_user_guide/node7.html).
