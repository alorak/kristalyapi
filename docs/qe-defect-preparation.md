# D5.1 — Doğrulanmış kaynaktan kusur başlangıç adayları

`tools/qe_defect_prepare.py` D3'ün kabul edilmiş son MoS₂ geometrisinden
tekrar üretilebilir 4×4×1 modeller hazırlar. Hesap göndermez. Üretilen
CIF/JSON dosyaları **başlangıç adaylarıdır**, rahatlamış kusur sonuçları değildir.

Kaynak D3 önce ham QE/kuvvet/geometri kapılarından yeniden geçer; kaynak
commit, summary/result SHA-256 ve son yapı hash'i [sabit planla](../tests/fixtures/qe/mos2-defect-preparation.json)
eşleşmelidir. Hücre ab yönünde dört kez büyür, c=24 Å kalır. Her konumun
kaynak ötelemesi ve üç atomlu referanstaki 1 tabanlı atom indeksi kaydedilir.

| Aday | Mo | S | O | Nötr valans elektron | En az dolu bant (spinsiz) |
| --- | --- | --- | --- | --- | --- |
| pristine | 16 | 32 | 0 | 416 | 208 |
| V_S | 16 | 31 | 0 | 410 | 205 |
| V_2S | 16 | 30 | 0 | 404 | 202 |
| O_S | 16 | 31 | 1 | 416 | 208 |

Üst S katmanında birincil site `t2-2-0-b2`, ikincil site `t3-2-0-b2`.
İki boşluğun kaynak siteleri aynı katmanda en yakın komşudur; araları
3.18 Å'dır. O_S aynı birincil sitede S→O ikamesidir. Kalan atomlar
başlangıçta hareket ettirilmez; adayların kararlılığı bu geometriden çıkarılmaz.

```bash
python3 tools/qe_defect_prepare.py --output /tmp/mos2-d5-initial
python3 tools/qe_defect_prepare.py --verify /tmp/mos2-d5-initial
```

[Kaydedilmiş hazırlık paketi](../validation-results/qe-mos2-d5-preparation-20261029/preparation.json)
aynı komutla doğrulanabilir. Her vaka altında `initial.cif`, `structure.json`,
`site-map.json`, `candidate-relax-request.json` ve operatör incelemesi için
`candidate-relax.in` bulunur. CIF'ler üretim
KristalYapı ayrıştırıcısında atom/hücre/koordinat eşleşmesiyle test edildi.
[Gerçek uygulama içe aktarma kanıtı](../validation-results/qe-d5-ui-smoke-20261029/INCELEME.md):
V_S adayı 47 P1 atomu / Mo16S31 olarak doğru tanındı.
Bütün hazırlık dosyalarının hash'i `files-sha256.json` içindedir. Hedef klasör üzerine
yazılmaz; doğrulama değiştirilmiş dosya veya eklenmiş sahte sonucu reddeder.

O₂@V_S adayı için kullanıcı iki O konumunu **4×4 süperhücrenin** kesirli
koordinatlarında açıkça sağlamalıdır:

```bash
python3 tools/qe_defect_prepare.py --output /tmp/mos2-d5-with-explicit-o2 \
  --o2-positions /path/to/two-oxygen-fractional-positions.json
```

Dosya iki üçlüden oluşan JSON dizisidir; her sayı 0≤x<1. Otomatik O–O
mesafesi, yönelim veya adsorpsiyon bağı seçilmez. Atom çakışmaları reddedilir;
geometrik olarak geçerli aday kimyasal bağ/relaksasyon kabulü değildir.

[Sonraki hesap için hazırlanmış protokol ve uygulama açıkları](qe-defect-compute-protocol.md).

## Hesaptan önce açık kalan koşullar

Aday 120/960 Ry ve 4×4×1 örgü, D3'ün 16×16×1 ilkel örgüsüyle aynı
nominal düzlem içi örnekleme aralığını korur. Bu, kusur/süperhücre
enerjileri veya kuvvetleri için yakınsama kanıtı değildir. Spin/doluluk,
kusur yeniden yapılanması, hücre boyutu ve k/cutoff ayrı kontrol ister.
Aday relaksasyon isteği nötr/spinsiz mevcut şemayı kullanır; fiziksel olarak
doğru spin durumu seçildiği anlamına gelmez.

