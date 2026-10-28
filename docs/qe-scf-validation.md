# D2.1 — Gerçek Docker/API Si SCF doğrulaması

D2.1 kabulü, gerçek `pw.x` ve hash ile sabitlenmiş gerçek Si UPF dosyası
kullanarak API'den SCF işi gönderme, tam çıktıyı saklama ve sonucu bağımsız
kontrol etme kapısıdır. Mock solver/UPF bu kapıda kullanılmaz.

## Tekrar çalıştırma

Python 3.11+, yerel Docker Engine/Desktop ve `docker compose` gerekir.
Python paket kurulumu gerekmez. Depo kökünde:

```bash
python3 tools/qe_scf_acceptance.py --run \
  --output validation-results/qe-si-local

# Aynı kanıtları Docker veya ağ kullanmadan yeniden denetle:
python3 tools/qe_scf_acceptance.py --verify validation-results/qe-si-local
```

Çıktı klasörü yeni olmalıdır; var olan kanıtlar üzerine yazılmaz.
`--run` açıkça verilmedikçe fizik hesabı başlatılmaz. Sabit hash ile aynı
UPF dosyası zaten varsa `--upf /tam/yol/Si.UPF` seçeneği kullanılabilir.
Farklı içerik reddedilir; sahte pseudopotansiyel veya alternatif çözücüye
geçiş yapılmaz.

Komut, kaynak ve hash'i sabitlenmiş UPF'yi indirir, geçici bir profil ve
rastgele API anahtarı üretir, Docker imajını derler ve benzersiz bir Compose
projesi başlatır. API yalnız otomatik seçilen `127.0.0.1` portunda açılır.
Her iş `validate → submit (202) → poll → results` akışından geçer.
Anahtarsız iş erişiminin 401 verdiği de doğrulanır. Tam girdi/çıktılar
alındıktan sonra testin konteynerleri, ağı, hacmi ve geçici anahtarı kaldırılır.
Başarısız koşu da `failed` özeti ve mevcut günlükleri bırakır.

## Sabit sistem ve önceden tanımlı ölçütler

Plan: [si-scf-acceptance.json](../tests/fixtures/qe/si-scf-acceptance.json).

- İki atomlu elmas Si primitive hücresi; sabit konvansiyonel örgü sabiti
  5.431 Å. Geometri optimize edilmez.
- PBE, spin polarizasyonu yok, `occupations='fixed'`; QE SCF eşiği
  `conv_thr=1e-8 Ry`, k-örgüsü kaydırması `0 0 0`.
- Gerçek [Si.pbe-n-rrkjus_psl.1.0.0.UPF](https://pseudopotentials.quantum-espresso.org/upf_files/Si.pbe-n-rrkjus_psl.1.0.0.UPF),
  A. Dal Corso / PSlibrary 1.0.0, [GPL-2.0-or-later](https://github.com/dalcorso/pslibrary#license).
  SHA-256: `669fb75395a9d26973b0ea1ce8223bbcb30d3396c5d48bf5e794d1243c52375a`.
- Kesme enerjisi örnekleri: 45/360, 60/480 ve 75/600 Ry
  (`ecutwfc/ecutrho`), sabit 8×8×8 k-örgüsü.
- K-örgüsü örnekleri: 4×4×4, 6×6×6, 8×8×8, 10×10×10 ve 12×12×12,
  sabit 75/600 Ry. Ortak 75 Ry / 8×8×8 noktası tekrar kullanılınca
  toplam **yedi gerçek iş**.
- Son iki kesme enerjisi noktası ve son iki k-örgüsü noktası arasındaki
  mutlak toplam enerji farkı için ayrı ayrı **≤1 meV/atom** sınırı.
  Ölçütler koşudan önce plan dosyasında tanımlıdır; başarısızlık halinde
  program sıfırdan farklı kodla çıkar.

Her iş için şu kanıtlar birlikte zorunludur:

1. Aynı job ID ve yapı hash'i ile API ön kontrolü, gönderim, `completed`
   durumu ve sonuç. Yapı hash'i kaynak JSON'dan ayrıca hesaplanır.
2. Gerçek çıktıdan `Program PWSCF`, SCF yakınsama bildirimi, `JOB DONE.`,
   toplam enerji ve son `estimated scf accuracy ≤1e-8 Ry`.
3. API/raw çıktı toplam enerjisi uyumu (1e-8 Ry tolerans) ve doğru Ry/eV
   dönüşümü. Yalnız API'deki başarı bayrakları yeterli değildir.
4. Gerçek girdinin hücre, atom, k-örgüsü, kesme enerjisi ve SCF protokolü
   ile kaynak isteğin eşleşmesi.
5. Ham girdi/çıktı SHA-256 ve worker'ın iş dizinine kopyaladığı gerçek UPF
   SHA-256 değerlerinin eşleşmesi.

## Kanıt paketi ve CI

Paket `plan.json`, `summary.json`, okunabilir `README.md`, kaynak commit ve
kod hash'leri, Docker imaj kimliği, mimari/sürümler, UPF kaynak/lisans/hash'i,
her işin API izi, sonucu ve tam `structure.in/out/stderr` dosyalarını içerir.
API anahtarı pakete yazılmaz. `api-audit.json` istek yöntemini, yolu, HTTP
kodunu ve yanıtı saklar; Authorization başlığı saklanmaz.

[Manuel GitHub Actions workflow'u](../.github/workflows/qe-docker-smoke.yml)
aynı komutu Linux üzerinde çalıştırır, çevrimdışı kanıt denetimini tekrarlar
ve başarılı/başarısız çıktı paketini 30 gün saklar. Normal CI yalnız kanıt
kontrolünün negatif birim testlerini çalıştırır; otomatik PR kontrolleri
fiziksel DFT hesabı başlatmaz.

## Kabulün sınırı

Bu, belirtilen Si geometrisi/UPF/protokolü için gerçek SCF ve sınırlı enerji
hassasiyeti doğrulamasıdır. Son iki noktadaki enerji farkı, tüm parametreler
ve gözlenebilirler için yakınsama garantisi değildir. Kafes relaksasyonu,
fononlar, bağımsız fiziksel referansla doğruluk, MoS₂, kusur/spin/SOC,
gevşeme ve optik çıkarımlar ayrı kabul adımlarıdır. Tekil iş sonuçlarındaki
`scientific_convergence_study_completed=false` alanı korunur; bu sınırlı
çoklu koşu denetimi ayrı D2.1 raporunda bulunur.
