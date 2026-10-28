# KristalYapı D0–D1: Docker Quantum ESPRESSO ve salt-okunur API

**Durum:** D0 = QE kurulu Docker imajı + ikili başlangıç smoke;
D1 = FastAPI **salt-okunur** sunucu keşfi ve KristalYapı'da IP:port
bağlantı kontrolü. **DFT işi gönderme / çalıştırma REST API'si henüz yoktur.**
Mevcut QE dosya alışverişi, Python `qe_run.py` ve `qe_pipeline.py`
iş akışları korunur.

## Gereksinimler

- Docker Engine / Docker Desktop ve `docker compose` komutu.
- En az yaklaşık 2 GB RAM; uygulamalı DFT hesaplamaları için daha
  fazla kaynak gerekecektir.
- Debian Trixie **Quantum ESPRESSO 6.7-3+b1** paketi.
  Paket sürümü bilerek sabitlenmiştir; bu paket güncel QE'nin tüm
  yeteneklerini garanti etmez. İmaj tabanı ve bağımlılık güncellemesini
  sonraki aşamada digest ve SBOM ile kilitlemek gerekir.
- CPU tabanlı çalışma; GPU, CUDA, MPI çok düğüm veya HPC desteklenmez.

## 1. Kendi bilgisayarınızda başlatın

Depoyu yerel olarak açın ve kök dizinde:

```bash
docker compose -f compose.qe.yml build
docker compose -f compose.qe.yml up -d

# Gerçek kurulu pw.x ikilisini BOŞ girdiyle başlatıp sürüm banner'ını kontrol eder
docker compose -f compose.qe.yml exec qe-api python3 qe_probe.py --require

curl -i http://127.0.0.1:8000/api/health
curl -i http://127.0.0.1:8000/api/capabilities

# Durdurmak için
docker compose -f compose.qe.yml down
```

`qe_probe.py --require` gerçek `pw.x` işlemini boş girdiyle
başlatır. Hata kodu dönebilir ama `Program PWSCF v...` banner'ı
beklenir. **Bu bir DFT toplam enerji/SCF hesabı değildir**; UPF
ve yapı verisi gerektiren fiziksel smoke testi ileriki D-P0 aşamasıdır.
API `/api/health` yalnız başarılı binary probe varsa 200 `ready`
verir, aksi durumda 503 `degraded` döner. QE sürümü
`/api/capabilities` üzerinden okunabilir.

