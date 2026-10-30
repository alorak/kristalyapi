# MoS₂ hesaplamaları: QE elektronik yapı zinciri (P1/P2 başlangıcı)

KristalYapı, GitHub Pages üzerinde **statik** kalır. Bu modül, yerel bilgisayar
veya Linux VM'de kurulu **gerçek Quantum ESPRESSO** araçlarını kullanır.
DFT/PBE fizik hesabını tarayıcı, LLM veya ML modeli gerçekleştirmez.

**Kaynak araştırma:** Wang ve ark., *ACS Nano* (2022),
[DOI 10.1021/acsnano.2c09209](https://doi.org/10.1021/acsnano.2c09209).
Makalede SIESTA kullanıldığı için bu QE iş akışı birebir yeniden üretim
olarak kabul edilmemelidir; sayısal yakınsama ve fiziksel protokol
doğrulanmalıdır.

## TRUBA P1.4: büyük nbnd, sınırlı grafik penceresi

Yüksek `nbnd` bilimsel hesaplamanın bant sayısıdır. TRUBA paketinde
`Grafikte ilk bant` / `Grafikte son bant` ile 1 tabanlı ve dahil
bir grafik aralığı seçilebilir (800 bandın içinden 301–380 gibi).
`pw.x` hiçbir bandı atlamaz; `bands.x` çıktısının **tüm** blokları
doğrulanır. `electronic-results.json` içinde yalnız seçili eğriler
taşınır ve `band_index_start` ile `total_bands` kaydedilir.
Böylece DFT grafik başlığı/CSV özgün bant indeksini korur.
Bu seçim otomatik Fermi/valans bandı tanısı değildir.
[P1.4 kaynak sınırları ve test durumu](qe-truba-slurm.md).

## TRUBA P1.3: ham QE çıktılarını doğrudan grafiklere aktarma

[TRUBA / SLURM P1.3 kılavuzu](qe-truba-slurm.md) kapsamında DFT → Hesap hazırlığı
altındaki çok aşamalı ZIP, isteğe bağlı olarak `electronic.py` ve `qe_pdos.py`
içerir. Başarılı `bands.x`, `dos.x` ve `projwfc.x` dosyalarını
`kristalyapi.qe-electronic.v1` biçiminde `electronic-results.json` içine
dönüştürür. Bu JSON, **DFT → Sonuçları incele → Bant, DOS ve PDOS** alanında,
aynı mevcut grafik motoruyla görüntülenir; ayrı bir grafik motoru kurulmaz.

Dönüştürücü veri kaynağını, girdiyi ve SLURM aşamalarını SHA-256 üzerinden
izler; eksik/spinli/uyuşmayan veriyi kabul etmez. Doğru bant yolu,
UPF/method seçimi, spin durumu ve numerik yakınsama yine bilimsel
doğrulama gerektirir. Enerjiler **ham QE referansındadır**: otomatik
Fermi sıfırlaması, optik emisyon ya da deneysel bant aralığı sonucu yoktur.
Grafik sınırları aşılıyorsa dönüştürücü seçimini kapatarak ham P1.2
çıktılarını koruyun. Gerçek TRUBA üretim koşumuyla kabul henüz beklemededir.

## Hesaplama aşamaları

| Aşama | Motor | Amaç |
|---|---|---|
| `relax` (opsiyonel) | `pw.x` | Atom konumlarını optimize et; son kesirli koordinatları izle |
| `scf` | `pw.x` | Öz-uyumlu elektron yoğunluğu ve toplam enerji |
| `bands` (opsiyonel) | `pw.x` | Kullanıcı tarafından doğrulanmış k-yolu üzerindeki KS özdeğerleri |
| `bands_pp` | `bands.x` | `bands.dat.gnu` veri dosyası |
| `nscf` (opsiyonel) | `pw.x` | Yoğun, düzenli k-örgüsündeki özdeğerler/dalga fonksiyonları |
| `dos` | `dos.x` | Toplam durum yoğunluğu `dos.dat` |
| `projwfc` | `projwfc.x` | Toplam PDOS ve atom/orbital projeksiyon dosyaları |

Bütün aşamalar **aynı çalışma dizini**, `prefix='kristalyapi'`
ve `outdir='./tmp'` değerlerini kullanır. Bir aşama başarısız olursa
diğerleri durdurulur. `pipeline.json` her aşamanın durumunu ve
girdi/çıktı özetlerini içerir.

**P2 atom/orbital analizi (yeni):** `projwfc.x` artık yalnız `pdos.pdos_tot`
değil, `pdos.pdos_atm#N(X)_wfc#M(l)` dosyaları da üretir.
`tools/qe_pdos.py` her dosyanın atom indeksini, Mo/S/O türünü ve
s/p/d/f orbital türünü son SCF atom sırasıyla karşılaştırır. `LDOS(E)`
sütununun orbital bileşenlerine eşitliğini, her atom/elementin toplamını
ve `pdos.pdos_tot` ile tutarlılığı kontrol eder. Eksik, bozuk, spin
veya SOC dosyası **sessizce kabul edilmez**.

Başarılı hesap sonrası `electronic-results.json` içinde ayrıca
`pdos_atoms` bulunur; KristalYapı DFT panelinde **Atom / element /
orbital katkılarını incele** seçicisiyle Mo-d, S-p, O-p veya belirli
atomun ilgili orbital katkısı toplam projeksiyon ile çizilir.
Sadece kollineer **spin-polarize olmayan** QE çıktıları desteklenir.

**Bilimsel sınır:** PDOS, atomik baz fonksiyonlarına yapılan
projeksiyondur; gerçek uzaydaki yük yoğunluğu, kimyasal bağ veya lokalize
bir kuantum yayıcı olduğunu tek başına kanıtlamaz. Özellikle bir S
boşluğu manyetik/açık kabuklu durum oluşturabiliyorsa spin-polarize
hesaplama gerekip gerekmediği araştırılmalıdır; bu sürüm o sonucu
otomatik hesaplamaz veya yanlış biçimde birleştirmez.

## Çalıştırma

Önce KristalYapı'nın DFT sekmesinden `relax` girdisi indirin.
Gerçek UPF dosyalarını (örn. `Mo.UPF`, `S.UPF`) uygun klasöre koyun.
Aşağıdaki **örnek** bant yolu, kullanıcının doğrulamasına tabidir;
özellikle COD'dan alınan süperhücrenin reciprocal bazına otomatik
uygulanamaz.

```text
# example.kpath — LABEL kx ky kz N
Gamma 0 0 0 16
M     0.5 0 0 16
K     0.3333333333 0.3333333333 0 16
Gamma 0 0 0 1
```

`--nbnd` boş bantları da hesaplayabilecek kadar büyük seçilmeli;
bu değer, kesme enerjileri, k-örgüsü ve vakum kalınlığı için
yakınsama denemeleri zorunludur.

```bash
# Çalışmayı hazırlamak: dış hesaplama ÇALIŞMAZ
python3 tools/qe_pipeline.py \
  --input mos2_relax.in \
  --pseudo-dir /data/pseudo \
  --workdir ./runs/mos2-prepare \
  --band-path example.kpath --nbnd 80 --nscf-k 12 --pdos

# Yeni/boş çalışma dizininde gerçek DFT/son işlem çalıştırır
python3 tools/qe_pipeline.py \
  --input mos2_relax.in \
  --pseudo-dir /data/pseudo \
  --workdir ./runs/mos2-real-01 \
  --band-path example.kpath --nbnd 80 --nscf-k 12 --pdos \
  --pw pw.x --bands-x bands.x --dos-x dos.x \
  --projwfc-x projwfc.x --timeout 14400 --run
```

Bant grafiği istenmiyorsa `--band-path` kaldırılabilir.
Yalnız `relax → scf` için `--band-path`, `--nbnd` ve
`--pdos` verilmez. `--run` olmadan hiçbir DFT hesabı yapılmaz.

**Not:** `--run` olmadan oluşturulan ileri aşama girdileri,
relaksasyonun henüz bilinmeyen son atom koordinatlarını içermez ve
yalnız iş planlaması içindir. Gerçek koşuda son koordinatlar zincire
aktarılır. Çalışma, tamamlanmış `JOB DONE` ve uygun yakınsama
belirteçleri olmadan `completed` sayılmaz.

## Dosyalar, grafikler ve sınırlamalar

- `pipeline.json`: aşama durumları, pseudopotential SHA-256,
  orijinal girdi SHA-256 ve yürütme parametreleri.
- `relax.out`, `scf.out`, `bands.out`, `nscf.out` ve diğer
  stdout/stderr dosyaları: çözücünün gerçek kayıtları.
- `bands.dat.gnu`, `dos.dat`, `pdos.pdos_tot` ve `pdos.pdos_atm#*`: gerçek QE
  son işlem dosyaları, yalnız ilgili aşamalar başarılıysa.
- `electronic-results.json`: yalnız bütün istenen aşamalar
  tamamlanırsa oluşturulur; bant, toplam DOS ve toplam PDOS verileri
  ortak şemada saklanır; doğrulanan atom/element-orbital PDOS için `pdos_atoms` alanı bulunur.

KristalYapı → DFT paneli → **Gerçek elektronik bant ve DOS verileri**
alanından `electronic-results.json` seçip SVG grafiklerini açın.
Dosya yerel olarak okunur; sunucuya gönderilmez.

**Enerji uyarısı:** QE bant özdeğerleri ve DOS enerjileri burada ham
eV değerleriyle çizilir. Fermi, vakum seviyesi veya deneysel
fotolüminesans değerlerine otomatik hizalama yoktur. Modelde optik
geçiş, eksiton, fonon, PL ömrü veya foton antibunching hesaplanmaz.
Atom/orbital PDOS mevcuttur ancak atomların gerçek uzaydaki yük yoğunluğunu ve optik geçişleri tek başına belirlemez. Band unfolding,
2B elektrostatik düzeltmeler ve kimyasal potansiyelli kusur oluşum
enerjileri bu pakette bulunmaz.

Ayrıca tarayıcıya yüklenen JSON bilimsel olarak doğrulanmış,
aktif kristalle eşleştirilmiş veya imzalanmış sayılmaz. Dosyayı
hesabı yaptığınız makineden aldığınızdan emin olun.

### Gerçek k-yolu işaretleri

`--band-path` ile belirtilen `crystal_b` yolundan **isimler** ve
`bands.x` tarafından oluşturulan `bands.dat.gnu` dosyasından **gerçek
örneklenmiş k-uzaklıkları** alınır. `k_path_nodes` yalnızca bütün örnek
sayısı QE yol ağırlıklarıyla uyuştuğunda ve hücrenin karşılıklı örgü
metriğiyle beklenen segment uzunlukları örneklenmiş uzaklıklarla
uyuştuğunda yazılır. Aksi durumda iş başarısı korunur ama grafik
üzerinde kanıtlanamayan Γ/M/K konumları gösterilmez. Etiket isimleri
kullanıcının belirlediği noktalardır; otomatik simetri sınıflandırması
değildir. Fermi hizalaması ve fiziksel bant aralığı çıkarımı yapılmaz.

## Test / tekrar üretilebilirlik

```bash
python3 -m unittest discover -s tests -p 'test_qe_pipeline.py' -v
python3 -m unittest discover -s tests -p 'test_qe_pdos.py' -v
node --test tests/qe-electronic-view.test.mjs
```

Bu testler **sahte QE işlem çıktıları** ve yapay sayısal grafik
örnekleri kullanır. Gerçek MoS₂ DFT çözümü çalıştırıldığı veya
makale Şekil 4'ün yeniden üretildiği anlamına gelmez.

Teknik referanslar:
[PWscf elektronik hesaplamalar](https://www.quantum-espresso.org/Doc/pw_user_guide/node10.html),
[bands.x](https://www.quantum-espresso.org/Doc/INPUT_BANDS.html),
[projwfc.x](https://www.quantum-espresso.org/Doc/INPUT_PROJWFC.html).


D4.1: [ön kayıtlı elektronik yakınsama planı, sınırlı DOS API ayarları ve manuel iş akışı](qe-electronic-convergence.md). Yeni MoS₂ karşılaştırma sonuçları henüz yok.
