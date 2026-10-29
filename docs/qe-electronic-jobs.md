# D4 — API üzerinden gerçek bant / DOS / atom-orbital PDOS

Durum: [Gerçek MoS₂ D4 kabulü geçti](../validation-results/qe-mos2-d4-20261029-amd64/INCELEME.md).
6/6 aşama, 26×61 bant, 3677 DOS noktası ve üç atomun orbital PDOS'u
ham QE/API verileriyle yerelde yeniden doğrulandı. Bu sonlu veri/işleyiş
kabulüdür; geniş elektronik yakınsama, SOC ve optik kapsamlar ayrı kalır.

Yeni `kristalyapi.qe-electronic-job.v1` şeması `calculation=electronic`
ve kesin alanlı `electronic` nesnesini kullanır: `nbnd` 1–128,
`nscf_k` 2–24, `band_path` 2–16 açık `crystal_b` noktası. Her nokta
`label`, üçlü `k` ve `segments` içerir. Son ağırlık 1, toplam bölüm
sayısı ≤300, kz=0 ve SCF ağı kz=1 olmalıdır. Yalnız PBE/spinsiz/sabit
doluluklu 2B slab akışı desteklenir. İş ön kontrolü gerçek hash eşleşmeli UPF v2 `PP_HEADER` içindeki
`element` ve `z_valence` alanlarından nötr elektron sayısını hesaplar.
`nbnd < ceil(nelec/2)` hem validate hem submit uçlarında, kuyruğa girmeden
422 olarak reddedilir. Worker aynı kontrolü önceden kuyruğa alınmış işler
üzerinde de tekrarlar. Eksik/yanlış/sonlu olmayan başlık reddedilir;
sonuçta `electronic_preflight` elektron/minimum/istenen bant sayısını kaydeder.
Boş bant sayısının fiziksel yeterliliği, spin ve yakınsama ayrıca doğrulanmalıdır;
bu gerekli kapasite ön koşulu bilimsel kabul değildir.

Worker mevcut `tools/qe_pipeline.py` işlevlerini bir alt süreç grubu olarak
kullanır: `scf → bands → bands.x → nscf → dos.x → projwfc.x`.
Kullanıcı dosya yolu, QE metni veya program adı gönderemez. Prefix/outdir
aynı pipeline içinde paylaşılır. Her aşama tamamlanmadan sonrakine geçilmez;
iptal ve toplam wall-time sınırı alt solver süreçlerini de sonlandırır.
Ham dosyalar, aşama manifesti ve atom/orbital PDOS dosya hash'leri korunur.
API ancak tüm aşamalar ve mevcut bant/DOS/PDOS ayrıştırıcıları geçerse
sonuç yayınlar; hata/kısmi sonuçlar 409 olarak kalır. Kaynak SCF son hata
tahmini ayrıca ≤1e-8 Ry olmalıdır. Sonuç JSON'u 24 MB ile sınırlıdır.

Arayüzde Sunucu iş akışı → SCF/bant/DOS seçilir. K-yolu yapıya göre
açıkça girilmelidir; placeholder otomatik yol seçimi değildir. D3 sonucu
altındaki düğme son geometriyi yeni hesabın girdisi olarak seçer; aktif
çalışma alanını değiştirmez. Seçili son yapı hash'i ön kontrolde eşleşmezse
iş gönderilmez. Alternatif olarak açıkça aktif yapı seçilebilir.

API sonucundaki `electronic` alanı mevcut bant/DOS/PDOS grafiğine doğrudan
bağlıdır. Ham QE enerji sıfırı kullanılır; Fermi/vakum hizalaması, bant
aralığı doğruluğu veya optik geçiş/tek-foton yorumları yapılmaz.

Kurulum için [iş API kılavuzu](qe-jobs.md). Docker imajı mevcut pipeline
ve PDOS ayrıştırıcılarını içerir; API 0.4.0 `electronic` yeteneğini duyurur.
Yoğun MoS₂ hesabı için D3'teki aynı doğrulanmış UPF ve kaynak profili
kullanılmalıdır. Gerçek Si işleyiş ve MoS₂ kabul kanıtları aşağıdadır.

## Gerçek Si denemesi ve kaynak verilerin korunması

