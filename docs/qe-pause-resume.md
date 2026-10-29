# Tamamlanan elektronik aşama sınırında duraklatma / devam

API 0.4.3 elektronik işlerde aşama sınırında duraklatmayı destekler.
DFT panelinde **Elektronik işi aşama sonunda duraklat** seçildiğinde
aktif QE aşamasının tamamlanması beklenir. Bir sonraki aşama başlamadan
`paused` durumuna geçilir. Son aşama zaten bittiyse iş tamamlanır.
Bu işlem çalışan SCF iterasyonunu veya iyonik adımı ortadan kesip
oradan devam etme desteği vermez. SCF/relaksasyon tekil işlerinde bu
sürümde duraklatma düğmesi etkinleşmez.

`POST /api/v1/calculations/{id}/pause` yalnız çalışan elektronik işte;
`POST .../resume` yalnız temiz duraklatılmış, kayıtlı checkpoint hash'i
olan işte kabul edilir. Kimlik, girdi ve parametreler aynı kalır. Tekrar
Devam seçildiğinde aynı iş yalnız bir kez kuyruğa girer. En fazla 20 devam
vardır; duraklatılan işler de 10 işlik bekleyen kapasitesine dahildir.
İptal edilen, zaman aşımına uğrayan, başarısız veya worker kesintisinde
kalan bir iş bu yolla devam ettirilmez.

Checkpoint, tamamlanan aşamaların manifestini ve scratch dahil bütün
dosyaların SHA-256 envanterini içerir. API veritabanı checkpoint dosyasının
kendi hash'ini de saklar. Devam öncesinde kaynak girdi, UPF'ler, yol/örgü/
bant/DOS ayarları, Python kodları, QE çalıştırılabilir dosyaları ve dosya
envanteri eşleşmelidir. Değişiklikte yeniden hesap yapılmadan hata verilir.
Yalnız tamamlanan aşamalar atlanır; ham girdi/çıktı hash'leri korunur.
Bütün aşamalar tamamlanmadan sonuç endpointi 409 döndürür.

Duraklatma aktif aşama uzun sürerse hemen sonuçlanmaz; iptal düğmesi
mevcut sonlandırma davranışını sürdürür. İptal/duraklatma yarışında iptal
önceliklidir. Her devam için süre sınırı ve kaynak ölçümü yeni çalıştırmaya
aittir; önceki tamamlanan aşamaların süreleri manifestte korunur.

CLI operatör kullanımı (aynı dosyalar/komutlar korunmalıdır):

```sh
python tools/qe_pipeline.py --input source.in --pseudo-dir pseudo --workdir run \
  --band-path path.txt --nbnd 26 --nscf-k 16 --pdos --pause-file pause.request --run
# Başka bir terminalde touch pause.request; aktif aşamanın bitmesini bekle.
# paused / çıkış 75 alındıktan sonra:
rm pause.request
python tools/qe_pipeline.py --input source.in --pseudo-dir pseudo --workdir run \
  --band-path path.txt --nbnd 26 --nscf-k 16 --pdos --pause-file pause.request --resume --run
```

CLI'nin doğrudan kullanımında operatör checkpointi korumalıdır; API,
veritabanındaki ayrı hash'i `--expected-checkpoint-sha` ile zorunlu kılar.
Bu uygulama temiz aşama sınırlarını kullanır. QE'nin kendi `restart_mode`
ile iterasyon içi restart'ı ayrı bir protokoldür; [resmî QE belgesi](https://www.quantum-espresso.org/Doc/pw_user_guide/node20.html)
temiz sonlandırma gerektirir.