Örnek yanıt şeması (gerçek sürüm çalışma zamanı probe'undan gelir):

```json
{
  "api_version": "0.1.0",
  "engine": {
    "id": "quantum-espresso",
    "version": null,
    "available": false
  },
  "binaries": {
    "pw.x": false,
    "bands.x": false,
    "dos.x": false,
    "projwfc.x": false
  },
  "supported_operations": ["health", "capabilities"],
  "job_submission_enabled": false,
  "calculations_executed_by_api": false,
  "binary_smoke": "unverified",
  "scientific_calculation_performed": false
}
```

Bu yalnız **sözleşme örneğidir**; örnekteki `null/false` değerler
gerçek konteyner sonucunu temsil etmez.

## 2. Aynı LAN'daki cihazdan IP/port ile erişim (açık etkinleştirme)

**Varsayılan güvenli ayar** Docker portunu yalnız
`127.0.0.1:8000` üzerinde yayımlar; başka bilgisayar göremez.

Sadece güvenilir özel ağda, IP adresi gerçekten host'a aitse:

```bash
QE_API_BIND_IP=192.168.1.50 \
QE_API_PORT=8000 \
QE_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50 \
docker compose -f compose.qe.yml up -d --build
```

Kullanıcı tarayıcısında **KristalYapı → DFT → Docker hesaplama sunucusu**
alanına `http://192.168.1.50:8000` girin ve **Bağlantıyı kontrol et**
düğmesine basın. Sayfa açılırken otomatik LAN isteği gönderilmez;
sunucu IP'si yerel depolamaya kaydedilmez.

Yalnız güvenilir cihazlara firewall izni verin; Docker API'sinin bu
sürümü **kimlik doğrulamalı bir hesaplama servisi değildir**. Portu
internete / router port-forwarding üzerinden açmayın. Gelecekte
iş gönderme eklendiğinde HTTPS, authentication, rate-limit, worker
izolasyonu ve kota ayrıca zorunlu olacaktır.

## 3. HTTPS GitHub Pages, CORS ve tarayıcı izinleri

İzinli origin varsayılan olarak **yalnız**
`https://alorak.github.io`. Geliştirme için diğer origin'ler
açıkça `QE_ALLOWED_ORIGINS` içine virgülle eklenebilir; `*`
wildcard kabul edilmez. Browser'ın göndereceği `Host` başlığı da
`QE_ALLOWED_HOSTS` içinden geçirilir. Bunlar **kimlik doğrulama değildir**.

Özel ağ IP'sine `http://` ile giden istekler tarayıcının sürümüne,
Local Network Access iznine ve mixed-content politikasına göre
engellenebilir. Chrome, yerel ağ erişimi için kullanıcı izni
isteyebilir. Her tarayıcıda genel bir HTTP istisnası varsayılmamalı.
Güvenilir kullanım için yerel DNS + geçerli sertifikayla HTTPS
reverse proxy önerilir; ör. `https://qe.home.example`. Proxy
üzerinden erişilecekse `QE_ALLOWED_HOSTS` ve
`QE_ALLOWED_ORIGINS` değerlerini buna göre düzenleyin. Bu
D0–D1 paketi **TLS reverse proxy kurmaz**.

Tarayıcıda `Failed to fetch` hatası, sunucu kapalı olduğu kadar
CORS, yerel ağ izni veya HTTP/HTTPS kısıtı anlamına gelebilir.
Testi aynı bilgisayarda `curl` ile yaparak ağ katmanını ayrı
doğrulayın.

Kaynak: [Chrome Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access),
[FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/).

## 4. Güvenlik ve sınırlar

- **Sadece `GET /api/health` ve `GET /api/capabilities`**
  vardır; `POST /api/jobs`, job logu, iş kuyruğu ve dosya
  yükleme bulunmaz.
- API çalıştırılabilir komut, yapı, UPF adı veya herhangi bir dosya
  yolu **almıyor**. QE binary probe yalnız başlangıçta bir kez
  yapılır, her HTTP isteğinde `pw.x` çalışmaz.
- Konteyner root olmayan kullanıcı ile, read-only kök dosya
  sistemi, drop-all capabilities, pids/CPU/RAM sınırları ile
  çalışır; `/tmp` geçici bellek dosya sistemidir.
- Docker sürüm/fonksiyonel doğrulaması ile bilimsel hesaplama
  doğrulaması **farklı aşamalardır**. Bu iş için UPF içermez;
  sisteme uydurma pseudopotansiyel koymaz.
- Debian QE **6.7** ilk yerel baseline'dır. Hibrit
  fonksiyoneller, QE yeni sürüm özellikleri ve gerçek MoS₂
  yakınsaması için ayrı motor imajı / bilimsel referans gereklidir.

## 5. CI / doğrulama

```bash
python3 -m pip install fastapi==0.115.11 httpx==0.28.1
python3 -m unittest discover -s tests -p 'test_qe_api.py' -v
node --test tests/qe-api-client.test.mjs
docker compose -f compose.qe.yml config --quiet
```

Bunlar **mock QE ikilileri** ve yerel API sözleşmesini sınar.
Gerçek Docker imajının çekildiği, inşa edildiği, gerçek `pw.x`
başlatıldığı veya bilimsel SCF hesabı yapıldığı iddiası için
ayrı makine/CI kanıtı gerekir. İlk fiziksel kabul kapısı:
kontrollü UPF ile Si SCF ve MoS₂ SCF/relax referans koşumlarıdır.

## 6. Sonraki paket (D2 / D-P1)

Sürümlü yapı/job giriş şeması, sunucu tarafı doğrulama,
kimlik doğrulama, gerçek UPF profili, izole iş kuyruğu,
`POST /api/jobs` (202 + job_id), poll, iptal, loglar,
başarısızlık kontrolleri ve doğru sonuç kökeni. Kullanıcı
işi açıkça onaylamadan yeni bir fiziksel hesaplama
başlatılmayacak.
