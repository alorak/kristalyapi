# P2 · Araştırma sonrası işlem prototipleri (bilimsel kabul DEĞİLDİR)

Bu paket, KristalYapı'ya bağlı malzeme araştırmalarında değerlendirilebilecek dört **hesaplama çekirdeği** sunar. Test verileri sentetiktir; gerçek DFT, deney, fonon, malzeme arayüzü veya cihaz ölçümü yürütülmedi. Tek başına kristal geometri dosyasından hesaplama fiziği türetilmez. Matematiksel sonuçlar **haricen sağlanan** sayısal girdilerin dönüşümleridir.

`python tools/materials_p2_research.py --input /private/case.json --output /private/result.json`

Girdi ortak alanları:

```json
{
  "schema": "kristalyapi.materials-research-input.v1",
  "source": {
    "kind": "synthetic",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reference": "example input only — not research evidence"
  },
  "mode": "phonon-screen",
  "parameters": {
    "frequencies_thz": [-0.3, 0, 1.2, 2.4],
    "imaginary_tolerance_thz": 0.1
  }
}
```

`source.kind` izin verilen değerleri: `synthetic`, `operator-supplied-qe`, `operator-supplied-experiment`. Hash ve referans yalnız operatör beyanıdır; **orijinal dosyalar bu komutta yeniden doğrulanmaz**. Kaynağın gerçekliğini veya bağımsız kalibrasyonu kanıtlamaz. Her çıktı `scientific_acceptance=false` içerir.

## P2.1 — Yüklü ve yüksüz kusur oluşum enerjisi

Kullanılan ifade (birimler eV):

`E_f(D^q) = E_defect^q - E_bulk - Σ_i n_i μ_i + q(E_F + E_VBM + ΔV) + E_corr`

- `delta_atoms`: kusura **eklenen** atomlar pozitif, **çıkarılan** atomlar negatif.
- `chemical_potentials_ev`: tür başına μᵢ. Kullanıcı tarafından kimyasal potansiyel/kararlı faz sınırları ayrıca sağlanmalı ve doğrulanmalı.
- `fermi_relative_ev`, `vbm_ev`, `potential_alignment_ev`, `finite_size_correction_ev`, `charge` ayrı tutulur.
- q≠0 ise `correction_method` ve `dielectric_reference` zorunludur. **FNV/Kumagai düzeltmeleri otomatik hesaplanmaz**; sadece kullanıcı girdisi toplam enerjiye eklenir.
- Yüksüz q=0 için charged-only düzeltme ve hizalama sıfır olmalıdır.

Üretimde eksik olanlar: referans bünye/boyut/kusur kökeni, dielektrik tensör, yük düzeltmeleri, değişken kimyasal potansiyel sınırları, defekt süperhücresi yakınsaması, yük dengeleme ve deneysel karşılaştırma.

## P2.2 — Fonon frekans taraması

`frequencies_thz`, `imaginary_tolerance_thz` üzerinden negatif modların sayısı/indisleri hesaplanır. Negatif işaret, kullanıcı verisinde sanal/imaginer frekansı temsil eder. **Tüm Brillouin bölgesinde dinamik kararlılık ispatı değildir**; küçük negatif akustik Γ sayısal hatalarının yorumu gereklidir. Frekans listesinden termal iletkenlik, fonon ömrü ya da arayüz termal direnci türetilmez.

## P2.3 — İki malzemenin arayüz geometrisi taraması

Her malzeme için iki adet 2B örgü vektörü Å cinsinden verilir: `material_a_inplane_angstrom`, `material_b_inplane_angstrom`. Her eşlenik vektör çiftinin uzunluk farkı yüzdesi ve açı farkı hesaplanır. **Süperhücre kommensürasyon araması, büküm (twist), registry, elastik enerji, yapışma veya arayüz elektronik etkisi yoktur.**

## P2.4 — Bölünmüş conformal belirsizlik prototipi

Bağımsız **kalibrasyon ayrımı** yapıldığı varsayılan `calibration_observed`, `calibration_predicted`, `candidate_predictions` ve hedef miscoverage `alpha` alınır. Kalibrasyon artıklarının `ceil((n+1)(1-alpha))` sıra istatistiği ile mutlak artık yarıçapı hesaplanır. Gerekli sıra n'yi aşıyorsa **sonlu güven aralığı sunulmaz** (`finite_interval_available=false`), sınırsız belirsizlik örtbas edilmez.

Gerçek kalibrasyon garantisi **yalnız değiştirilebilirlik (exchangeability) ve gerçek bağımsız veri koşullarıyla** ilişkilidir. Bu prototip eğitim/kalibrasyon veri sızıntısı, dağılım kayması, faz/aile gruplaması veya gerçek kapsama ölçümü yapmaz; anten performansı ya da üretim karar güvenilirliği hesapladığını iddia etmez.

## P2 fiziksel kanıt kapıları

1. **Yüklü kusur**: gerçek QE kusur/saf süperhücre çiftleri, yük ve potansiyel hizalaması, ε tensörü, yöntem bağımsız yakınsama ve ham kanıt hash'leri.
2. **Fonon/termal**: doğrulanmış DFPT veya sonlu deplasman kuvvetleri, q-mesh, akustik sum rule, gerçek ölçüm/hesap referansı; termal iletkenlik için gerekirse üçüncü-mertebe FC ve fonon taşınım çözümü.
3. **Arayüz**: doğrulanmış kommensürat süperhücre, gerilim/gerinim, relaksasyon, ara yüz bağlanma/enerji, ikincil literatür.
4. **Vekil model**: bağımsız eğitim/kalibrasyon/test bölünmesi, maliyetli referans veri kaynakları, önceden kayıtlı kapsama hedefi ve aday karar hataları; gerçek deneysel/FDTD/DFT çıktıların karşılaştırması.
5. **Rietveld**: bu pakete dahil değil; fiziksel referans verisi ve bağımsız deneysel acceptance olmadan otomatik fit/kalite kararı eklenmeyecek.

Test: `python -m unittest discover -s tests -p 'test_materials_p2_research.py' -v`.

Bu, P2'nin **sayısal araştırma prototipi** olarak ilk PR'ıdır, tam P2 kabulü değildir.