[Gerçek raw/API kanıtları](../validation-results/qe-d4-si-smoke-20261029-arm64/INCELEME.md):
6/6 solver aşaması, 8 bant, 1145 DOS noktası ve iki atomun s/p PDOS'u geçti.
İlk koşu, QE dosyalarının bir uç enerji noktasındaki farklılığı nedeniyle
sonuç yayınlamadan reddedildi. Yeni okuyucu yalnız DOS aralığındaki mevcut,
birebir eşleşen PDOS noktalarını seçer. Kaynak/seçilen nokta sayıları kaydedilir;
interpolasyon veya enerji kaydırması yapılmaz. İç grid kayması/eksikliği
hâlâ reddedilir. 111 Python QE testi ve 439 JavaScript testi geçti;
gerçek tek-atom orbital seçimi tarayıcıda incelendi.

Si denemesi işleyiş testidir. Gerçek MoS₂ kabulü D3'ün son geometrisinde
[ayrıca tamamlandı](../validation-results/qe-mos2-d4-20261029-amd64/INCELEME.md).

## Ön kayıtlı gerçek MoS₂ D4 kabulü

[Sabit plan](../tests/fixtures/qe/mos2-electronic-acceptance.json),
`tools/qe_electronic_acceptance.py` ve mevcut manuel workflow'daki
`protocol=d4` gerçek koşudan önce commit edilir. Araç, D3'ün son
geometri/kuvvet/yüksek-cutoff kapılarını yeniden doğrulamadan hesap göndermez.
D3 referans summary/result hash'leri D4 raporuna bağlanır.

Aynı 120/960 Ry ve 16×16×1 SCF protokolü, aynı doğrulanmış UPF'ler,
D3 son hücre/atom koordinatları kullanılır. nbnd=26, NSCF=16×16×1;
açık yol Gamma(0,0,0) → M(1/2,0,0) → K(1/3,1/3,0) → Gamma,
20/20/20/1 ağırlıklarıyla 61 k noktası. DOS/projeksiyon adımı 0.02 eV,
mevcut ortak postprocessor girdilerindeki degauss=0.01 Ry'dir.

Kabul: 6/6 gerçek aşama ve ham `JOB DONE.`, ham girdi/çıktı/PDOS hash'leri,
PW aşamalarında 26 elektron, kaynak SCF hata tahmini ≤1e-8 Ry,
D3 son SCF ile enerji farkı ≤1e-6 Ry ve son kuvvet bileşeni ≤1e-4 Ry/Bohr.
Ham bant matrisi 26×61, tüm DOS/PDOS noktaları API JSON'uyla eşleşmeli;
Mo-d ve S-p atom/orbital grupları bulunmalı. Tam DOS aralığındaki integral
52 duruma (2×nbnd) 0.2 durum içinde yakın olmalı. Ortak enerji aralığı
seçimi yalnız birebir eşleşen noktalardan yapılır ve sayıları kaydedilir.

Kabul ortamı 6 GiB RAM, swap kapalı, 2 CPU; iş wall-time 14400 saniye,
workflow üst sınırı 240 dakikadır. Sonuç bu sonlu yol/örgüde işleyiş ve
veri tutarlılığını gösterir. Bant sayısı, yoğun k-örgüsü, DOS genişliği,
SOC veya optik doğruluğuna ilişkin daha geniş yakınsama iddiası değildir.

```bash
python3 tools/qe_electronic_acceptance.py --run --output validation-results/qe-mos2-electronic-local
python3 tools/qe_electronic_acceptance.py --verify validation-results/qe-mos2-electronic-local
```

Gerçek MoS₂ koşusu `d25e112312acd6f02591c0abe5b03acc5ed3b024` kaynağında
[başarıyla tamamlandı](https://github.com/alorak/kristalyapi/actions/runs/40821361993).
19 kaynak hash'i, tam raw/API eğrileri, atomik projeksiyonlar ve üç sayısal
karar ölçütü tekrar doğrulandı. D3 SCF enerjisi tam tekrarlandı; integral
52 durumdan yalnız 6.574e-6 farklı. Sonradan eklenen kapasite kontrolü
hesap girdilerini değiştirmez; bu kontrol ayrıca gerçek Docker/API'de
26 elektron/minimum13 ve yetersiz12 bant reddiyle test edildi.

[Gerçek Docker/API ön kontrol kanıtı](../validation-results/qe-d4-band-preflight-20261029-arm64/INCELEME.md):
26 bant validate=200, 12 bant validate/submit=422 ve boş kuyruk doğrulandı.
Bu denemede DFT işi gönderilmedi; gerçek D4 spektrum kabulü ayrı çalışmadır.
