# Güncel main üzerinde gerçek Si çalıştırma denemesi

30 Ekim 2026 tarihli `7f38e9e31c018a431863e594301ca6eeec61ee3a` ana dalı ayrı Docker imajında çalıştırıldı. API ve worker içindeki dosya SHA-256 değerleri çalıştırılmadan önce kaynakla eşleştirildi. İş: `1448b3cb1f17444d89a08100840860ef`.

İki atomlu Si, PBE, 45/360 Ry, 2×2×1 SCF/NSCF örgüsü, nbnd=8/spin, başlangıç Si polarizasyonu 0.1, Gaussian SCF genişliği 0.01 Ry. DOS −4…10 eV, adım 0.01 eV, genişlik 0.005 Ry. Yedi aşama tamamlandı; SCF hata tahmini 1.2e-9 Ry, enerji −22.47662949 Ry, her spin için 8 bant ve 1401 DOS örneği. Manyetizasyon basılı hassasiyette sıfırdır. Küçük işlev testidir; manyetik temel durum veya D5/HPC kapasite kabulü değildir.

Yeni API'nin hesap özeti `evidence_status=matched` döndürdü; adlandırma ve iş geçmişinde kimlik/tür/durum filtreleri doğrulandı. İlgili yanıtlar bu klasörde tutulur. Gizli API anahtarı kaydedilmedi. Docker test projesi kanıtlar alındıktan sonra kaldırıldı.

İlk bağımsız doğrulama, yeni `k_path_nodes` bant üstverisini yeniden üretmediğinden eşleşme hatası verdi. Sayısal bant/DOS/PDOS değerleri değişmemişti. Düzeltme, mevcut düğümleri kayıttan kopyalamak yerine ham GNU uzaklıkları, girdi hücresi ve açık `crystal_b` yolu üzerinden yeniden hesaplar; değiştirilmiş düğümleri reddeder. Eski düğümsüz kayıtların biçimi korunur. `verification.json` düzeltilmiş doğrulayıcının bu ham veri üzerindeki başarılı sonucudur.

```sh
python tools/qe_spin_acceptance.py --verify validation-results/qe-spin-si-20261030-main-7f38e9e
```

Bu komut yeni QE hesabı başlatmaz.
