# Paket 13 — Deneysel CIF korpusu, yerel doluluk modeli ve bağımsız bilimsel test

## Gerçek kaynaklar ve lisans/atıf

Dosyalar özgün yayın/depozito CIF içeriği olarak sürümlenmiştir. Dosya
baytlarının SHA-256 özeti `bvs_13_sources.json` dosyasındaki literal değerle
**her çalıştırmada** eşleşmek zorundadır; sessiz upstream değişim testten geçmez.

| CIF, deneysel kaynak | Yayın/kaynak bağlantısı | SHA-256 | Genişlemiş atom |
| --- | --- | --- | ---: |
| `COD_1000041_NaCl.cif` | [COD 1000041](https://www.crystallography.net/cod/1000041.cif); Abrahams & Bernstein (1965), [DOI](https://doi.org/10.1107/S0365110X65002244) | `02d4f4fa315f7b97147256118acc7f9f20190d7246c3ea7209cfb8bd5d6e1fed` | 8 |
| `COD_9009083_rutile.cif` | [COD 9009083](https://www.crystallography.net/cod/9009083.cif); Wyckoff (1963), AMCSD 0011762 | `e36061ba775e5ba3771426654a9348cfbcec6d18834ba2d29388816fc5eae1f9` | 6 |
| `IUCr_wm5651_KNaCaSiO.cif` | Volker Kahlenberg, *Acta Cryst.* E78 (2022) 727–731, [DOI](https://doi.org/10.1107/S2056989022006193), [açık destek CIF'i](https://journals.iucr.org/e/issues/2022/07/00/wm5651/wm5651sup1.cif) | `33f1e7ee6a28730b9aef68c8bd16ca683363d9c6ad3f81b1a86f5ea57edd5a0d` | 40 |

COD NaCl açık depozitodur; rutilin AMCSD/Wyckoff katkısı burada belirtilmiştir.
IUCr makalesi ve ekleri **CC BY** kapsamında orijinal araştırmacıya ve
IUCr kaynağına atıfla kullanılır. Bu deneysel kristal verileri Paket 12'nin
ideal/analitik örneklerinden farklıdır.

## Yapı okuyucu ve bilimsellik sınırları

- IUCr ham dosyasındaki üstveri `data_global` bloğu kristal hücresinden
  **ayrılır**; `data_I` tek yapı bloğu işlenir. Aynı CIF'in sonundaki
  `CELL`/`SFAC`/`LATT` içeren gömülü SHELX rafinman kaydı dosyanın
  `.res` sanılmasına neden olamaz. Kaynak CIF K1 doluluğu **0,722** olarak
  korunur; SHELX ara değerindeki **0,72230** ile karıştırılmaz. İki gerçek kristal veri
  bloğunu karıştırma girişimi reddedilir. P-1 simetri çoğaltması **40 atom**
  üretir; bu çıktı bağımsız Gemmi ile eşleştirilir.
- Kaynak K1/Na1 aynı kesirli konumdadır ve dolulukları **0,722 / 0,278**;
  ikinci K2/Na2 konumunda oran **0,799 / 0,201**. Alternatif türler
  toplam doluluğu 1'i aşamaz. K ve Na ayrı geometrik/kimyasal senaryolardır.
- Yalnız **kullanıcının seçtiği formal katyon yükü, anyon ve R₀/B çifti**
  değerlendirilir. Bu kaynakta K⁺–O²⁻ ve Na⁺–O²⁻ parametreleri için ayrı
  BVS; ağırlıklı, **merkez türüne koşullu** ortalama ve standart sapma
  raporlanır. Merkez atomun doluluğu kendi türünün BVS katkısıyla yeniden
  çarpılmaz. Parametresi eksik alternatif türde koşullu toplam verilmez.
- Her ligand görüntüsü için olay uzayı: aynı noktadaki birbirini dışlayan
  iyonlar veya boş konum. Farklı *fiziksel periyodik görüntü* konumları
  **bağımsız** kabul edilir. `BVS = Σ exp((R₀ − d)/B) × occupancy`,
  `Var(BVS)=Σ (E[sᵢ²]−E[sᵢ]²)`; mümkün min/maks ve en fazla 4096
  kategorik birleşim için kesin P05/medyan/P95.
- Bu standart sapma **ölçüm belirsizliği değildir**. Aynı kristalografik
  sitenin uzakta tekrarlanan görüntülerinde korelasyon bulunabilir;
  koordinat standart sapmaları, termal titreşimler, atomlar arası korelasyon
  ve deneysel yük modelleri bu sınırlı algoritmanın dışında kalır.

## Zorunlu bağımsız sayısal karşılaştırma

`tests/validation/bvs-p13-bridge.cjs`, uygulamanın **üretim CIF okuyucusunu
ve BVS hesabını** çalıştırır; ayrı Python betiği `gemmi.cif` ve
`gemmi.make_small_structure_from_block()` ile birim hücre/atom/simetri
okur, `ase.neighborlist.neighbor_list('ijdS')` ile bütün periyodik komşu
görüntülerini **ürün algoritmasından bağımsız** kurar. Bu nedenle test sadece
uygulamanın kendi sonucunu kendisiyle karşılaştırmaz.

| Deneysel atom/çift | Komşu görüntü | BVS (v.u.) | Bağımsız kaynak kontrolü |
| --- | ---: | ---: | --- |
| NaCl Na1–Cl | 6 | 1,0080076 | COD a = 5,62 Å |
| Rutil Ti4–O | 6 | 4,0749460 | COD TiO₂ |
| Silikat K1–O | 7 | 1,2848485 | IUCr K1–O yayımlanmış 7 mesafe |
| Silikat Na1–O | 7 | 0,5280584 | Aynı konum, farklı tür |
| Silikat K2–O | 8 | 1,3483531 | İkinci karma merkez |
| Silikat Na2–O | 8 | 0,5541581 | İkinci karma merkez |
| Silikat Ca1–O | 6 | 2,1325221 | Ca koordinasyon |
| Silikat Si1–O | 4 | 3,8872474 | Si tetrahedronu |

Kaynak IUCr'deki K1–O uzaklıkları (`2,566, 2,636, 2,721, 2,724,
2,919, 2,940, 3,060 Å`) tam kaynak geometriyle **0,03 Å içinde**
bulunmalıdır. Sekiz senaryoda ASE komşularının **tam `(atom, x/y/z
görüntü kayması)` kümeleri** ile atom dolulukları eşleşir; bireysel
mesafe toleransı **2×10⁻⁶ Å**, bireysel BVS katkısı **10⁻⁷ v.u.**;
koşullu doluluk dağılımı ve alternatif merkez ortalaması/σ da ayrı
Python hesaplarıyla karşılaştırılır. Test herhangi bir farkta durur.

```sh
node --test tests/core.test.cjs tests/coordination-reference.test.cjs
python -m pip install gemmi==0.7.5 ase==3.26.0 numpy==2.1.3
python tests/validation/bvs_13_experimental.py
# Browser CI: Playwright Chromium + yerel Moyo WASM, gerçek IUCr dosyası
node tests/browser/visual.test.mjs
```

JSON kanıtı: `validation-results/bvs-13-experimental-cif-ase-gemmi.json`
(CI'da artefakt olarak yüklenir). Gerçek Chromium/WebGL ekran görüntüsü:
`tests/browser/artifacts/p13-experimental-kna-bvs.png` (görsel CI).

## VESTA ile doğrudan karşılaştırma: henüz yapılmadı

Bu pakette **VESTA GUI çalıştırılmadı**; bu nedenle VESTA ile piksel,
koordinasyon veya bağ-değerliği eşdeğerliği **iddia edilmiyor**.
Paket 14 için elle yapılabilecek yeniden üretilebilir protokol:

1. VESTA 3 ve Kristal Yapı'yı sürüm/işletim sistemi bilgisiyle açın.
   Aynı özgün `IUCr_wm5651_KNaCaSiO.cif` dosyasını yükleyin;
   `data_global` destek farkını ve yükleme uyarısını kayıt altına alın.
2. Hücre parametreleri, P-1 simetri, eksen yönleri, asimetrik site
   etiketleri ve iki alternatif doluluğu iki uygulamada karşılaştırın.
   K1, Na1, K2, Na2 türlerini sessizce tek ortak elemente dönüştürmeyin.
3. Görünüm bölgesini **[0,1]³**, sınır görüntülerini, atom yarıçapını,
   birim Å'yi ve komşu kesimlerini aynı seçin: K1–O **3,2 Å**, K2–O
   **3,5 Å**, Ca1–O **3,1 Å**, Si1–O **2,0 Å**. BVS için VESTA'da
   doğrudan eşleşen R₀/B parametresi ve formal iyon çifti seçilemiyorsa,
   ölçümleri **yalnız geometri** olarak işaretleyin.
4. Koordinasyon görüntü sayısı, yedi K1–O uzaklığı, doluluk/etiket,
   paylaşılan alternatif merkez, varsa BVS parametre tablosunu iki tarafta
   CSV/tablo ve tam pencere ekran görüntüsüyle kaydedin. Eksik/ekstra
   komşuları **atom etiketi + periyodik görüntü kayması** bazında raporlayın.
5. VESTA'nın geometri kesimi, görünüm sınırları veya BVS veri tabanı
   farklıysa bu farkları sonuç tablosunda ayrı gerekçe olarak tutun.
   Gerçek ekran/çıktı olmadan `pass` yazmayın.

### Sonraki Paket 14

İlk hedef **gerçek VESTA 3 çalıştırmasıyla** aynı kaynak/ayar altında
koordinasyon, bağ uzunluğu ve görsel ekran kayıtlarını sabitlemek; ardından
özel VESTA `GROUP`/`SYMOP` setting çevirilerini bağımsız simetri kontrolüyle
genişletmek. P13'teki deneysel referans **P14 karşılaştırmasının temeli**dir;
VESTA'yı otomatik taklit ettiği varsayılmaz.
