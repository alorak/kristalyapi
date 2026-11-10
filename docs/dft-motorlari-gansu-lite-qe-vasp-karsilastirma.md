# GANSU Lite, Quantum ESPRESSO ve VASP: özellik, performans ve KristalYapı entegrasyonu

> **Durum:** Teknik değerlendirme / geliştirme önerisi (10 Kasım 2026). Bu belge yeni bir çözümleyici entegrasyonu, gerçek benchmark veya bilimsel doğrulama yapıldığını iddia etmez. Mevcut kaynak kodu, resmi belgeler ve KristalYapı'nın mevcut sınırları esas alınmıştır.

## 1. Yönetici özeti

**Üç çözümleyici doğrudan birbirinin yerine geçmez.**

- **GANSU Lite:** Sonlu, çoğunlukla küçük moleküler sistemler için Gaussian tipinde atom-merkezli bazlar kullanan, JavaScript / Rust-WebAssembly tabanlı **tarayıcı içi** kuantum kimyası. RHF/UHF/ROHF, RKS/UKS/ROKS, moleküler DFT, bazı post-HF ve uyarılmış durum yöntemleri sunar. **Periyodik kristal DFT motoru değildir.**
- **Quantum ESPRESSO (QE):** Düzlem dalga + pseudopotansiyel/PAW tabanlı, açık kaynak, periyodik malzeme fiziğine odaklı kapsamlı bir ekosistem. Geometri, SCF, elektronik yapı, spin, fonon/DFPT, NEB, moleküler dinamik ve XSpectra gibi modüller sağlar.
- **VASP:** Düzlem dalga/PAW ağırlıklı, lisans gerektiren, malzeme hesaplamalarında olgun bir platform. Geometri, magnetizma/SOC, NEB, MD, fonon, hibrit DFT, GW/BSE ve ilgili ileri yöntemlerde güçlüdür.

**KristalYapı için karar:** Mevcut QE iş akışını koru; GANSU Lite'ı **isteğe bağlı, küçük sonlu moleküller için tarayıcı motoru** olarak ekle; VASP'ı yalnızca kullanıcıya ait, uygun lisanslı kurulum için **dış hesaplama/sonuç içe aktarma adaptörü** olarak tasarla. Senkrotron **X-ışını Raman spektroskopisi (XRS/NRIXS)** için bu üç üründen hiçbirini tek başına tam bir XRS çözümü sayma.

**Kapsam dışı:** Belirli GPU modeli/sunucu yapılandırması, donanıma özel hız tahminleri, GPU-native **GANSU** projesinin performansını GANSU Lite'a mal etme ve ölçülmemiş süre/hızlanma iddiaları.

## 2. Yetenek matrisi

