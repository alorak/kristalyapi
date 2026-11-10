# P0.3 · GANSU Lite – PySCF bağımsız moleküler DFT doğrulaması ve silisyum

**Kapsam:** [KristalYapı](../README.md) → **DFT / Tarayıcı hesapları**. Tarih: 10 Kasım 2026.

## Bilimsel hedef

P0.2'de çalışan GANSU Lite Kohn–Sham WASM/SCF motorunu, farklı kod tabanı olan **PySCF 2.15.0** ile sayısal olarak karşılaştırmak. Kullanıcıya özellikle **SiH₄ (silan)** üzerinden silisyum içeren bir **sonlu molekül** örneği sunmak. Silan üzerindeki moleküler orbitaller, periyodik **elmas yapılı Si katısının bant yapısı veya bant aralığı değildir**.

[PySCF](https://pyscf.org/) ile GANSU sonuçları **aynı molekül, sabit geometri, yük, spin, STO-3G baz seti ve seçili XC fonksiyoneli** üzerinden hesaplanır. PySCF LibXC ızgarası (level=3) GANSU'nun `medium` ızgarasıyla nokta nokta aynı değildir. GANSU'nun SVWN/PBE XC bileşenleri, PySCF/LibXC'nin birebir matematiksel uygulaması olmak zorunda değildir. Farklı grid/çözücü ve fonksiyonel varyantı kaynaklı artık farklar bir hata kanıtı sayılmaz; **ölçülen sayılar raporlanır**.

## Hangi sistemler?

| Sabit çalışma | Atom sayısı | Elektron | DFT | Amaç |
| --- | ---: | ---: | --- | --- |
| H₂, R=0,740 Å | 2 | 2 | SVWN/LDA | P0.2 kontrolünün bağımsız tekrarı |
| H₂O, sabit 104,54° yaklaşımı | 3 | 10 | PBE/GGA | Üç atom / kutupsal molekül |
| NH₃, sabit geometri | 4 | 10 | PBE/GGA | Dört atom / N-H bağları |
| SiH₄, Si–H=1,480 Å | 5 | 18 | SVWN/LDA | Silisyum atomunun baz desteği |
| SiH₄, aynı geometri | 5 | 18 | PBE/GGA | XC fonksiyoneli farkının izlenmesi |

Silan Si atomunun merkezde olduğu, dört H'nin `(±0,85448, ±0,85448, ±0,85448) Å` konumlarında uygun tetrahedral işaretlerle bulunduğu bir referans geometridir; **geometri optimizasyonu yapılmaz**. Sayılar uygulamadaki ön-tanımlı örnekler ile `tests/fixtures/gansu/p03-molecules.json` içinde eşleşir. Bağ uzaklığı yaklaşık 1,480 Å'dır.

## Bağımsız kabul kapısı

1. GANSU Lite kodu `58237bc616e9795f393b3d5272805ecef6d377ad` ve dosya hash'leriyle sabitlenir. WASM varlıkları yalnız build/test aşamasında indirilir; yürütme same-origin'dir.
2. Playwright/Chromium tarayıcıda **gerçek GANSU hesaplaması** başlatır; XYZ, fonksiyonel ve grid seçimi uygulamanın kendi arayüzünden yapılır. Bilimsel sonuçlar `gansu-p03-browser-results.json` dosyasına yazılır. Her sonuç orijinal XYZ'nin SHA-256 özetini içerir. Çalışma esnasında harici origin istekleri reddedilir.
3. Ayrı Python sürecinde **PySCF 2.15.0** kurulur, aynı geometri/elektron konfigürasyonu için `dft.RKS` hesapları (`LDA,VWN` veya `PBE`) `STO-3G` baz setiyle çalıştırılır. `conv_tol=1e-9`, `grid.level=3`, `max_cycle=100`. İkinci çözücüden gerçek sayısal sonuç yoksa karşılaştırma **başarılı sayılmaz**.
4. Karşılaştırma toplam enerji farkını **milli-Hartree (mHa)** biriminde ve işaretiyle kaydeder. İlk keşif/entegrasyon kabul eşiği **20 mHa (0,020 Ha)** olarak koşulmadan önce sabitlenmiştir; bir vakada aşılırsa bilimsel iş başarısız olur. Bu geniş eşik **kimyasal doğruluk, 1 kcal/mol düzeyi veya fonksiyonellerin tam eşdeğerliği iddiası değildir**. İleride fonksiyonel varyantları/gridler hizalanarak küçültülmelidir.
5. Hesaplanmış GANSU sonuçları, PySCF bağımsız referansları, `|ΔE|`, uyumsuzluklar ve geçen/kalan vakalar `gansu-p03-pyscf-comparison.json` halinde CI artifact'ına kaydedilir. Farklar bilinmiyorken statik geçiş veya bilimsel uyum iddia edilmez.

### Çalıştırma

GitHub Actions: [GANSU P0.3 bağımsız PySCF doğrulaması](../.github/workflows/gansu-pyscf-validation.yml). Bilimsel test, Python ve Node testlerinden ayrı çalışır.

```bash
# Gerekenler: Python 3.11, PySCF 2.15.0, Node 22, Playwright 1.56.1,
# Chromium, repo içindeki GANSU Worker/STO-3G.
python -m pip install pyscf==2.15.0
python tools/gansu_wasm_assets.py
node tests/browser/gansu-science-p03.test.mjs
python tools/gansu_pyscf_benchmark.py \
  --fixtures tests/fixtures/gansu/p03-molecules.json \
  --gansu tests/browser/artifacts/gansu-p03-browser-results.json \
  --out tests/browser/artifacts/gansu-p03-pyscf-comparison.json

# Saf Python sonuç doğrulama testleri (sentetik girdi; fizik kanıtı değildir):
python -m unittest discover -s tests -p 'test_gansu_pyscf_benchmark.py' -v
```

Kısmi tamamlanma da açıkça kayda geçmelidir. GANSU hesaplaması başarısızsa, PySCF çalışamazsa, referans uyuşmazsa veya testler zaman aşımına uğrarsa P0.3 bilimsel kapısı kapanır.

## 10 Kasım 2026 gerçek bağımsız sonuçları

[GitHub Actions bilimsel koşusu](https://github.com/alorak/kristalyapi/actions/runs/42785028307) **başarılı** tamamlandı. Bütün beş sonlu molekül, yerel GANSU Worker/WebAssembly üzerinde hesaplandı ve aynı konfigürasyonlar PySCF 2.15.0 + LibXC ile bağımsız çalıştırıldı. Geçici CI artifact'ının yanında [kalıcı, hash referanslı özeti](../validation-results/gansu-p03-silicon-20261110/summary.json) saklanır.

| Molekül / fonksiyonel | GANSU (Ha) | PySCF (Ha) | Mutlak fark (mHa) | Ön-kayıtlı kapı |
| --- | ---: | ---: | ---: | --- |
| H₂ / SVWN | −1,121281146 | −1,121206116 | 0,07503 | Geçti |
| H₂O / PBE | −75,228448779 | −75,225413375 | 3,03540 | Geçti |
| NH₃ / PBE | −55,715767776 | −55,713023080 | 2,74470 | Geçti |
| **SiH₄ / SVWN** | **−287,271207735** | **−287,270059677** | **1,14806** | **Geçti** |
| **SiH₄ / PBE** | **−288,347064837** | **−288,341082612** | **5,98223** | **Geçti** |

En yüksek fark SiH₄/PBE için 5,98223 mHa'dır; önceden belirlenen 20 mHa'nın altındadır. **20 mHa kimyasal doğruluk eşiği değildir**; uygun olmayan grid/XC varyantları karşısında bu karşılaştırmayı "mikro-Hartree hassasiyetinde aynı çözücü" diye nitelemek doğru olmaz. Sonuçlar bu beş sabit geometrinin **moleküler** toplam enerjilerine özeldir.

## Silisyum kristali için mevcut gerçek QE kanıtı

**SiH₄ molekülü için GANSU/PySCF** ve **elmas Si kristali için Quantum ESPRESSO** birbirinden ayrı yöntemlerdir. P0.3 bunların enerjilerini doğrudan karşılaştırmaz; atom sayısı, sınır koşulları, pseudopotansiyel ve baz setleri farklıdır.

Repo daha önce [Si için gerçek QE API SCF doğrulaması](qe-scf-validation.md) tamamlamıştır. İki atomlu elmas Si primitif hücresi, PBE, `a=5,431 Å`, gerçek UPF pseudopotansiyel, 45/360–75/600 Ry kesme enerjisi ve 4×4×4–12×12×12 k-örgüleri kullanılarak yedi gerçek hesap kanıtlanmıştır. Son raporun enerji yakınsama kapıları **≤1 meV/atom**'dur. Bu ayrı veri P0.3'te yeniden çalıştırılmaz ve moleküler PySCF ile aynı yöntem olarak sunulmaz.

### Sonraki silisyum araştırmaları

- **SiH₄ bağ uzunluğu–enerji taraması**: 1,40–1,65 Å bölgesinde GANSU/PySCF minimumu ve fonksiyonel etkisini ayrı SCF koşularıyla doğrulama (P0.4 adayı).
- **Kristal Si bant yapısı**: QE üzerinden Γ–X–L k-yolu, DOS/PDOS ve PBE bant aralığının bağımsız kaynakla kıyaslanması; yalnız P0.3 moleküler çıktısından çıkarılamaz.
- **Si kusur ve katkılama**: vakans, P/B dopantı, yük/süperhücre yakınsaması ve formasyon enerjisi için periyodik hesaplarla ayrıca çalışılması gerekir.

**Sınırlamalar:** Si'ye destek açmak Ni, Fe, spin–orbit, ECP, yüzey/slab, amorf Si, XRS veya fonon hesaplamalarını otomatik desteklemez. 12 atom sınırı, STO-3G ve yalnız doğrulanmış türler korunur. PySCF fiziksel referansları test tamamlanmadan "geçti" diye sunulmaz.
