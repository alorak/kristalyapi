# DFT sunucusunu çalıştırma ve ilk gerçek Si hesabı

Bu kılavuz Linux veya macOS üzerinde, depo kökünden çalıştırılan Docker Compose ve Python 3 komutlarını kullanır. Arayüzden küçük bir gerçek Quantum ESPRESSO hesabına kadar gereken adımları bir araya getirir.

## 1. Hangi parça neyi çalıştırır?

| Parça | Örnek adres / servis | Görevi |
| --- | --- | --- |
| KristalYapı arayüzü | `http://127.0.0.1:8840/index.html#dft` | Yapı ve hesap hazırlığı, iş takibi, sonuç grafikleri |
| QE API | `http://127.0.0.1:8000` / `qe-api` | Bağlantı kontrolü, ön kontrol, kuyruk, geçmiş ve sonuçlar |
| QE worker | `qe-worker`; HTTP portu yok | Kuyruktan işi alıp gerçek `pw.x`, `bands.x`, `dos.x`, `projwfc.x` işlemlerini çalıştırır |

**Arayüzü açmak hesaplama sunucusunu başlatmaz.** İş göndermek için hem API hem worker çalışmalı, hesap alımı açık olmalı, UPF profili ve erişim anahtarı eşleşmelidir. `/api/health` yanıtının `ready` olması yalnız motorun hazır olduğunu gösterir; ayrıca `/api/capabilities` içindeki `job_submission_enabled` alanını kontrol edin.

Depodaki varsayılan `.env.example` hesap alımını kapatır (`QE_JOBS_ENABLED=0`). Aşağıdaki örnek, yalnız aynı bilgisayardan erişilen hesap alımını açıkça etkinleştirir.

## 2. Gereksinimler ve adresler

- Docker Engine veya çalışan Docker Desktop; `docker compose` komutu.
- Python 3; arayüzü depodan sunacaksanız Node.js 22+ ve npm.
- 8000 ve 8840 portlarının kullanılabilir olması.
- Gerçek UPF dosyası, kaynağı/lisansı ve doğrulanmış SHA-256 değeri.

```sh
docker version
docker compose version
python3 --version
git rev-parse HEAD
```

Docker Desktop kullanıyorsanız uygulamayı açıp motor hazır olana kadar bekleyin. `compose.qe.yml` her konteyneri 2 GiB RAM ve 2 CPU ile sınırlar; bu, ana bilgisayarın toplam RAM gereksinimi değildir. İlk denemeyi aşağıdaki **iki atomlu Si** örneğiyle yapın. Bu limitlerin büyük MoS₂/kusur hesaplarına yeterli olduğu varsayılmaz.

Bu kılavuzda UI portu **8840**, API portu **8000**. Böylece README'deki arayüzü 8000 portunda sunma örneğiyle API portu çakışmaz.

## 3. Doğrulanmış Si UPF'si, profil ve özel ayar dosyası

Aşağıdaki komutu depo kökünde çalıştırın. UPF adresi, SHA-256 ve lisansı sürümlü [Si planından](../tests/fixtures/qe/si-scf-acceptance.json) alınır. Dosya mevcutsa hash'i yeniden kontrol edilir; farklı dosya sessizce üzerine yazılmaz. Profil, API anahtarı ve hesap çıktıları Git'e eklenmeyen yerel dosyalarda tutulur.

**Mevcut `.env.dft-local` varsa komut durur.** Yeni anahtar üretip mevcut kurulumun anahtarını değiştirmek yerine bu dosyayı düzenleyin.

