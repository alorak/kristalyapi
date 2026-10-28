# MoS₂ hesaplamaları: QE elektronik yapı zinciri (P1/P2 başlangıcı)

KristalYapı, GitHub Pages üzerinde **statik** kalır. Bu modül, yerel bilgisayar
veya Linux VM'de kurulu **gerçek Quantum ESPRESSO** araçlarını kullanır.
DFT/PBE fizik hesabını tarayıcı, LLM veya ML modeli gerçekleştirmez.

**Kaynak araştırma:** Wang ve ark., *ACS Nano* (2022),
[DOI 10.1021/acsnano.2c09209](https://doi.org/10.1021/acsnano.2c09209).
Makalede SIESTA kullanıldığı için bu QE iş akışı birebir yeniden üretim
olarak kabul edilmemelidir; sayısal yakınsama ve fiziksel protokol
doğrulanmalıdır.

## Hesaplama aşamaları

| Aşama | Motor | Amaç |
|---|---|---|
| `relax` (opsiyonel) | `pw.x` | Atom konumlarını optimize et; son kesirli koordinatları izle |
| `scf` | `pw.x` | Öz-uyumlu elektron yoğunluğu ve toplam enerji |
| `bands` (opsiyonel) | `pw.x` | Kullanıcı tarafından doğrulanmış k-yolu üzerindeki KS özdeğerleri |
| `bands_pp` | `bands.x` | `bands.dat.gnu` veri dosyası |
| `nscf` (opsiyonel) | `pw.x` | Yoğun, düzenli k-örgüsündeki özdeğerler/dalga fonksiyonları |
| `dos` | `dos.x` | Toplam durum yoğunluğu `dos.dat` |
| `projwfc` | `projwfc.x` | `pdos.pdos_tot`; toplam projeksiyon |

Bütün aşamalar **aynı çalışma dizini**, `prefix='kristalyapi'`
ve `outdir='./tmp'` değerlerini kullanır. Bir aşama başarısız olursa
diğerleri durdurulur. `pipeline.json` her aşamanın durumunu ve
girdi/çıktı özetlerini içerir.

**Sınırlama:** İlk P2, atom/orbital başına PDOS ayrıştırması ve spin/SOC
analizi sağlamaz. `pdos.pdos_tot` yalnız toplam PDOS katkısını verir;
yerelleşmiş kusur durumunun Mo/S/O kaynaklı olduğunu tek başına kanıtlamaz.

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
- `bands.dat.gnu`, `dos.dat`, `pdos.pdos_tot`: gerçek QE
  son işlem dosyaları, yalnız ilgili aşamalar başarılıysa.
- `electronic-results.json`: yalnız bütün istenen aşamalar
  tamamlanırsa oluşturulur; bant, toplam DOS ve toplam PDOS verileri
  ortak şemada saklanır.

KristalYapı → DFT paneli → **Gerçek elektronik bant ve DOS verileri**
alanından `electronic-results.json` seçip SVG grafiklerini açın.
Dosya yerel olarak okunur; sunucuya gönderilmez.

**Enerji uyarısı:** QE bant özdeğerleri ve DOS enerjileri burada ham
eV değerleriyle çizilir. Fermi, vakum seviyesi veya deneysel
fotolüminesans değerlerine otomatik hizalama yoktur. Modelde optik
geçiş, eksiton, fonon, PL ömrü veya foton antibunching hesaplanmaz.
PDOS toplamları atom bazında ayrıştırılmaz. Band unfolding,
2B elektrostatik düzeltmeler ve kimyasal potansiyelli kusur oluşum
enerjileri bu pakette bulunmaz.

Ayrıca tarayıcıya yüklenen JSON bilimsel olarak doğrulanmış,
aktif kristalle eşleştirilmiş veya imzalanmış sayılmaz. Dosyayı
hesabı yaptığınız makineden aldığınızdan emin olun.

## Test / tekrar üretilebilirlik

```bash
python3 -m unittest discover -s tests -p 'test_qe_pipeline.py' -v
node --test tests/qe-electronic-view.test.mjs
```

Bu testler **sahte QE işlem çıktıları** ve yapay sayısal grafik
örnekleri kullanır. Gerçek MoS₂ DFT çözümü çalıştırıldığı veya
makale Şekil 4'ün yeniden üretildiği anlamına gelmez.

Teknik referanslar:
[PWscf elektronik hesaplamalar](https://www.quantum-espresso.org/Doc/pw_user_guide/node10.html),
[bands.x](https://www.quantum-espresso.org/Doc/INPUT_BANDS.html),
[projwfc.x](https://www.quantum-espresso.org/Doc/INPUT_PROJWFC.html).