Mevcut D4 API sınırı 128 banttır. Bu hücrede yalnız dolu bantlar bile
202–208 olduğundan elektronik iş gönderilemez. Ortak 416 bant yalnız
planlama adayıdır; büyük hücre RAM/wall-time ve SCF CPU sınırı henüz
ölçülmemiştir. Araç sınırları yükseltmez, Docker/API işi açmaz. Gerçek
kusur serisinden önce D4 kaynak kabulü ve ayrı büyük-hücre/spin protokolü gerekir.

[Resmi oksijen UPF incelemesi](../validation-results/qe-d5-oxygen-upf-review-20261029.json):
[PSlibrary O PBE USPP](https://pseudopotentials.quantum-espresso.org/upf_files/O.pbe-n-rrkjus_psl.1.0.0.UPF),
SHA-256 `39cf0077e3ee34edce47746270394a8265ed70d92d73bc97cc1e20401657f8f6`.
Başlık PBE, skaler, SOC'siz ve 6 valans elektronla eşleşti. Bu yalnız
bayt/başlık incelemesidir; oksijenli kusur hesaplarının fiziksel kabulü değildir.
`operator-profile.json` Mo/S/O hash metadata'sını içerir; UPF baytları ve
üretim sunucu kurulumu bu araca dahil değildir.

Gerçek sonuçlar geldikten sonra mevcut [PDOS karşılaştırma aracı](qe-defect-comparison.md)
kullanılabilir. Farklı stokiyometrilerin toplam enerjileri doğrudan kararlılık
sıralaması veya kusur oluşum enerjisi değildir; enerji eksenleri vakum
referansı olmadan ortaklaştırılmaz.

## Yalnız başlatma için sabit kaynak pilotu

`tools/qe_defect_init.py` aynı hazırlanmış dört aday için ayrı, operatöre
özel `nstep=0` kontrolüdür. [QE kılavuzu](https://quantum-espresso.org/Doc/pw_user_guide/node9.html)
bu seçeneği başlangıç/girdi doğrulaması için tanımlar. Araç yalnız açıkça
verilen mevcut Docker imajının SHA-256 kimliğini kabul eder; imaj indirmez.

Sabit sınırlar: 416 bant, 2 CPU, 6 GiB RAM, swap kapalı, 120 saniye/vaka,
ağ kapalı, salt okunur kök ve UPF/girdi bağları, geçici scratch. Her vaka
sonunda konteyner kaldırılır. Gerçek QE atom/elektron/bant sayıları, sürüm,
ham bellek tahmin satırları, OOM/exit ve dosya hash'leri korunur. Enerji
veya SCF yakınsaması üreten çıktı `initialization-only` diye kabul edilmez.

```bash
python3 tools/qe_defect_init.py --pseudo-dir /path/to/reviewed-Mo-S-O-upfs \
  --image sha256:EXPLICIT_LOCAL_IMAGE_DIGEST --output /tmp/mos2-d5-init
```

`initialized` sonucu yalnız başlangıcın tamamlandığını gösterir. SCF,
relaksasyon, PDOS, tam hesabın RAM/wall-time yeterliliği veya API'nin 128
bant sınırının kaldırıldığı anlamına gelmez. [Gerçek pilot sonucu](../validation-results/qe-mos2-d5-init-first-20261029-arm64/INCELEME.md):
4/4 aday 6 GiB sınırında OOM/exit137 ile durdu; hiçbirinde SCF başlamadı.
QE üst bellek tahmini 71.76–80.49 GB bastı; bu ölçülmüş tepe bellek değildir.
Özgün başarısız ham girdiler/çıktılar korunur. Sonraki kod başarısızlıkta da
ham sayı/bellek tahminlerini metadata'ya taşır; bu tanı düzeltmesi nedeniyle
aynı yetersiz kaynakta hesap tekrar edilmedi.

## D5.2 — Sonraki kaynak kararı için çalıştırmasız inceleme

Önceki dört gerçek OOM denemesi [kaynak denetimi](qe-defect-resource-review.md)
ile hash / sayı / OOM durumundan yeniden kontrol edilebilir. Bu adım
Docker veya QE çalıştırmaz, API limitlerini değiştirmez ve tek başına
büyük hücreye yeterli RAM miktarı belirlemez.