| Başlık | GANSU Lite | Quantum ESPRESSO | VASP |
| --- | --- | --- | --- |
| Temel ayrıklaştırma | Atom-merkezli Gaussian bazlar | Düzlem dalga + NC/USPP/PAW | Düzlem dalga, ağırlıklı PAW |
| Esas model | Sonlu molekül/küme | Periyodik kristal, yüzey/slab; vakumlu molekül de mümkün | Periyodik kristal, yüzey/slab; vakumlu molekül de mümkün |
| Girdi | XYZ + yük, çokluk, .gbs | CELL/ATOMIC_POSITIONS, pseudopotansiyel, k-örgüsü | POSCAR, POTCAR, INCAR, KPOINTS |
| SCF / geometri optimizasyonu | Evet | Evet | Evet |
| Açık kabuk / kollineer spin | UHF/UKS/ROHF/ROKS | Evet | Evet |
| Nonkollineer spin / SOC | Belgelenmiş yerleşik destek yok | Evet, uygun UPF/protokol ile | Evet |
| LDA / GGA / hibrit | Var; bazı uygulamalar sadeleştirilmiş | Var; yöntem/sürüm/pseudopotansiyel sınırlamalarıyla | Var; geniş iş akışı |
| DFT+U | Yerleşik değil | Var | Var |
| MP2/MP3/CCSD | R/U/RO varyantları belgelenmiş | Genel PW iş akışının ana özelliği değil; ilgili ekosistem ayrı | MP2 var; GANSU'nun MP3/CCSD kapsamıyla eşit değil |
| CIS / ADC(2) / TDDFT | Var (belirtilen yöntem/uygulama) | TDDFPT ve ekosistem | TDDFT / uyarılma yöntemleri |
| Band / k-yolu / periyodik DOS | **Yok** | Evet | Evet |
| Moleküler orbital ve Mulliken/Löwdin | Evet | Projeksiyon/son işlemle farklı yorum | Projeksiyon/son işlemle farklı yorum |
| Fonon / titreşim | Moleküler Hessian/frekans ve IR | DFPT, fonon dispersiyonu; Raman seçenekleri | Fonon ve titreşim; Raman iş akışı sürüm/yönteme bağlı |
| NEB / difüzyon bariyeri | Yerleşik NEB yok; PES taraması NEB değildir | PWneb / `neb.x` | NEB / CI-NEB |
| Ab initio MD | Genel amaçlı AIMD yok | Evet | Evet |
| XAS / çekirdek düzeyleri | Yerleşik değil | XSpectra (uygun kenarlar/yöntemler) | Çekirdek deliği/BSE yaklaşımları |
| Tam momentum-transferli XRS/NRIXS | Yerleşik değil | Standart XSpectra ile eşdeğer değil | Standart XAS/BSE ile eşdeğer değil |
| Çalıştırma | Tarayıcı, JS/WASM/Web Worker | Yerel/uzak işlem, MPI/OpenMP, uygun sürümlerde hızlandırıcı | Yerel/uzak işlem, MPI/OpenMP, uygun sürümlerde hızlandırıcı |
| Lisans | BSD-3-Clause | GPL/açık kaynak | Kurumsal/akademik/ticari kullanım için lisans gerekir |
| KristalYapı entegrasyonu | İstemci içi `Web Worker` adaptörü | Halihazırda API/iş akışı var | Kullanıcıya ait lisanslı kurulumla dış adaptör |

**Önemli yorumlar:**

1. **Periyodik yapı ile molekülü ayırın.** GANSU Lite'ın hesapladığı sonlu, kenarları passivasyonlu grafen parçası; QE/VASP'taki sonsuz periyodik grafen tabakasıyla aynı fiziksel model değildir. Aynı moleküler referansı kıyaslamak için QE/VASP'ta yeterli 3B vakumlu hücre kurulmalı, periyodik görüntü etkileşimleri kontrol edilmelidir.
2. **Yöntem adı aynı olduğunda bile denklem/uygulama birebir aynı olmayabilir.** GANSU Lite'ın kendi belgeleri PBE korelasyonunun VWN5 yerel kısmını kullandığını (standart PBE'deki PW92 ile aynı değil) ve bazı aralık-ayrımlı fonksiyonellerin “lite” yaklaşımı olduğunu belirtir. **GANSU Lite PBE ≡ QE/VASP PBE** diye varsayılmamalıdır.
3. **Moleküler Raman ile XRS farklıdır.** GANSU Lite'ın titreşim/frekans ve IR özellikleri, çekirdek elektron geçişlerinden kaynaklanan senkrotron XRS'yi hesaplamaz. Aynı ayrım optik Raman, XAS, XANES ve XRS arasında da korunmalıdır.
4. **VASP ≠ varsayılan olarak daha doğru.** Uyumlu Hamiltonyen, iyi yakınsamış baz, uygun pseudopotansiyel/PAW, spin/elektronik durum ve fiziksel doğrulama olmadan kod adı doğruluk ölçütü değildir.

## 3. Hesaplama performansı ve ölçeklenebilirlik

### 3.1 Neden tek bir “en hızlı” sıralaması yok?