```sh
python3 - <<'PY'
import hashlib, json, os, secrets, urllib.request
from pathlib import Path

root = Path.cwd()
env_file = root / '.env.dft-local'
if env_file.exists():
    raise SystemExit('Mevcut .env.dft-local korunuyor; önce dosyayı inceleyin.')
plan = json.loads((root / 'tests/fixtures/qe/si-scf-acceptance.json').read_text())
meta = plan['pseudopotential']
profiles = root / 'qe-local/profiles'
pseudos = root / 'qe-local/pseudos'
for folder in (root / 'qe-local', profiles, pseudos):
    folder.mkdir(parents=True, exist_ok=True)
    folder.chmod(0o755)
upf = pseudos / meta['filename']
if upf.exists():
    raw = upf.read_bytes()
else:
    with urllib.request.urlopen(meta['url'], timeout=60) as response:
        raw = response.read()
actual = hashlib.sha256(raw).hexdigest()
if actual != meta['sha256']:
    raise SystemExit('UPF SHA-256 eşleşmedi; dosya/profil yazılmadı: ' + actual)
profile = {
    'schema': 'kristalyapi.upf-profile.v1', 'id': 'si-pbe', 'functional': 'PBE',
    'elements': {'Si': {
        'file': meta['filename'], 'sha256': actual, 'source': meta['url'],
        'license': meta['license'], 'functional': 'PBE'
    }}
}
profile_file = profiles / 'si-pbe.json'
if profile_file.exists() and json.loads(profile_file.read_text()) != profile:
    raise SystemExit('Mevcut si-pbe.json farklı; üzerine yazılmadı.')
if not upf.exists():
    upf.write_bytes(raw)
upf.chmod(0o644)
profile_file.write_text(json.dumps(profile, indent=2) + '\n')
profile_file.chmod(0o644)
settings = [
    'QE_JOBS_ENABLED=1',
    'QE_API_TOKEN=' + secrets.token_urlsafe(40),
    'QE_API_BIND_IP=127.0.0.1', 'QE_API_PORT=8000',
    'QE_ALLOWED_HOSTS=localhost,127.0.0.1',
    'QE_ALLOWED_ORIGINS=http://127.0.0.1:8840,http://localhost:8840,https://alorak.github.io',
    'QE_TRUSTED_PROXY_IPS=127.0.0.1',
    'QE_PROFILE_DIR=' + json.dumps(str(profiles)),
    'QE_PSEUDO_DIR=' + json.dumps(str(pseudos)),
    'QE_JOB_TIMEOUT=1200', 'QE_RESOURCE_PROFILE_FILE='
]
fd = os.open(env_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
with os.fdopen(fd, 'w') as handle:
    handle.write('\n'.join(settings) + '\n')
print('Si UPF doğrulandı:', actual)
print('Hazır: qe-local/profiles/si-pbe.json ve .env.dft-local')
print('API anahtarı konsola yazılmadı; arayüz için .env.dft-local dosyasından alın.')
PY
```

Beklenen Si SHA-256:

```text
669fb75395a9d26973b0ea1ce8223bbcb30d3396c5d48bf5e794d1243c52375a
```

UPF/profil dosyaları konteynerdeki kullanıcı tarafından okunabilmeli; bağlar salt okunurdur. Anahtar dosyası ise özel tutulur. `.env.dft-local` ve `qe-local/` depodaki `.gitignore` kapsamındadır. Si profili Mo/S/O içermez; MoS₂ veya oksijenli kusurlarda ilgili elementler için ayrıca doğrulanmış profil gerekir.

## 4. API ve worker'ı başlatın

Aynı terminalde, depo kökünde aşağıdaki yardımcı fonksiyonu tanımlayın. Yeni terminal açarsanız fonksiyonu yeniden tanımlayın. Sabit Compose proje adı `kristalyapi-dft`, bu kurulumun durum hacmini diğer denemelerden ayırır.

```sh
dft_compose() {
  docker compose --env-file .env.dft-local -p kristalyapi-dft -f compose.qe.yml --profile compute "$@"
}

dft_compose config --quiet
dft_compose build qe-api
dft_compose up -d --no-build qe-api qe-worker
dft_compose ps
```

**Build tamamlandıktan sonra `up` komutunu çalıştırın.** API ve worker aynı imajı kullanır; yalnız eski imajla `up --no-build` çalıştırmak yeni kodu yüklemez. Dockerfile QE Debian paketini `6.7-3+b1` sürümüne sabitler; aşağıdaki kayıtlı gerçek testlerde motor `6.7MaX` olarak raporlandı.

```sh
curl --fail --silent --show-error http://127.0.0.1:8000/api/health
curl --fail --silent --show-error http://127.0.0.1:8000/api/capabilities
```

API başlangıcı sürüyorsa biraz bekleyip yeniden deneyin. Beklenenler:

- Sağlık: `status=ready`, `read_only=false`.
- Yetenekler: `engine.available=true`, `job_submission_enabled=true`.
- `pw.x`, `bands.x`, `dos.x`, `projwfc.x` kullanılabilir.
- Kaynak profili yürütmeye izin verir (`resource_profile.execution_enabled=true`).

