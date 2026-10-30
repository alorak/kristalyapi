# Gerçek Si aşama sınırında duraklatma/devam — geçti

Kaynak `65f5d221df01e91e847d2b98ee8af63006d50046`, QE 6.7MaX/arm64, API 0.4.3.
Container içindeki server ve pipeline/checkpoint kaynak hash'leri host
kaydıyla işten önce eşleştirildi. Bu bir işleyiş testidir; fiziksel
Si/MoS₂ yakınsama kabulü değildir.

İş `18081a90975740d7af4c10982cfc74b7` gerçek SCF çalışırken API'den duraklatıldı.
SCF tamamlandıktan sonra `paused` durumuna geçti; sonuç endpointi 409
verdi. Aynı kimlikte Devam isteği işi tekrar kuyruğa aldı ve bütün altı QE
aşaması tamamlandı. Son manifest `resume_count=1`, tanı `execution_attempt=2`.

Devam öncesi SCF stdout SHA-256:
`9a32a6be6f483b2b7f6050b4581f252818e6844a5afec0991ed2c3ee29c928b2`.
Sonuç API'sinin SCF stdout hash'i ve son ham SCF dosyası aynıdır; SCF
tekrar çalıştırılmadı. Checkpoint ve son manifest hash zinciri testte
bağımsız eşleştirilir. Dosya/scratch, kod, UPF ve çözücü sözleşmesi
worker tarafından devamdan önce denetlendi.

Dosyalar: `pause-api.json`, `paused-checkpoint.json`, `result.json`,
`pipeline/` ve `diagnostics.json`. İstek iki atomlu Si, 45/360 Ry,
8 bant/k2 ve −4…10 eV ortak DOS/PDOS penceresini kullanır. 1401 ortak
nokta, atomik projeksiyonlar ve ayrı 16 durumluk tam integral kontrolü
geçti. Geçici container ve volume'ler kaldırıldı.

Scratch dosyaları işleyiş sırasında hash ile denetlendi; bu küçük kanıt
paketi ham dalga fonksiyonlarını dağıtmaz. Metadata/hashes korunur.