- **GANSU Lite**, Gaussian baz fonksiyonları, Coulomb/exchange integralleri, RI-J ve seçilmiş WASM/SIMD çekirdekleriyle moleküler SCF çözer. Tarayıcıda kurulum ve veri gönderme maliyeti düşüktür; ancak kullanıcı cihazının bellek, CPU ve tarayıcı sınırlarına tabidir.
- **QE/VASP**, periyodik sınır koşullarında düzlem dalga/FFT, k-noktası örneklemesi ve geniş paralel hesaplama altyapısı kullanır. Büyük slab ve süperhücreler için doğal tercihtir; çok küçük moleküllerde baz/pseudopotansiyel/vakum hazırlığı daha zahmetli olabilir.
- Atom sayısı tek başına yeterli ölçek ölçütü değildir: **Gaussian baz fonksiyonu sayısı**, valans/çekirdek elektron seçimi, düzlem dalga kesmesi, FFT ızgarası, bant ve k-noktası sayısı, fonksiyonel, spin, özdevinim ve yakınsama toleransları birlikte raporlanmalıdır.
- Hibrit DFT, MP2/CCSD, GW/BSE, NEB ve AIMD'nin maliyetleri karşılaştırılamayacak kadar farklıdır. Bir kodun yöntem sunması onun büyük girdide pratik süre/bellekle çalışacağını kanıtlamaz.

### 3.2 Karmaşıklık ve bellek

Gaussian bazlı yöntemlerde **naif** dört indeksli elektron-itme integralleri `O(M^4)` sayıda eleman doğurur (`M`: baz fonksiyonu sayısı). Float64 tam tensör için teorik bellek `8 M^4` bayttır. **Bu GANSU Lite'ın gerçek bellek kullanım formülü değildir:** permütasyon simetrisi, integral eleme, RI ve diğer algoritmalar maliyeti değiştirebilir. Dolayısıyla bu ifade bir ölçeklenme uyarısıdır, benchmark değildir.

Düzlem dalga kodlarında da bellek otomatik olarak düşük değildir: boş bantlar, yoğun k-örgüleri, hibrit exchange, GW ve büyük vakum kutuları maliyeti ciddi şekilde artırabilir.

### 3.3 Mevcut yayımlanmış göstergeler ile açık boşluk

GANSU Lite README'sindeki küçük referanslar PySCF'ye karşı **doğruluk** kıyasları sunar; aynı problemi QE/VASP ile eş koşullarda çözen bir **üçlü süre/bellek benchmarkı sunmaz**. Örnek: belgelenen 17 kapalı kabuk karşılaştırmasında SVWN/BLYP/B3LYP için `< 0.05 mHa`, PBE/PBE0 için `0.2–2.6 mHa` enerji sapması; bu sonuçlar Ni içeren açık kabuklu bir GQD'nin doğruluğunu kanıtlamaz. GANSU Lite ayrıca TPSS ve geniş bazlı yinelenen görevler için maliyet kısıtları uygular.

**Bu belgede ölçülmemiş hızlanma, saniye veya yüzde kullanılmıyor.** Başka bir proje olan GPU-native “GANSU”nun performans sonuçları **GANSU Lite'a aktarılmamalıdır**. QE/VASP için mutlak bir kazanan belirtmek için eş donanım + eş fiziksel model + yakınsama hedefiyle gerçek ölçüm gerekir.

### 3.4 İki kollu adil benchmark protokolü

**Kol A — sonlu molekül: üçlü kıyas mümkündür.**
- Referans seti: `H2O`, `C6H6`, H ile passivasyonlu küçük C–N karbon kümesi ve mümkünse küçük Ni–N–C kompleksi. Ni kompleksini yalnız uygun spin ve baz/pseudopotansiyel doğrulaması geçtikten sonra dahil edin.
- Tek geometri ve yük/çokluk; QE/VASP için yeterli vakum, `Γ`-nokta, görüntü-etkileşimi ve gerekirse yük düzeltmesi.
- Önce **aynı metodolojik aile** içinde referans: RHF ile HF; yarı-yerel DFT ile yarı-yerel DFT. GANSU Lite'ın PBE varyantı tam aynı olmadığı için sayısal farkı açıkça işaretleyin.
- Ölçümler: soğuk/ılık başlangıç, SCF iterasyonu, yakınsama durumu, duvar saati, tepe RAM, tam girdi/profil, enerji ve kuvvet farkları. Tek seferlik koşum yerine tekrarlı deneme + dağılım raporlayın.
- Aynı elektronik durum ve geometri elde edilmeden enerji farkını “kod hatası” veya “daha doğru” diye yorumlamayın.

