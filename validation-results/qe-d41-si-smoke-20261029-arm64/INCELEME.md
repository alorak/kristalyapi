# D4.1 gerçek Si işlev testi — geçti

Kaynak: `172ff940299c8b1b11e48fadaff6d417e4114c9f`, arm64 Docker,
QE 6.7MaX. Bu paket Si/MoS₂ sayısal yakınsama kabulü değildir; yeni DOS
ayarlarının API'den gerçek QE'ye ve ham sonuçlara aktarımını sınar.

- Si: iki atom, SHA-256 eşleşmeli resmi UPF; 45/360 Ry, SCF/NSCF k2,
  8 bant, dört açık yol noktası. İstek `request.json` içindedir.
- API işi `bc6480e1e9f344fb96d9249eede320ef`: altı aşama tamamlandı,
  E = −22.47661421 Ry; ham aşama/artifact hash'leri ve API eğrileri eşleşti.
- DOS/projwfc: −4…10 eV, ΔE=0.01 eV, σ=0.005 Ry; 1401 seçili ortak
  nokta ve iki atom projeksiyonu. Ham projwfc'deki fazla uç nokta mevcut
  seçme kuralıyla dışarıda bırakıldı; interpolasyon/kaydırma yapılmadı.
- `state-count/`: aynı NSCF kaydından ayrı `dos.x`, −65…30 eV,
  ΔE=0.01 eV, σ=0.01 Ry. 9501 nokta, 16 toplam durum, yazılı integral
  uçları üzerinden hata 0.0 durum. Tam integral API eğrisinden ayrıdır.
- İşlev testi kaynakları: 2 GiB RAM, 4 GiB RAM+swap, 2 CPU. Bu kaynaklar
  D4.1 bilimsel kohortunun x86_64/6 GiB/no-swap protokolünün yerine geçmez.
  Geçici container/volume'ler kaldırıldı.

Bağımsız, DFT çalıştırmayan doğrulama:

```sh
python -m unittest discover -s tests -p 'test_qe_dos_settings.py' -v
python -m unittest discover -s tests -p 'test_qe_electronic_convergence.py' -v
```

İlk deneme kardeş `qe-d41-si-smoke-20261029-arm64-first-failed` dizininde
saklanır. O denemede geniş pencere QE 6.7 projwfc tarafından daraltıldı;
enerji gridleri eşleşmediği için API sonuç yayımlamadı. Başarısızlık
özetleri değiştirilmedi. Sonlu kabul eşikleri bu test nedeniyle gevşetilmedi.

MoS₂ D4.1'in altı yeni karşılaştırma hesabı henüz çalıştırılmadı.
