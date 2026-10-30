# HPC hazırlık paketi — hesap çalıştırılmadı

`0fd12f212b6601b32a4b6aa39c3ec820cecb096c` kaynak commit'inden dört sabit D5 adayı için taşınabilir başlangıç paketi üretildi. Kaynaklar commit içeriğiyle eşleşti; paket dosya hash'leri yeniden kontrol edildi ve taşınmış `tools/qe_hpc_init.py --inspect` çalıştı. Slurm dosyaları `bash -n` ile denetlendi. Kimlik ve SHA-256 değerleri `inspection.json`, tam dosya listesi `package-manifest.json` içindedir.

**QE çalıştırılmadı, Slurm işi gönderilmedi.** `nstep=0` bile bu doğrulamada yürütülmedi. 128 GiB RAM kapasitesi/64 GiB boş scratch/8 thread yalnız örnek operatör bütçesidir; ölçülmüş gereksinim veya tam hesabın sığacağına dair kanıt değildir. Kaynak profili `execution_enabled=false` içerir. Tam SCF, relaksasyon, spin veya kusur karşılaştırması için fiziksel kabul üretilmez.

Paket kaynakları ve girdileri `[dosya yolu → SHA-256]` manifestiyle sabittir. Aynı kaynak commit'inden, [HPC kılavuzundaki](../../docs/qe-hpc-preparation.md) komutlarla yeniden üretilebilir. Kaynak commit'ini ve profile dosyasını koruyarak CLI çıktısını inceleyin; bir sonraki commit'in farklı kaynak kimliği farklı bir paket manifesti üretir. Linux/HPC erişimi sağlanana kadar bu aşama kod ve protokol hazırlığı olarak kalır.