**Kol B — periyodik kristal: yalnız QE–VASP kıyası anlamlıdır.**
- Referans seti: bulk Si, periyodik grafen, basit slab; sonra Ni katkılı ve Li adsorbe grafen süperhücresi.
- Tutarlı XC fonksiyoneli, spin, dispersiyon, hücre, k-örgüsü, smearing, geometrik kısıtlar; ayrı baz/ecut/PAW-pseudopotansiyel yakınsama serileri.
- Ölçümler: enerji **farkları** (adsorpsiyon/relaksasyon), kuvvetler, geometri, SCF ve toplam iş süresi, RAM, yakınsama maliyeti; NEB için görüntü sayısı ve bariyer kararlılığı.
- GANSU Lite bu periyodik seride **“desteklenmiyor”** olarak gösterilmeli; başarısız bir performans skoru verilmemelidir.

**Önerilen sonuç tablosu şeması**

| Alan | Anlam |
| --- | --- |
| `model_id`, `model_kind` | Molekül / periyodik ve atom sayısı |
| `engine`, `version`, `build` | Çözümleyici ve derleme kimliği |
| `functional`, `basis_or_pseudo` | Yöntem, baz veya UPF/POTCAR kimliği |
| `charge`, `multiplicity`, `spin` | Elektronik durum |
| `cutoff`, `kmesh`, `vacuum` | Periyodik model ayrıntıları (uygunsa) |
| `scf_threshold`, `force_threshold` | Yakınsama eşikleri |
| `converged`, `iterations`, `wall_s` | Başarı, iterasyon ve zaman |
| `peak_memory_bytes`, `energy_ev` | Bellek, enerji ve birimler |
| `force_max`, `input_sha256` | Kuvvet metriği, girdi bütünlüğü |
| `evidence`, `warnings` | Ham çıktı/referanslar, bilimsel uyarılar |

## 4. Ni–N-GQD / Li-iyon anodu araştırmasına uygulanabilirlik

| Soru / iş | GANSU Lite | QE | VASP |
| --- | --- | --- | --- |
| Küçük, sonlu N-GQD yapısı | Ön tarama mümkün | Mümkün | Mümkün |
| Ni–N koordinasyonu ve alternatif spin çoklukları | Ni bazları mevcut; **bağımsız doğrulama şart** | Uygun protokolle | Uygun protokolle |
| Li adsorpsiyonu ve enerji farkı | Küçük sonlu modelde ön sonuç; yakınsama şart | Tercih edilen esas hesap | Tercih edilen alternatif |
| Li göçü / CI-NEB | Yerleşik NEB yok | Var | Var |
| Elektronik durumlar | Moleküler MO / yükler | Bant, DOS/PDOS (periyodik modelde) | Bant, DOS/PDOS |
| C/N K-edge XAS/XANES | Yerleşik değil | XSpectra ve ek araçlar | Çekirdek deliği/BSE iş akışı |
| `S(q,ω)` türü tam XRS | Yerleşik değil | Özel XRS çözümleyicisi gerekir | Özel XRS çözümleyicisi gerekebilir |
| Sıcaklık/dinamik kararlılık | Genel AIMD yok | AIMD | AIMD |

- **GQD ile grafen tabakasını eşitlemeyin:** Sonlu kuantum noktaları kenar durumları ve pasivasyondan etkilenir. Çok küçük moleküler modelden çıkarılan kapasite/difüzyon genellemeleri için boyut duyarlılığı incelenmelidir.
- **Ni için spin kritiktir:** Farklı başlangıç spin çoklukları, `⟨S²⟩` ve total enerji kontrol edilmeli; tek SCF yakınsaması manyetik temel durum kanıtı değildir.
- **Li adsorpsiyonu:** `E_ads = E(host+Li) - E(host) - E(Li_ref)`. Li atomu referansı ile metalik Li kimyasal potansiyeli referansı farklı termodinamik sorulara cevap verir; seçimi ve düzeltmeleri açık yazılmalıdır.
- **XRS ayrımı:** Klasik titreşim Raman bantları, XAS ve NRIXS/XRS farklı gözlenebilirlerdir. XSpectra veya bir BSE-XAS sonucu tam momentum transferine bağlı XRS spektrumu olarak etiketlenmemelidir.

