# Gerçek Docker/API bant kapasitesi ön kontrolü

Kaynak `bbd626b`, resmi hash eşleşmeli Mo/S UPF dosyaları, gerçek QE
hazır Docker API/worker; **DFT hesabı gönderilmedi**.

- D3 son MoS₂ yapısında 26 bantlık validate isteği 200 verdi.
- Gerçek UPF v2 başlıkları: Mo=14, S=6; 26 nötr elektron, en az 13 bant.
- 12 bant hem `/validate` hem POST iş gönderiminde 422 ile reddedildi.
- GET kuyruk listesi boş kaldı. Herhangi bir solver hesabı açılmadı.
- 6 GiB/no-swap gerçek worker profili ve temiz kaynak kaldırma doğrulandı.
- Kaynak hash'leri kayıtlı Git commit'inden yeniden hesaplandı ve eşleşti.

`summary.json`, API audit ve container logları gerçek ön kontrol kanıtlarıdır.
Bu dosyalar D4 elektronik yapı fiziksel kabulü yerine kullanılmaz.
