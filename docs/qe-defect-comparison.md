# KristalYapı — MoS₂ kusur serisi ve PDOS karşılaştırması

**Hedef:** Aynı 2B MoS₂ süperhücresinde kusursuz örnek, tek S vakansı (`V_S`),
iki S vakansı (`V_2S`), O ikamesi (`O_S`) ve S vakansına yakın iki O
içeren bir adayın (`O2_at_VS`) **gerçek DFT çıktılarından** atom/orbital PDOS
karşılaştırma dosyası üretmek. Deneysel kaynak:
[Wang ve ark., *ACS Nano* (2022)](https://doi.org/10.1021/acsnano.2c09209).

**Bu, DFT çözücüsü değildir.** Quantum ESPRESSO'nun `pw.x`, `dos.x` ve
`projwfc.x` komutları önce kullanıcı makinesinde/Linux VM'de gerçek
hesaplamaları tamamlamalıdır. `tools/qe_pipeline.py` yürütücüsünde
`--pdos` kullanın; ortaya çıkan her çalışma klasöründe
`electronic-results.json`, `pipeline.json`, `scf.in` bulunmalıdır.

## 1. Girdi organizasyonu

```text
mos2-series/
  series-config.json
  pristine/
    electronic-results.json
    pipeline.json
    scf.in
  V_S/
    electronic-results.json
    pipeline.json
    scf.in
  V_2S/
    ...
  O_S/
    ...
  O2_at_VS/
    ...
```

`series-config.json` şeması:

```json
{
  "schema": "kristalyapi.mos2-defect-series-config.v1",
  "near_radius_angstrom": 3.6,
  "cases": [
    {
      "id": "pristine",
      "kind": "pristine",
      "run_dir": "pristine",
      "label": "Kusursuz MoS2",
      "defect_center_fractional": [0.25, 0.25, 0.5]
    },
    {
      "id": "V_S",
      "kind": "V_S",
      "run_dir": "V_S",
      "label": "Tek S vakansı",
      "defect_center_fractional": [0.25, 0.25, 0.5]
    }
  ]
}
```

Bu koordinatlar **şematiktir**. Gerçek modelinizde eksilen S atomunun
konumunu veya pristine yapıdaki eşdeğer referans noktasını kullanın.
Farklı süperhücrelerde/konumlarda köşe/merkez etiketlerini aynı saymayın.
Diğer üç vaka için aynı biçimde `V_2S`, `O_S` ve `O2_at_VS`
eklenebilir. Bir seri için **2–5** benzersiz vaka ve `pristine` gerekir.
Bir vakada iki kusur varsa ilk sürüm yalnız **tek kullanıcı merkezinin**
çevresini özetler; iki kusur merkezi arasındaki farkları kendiliğinden
çözmez.

```bash
python3 tools/qe_defect_compare.py \
  --config mos2-series/series-config.json \
  --output mos2-series/defect-comparison.json
```

Çıktı dosyası önceden varsa üzerine yazılmaz. Her çalışma dizini,
config dosyasının yer aldığı klasör altında göreli bir yol olmalıdır.

## 2. Bilimsel güvenlik ve uyumluluk kapısı

Program aşağıdaki koşulları denetler ve sağlanmazsa durur:

- Her vakada tamamlanmış `scf`, `nscf`, `dos`, `projwfc` durumu;
  `electronic-results.json` ve `pipeline.json` girdi ve UPF
  kimlik özetlerinin tutarlılığı; `scf.in` SHA-256 doğrulaması.
- Mo:S:O stokiyometrisinin seçilen **aday** etiketiyle uyumu.
  Stokiyometri, `V_2S` komşuluğunu veya iki O'nun gerçek
  kemisorpsiyonunu ispatlamaz.
- Aynı Mo atom sayısı, hücre vektörleri (1e-3 Å tolerans), QE SCF
  cut-off, k-örgüsü, doluluk ve mevcut diğer SYSTEM ayarları.
  Paylaşılan Mo/S (ve uygun vakalarda O) pseudopotansiyellerinin
  SHA-256 değerleri aynı olmalıdır.
- Spin-polarize olmayan atomik/orbital PDOS, son SCF atom sırası,
  atom indeksleri ve enerji ekseni.
- Kullanıcı merkezinden periyodik minimum-görüntü uzaklığı.
  `near_radius_angstrom` içindeki atomlar ve dışındakiler ayrı;
  aynı elementin orbital eğrileri **atom başına ortalama** olarak
  raporlanır.
- Pristine ve kusurlu yapı arasında **aynı elementten** kalan
  atomlar için yaklaşık, tekil yakın-komşu eşleme. Bu yalnız
  geometrik aday eşlemesidir; kimyasal atom kimliği, kusur
  kökeni, oksijen ikamesi ve spin durumunu doğrulamaz.

Fiziksel yakınsama, değişen atom sayısına bağlı kusur oluşum
enerjisi ve yük durumları bu araç tarafından hesaplanmaz.

## 3. Enerji ekseni — varsayılan hizalama YOK

Farklı Quantum ESPRESSO hesaplamalarının ham özdeğer sıfırlarını
fiziksel olarak **eşit kabul edemeyiz**. Bu nedenle varsayılan
sonuçtaki `alignment_status='unaligned'` olur ve KristalYapı'da
**pristine/kusurlu grafikler ayrı ayrı** gösterilir. Piklerin x
konumları farkı, gerçek kusur seviye kayması diye yorumlanmamalıdır.

Gerçek, aynı yöntemle değerlendirilmiş vakum elektrostatik potansiyeli
referansları varsa aşağıdaki bilgileri **her vaka için** ekleyin:

```json
"reference_energy_ev": -0.0,
"reference_evidence": "Bu vakada ölçülen/hesaplanan ortalama vakum potansiyelinin dosyası, yöntem ve sürüm kaydı"
```

Ayrıca config köküne şu alanı ekleyin:

```json
"alignment_method": "vacuum_potential"
```

Buradaki `-0.0` **yer tutucudur; fiziksel veri değildir** ve hesaplanan
referansla değiştirilmelidir. Her vaka için referans enerji (eV) aynı
QE özdeğer sıfırına göre türetilmiş olmalıdır. Böylece

```text
E_(vacuum referenced) = E_(raw QE) - E_vac
```

şeklinde aynı eksene çizim yapılabilir. Program **referansın
köken bilgisi olup olmadığını kontrol eder fakat vakum potansiyeli
hesabını kendi başına yapmaz/doğrulamaz**; çıktı durumu
`user_supplied_vacuum_alignment_unverified` olarak adlandırılır.
Yalnızca bir kısmında referans olan seri veya referansı
`fermi_level` diye tanımlayan seri reddedilir.

Vakum düzeyini kullanıcı kendi hesaplamasından çıkarabilir: QE'nin [`pp.x` ve `average.x` akışı](https://www.quantum-espresso.org/Doc/pp_user_guide/node6.html) elektrostatik potansiyel üzerinden düzlemsel ortalama elde etme imkânı sunar. **Bu PR bu iki programı otomatik çalıştırmaz**, potansiyelin vakum platosunu kendiliğinden doğrulamaz.

**Önemli:** 2B slab hesaplarında gerçek vakum plato bölgesi
oluştuğunu, toplam elektrostatik potansiyelin tutarlı tanımını,
dipol ve elektrostatik sınır koşullarını uzman değerlendirmesiyle
doğrulamak gerekir. Sonlu boyutlu ve yüklü vakanslar için ayrı
düzeltmeler gerekebilir.

## 4. Arayüz

[KristalYapı](https://alorak.github.io/kristalyapi/) → **DFT /
Quantum ESPRESSO** → **4 · MoS₂ kusur serisi karşılaştırması** →
`defect-comparison.json` yükle.

Mevcut grafikler:

- Kusursuz → seçili `V_S`, `V_2S`, `O_S` veya `O2_at_VS`
- Kusura yakın / uzak atom grupları
- Mo-d, S-p, O-p (varsa diğer s/p/d orbitalleri)
- Eşlenen/eşlenemeyen atom sayıları ve yerel atom sayıları

**Yalnız enerji referansı kaydedilmiş ve tüm vakalar için tutarlı
girilmişse** karşılaştırmalı tek grafik oluşturulur. Aksi halde
bağımsız enerji eksenli grafikler sunulur.

## 5. Kapsam dışı

- Makaledeki SIESTA sonuçlarının yeniden üretildiği iddiası
- `V_2S` vakans çiftinin geometrik komşuluğu ve `O2@V_S`
  kimyasal bağı için otomatik onay
- Spin/SOC, lokalize durumun gerçek-uzay yoğunluğu, orbital
  karakterinin eksiton/PL/tek foton emisyonunu kanıtlaması
- GW/BSE, optik geçiş, \(g^{(2)}(0)\) foton istatistiği
- Laboratuvarda gerçek UV ışınlaması ve deneysel vakum

**Testler:**

```bash
python3 -m unittest discover -s tests -p 'test_qe_defect_compare.py' -v
node --test tests/qe-defect-compare-view.test.mjs
```

Testler yapay MoS₂ envanteri ve sayısal eğrilerle çalışır; bunlar
gerçek DFT veya deneysel veri değildir.