## 5. KristalYapı'nın güncel durumu ve entegrasyon tasarımı

### 5.1 Halihazırda olanlar

Depodaki [DFT çalışma alanı](qe-workspace.md), [elektronik iş akışı](qe-electronic.md), [kollineer spin desteği](qe-collinear-spin.md) ve [TRUBA/SLURM paketi](qe-truba-slurm.md); QE girdi hazırlama, sunucu iş gönderimi, relaksasyon, bant/DOS/PDOS sonuçlarını ve ilgili kaynağı izleme altyapısını içerir.

**Önemli sınırlar:**
- `server/job_core.py` içinde API tarafından kabul edilen elementlerin listesinde **Li ve Ni yok** (H, C, N, O, Si, S, Mo var). Bu sınıra rağmen “Ni–N-GQD sunucuda hemen hesaplanabilir” denmemeli; UPF profili, atom kütlesi/element denetimi, spin ve sayısal testler genişletilmelidir.
- `server/electronic_core.py` kollineer spin-polarize elektronik iş akışı sunar. Sunucunun bağımsız `relax-scf` yolu aynı spin kapsamını otomatik olarak paylaşmaz.
- Elektronik API slab odaklı `k_z=1` ve `k_z=0` bant yolu varsayımlarına sahiptir; sonlu moleküler GQD için doğrudan genel amaçlı molekül API'si kabul edilmemelidir.
- Mevcut QE sonuç okuyucusu, yeni bir GANSU Lite veya VASP çıktısını şemasız ve kaynak kimliği olmadan otomatik bilimsel sonuç saymamalıdır.

### 5.2 Önerilen modüler yapı (henüz uygulanmadı)

```text
KristalYapı UI (ortak atom düzenleyici + CIF/XYZ + sonuçlar)
  └─ Calculation Engine Router (capabilities + bilimsel preflight)
       ├─ gansu-lite-adapter   → Web Worker / WASM / sonlu molekül
       ├─ qe-adapter           → mevcut QE API, yerel/HPC dışa aktarma
       └─ vasp-adapter         → yalnız lisanslı yerel/uzak çalıştırma veya çıktı içe aktarma
            ↓
    Ortak sonuç katmanı (motor, yöntem, birimler, yapı hash'i,
    konverjans, spin, ham çıktı özeti, provenance)
```

**GANSU Lite adaptörü:** KristalYapı P1 veya sonlu küme atomlarını **Å cinsinden XYZ**'ye aktarır; yük/çokluk, baz seti, fonksiyonel ve normalizasyon ayrı tutulur. GANSU `src/core/scfWorker.ts` iş sözleşmesindeki `xyzText`, `basisGBS`, `method`, `charge`, `multiplicity`, `dftConfig` alanları üzerinden işlem yapılabilir. Tarayıcı ana iş parçacığı kilitlenmemeli; iptal, sınırlar ve durum gösterimi olmalı.

**QE adaptörü:** Mevcut REST/SLURM iş akışını yeniden kullanın; yalnız bilimsel ve yetkilendirme kontrolleri geçildiğinde yeni element/yöntemleri açın. Kaynak/protokol kimliği, k-örgüsü, kesme enerjisi ve UPF SHA-256 kaydı korunmalı.

**VASP adaptörü:** Lisanslı VASP ikili dosyalarını veya POTCAR içeriklerini açık kaynak depoya ya da dağıtım paketine **eklemeyin**. Kullanıcının lisanslı kurulumuna yönlendirme, girdiyi orada üretme ve `vasprun.xml`/`OUTCAR` gibi sonuçları şema/kaynak doğrulamasından geçirerek içe alma ayrı bir iş akışıdır. VASP'ın lisans şartları kullanıcı/kurum tarafından teyit edilmelidir.

