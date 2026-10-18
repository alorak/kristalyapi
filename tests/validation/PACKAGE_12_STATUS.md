# Paket 12 — Bağ-değerliği ve koordinasyonun bağımsız denetimi

## Kapsam

- `BVS_PARAMETERS`: IUCr [2020 CIF parametre derlemesindeki](https://www.iucr.org/what-we-do/digital-standards/data/datasets/bond-valence-parameters)
  **19 seçili** iyon çifti. Kaynak alanları `cation`, `anion`, iki
  iyonun formal yükleri, `R₀` (Å), `B` (Å) ve literatür referans kodu
  birlikte taşınır. Derlemenin bütünü desteklenmiyor; örneğin Cu²⁺–O²⁻
  parametresi `R₀=1,679 Å`, `B=0,36 Å`, `ref=bj` olarak okunur.
- Kimyasal BVS formülü `sᵢ = occupancyᵢ · exp((R₀−dᵢ)/B)`;
  `BVS = Σsᵢ`. Bu **seçili merkez atomun mevcut olduğu koşuldaki**
  hesaplamadır: merkez doluluğu ikinci kez çarpılmaz. Farklı türlerden
  oluşan **aynı konum** alternatiflerinin doluluk toplamı `>1` ise
  geçersizdir. Karışık ligandlar tek atommuş gibi birleştirilmez.
- Raporlanan **geometrik ligand CN** sayılan görüntü/ligand sayısıdır;
  **ağırlıklı CN** `Σoccupancyᵢ`'dir. `BVS − seçili formal yük` açıkça
  gösterilir; eşit bağ uzunluğu yalnız varsayımsal referanstır.
- Kısmi ligand, alternatif merkez, kesimin son `0,2 Å` dilimine denk
  gelen anlamlı katkı ve büyük valans sapmasında uyarı verilir.
  Nonperiyodik moleküler kaynaklarda koordinasyon ve BVS için yalnız
  **[0,0,0] görüntüsü** değerlendirilir; göstermelik hacim kutusunun
  karşı kenarındaki atomlara bağ uydurulmaz.

## Kaynak ve bağımsız bilimsel referans

- Kaynak parametre CIF'i:
  <https://www.iucr.org/__data/assets/file/0011/150779/bvparm2020.cif>
  (IUCr'nin yayımladığı aynı `R₀/B/ref` satırlarının seçimi).
- Bağımsız referans **ASE 3.26.0** `ase.neighborlist.neighbor_list('ijdS')`:
  ürün kodunun periyodik görüntü arama döngüsünü çağırmadan, verilen
  kesim ve tam 3×3 hücre metriğinde her ligand ve görüntü kaymasını
  belirler. Her uzaklık, değişken `B` ile bağ-değer katkısı, ağırlıklı
  CN ve toplam valans üretim JavaScript'iyle tolerans `1×10⁻⁷`
  düzeyinde karşılaştırılır. Ham `R₀`, `B` ve kaynak referans kodu da
  sabit literal IUCr satırlarıyla karşılaştırılır.

| Analitik örnek | Gözlenen/bağımsız CN | ASE BVS (v.u.) | Kontrol |
| --- | ---: | ---: | --- |
| İdeal NaCl, a=5,64 Å | 6 | 0,98113 | Tam oktahedral ligand görüntüleri |
| İdeal MgO, a=4,212 Å | 6 | 1,96510 | `Mg²⁺–O²⁻` formal yük yakınlığı |
| İdeal SrTiO₃ Ti merkezi, a=3,905 Å | 6 | 4,13769 | Ti–O oktahedronu |
| İdeal SrTiO₃ Sr merkezi | 12 | 2,10937 | Sr–O 12 komşu |
| Çok eğik hücre (`γ≈6°`) | 7 | 153,49316 | `|image shift|>2`; **kimyasal olarak anlamsız**, sapma uyarısı |
| Karışık Na/K merkez, Cl/O ligand | 2 | 0,19623 | Koşullu doluluk ve ayrık site türleri |
| Moleküler Na···Cl, periyodik değil | 0 | 0 | Kutu duvarından sahte bağ yok |
| Cu²⁺–O²⁻ | 1 | 0,47106 | `B=0,36 Å` kullanım testi |
| K⁺–O²⁻ kesim sınırı | 1 | 0,12547 | Uzaklık kesimi uyarısı |

Bu sayılar **ideal analitik hücre/koordinat örnekleri** için geçerlidir;
ölçülen deneysel kafesler, bağ değerliği ile çözülmüş bilinmeyen
oksidasyonlar veya VESTA GUI çıktıları değildir. Aşırı eğik hücre
uygulamanın arama algoritmasının stres testidir; çok kısa periyodik
aralıkları nedeniyle `153,49 v.u.` fiziksel valans olarak yorumlanamaz.

## Yeniden üretim / zorunlu kalite kapısı

```sh
node --test tests/core.test.cjs tests/volume-worker.test.cjs tests/offline.test.mjs tests/worker.test.mjs tests/reciprocal.test.mjs tests/coordination-reference.test.cjs tests/validation/test_runner.cjs
python -m pip install ase==3.26.0 numpy==2.1.3
python tests/validation/bvs_12_reference.py
node tests/browser/visual.test.mjs  # Playwright Chromium + yerel Moyo WASM gerekli
```

GitHub Actions'ta ASE bilimsel kapısı `validate` işinin zorunlu adımıdır;
JSON kanıtı `validation-results/bvs-12-ase-ion-pairs.json` olarak,
tarayıcı ekran resmi `tests/browser/artifacts/p12-bvs-coordination.png`
olarak üretilir (tarayıcı kurulumu uygunsa). Bilimsel CI kapısı tek bir
masaüstü VESTA çalıştırma yerine geçmez.

## Bilimsel sınırlar ve sonraki Paket 13

1. **Kimyasal çevre ve oksidasyon otomatik belirlenmez.** Kullanıcı
   merkez atomu, iyon çifti/valansı ve kesimi seçer; BVS sapması seçilen
   formal yükü doğrulamak veya çürütmek için tek başına yeterli değildir.
2. Aynı konumdaki alternatif türler karşılıklı dışlanır. Diğer
   konumlardaki korelasyonlar, yerel kimyasal kurallar, süperhücre
   konfigürasyon dağılımları ve belirsizlik aralıkları modellenmez.
3. Yakın komşuluk **tek seçilmiş ligand türü** için hesaplanır; başka
   ligand türlerinin katkıları bu BVS sayısına dahil değildir. Bu yüzden
   çok anyonlu bir malzemede elde edilen değer tam valans toplamı olamaz.
4. IUCr derlemesindeki parametreler ampiriktir, referans sistem ve
   mesafe kesimine bağlıdır; sadece seçilmiş 19 çift uygulanır. Parametre
   olmayan çift için sıfır BVS gibi sahte sonuç sunulmaz.
5. **Gerçek deneysel CIF korpusu, otomatik kimyasal yük tayini ve doğrudan
   VESTA GUI/CSV fark analizi yapılmadı.** Paket 13'te kaynak kimliği ve
   sayısal doğruluğu sabitlenmiş deneysel yapılar, koşullu disorder
   konfigürasyonları ve belirsizlik aralıkları hedeflenir.
