# D2.2 — 1H-MoS₂ gerçek SCF kabul protokolü

**Durum:** Kabul aracı, yedi vakalık sabit plan, negatif testler ve manuel
Docker CI iş akışı hazır. **Gerçek MoS₂ koşumu henüz yapılmadı; sonuç uydurulmaz.**
Bu paket yalnız kusursuz monolayer MoS₂'yi kapsar; Si D2.1 sonucu MoS₂
sonucu sayılamaz.

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

**Önemli:** Bu geliştirme ortamında resmi UPF baytları indirilemediğinden
Mo/S SHA-256'ları **uydurulmadı**. Operatörün doğruladığı iki SHA-256
girilmeden araç hesap başlatmaz. Gerçek dosya SHA-256 ve element/PBE
metadata doğrulandıktan sonra dosyalar hesaplamaya alınır. Kaynak ve
lisans bilgileri de kanıt manifestine kaydedilir.

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
Bunlar başlangıç hedefleridir; gerçek sonuçlar henüz bilinmiyor.
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
  --mo-sha256 YOUR_VERIFIED_64_HEX_MO_HASH \
  --s-sha256 YOUR_VERIFIED_64_HEX_S_HASH \
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

## Sonraki işler

D2.2'nin gerçek MoS₂ koşusu ve kanıtı geçtikten sonra:
D3 sabit hücreli relaksasyon ve yeni atom koordinatlarının
kullanıcı onaylı 3B önizlemesi; D4 `relax → scf → bands → nscf →
dos.x/projwfc.x` hesaplamalarının gerçek worker'a bağlanması;
D5 kontrollü kusur modelleri. Spin/SOC, vakum referansı, kimyasal
potansiyeller ve bilimsel sonlu-hücre etkileri ayrıca doğrulanacak.

Negatif test:
`python3 -m unittest discover -s tests -p 'test_qe_mos2_acceptance.py' -v`.
Bu testlerin uydurma sayısal örnekleri gerçek bilimsel kanıt değildir.
