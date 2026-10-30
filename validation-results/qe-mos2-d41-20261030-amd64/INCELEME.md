# D4.1 gerçek MoS₂ elektronik yakınsama kabulü

Ön kayıtlı altı bağımsız API/Docker işi ve kohort raporu [40928974130](https://github.com/alorak/kristalyapi/actions/runs/40928974130) çalışmasında tamamlandı. Hesap kaynağı `64530c73ae34112a1575c66002f3b1434037c2e5`; indirilmiş ZIP SHA-256 ve artifact kimliği `artifact-source.json` içindedir. Yeni hesap çalıştırmadan, kayıtlı rapor her vakanın ham QE girdisi/çıktısı, API sonuçları, UPF/çalışan kaynak hash'leri ve tam durum sayımı üzerinden yeniden türetildi ve birebir eşleştirildi.

**Sonuç: ön kayıtlı sonlu bant/NSCF örgüsü kabulü geçti.** Yöntem: sabit kabul edilmiş D3 geometrisi, PBE/skaler/spinsiz, SCF 120/960 Ry ve 16×16×1. Ortak DOS/PDOS penceresi −8…6 eV, adım 0.01 eV. Kesim enerjisi, geometri, yük, SOC, spin, yöntem veya kusur büyüklüğü için yeni bir yakınsama iddiası değildir.

| Ön kayıtlı karar çifti | Ortak en düşük 24 yol bandı azami farkı | NSCF VBM/CBM/aralık farkları | DOS / Mo-d / S-p bağıl L1 | Karar |
| --- | --- | --- | --- | --- |
| 32→40 bant; k16, σ=0.01 Ry | 0 eV | 0 / 0 / 0 eV | 0 / 0 / 0 | Geçti |
| NSCF 18→24; 40 bant, σ=0.01 Ry | 0 eV | 0 / 0 / 0 eV | %3.9794 / %2.6041 / %4.4769 | Geçti |

Sıfırlar QE'nin yazdırdığı sayısal hassasiyettedir. Proje hedefleri bant/kenar değişimleri için 10 meV, eğriler için %5'tir; evrensel fiziksel doğruluk sınırları değildir. Sabit açık yolun değişmemesi tek başına NSCF örgüsü kanıtı sayılmadı: gerçek NSCF özdeğer ve doluluk blokları kullanıldı. Enerji sıfırına kaydırma, interpolasyon veya yeniden ölçekleme uygulanmadı.

**Başarısız yardımcı karşılaştırma korunmuştur:** NSCF 16→18 için CBM farkı 56.1 meV, aralık farkı 64.8 meV, DOS L1 %6.0004 ve S-p L1 %7.7083. Bu çift sonradan karar çifti yerine seçilmedi; k16 NSCF'nin yeterliliği iddia edilmez.

**Genişlik yakınsaması iddia edilmez:** σ=0.005→0.0025 Ry için DOS/Mo-d/S-p L1 yaklaşık %15.3450/%15.8552/%15.8884; alttaki NSCF spektrumu değişmiyor. `broadening_converged` daima `null` kalır. Karşılaştırma başarısı optik geçiş, PL, kusur seviyesi, deneysel aralık veya manyetik temel durum doğrulaması değildir.

Altı yeni vaka + eski D4 referansı raporda yedi kayıt oluşturur. Ham `case-bundles/` her vaka için korunur. Üç atomlu referansın kaynak sınırları büyük D5 hücrelerine taşınmaz.

Bağımsız tekrar denetimi (QE çalıştırmaz; ilgili git kaynak nesneleri için tam geçmiş gerekir):

```sh
python tools/qe_electronic_convergence.py --verify validation-results/qe-mos2-d41-20261030-amd64
python tools/qe_convergence_view.py validation-results/qe-mos2-d41-20261030-amd64 --output /tmp/convergence-view.json
cmp validation-results/qe-mos2-d41-20261030-amd64/convergence-view.json /tmp/convergence-view.json
```

`convergence-view.json`, **DFT → Yakınsama ve kanıtlar** bölümünde açılabilir. Tarayıcı görünümü dosya hash'lerini kontrol eder; bağımsız ham kanıt denetimi yukarıdaki Python aracıdır. CI her ikisini yeniden doğrular.
