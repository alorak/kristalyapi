# D2.2 — 1H-MoS₂ gerçek SCF kabul protokolü

**Durum:** Gerçek Linux/Docker/API koşusunda yedi SCF işinin tamamı
yakınsadı; ham dosya/API/UPF kanıtları doğrulandı. **D2.2 genel kabulü
başarısız:** 80→100 Ry kesme enerjisi duyarlılığı 2.374556 meV/atom ile
1 meV/atom eşiğini aşıyor. K-örgüsü ve vakum kapıları geçti. Tam kanıtlar
ve ayrıntılı sonuçlar aşağıdadır; eşikler gevşetilmedi.

## Yapı ve fiziksel kapsam

[Değişmez plan](../tests/fixtures/qe/mos2-scf-acceptance.json):
ideal 1H-MoS₂ tek tabaka, hekzagonal a=3.18 Å, Mo merkezli düzlemin
üstü ve altındaki S tabakaları 1.56 Å uzaklıkta (üç atom). Bu geometri
relakse edilmiş veya bağımsız deneysel olarak doğrulanmış **değildir**.
Sabit PBE, spin-polarize olmayan, nötr, 3B periyodik slab, 8×8×1–
16×16×1 düzlem içi k-örgüsü; c=18/24/30 Å.
c yönündeki yaklaşık fiziksel boşluk, c eksi 3.12 Å'dır.
QE 6.7 tabanı ve sabit occupations kullanılır. SOC, optik özellikler,
yük düzeltmeleri, relaksasyon, fononlar bu aşamada kapsam dışındadır.