Worker HTTP servisi sunmadığından `healthy` ibaresi taşımayabilir; `Up` olması beklenir. `--profile compute` veya `qe-worker` eksikse API açıkken işler kuyrukta kalabilir. `scientific_calculation_performed=false` keşif yanıtının sabit alanıdır; geçmişte hiç iş yapılmadığını gösteren bir sayaç değildir. Çalıştırılmış iş için iş durumu ve sonuç uçlarını kullanın.

## 5. Arayüzü bağlayın ve ilk hesabı gönderin

Yayındaki [KristalYapı DFT](https://alorak.github.io/kristalyapi/#dft) sayfasını kullanabilir veya ayrı bir terminalde yerel arayüzü başlatabilirsiniz:

```sh
npm install --no-save --ignore-scripts @spglib/moyo-wasm@0.21.0
mkdir -p vendor
cp node_modules/@spglib/moyo-wasm/moyo_wasm.js vendor/
cp node_modules/@spglib/moyo-wasm/moyo_wasm_bg.wasm vendor/
python3 -m http.server 8840 --bind 127.0.0.1
```

Yerel adres: **http://127.0.0.1:8840/index.html#dft**. Arayüz sunucusunun terminali açık kalmalıdır; bu terminalde `Ctrl+C` yalnız arayüzü durdurur. `file://` ile açmayın.

1. **DFT → Ayarlar:** API adresini `http://127.0.0.1:8000`, profil kimliğini `si-pbe` yapın. `.env.dft-local` içindeki `QE_API_TOKEN` değerini erişim anahtarına kopyalayın.
2. **Docker / QE bağlantısını kontrol et:** Sunucu hazır olduğunda **İşler ve kaynaklar** sekmesi açılır. Anahtar yalnız sayfa belleğinde tutulur; sayfa yenilenirse yeniden girilir.
3. **Hesap hazırlığı:** **Si · işlev sınaması** protokolünü seçip **Referansı yeni çalışma alanında hazırla** düğmesine basın. Böylece mevcut yapıyı değiştirmeden iki atomlu Si hazırlanır. Yalnız ayarları aktarmak aktif yapıyı küçültmez; ilk testte iki atom bulunduğunu kontrol edin.
4. **Sunucuda hesapla** yöntemini kullanın. Si protokolü `SCF → bant → DOS / PDOS` akışını; 45/360 Ry, SCF ve NSCF için 2×2×1 örgü, nbnd=8, açık Γ→X yolunu ve −4…10 eV DOS penceresini hazırlar. DOS adımı 0.01 eV, genişliği 0.005 Ry'dir.
5. Spinsiz akış 6 aşamadır. Kayıtlı spin denemesini tekrarlamak için elektronik spin modunu **kollineer spin** seçin, başlangıç tohumuna `Si 0.1`, SCF Gaussian genişliğine `0.01` Ry girin. Bu akış iki ayrı `bands.x` işlemiyle 7 aşamadır. Ayrıntılar: [spin kılavuzu](qe-collinear-spin.md).
6. **İşler ve kaynaklar → Aktif yapıyı ön kontrol et:** Yapı/UPF doğrulaması geçmeli. Bu adım hesap başlatmaz.
7. **Gerçek hesabı gönder:** Gösterilen onayı kabul ettiğinizde yeni iş başlar. İş kimliğini kaydedin; durumunu izleyin. Sayfayı yeniden açarsanız anahtarı girip iş geçmişinden aynı işi seçebilirsiniz.
8. `completed` sonrasında **Hesabın sonuçlarını aç** ile enerji, bant/DOS/atom-orbital PDOS ve kaynak raporunu inceleyin. Hesap özeti yapı ve sonuç kimliği eşleşmesini ayrıca gösterir.

Küçük Si testi işleyişi denetler. Başarılı SCF veya `completed` tek başına kesme enerjisi, k-örgüsü, spin, boş bant, manyetik temel durum ya da optik doğruluk kabulü değildir. MoS₂ ve büyük kusurlar için [hesap protokolünü](qe-defect-compute-protocol.md) ve [kaynak hazırlığını](qe-hpc-preparation.md) izleyin.

## 6. İsteğe bağlı: aynı küçük işi terminalden gönderin

Bu bölüm tarayıcıdan göndermenin alternatifidir. Her çalıştırma **yeni bir gerçek iş** oluşturur. API/worker açık olmalı; aşağıdaki sürümlü istek, yukarıdaki Si profiliyle 7 aşamalı küçük spin işidir. Python standart kütüphanesi yeterlidir.

```sh
python3 - <<'PY'
import datetime, json, time, urllib.request
from pathlib import Path

env = dict(line.split('=', 1) for line in Path('.env.dft-local').read_text().splitlines()
           if line.strip() and not line.lstrip().startswith('#') and '=' in line)
base = 'http://127.0.0.1:' + env.get('QE_API_PORT', '8000')
headers = {'Authorization': 'Bearer ' + env['QE_API_TOKEN'], 'Content-Type': 'application/json'}
payload = json.loads(Path('validation-results/qe-spin-si-20261030-main-7f38e9e/request.json').read_text())
out = Path('qe-local') / ('si-check-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
out.mkdir(exist_ok=False)
def save(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n')
def api(path, method='GET', body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)
save('request.json', payload)
save('preflight.json', api('/api/v1/calculations/validate', 'POST', payload))
created = api('/api/v1/calculations', 'POST', payload)
save('created.json', created)
job_path = '/api/v1/calculations/' + created['job_id']
print('Yeni iş:', created['job_id'], '| Yerel kayıt:', out)
deadline = time.monotonic() + 1300
while True:
    job = api(job_path)
    save('job.json', job)
    if job['status'] not in ('queued', 'running'):
        break
    if time.monotonic() > deadline:
        raise SystemExit('İzleme süresi doldu; aynı işi geçmişten inceleyin. Yeniden gönderim yapılmadı.')
    time.sleep(2)
for suffix in ('diagnostics', 'summary', 'logs'):
    save(suffix + '.json', api(job_path + '/' + suffix))
if job['status'] != 'completed':
    raise SystemExit('İş tamamlanmadı: ' + str(job.get('error') or job['status']))
result = api(job_path + '/results')
save('result.json', result)
print('Tamamlandı:', result['energy_ry'], 'Ry | SCF:', result['scf_converged'])
PY
```

Bu çıktı dizini API yanıtlarını ve log kuyruğunu korur; tam ham kanıt paketi değildir. İşin tam girdilerini, aşama çıktılarını ve projeksiyon dosyalarını aşağıdaki gibi ayrıca kopyalayın. Anahtar, bu JSON çıktılarına yazılmaz.

## 7. Log, ham kanıt, durdurma ve güncelleme

Aşağıdaki komutlarda bölüm 4'teki `dft_compose` fonksiyonu tanımlı olmalıdır.

```sh
dft_compose logs --tail 100 qe-api qe-worker

# İş tamamlandıktan sonra JOB_ID yerine kaydettiğiniz 32 haneli kimliği yazın.
# Hedef klasör yeni olmalı; bütün iş klasörünü kopyalar.
dft_compose cp qe-api:/var/lib/qe/runs/JOB_ID ./qe-local/si-run-backup

# Konteynerleri durdurup kaldırır; qe-state hacmi ve iş geçmişi korunur.
dft_compose down
```

`qe-state` hacmi SQLite geçmişini ve iş dosyalarını tutar. **`down --volumes` / `down -v` bu hacmi siler**; ham verileri ve uygun bir veritabanı yedeğini almadan kullanmayın. Çalışan işleri önce tamamlayın, iptal edin veya desteklenen elektronik aşama sınırında duraklatın. [Duraklatma/devam kılavuzu](qe-pause-resume.md), [tanı ve kaynak raporu](qe-job-diagnostics.md).

Kod güncellemesinden sonra `dft_compose build qe-api` bitmeli; ardından `dft_compose up -d --no-build qe-api qe-worker` ile konteynerler yeni imajı almalıdır. `.env.dft-local`, UPF profili ve durum hacmini koruyun. Kod/UPF/kaynak profili değişirse eski elektronik checkpoint'in devamı reddedilebilir; [checkpoint sözleşmesini](qe-pause-resume.md) inceleyin.

## 8. Sık karşılaşılan durumlar

| Belirti | Kontrol / çözüm |
| --- | --- |
| Docker soketine bağlanılamıyor | Docker Desktop/Engine çalışıyor mu? `docker version` sunucu bilgisini vermeli. |
| 8000 portu dolu | Statik UI'yi 8840'ta sunun veya API portunu değiştirip arayüz adresini eşitleyin. |
| API hazır ama İşler kapalı | `QE_JOBS_ENABLED=1`, geçerli anahtar, `job_submission_enabled=true` ve yürütmeye izin veren kaynak profili gerekli. Ayar değişince konteynerleri yeniden oluşturun. |
| `401` | Anahtar, çalışan API'nin `.env.dft-local` değeriyle aynı mı? Yenilemeden sonra tekrar girildi mi? |
| `403` | Anahtarlı işler için aynı bilgisayarda loopback HTTP kullanın; LAN'daki başka cihaz için HTTPS gerekir. |
| `Failed to fetch` | Önce `curl` ile API'yi kontrol edin. Sonra UI origin'inin host **ve portuyla** `QE_ALLOWED_ORIGINS` içinde olduğuna, Host izinlerine ve tarayıcı yerel ağ iznine bakın. `localhost` ile `127.0.0.1` farklı origin'dir. |
| `422`, profil/UPF bulunamadı veya SHA hatası | `si-pbe.json`, `Si.UPF`, hash, element başlıkları ve konteynerin dosyaları okuyabildiğini denetleyin. Hash'i hatayı gizlemek için yeni dosyaya göre değiştirmeyin. |
| İş `queued` durumunda kalıyor | `qe-worker` çalışıyor mu? Compute profili açık mı? `dft_compose logs --tail 100 qe-worker` çıktısını okuyun. |
| OOM / süre aşımı / `failed` | Sonuç ve kaynak raporunu okuyun; başarısız işi yakınsamış saymayın. Büyük kusur hesabında limitleri körlemesine artırmak yerine kaynak/HPC protokolünü izleyin. |
| Yeni kod görünmüyor | İmajı yeniden build edin; UI için güncel dosyaları sunup sekmeyi yenileyin. Eski Service Worker kabuğu yüklenmiş olabilir. |

Yerel dışı anahtarlı kullanım HTTPS/proxy yapılandırması gerektirir. Bu localhost örneği internete açılan, çok kullanıcılı bir servis kurulumu değildir. Ayrıntılar: [Docker/CORS](qe-docker-api.md), [iş API'si](qe-jobs.md), [elektronik işler](qe-electronic-jobs.md).

## 9. Hangi çalışma gerçekten denendi?

30 Ekim 2026 tarihli kayıtlı denemede `7f38e9e31c018a431863e594301ca6eeec61ee3a` kaynağı gerçek Docker API/worker ile çalıştırıldı. İş `1448b3cb1f17444d89a08100840860ef`: 7/7 aşama, `1.2e-9 Ry` SCF hata tahmini, `-22.47662949 Ry` toplam enerji, spin başına 8 bant ve 1401 DOS örneği. UPF ve imajdaki kaynak SHA-256 değerleri de kontrol edildi. [Ham kanıt ve açıklama](../validation-results/qe-spin-si-20261030-main-7f38e9e/INCELEME.md), [doğrulama sonucu](../validation-results/qe-spin-si-20261030-main-7f38e9e/verification.json).

Sonraki küçük canlı denemede `d66ae4755f6b42dda27a344348e6aa24` işi arayüzden API'ye bağlanılarak incelendi: iş geçmişi filtreleri, kaynakla eşleşen özet, kaynak raporu ve iki spin kanalının altı grafiği doğrulandı. Deneme ortamları kapatıldı; o geçici API adresi kalıcı bir servis değildir.

En son `2d3455574c6c5a8033e0afce74bcd590717a8389` sürümünde `127.0.0.1:8840` üzerinden yapılan başlatma ise **arayüz önizlemesiydi**; bu commit için yeni bir gerçek QE işi çalıştırıldığı iddia edilmez. Bu kılavuz yazılırken de yeni DFT hesabı başlatılmadı. Kendi makinenizde API/worker'ı çalıştırmak için yukarıdaki kurulum adımlarını uygulayın.

Arşivlenmiş gerçek hesabı yeniden hesap yapmadan denetlemek için:

```sh
python3 tools/qe_spin_acceptance.py --verify validation-results/qe-spin-si-20261030-main-7f38e9e
```

Bu komut mevcut ham dosyaları okur ve hash/girdi/sonuç tutarlılığını kontrol eder; Docker veya yeni QE işi başlatmaz.