**Ortak sonuç şeması:** `engine`, `engine_version`, `method`, `structure_sha256`, `reference_energy`, `units`, `spin`, `charge`, `convergence`, `raw_artifact_hashes` ve `validation_level` zorunlu; desteklenmeyen alanlar uydurulmaz. Moleküler MO enerjisi ile periyodik bant enerjisi yanlışlıkla aynı grafik/enerji sıfırında gösterilmemelidir.

### 5.3 Aşamalı geliştirme önerisi

| Aşama | İş | Asgari kabul kriteri |
| --- | --- | --- |
| P0 | `docs` tasarımı, motor yetenek kaydı, GANSU Lite `Web Worker` adaptörü ve ayrı molekül ön kontrolü | H2O/C6H6 referansları, atom/Å/Bohr/yük/çokluk denetimi, iptal/bellek sınırı; mevcut QE CI etkilenmez |
| P1 | GANSU enerji/kuvvet/yük/MO görselleştirme ve ortak provenance | Kaynak hash'i, SCF yakınsaması, spin kontrolü; hata durumları sessizce başarı sayılmaz |
| P2 | QE–VASP lisans-duyarlı sonuç içe aktarma; iki kollu benchmark raporu | Bağımsız yakınsama ve sayısal referans, enerji birimleri ve yapı eşleme doğrulaması |
| P3 | Ni–N-GQD / Li için özel bilimsel hazırlık ve XRS dış çözümleyici planı | Li/Ni UPF/POTCAR ve spin protokolleri; XRS/XAS ayrımı; deney karşılaştırma belirsizliği |

**Karar kapısı:** GANSU Lite P0 ile sonlu moleküler hesap desteği eklenebilir; bu, QE'nin yerine geçmez. VASP kullanımı için yazılım lisansı ve bağımsız fiziksel doğrulama zorunludur.

## 6. Kaynaklar ve izlenebilirlik

Kaynaklar 10 Kasım 2026 tarihinde değerlendirilmiştir. Ürünlerin desteklediği yöntemler sürüm/derleme koşullarına bağlı olabilir.

1. [GANSU Lite — kaynak kod, yöntemler, performans notları ve doğrulama](https://github.com/Yasuaki-Ito/GANSU-Lite) ([SCF worker](https://github.com/Yasuaki-Ito/GANSU-Lite/blob/main/src/core/scfWorker.ts), [basis set parser](https://github.com/Yasuaki-Ito/GANSU-Lite/blob/main/src/core/basisSet.ts)).
2. Ito ve ark., *GANSU lite: A zero-install, browser-based quantum chemistry platform*, *SoftwareX* **36**, 103046 (2026), [doi:10.1016/j.softx.2026.103046](https://doi.org/10.1016/j.softx.2026.103046).
3. [Quantum ESPRESSO — resmi özellikler](https://www.quantum-espresso.org/what-can-qe-do/) ve [genel kullanıcı kılavuzu](https://www.quantum-espresso.org/Doc/user_guide/node2.html).
4. [Quantum ESPRESSO — paralellik](https://www.quantum-espresso.org/Doc/user_guide/node18.html) ve [NEB kullanıcı kılavuzu](https://quantum-espresso.org/Doc/neb_user_guide/node6.html).
5. [VASP — resmi ürün/yöntem listesi](https://vasp.at/info/about/), [VASP Wiki](https://vasp.at/wiki/Main_page) ve [lisans sık sorulan sorular](https://vasp.at/info/faq/).
6. KristalYapı: [DFT](qe-workspace.md), [kollineer spin](qe-collinear-spin.md), [QE elektronik sonuçları](qe-electronic.md), [kaynak doğrulama](material-evidence-attestation.md).

---

*Bu belge tasarım kararı ve benchmark planıdır; yeni hesaplama, deney veya PR kabul kanıtı içermez.*