Gerçek UPF kaynakları [Mo.pbe-spn-rrkjus_psl.1.0.0.UPF](https://pseudopotentials.quantum-espresso.org/upf_files/Mo.pbe-spn-rrkjus_psl.1.0.0.UPF)
ve [S.pbe-n-rrkjus_psl.1.0.0.UPF](https://pseudopotentials.quantum-espresso.org/upf_files/S.pbe-n-rrkjus_psl.1.0.0.UPF).
PSlibrary 1.0.0 / PBE scalar-relativistic USPP; lisans
[PSlibrary](https://github.com/dalcorso/pslibrary#license).

29 Ekim 2026 tarihinde resmi HTTPS kaynaklarından indirilen dosyaların
SHA-256 değerleri hem `shasum` hem Python `hashlib` ile hesaplanıp
karşılaştırıldı; XML `PP_HEADER` element/PBE/USPP/scalar metadata'sı
ayrıca incelendi. [İnceleme kaydı](../validation-results/qe-mos2-d22-upf-review-20261029.json):

| Element | Gözden geçirilmiş SHA-256 |
| --- | --- |
| Mo | `0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd` |
| S | `90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4` |

Bu değerler resmi indirmelerin bayt özetleridir; yayıncı tarafından
imzalanmış checksum veya bağımsız fiziksel uygunluk sertifikası değildir.
İki SHA-256 açıkça girilmeden araç hesap başlatmaz; yeni indirilen ve
worker'a kopyalanan dosyaların aynı baytlara sahip olduğu ayrıca kontrol edilir.

İlk gerçek denemede resmi S dosyasındaki `element=" S"` değeri metadata
kontrolünce reddedildi. Okuyucu artık XML attribute değerindeki çevre
boşluğunu normalize eder; UPF baytları ve SHA-256 değiştirilmez. Yanlış
element/fonksiyonel ve bozuk/eksik header reddedilmeye devam eder.

## Önceden belirlenen yedi koşum

| Vaka | ecutwfc/ecutrho, Ry | k-örgüsü | c, Å |
| --- | --- | --- | --- |
| ecut60-k8-c24 | 60 / 480 | 8×8×1 | 24 |
| ecut80-k8-c24 | 80 / 640 | 8×8×1 | 24 |
| ecut100-k8-c24 | 100 / 800 | 8×8×1 | 24 |
| ecut100-k12-c24 | 100 / 800 | 12×12×1 | 24 |
| ecut100-k16-c24 | 100 / 800 | 16×16×1 | 24 |
| ecut100-k16-c18 | 100 / 800 | 16×16×1 | 18 |
| ecut100-k16-c30 | 100 / 800 | 16×16×1 | 30 |

**Koşumdan önce kaydedilen geçiş kriterleri:**
80→100 Ry (k=8, c=24) için en fazla 1 meV/atom;
12→16 düzlem içi k-örgüsü (ecut=100, c=24) için 1 meV/atom;
c=24→30 Å (ecut=100, k=16) için 2 meV/atom.
Bunlar koşudan önce tanımlanmış ölçütlerdir; ölçülen sonuçlar aşağıdadır.
Başarısız olursa kriter değiştirip aynı koşumu başarılı ilan etmeyin:
yeni, önceden kayıtlı daha sık tarama hazırlayın. Enerji hassasiyeti,
kuvvet, band gap, vakum potansiyel platosu veya kusur düzeyi
hassasiyetinin garantisi değildir.

## Çalıştırma

Python 3.11+, Docker Engine ve Compose gereklidir.
Pseudopotansiyel dosyalarını yukarıdaki resmi bağlantılardan indirin,
kaynağını/lisansını doğrulayın ve `sha256sum` ile gerçek özetlerini
hesaplayın. Depoda UPF dosyaları paylaşılmaz.

```bash
mkdir -p qe-local/pseudos
curl -fL https://pseudopotentials.quantum-espresso.org/upf_files/Mo.pbe-spn-rrkjus_psl.1.0.0.UPF -o qe-local/pseudos/Mo.UPF
curl -fL https://pseudopotentials.quantum-espresso.org/upf_files/S.pbe-n-rrkjus_psl.1.0.0.UPF -o qe-local/pseudos/S.UPF
sha256sum qe-local/pseudos/Mo.UPF qe-local/pseudos/S.UPF

python3 tools/qe_mos2_acceptance.py --run \
  --mo-sha256 0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd \
  --s-sha256 90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4 \
  --mo-upf qe-local/pseudos/Mo.UPF \
  --s-upf qe-local/pseudos/S.UPF \
  --output validation-results/qe-mos2-local

# Docker veya ağ bağlantısı gerektirmeyen bağımsız kanıt denetimi
python3 tools/qe_mos2_acceptance.py --verify validation-results/qe-mos2-local
```

Yerel UPF yolları verilmezse plan dosyasındaki resmi URL'lerden
indirilen baytlar, operatörün önceden verdiği SHA-256 ile karşılaştırılır.
Farklı içerik, geçersiz metadata, eksik yakınsama veya uydurma enerji
**reddedilir**. Çıktı dizini yeni olmalıdır; mevcut kanıtlar üzerine
yazılmaz.

Ayrıca [manuel GitHub Actions](../.github/workflows/qe-mos2-acceptance.yml)
üzerinden iki doğrulanmış SHA-256 değeriyle gerçek hesaplamalar başlatılabilir.
Çalıştırılması için açık kullanıcı eylemi gerekir. Başarılı/başarısız
çıktı paketleri artifact olarak saklanır.

## Kanıt zinciri

Her vaka için tam QE input/output/stderr, API `validate → 202 submit →
poll → results` kaydı, tam iş kimliği, yapı SHA-256, gerçek UPF
dosyalarının SHA-256'ları, hesaplamanın QE sürümü, Docker image kimliği
ve kaynak kod hash'leri kaydedilir. Erişim token'ı kaydedilmez.
Offline `--verify`, ham dosyalardan SCF yakınsama satırı, `JOB DONE.`,
enerji (Ry/eV), atom/hücre/k-örgüsü, UPF, plan/parametre/özdeşlik
tutarlılığı ve üç duyarlılık kapısını bağımsız kontrol eder.

**Sınır:** Bu, gerçek Docker/QE ile koşulduğunda yalnız belirtilen
ideal yapı için sınırlı SCF enerji hassasiyeti kanıtı oluşturur.
Makalede kullanılan SIESTA/DZP protokolünün QE eşdeğeri değildir.
Optik emisyon veya tek-foton üretimi sonucu çıkarılmaz.

## 29 Ekim 2026 gerçek koşu ve bağımsız inceleme

[Manuel CI koşusu](https://github.com/alorak/kristalyapi/actions/runs/40770083516),
kaynak commit `588881e8cf37463fd78ec10317a9f2aa9554b146`, Linux x86_64,
Docker 28.0.4, gerçek QE `6.7MaX`. Tarama ve temizlik yaklaşık 42 dakika
52 saniye sürdü. API anahtarları kanıta eklenmedi; test kaynakları kaldırıldı.

[Kalıcı kanıt paketi](../validation-results/qe-mos2-d22-20261029-amd64/README.md)
ve [ham dosyalardan yerel inceleme](../validation-results/qe-mos2-d22-20261029-amd64/inspection.json)
depoda saklanır; CI artifact süresi dolduğunda da kullanılabilir.
Kaynak kod hash'leri yerel inceleme koduyla eşleşti. Her işte:

- API ön kontrolü, 202 gönderim, aynı job ID/yapı hash'i ve `completed` sonucu;
- `JOB DONE.`, ham SCF yakınsama bildirimi ve son hata tahmini ≤1e-8 Ry;
- kaynak girdi/ham çıktı/staged Mo/S UPF hash'leri ve API/raw Ry/eV enerjileri;
- iki S ve bir Mo için beklenen **26 elektronlu nötr hücre** doğrulandı.

| Vaka | Gerçek enerji, Ry | Son SCF hata tahmini, Ry | İterasyon |
| --- | ---: | ---: | ---: |
| ecut60-k8-c24 | -181.57954599 | 5.0e-9 | 27 |
| ecut80-k8-c24 | -181.58082320 | 6.1e-9 | 19 |
| ecut100-k8-c24 | -181.58134678 | 1.3e-9 | 18 |
| ecut100-k12-c24 | -181.58136250 | 3.6e-9 | 16 |
| ecut100-k16-c24 | -181.58136264 | 4.1e-9 | 18 |
| ecut100-k16-c18 | -181.58136261 | 4.8e-9 | 14 |
| ecut100-k16-c30 | -181.58136256 | 3.4e-9 | 16 |

| Duyarlılık ölçütü | Gerçek fark, meV/atom | Sınır | Sonuç |
| --- | ---: | ---: | --- |
| 80/640→100/800 Ry, k=8, c=24 | **2.374556** | 1 | **Başarısız** |
| k=12→16, ecut=100/800, c=24 | 0.000635 | 1 | Geçti |
| c=24→30 Å, ecut=100/800, k=16 | 0.000363 | 2 | Geçti |

`--verify` indirilen pakette yerelde tekrar çalıştırıldı ve aynı duyarlılık
ihlali nedeniyle sıfırdan farklı çıktı verdi. Bu beklenen bir reddir;
hesapların tamamlanması genel bilimsel kabul anlamına getirilmedi.
Geometri relakse edilmedi; yaklaşık 0.006 Ry/Bohr toplam kuvvetler
geometri/kuvvet yakınsamasına ilişkin bir kabul değildir.

[İlk metadata reddi](../validation-results/qe-mos2-d22-initial-metadata-20261029.json)
de ayrı saklanır: hesap başlamadan oluşan S attribute okuma hatası ile
sonraki gerçek sayısal kesme enerjisi başarısızlığı birbirinden ayrıdır.

## Gerekli takip ve sonraki işler

Genel D2.2 kabulü açık kalır. Ayrı ön kayıtlı [D2.2b takip deneyi](qe-mos2-cutoff-validation.md)
100/800, 120/960 ve 140/1120 Ry'de üç yeni gerçek SCF işiyle tamamlandı:
**120→140 Ry farkı 0.268123 ≤1 meV/atom, kesme enerjisi kapısı geçti**.
İlk 80→100 Ry başarısız sonucu ve ölçütler değişmez; D2.2b ayrı kayıttır.

Seçilecek yüksek kesme enerjisinde k/vakum kontrolleri hâlâ yeniden
doğrulanmalıdır; mevcut 100 Ry sonuçları daha yüksek cutoff protokolündeki
doğrulamanın yerine geçmez. Kuvvet ve relaksasyon ayrıca değerlendirilir.

D2.2'nin gerçek MoS₂ koşusu ve kanıtı geçtikten sonra:
D3 sabit hücreli relaksasyon ve yeni atom koordinatlarının
kullanıcı onaylı 3B önizlemesi; D4 `relax → scf → bands → nscf →
dos.x/projwfc.x` hesaplamalarının gerçek worker'a bağlanması;
D5 kontrollü kusur modelleri. Spin/SOC, vakum referansı, kimyasal
potansiyeller ve bilimsel sonlu-hücre etkileri ayrıca doğrulanacak.

Negatif test:
`python3 -m unittest discover -s tests -p 'test_qe_mos2_acceptance.py' -v`.
Bu testlerin uydurma sayısal örnekleri gerçek bilimsel kanıt değildir.
