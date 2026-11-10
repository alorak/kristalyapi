# KristalYapı — uçtan uca uygulamalı örnek iş akışları

> **Amaç:** Aynı kristalden hareketle **Kütüphane → Kristal → Malzemeler → DFT → Toz Kırınımı** bölümlerinde neler yapılabildiğini, giriş/çıktılarını ve bilimsel sınırlarını açıklamak.
>
> **Durum:** 11 Kasım 2026. Bu belge depodaki `main` dalında bulunan özellikleri esas alır. Materials Project'ten **gerçek bant/DOS/varsa PDOS dosyası alma ve görüntüleme** özelliği [PR #247](https://github.com/alorak/kristalyapi/pull/247) üzerinde geliştirilmektedir; PR birleştirilmediyse yayımlanan sitede bu kontroller **henüz görünmeyebilir**. Aşağıda açıkça **PR #247** olarak işaretlenmiştir.
>
> **Temel ilke:** Hesaplanmış/kurgusal difraktogram ≠ gerçek difraktometre ölçümü; MP referans hesaplaması ≠ bu tarayıcıda çalıştırılmış DFT; ML tahmini ≠ gerçek SCF; GANSU molekül DFT'si ≠ periyodik kristal DFT'si.

Uygulama: https://alorak.github.io/kristalyapi/ · Kaynak: https://github.com/alorak/kristalyapi

## 1. Önce hangi işlemin nerede yapıldığını anlayalım

| Arayüz | Girdi | Yapılan işlem | Görülebilen/indirilebilen çıktı | Kritik sınır |
| --- | --- | --- | --- | --- |
| **Kütüphane → Materials Project** | Kişisel MP API anahtarı, formül veya `mp-*` kimliği | Gerçek MP **özet kaydı** arama, seçili hesaplanmış yapıyı içe alma, en çok dört kaydı özellik bazında kıyaslama | MP-ID, formül, uzay grubu, atom konumu sayısı, hesaplanmış bant aralığı, oluşum enerjisi, hull üstü enerji, yoğunluk; yapının etkin kristale aktarılması | Özet bant aralığı **tam bant eğrisi değildir**; API erişimi ağ/CORS ve anahtara bağlı |
| **Kristal / editör** | CIF, Kütüphane'den içe alınmış yapı veya mevcut çalışma alanı | Hücre ve atom koordinatları, 3B görüntüleme, yapı ölçümleri | Aktif periyodik kristal geometrisi | CIF/MP aktarımı yapıyı temsil eder; kendi başına deneysel kimlik/doğruluk teyidi değildir |
| **Malzemeler → Yapı Kartları / Karşılaştırma** | Etkin kristalin anlık kopyaları | En fazla dört yapının geometrik/bileşimsel karşılaştırması | Kartlar, farklar, CSV/JSON | Tek başına DFT, faz tayini veya deneysel kabul değildir |
| **Malzemeler → ML Tahminleri** | Etkin CIF/P1 kristal | Tarayıcıda yerel kNN prototipleri, veri kalite denetimi | Ayrı hedeflere ait tahmin/uyarılar, JSON | P0/P1/P1.2 farklı veri ve hedeflere dayanır; hiçbiri PINN/ab initio değildir |
| **Malzemeler → Kaynak ve Kanıtlar** | Yapı kartı ve seçilen kanıt dosyaları | Yerel SHA-256 kimlik ve kayıt | Yapıyla ilişkili metaveri ve kanıt JSON'u | Hash kaynak kimliğini veya fiziksel doğruluğu kanıtlamaz |
| **Malzemeler → 3B DFT Hazırlığı** | GaN/AlN/SiC adayı ve 3B k-örgüsü | Yürütülemeyen araştırma manifesti | Hazırlık JSON'u | Bu panel gerçek 3B QE işini başlatmaz; Si bu panelin adaylarından değildir |
| **DFT → Tarayıcı hesapları** | XYZ sonlu molekül veya uyumlu iki-C grafen hücresi | Yerel GANSU Lite WASM moleküler SCF; veya grafen π Tight-Binding | Molekül enerji/yük/SCF sonuçları; GANSU bağ taraması; grafen bant/DOS CSV | **Elmas-Si'nin periyodik bant yapısı burada hesaplanmaz** |
| **DFT → Hesap hazırlığı / İşler / Sonuçları incele** | Aktif yapı, QE girdisi, sunucu erişimi veya hazır QE çıktı dosyaları | QE girdi hazırlama; koşullar sağlanırsa gerçek sunucu işleri; mevcut elektronik çıktıyı görüntüleme | `.in`/TRUBA paketi, job sonuçları, kaynaklı bant/DOS/PDOS JSON'u | Hesaplamanın çalışması için gerçek QE/UPF/uygun profil gerekir; elektronik API özellikle 2B/slab kapsamlıdır |
| **Toz Kırınımı / Karşı Uzay / Kamera** | Etkin kristal ve X-ışını parametreleri | Kinematik XRD, Miller düzlemleri, Ewald/karşı örgü, öğretici kamera simülasyonu | `2θ`–göreli şiddet, yansımalar, `d_{hkl}`, yapı faktörü, halkalar | Ölçülmüş XRD, cihaz profili veya Rietveld değildir |
| **Toz Kırınımı → Pik İndisleme** | **Ölçülen** `2θ` listesi, dalga boyu; manuel modda hkl | Kübik/hekzagonal aday hkl ve/veya örgü parametresi en küçük kareler uyumu | Adaylar, a/c, hesaplanan `2θ`, kalıntılar, RMSE, CSV | Faz/uzay grubu otomatik doğrulanmaz; tüm sistematik sönümler modellenmez |
| **PR #247 — MP gerçek elektronik referansı** | Resmî Python `mp-api` ile alınmış bant/DOS JSON'u | Mevcut MP hesaplamasının tarayıcıda **görüntülenmesi** | Bant–DOS, Fermi işaretleri, enerji pencereleri, varsa gerçek orbital PDOS, kümülatif DOS | Python dışa aktarma gerekir; dosyanın kökeni kriptografik doğrulanmaz; yeni DFT başlatılmaz |

### Örnek seçimi matrisi

| İş akışı | Başlangıç yapısı | Özellikle incelenecek özellik | DFT/ML durumu |
| --- | --- | --- | --- |
| **A — Silisyum (Si)** | `mp-149` veya doğrulanmış elmas-Si CIF | Hücre, yapı kartları, ML tahminleri, elmas yapı sönümleri, XRD, MP referans bant/DOS | Gerçek periyodik Si için QE **ayrı** hesap/kanıt; GANSU SiH₄ eşdeğer değildir |
| **B — SrTiO₃** | MP formül araması, belirli MP-ID seçimi | MP farklı faz/kayıt kıyası, perovskit kristali, teorik toz deseni | P1/P1.2 kabul kapılarına bağlı; mevcut 3B bulk panelinden gerçek QE yok |
| **C — MoS₂** | Katmanlı yapı CIF'i / doğrulanmış MP kaydı | Katmanlı figür, karşı uzay, XRD, 2B elektronik QE hazırlığı | 2B/slab protokolüne uygunsa gerçek QE sunucusu kullanılabilir; koşulsuz otomatik değildir |
| **D — α-Ti ölçüm örneği** | Yedi `2θ` değeri (aşağıda) | Manuel ve otomatik hekzagonal pik indisleme | DFT veya Materials Project anahtarı gerekmez |
| **E — Grafen / SiH₄** | Hazır grafen örneği / SiH₄ molekülü | Parametrik bant–DOS ile gerçek moleküler SCF'nin farkını görme | İki ayrı tarayıcı motorudur; kristal Si bandı üretmez |

---

## 2. A — Silisyum: Kütüphane'den XRD'ye tam senaryo

**Araştırma sorusu:** “Elmas yapılı Si için hangi bilgileri dış referanstan alabiliyorum, hangilerini yerel modelden tahmin ediyorum, hangi spektrumlar gerçek hesap ve hangileri öğretici?”

**Beklenen başlangıç:** İdeal bir elmas-Si kristal yapısı; MP kaydı olarak `mp-149` kullanılabilir. Referans [MP malzeme kaydı](https://materialsproject.org/materials/mp-149). Başka bir Si polimorfu aynı sonuçları vermez.

### A1. Kütüphane: gerçek MP kaydını bul ve yapıyı aktar

1. **Kütüphane → Materials Project Ayarları** bölümünde kişisel MP API anahtarını girip **Tarayıcıya kaydet** ile sakla. Tarayıcı depolaması şifreli kasadır varsayma; paylaşılan bilgisayarda iş bitince anahtarı sil.
2. **Kütüphane → Materials Project** bölümünde `mp-149` ara. Alternatif: `Si` formülünü ara ve dönen kayıtlar arasından **aynı MP-ID/fazı** seç; ilk sonucu otomatik elmas-Si kabul etme.
3. Özet kartından **hesaplanmış** bant aralığı, doğrudan/dolaylı nitelik, oluşum enerjisi, `E_above_hull`, yoğunluk, atom konumları ve uzay grubu bilgilerini incele. **Eksik alanları sıfır kabul etme.**
4. **Kristalde aç** ile seçili kaydın hesaplanmış yapısını etkin çalışma alanına aktar. İstersen **Toz XRD ile aç** üzerinden aynı kaynağın ideal kinematik kırınımını doğrudan aç.
5. İçe aktarım sonrası örnek veri kümesini ve kullanılan MP-ID'yi bir araştırma notunda kaydet. MP adapter'ı örgü ve atomların P1 gösterimini taşır; özgün deneysel CIF'in bütün simetri/provenans metadatasını eksiksiz aktardığı iddia edilmez.

**Çıktı:** MP'ye bağlı kimliği bilinen, seçili hesaplanmış Si kristal geometrisi. **Henüz herhangi bir yeni Si DFT hesabı çalışmadı.**

**Bağlantı sorunu:** Doğrudan erişim CORS/ağ engeline takılabilir. Uygulamadaki **isteğe bağlı Cloudflare Worker** modu ayrı bir güven kararıdır: kişisel API anahtarı bu Worker'dan geçirilir ve sunucu sürüm/health durumu kontrol edilmelidir. Detay: [Materials Project entegrasyonu](materials-project.md).

### A2. Kristal: hangi geometrinin incelendiğini doğrula

- Etkin kristalin atom türünü, primitif/konvansiyonel hücreyi, örgü uzunluk ve açılarını, kesirli koordinatları incele. Silisyumun elmas (diamond-cubic) fazında iki atomlu primitif veya sekiz atomlu konvansiyonel gösterim kullanılması mümkündür; yalnız atom sayısının farklılığı iki farklı fiziksel fazı kanıtlamaz.
- Ölçümlerin (ör. en yakın komşu Si–Si mesafesi ve koordinasyon) mevcut periyodik hücreye ait olduğunu doğrula. Farklı hücre dönüşümü/normalize edilmiş atom sırası karşılaştırma raporunu etkileyebilir.
- Gerçek deneyle kıyas yapacaksan sıcaklık, gerçek kafes sabiti ve kullanılan CIF kaynağını ayrıca kaydet. **5,431 Å**, mevcut QE Si kabul fikstürünün *sabit başlangıç* konvansiyonel parametresidir; herhangi bir canlı MP sorgusunun güncel değerini önceden garanti etmez.

### A3. Malzemeler: kart, karşılaştırma, ML ve kanıt

1. **Malzemeler → Yapı Kartları**: `mp-149` kaynak bilgisini **Kaynak kimliği / bağlantısı** alanına yaz, **Etkin kristalin anlık kopyasını ekle** düğmesine bas. Başka Si hücresi/fazı eklersen kartları isim/MP-ID ile ayırt et. En çok dört kart saklanabilir.
2. **Malzemeler → Karşılaştırma**: bileşim ve geometrik/hücresel farkları incele; **Karşılaştırma CSV** veya **Kaynaklı JSON** indir. *Bir hücrenin sekiz atomlu, diğerinin iki atomlu olması doğrudan faz farkı değildir.*
3. **Malzemeler → ML Tahminleri → P0 · Deneysel**: **Etkin kristal için ML tahmini** çalıştır. Matbench kökenli bileşim-temelli kNN **deneysel bant aralığı kestirimi** üretmeyi deneyebilir; atom koordinasyonu ve Si polimorfunu öğrenmez. Veri alanı dışı ret de geçerli sonuçtur.
4. **P1 · Yapısal**: **Etkin kristalde yapısal tahmin** ile ayrı ZEBRA kökenli **hibrit-DFT doğrudan bant aralığı** ve **oluşum enerjisi** kestirimini iste. Öğrenilen girdi bileşim + atom başına hacimdir; görüntülenen bağ/koordinasyon özellikleri bu modelin eğitim özellikleri değildir. Doğrudan ve temel/dolaylı bant aralığını eşitleme.
5. **P1.2 · Polimorflar**: **P1.2 · Polimorf modelini çalıştır**. JARVIS OptB88vdW hedefleri için gerçekten eğitilmiş PBC bağ/koordinasyon özelliklerini ve kapsama uyarılarını incele. **Si'nin uygun kaynak veride bulunacağı garanti edilmez**; eş bileşimli fazların doğru ayrıldığı ispatlanmış sayılmaz.
6. **P1.3 · Doğrulama**: **P1.3 · Doğrulama denetimini çalıştır**. Veri kalite, dört katlı gruplu iç doğrulama ve model ablation bulgularını gör; bu sekme yeni Si enerjisi hesaplamaz.
7. **Malzemeler → Kaynak ve Kanıtlar**: Si kartına kaynak CIF'ini, varsa gerçek deneysel XRD CSV'sini ve ayrı yürütülmüş QE kanıtını **tür ve kaynak kimliğiyle** ilişkilendir. SHA-256 kayıtları dosya bütünlüğü takibi içindir; kaynak/doğruluk imzası değildir.

**Teknik ayrım:** P0 deneysel hedef, P1 hibrit-DFT **doğrudan** hedef ve P1.2 JARVIS OptB88vdW hedefini *aynı ölçümün üç farklı doğrulaması* olarak sunma. P1.2 küçük faz-gruplu korpusta bant aralığına yeni geometrik tanımlayıcı eklemek her metrikte iyileşme sağlamamıştır.

**Referanslar:** [P0](materials-ml-p0.md) · [P1](materials-ml-p1.md) · [P1.2](materials-ml-p12.md) · [P1.3](materials-ml-p13.md) · [Kanıt zinciri](material-intelligence-p1.md).

### A4. DFT: tarayıcı hesabı, MP elektronik referansı ve gerçek QE'yi ayır

#### A4.1. DFT → Tarayıcı hesapları: ne yapılabilir?

- **GANSU Lite WASM/SCF**: `H₂`, `H₂O`, `NH₃` veya `SiH₄` gibi **sonlu XYZ molekülleri** için sınırlı baz setli gerçek Kohn–Sham hesabı; enerji, orbital/yük ve iterasyon bilgileri. **SiH₄'ün HOMO–LUMO farkı elmas-Si'nin periyodik bant aralığı değildir.**
- **P0.4 enerji–geometri taraması**: SiH₄'te sabit tetrahedral yönlerde **3–9 bağımsız SCF** ile Si–H bağ uzunluğu–enerji eğrisi. İşaretlenen minimum yalnız örneklenmiş noktalarda geçerlidir; tam relaksasyon değildir.
- **Grafen π Tight-Binding**: Yalnız doğrulanmış iki C atomlu ideal grafen hücresinde Γ–M–K–Γ bantları ve yaklaşık DOS. **Si CIF'i ile çalışmaz**; model hesaplamasını Si DFT'si gibi etiketleme.

#### A4.2. PR #247: Si'nin gerçek MP bant/DOS referansı (henüz otomatik tarayıcı hesabı değil)

PR #247 yayımlandıysa, **Kütüphane → Materials Project** içindeki **Bant / DOS JSON** kontrolüyle resmî `mp-api` istemcisinden dışa alınmış gerçek MP dizileri yüklenebilir. Uygulama bunları **DFT → Tarayıcı hesapları** ekranında yalnız **referans** olarak görüntüler.

Depo kökünde, kendi erişim anahtarınla:

```bash
python -m pip install mp-api
export MP_API_KEY="KENDI_KISISEL_MP_ANAHTARIN"
python tools/mp_electronic_export.py --mp-id mp-149 --output mp-149-electronic.json
```

- Bant–DOS grafikleri, uygun enerji penceresi, yüksek-simetri k-yolu etiketleri, varsa gerçek element/orbital PDOS ve kümülatif DOS incelenir.
- Bant ve DOS kaynaklarının **kendi** Fermi sıfırları vardır; görselde ikisinin de `E−E_F` yazması otomatik ortak mutlak hizalama anlamına gelmez.
- Bu işlem MP'nin **önceden hesaplanmış elektronik sonuçlarını getirir**; tarayıcıda Si Kohn–Sham çözümü **çalıştırmaz**.
- MP özetindeki tek `band_gap` sayısından gerçek bant eğrisi **üretilmez**. Gerçek veri indirme kişisel anahtar + Python istemcisini gerektirir; yalnız tarayıcıdaki mevcut MP özet araması yeterli değildir.
- PR henüz birleştirilmediyse bu düğmeler/`tools/mp_electronic_export.py` dosyası `main` dalında yoktur: [PR #247](https://github.com/alorak/kristalyapi/pull/247) · [PR #247 kod değişiklikleri ve kılavuz](https://github.com/alorak/kristalyapi/pull/247/files) (birleştirme sonrasında dosya: `docs/mp-electronic-browser.md`).

#### A4.3. DFT → Hesap hazırlığı / Sonuçları incele: gerçek periyodik Si

- **Hesap hazırlığı**: etkin yapıyı ve gerekli parametreleri gözden geçir; **QE .in dosyası oluştur** veya **TRUBA / SLURM paketi** seç. Girdi dosyası hazırlamak tek başına `pw.x` çalıştırmaz.
- **Sunucuda hesapla**: yalnız uygun gerçek QE kurulumu, UPF profili, erişim anahtarı, uygun boyutsallık ve sunucu kaynak kapıları sağlanırsa `SCF`, `relax→SCF` ya da desteklenen elektronik iş akışı başlatılabilir. İlgili elektronik API **2B/slab koşulları** içerdiğinden elmas-Si için doğrudan 3B `SCF→bands→DOS` çalıştırmayı bu ekranda garanti etme.
- **Mevcut doğrulanmış Si SCF yolu:** [D2.1 Si gerçek Docker/API SCF protokolü](qe-scf-validation.md). İki atomlu primitif elmas hücresi, PBE ve kaynak/hash'li Si UPF ile 7 gerçek hesap, sınırlı cutoff/k-grid yakınsama kontrolü yapılmıştır. Bu **Si bant/DOS ölçümü değildir**.
- **Sonuçları incele**: gerçek QE `pw.x` `.out` dosyasını veya geçerli `electronic-results.json` verisini aç; bant–DOS/PDOS grafiğini ve ham kaynak/enerji referansını incele. Sonuç dosyasının açılması aktif Si yapısıyla otomatik hesap eşleşmesi veya yeni çözümleyici çalışması değildir.

**Referanslar:** [DFT çalışma alanı](qe-workspace.md) · [QE elektronik zinciri](qe-electronic.md) · [Tarayıcı GANSU/TB](browser-dft-tb.md) · [Si kabul kanıtı](qe-scf-validation.md).

### A5. Toz Kırınımı: Si kristalinden hesaplanan XRD ve yapı faktörü

1. `mp-149`'dan seçilen **etkin Si kristali** açıkken **Toz Kırınımı → Toz Kırınımı** bölümüne git.
2. **Dalga boyu λ** değerini örnek olarak **1,5406 Å** (Cu Kα bölgesi) seç, **2θ üst sınırı** ve **Profil FWHM** kontrollerini ayarla. Varsayılan Lorentz–polarizasyon çarpanının grafik üzerindeki etkisini karşılaştır.
3. **Hesaplanan kırınım deseni** grafiğinde pik seç. Seçilen yansımanın **(hkl), Bragg koşulu, `d` düzlem aralığı ve 3B Miller düzlemleri** gösterimini incele.
4. **Bragg ışınları ve faz girişimi** bölümünde **Bragg açısına getir** ve isteğe bağlı animasyonla `2d\sin\theta=\lambda` ilişkisinin geometrik anlamını gözle.
5. **Yapı faktörü: atom fazörleri ve sönme** bölümünde örnek Si üzerinde `(111)`, `(200)`, `(220)` gibi yansımaları incele. Elmas-Si için `(200)`, yalnız F-merkezleme kuralına bakıldığında mümkün görünse de **iki atomlu elmas bazının girişimi nedeniyle sönümlenir**. Bu, indisleme ile gerçek yapı faktörü arasındaki farkın öğretici örneğidir.
6. **Aynı (hkl), farklı kristaller** tablosunda Si / BCC Fe / NaCl kaynaklarının farklı atomik bazlarının şiddete etkisini gör. **Yapı faktörü örnek malzemesini değiştirmek etkin Si CIF'ini değiştirmez.**
7. **Karşı Uzay** bölümünde gerçek↔karşı örgü, Ewald küresi/toz halkaları, SAED bölge ekseni ve Brillouin bölgesi öğretici görünümlerini keşfet.
8. **Kamera** sekmesinde kristalden türetilmiş ideal Debye–Scherrer kamera/halkalar görünümünü ve mevcut ışınım/numune seçeneklerini incele. Bu **gerçek kamera fotoğrafı** ya da bir dedektör kalibrasyonu değildir.

**Neden önemli?** Si `(111)` ve `(220)` gibi piklerin açısı örgü parametresine, şiddeti ise atomların kesirli konumları ve atomik saçılma faktörlerine bağlıdır. **Fazı yalnız birkaç pikle kesin belirlemek mümkün değildir**; şiddetler de absorpsiyon, tercihli yönlenme, çift çizgi ve cihaz yanıtından etkilenir.

**Bilimsel model:** Kinematik XRD; IT92 nötr atom saçılma faktörleri, model Lorentz–polarizasyon etkisi ve sabit profil genişliği. Rietveld, gerçek cihaz profil fonksiyonu, numune absorpsiyonu veya kalibrasyon işlemi değildir.

### A6. Pik İndisleme: sentetik Si deseni ile ölçülmüş Si verisini karıştırma

- **Toz Kırınımı → Pik İndisleme** sekmesi, *ayrı* bir **deneysel `2θ` çalışma sayfasıdır**. Toz deseni ekranındaki **hesaplanmış** pikleri buraya ölçülmüş veriymiş gibi aktarmayı deneysel doğrulama sayma.
- **Manuel hkl**: dalga boyu, kübik sistem ve ölçülmüş `2θ`/atanmış `h,k,l` değerlerini gir. En az iki uygun kübik pik gerekir; `1/d^2=(h^2+k^2+l^2)/a^2` üzerinden en küçük kareler `a`, artıklar ve RMSE görünür.
- **Otomatik hkl · P1**: hkl'si bilinmeyen **5–40 ayrı deneysel pik** gir, **Kübik** ve gerekirse **F** merkezlenme adaylarını seç; `2θ` toleransı ve kafes aralığını ayarla, **Adayları hesapla**. Bütün pikler bire bir eşleşen bir aday varsa **hkl atamalarını uygula**.
- Kübik **P/I/F** sınırlaması yalnız **örgü merkezlenmesi** kuralıdır. Elmas-Si'nin **bazdan kaynaklanan (200) sönümü** otomatik indisleme tarafından tüm ayrıntısıyla uygulanıyor diye düşünme. Adayı **XRD yapı faktörü**, kaynak CIF ve ölçümle ayrıca kontrol et.
- Cihaz kalibrasyonu/sıfır kayması, Kα₁/Kα₂, çok faz, sıcaklık, hkl-yapı eşdeğerliği ve belirsizlik bütçesi ayrıca değerlendirilmelidir.

**Gerçek ölçüm karşılaştırması önerisi:** Silisyum standart malzeme için [NIST SRM 640g sertifika raporu](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.260-245.pdf) bağımsız başvuru kaynağı olabilir. Ancak raporu indirmek **cihazınızın gerçekten SRM 640g ölçtüğü** anlamına gelmez.

### A7. Si senaryosunda rapora konulacak çıktılar

| Kaydedilecek çıktı | Kaynak bilgisinde zorunlu ayrım |
| --- | --- |
| Aktarılan Si hücresinin CIF/koordinat ve hücre bilgisi | MP-ID, alan/sürüm, primitif/konvansiyonel seçim, tarih |
| Malzemeler yapı karşılaştırması CSV/JSON | Kıyaslanan her kartın ayrı yapı ve kaynak kimliği |
| P0/P1/P1.2 tahmin raporları | Model sürümü, eğitim veri hedefi, kapsama/ret, gerçek veri olmadığı uyarısı |
| Gerçek MP bant/DOS JSON'u (**PR #247**) | MP-ID, kaynak görev bilgisi, fonksiyonel varsa, Fermi ve k-yolu; **uygulamada yeniden DFT çalıştırılmadı** |
| QE Si `.in/.out` + UPF/iş hash'leri | Gerçek çalıştırıcı, k-örgü/cutoff, XC, converged SCF ve enerji birimleri |
| Teorik Si toz deseni/görselleri | Kullanılan CIF, radyasyon λ, 2θ aralığı ve FWHM |
| Deneysel pik indisleme CSV'si (varsa) | **Ölçülen** piki, cihaz/model, numune, λ, hkl yöntemi ve RMSE |
| Kanıt JSON'u | SHA-256 ve dosya kaynağı; **bilimsel kabul imzası değildir** |

---

## 3. B — SrTiO₃: hesaplanmış çok bileşenli oksitten XRD'ye

**Soru:** “Bir perovskit oksit için kimyasal bileşimi aynı, fakat MP kimliği/fazı farklı olabilen kayıtları ve toz kırınımını nasıl incelerim?”

1. **Kütüphane → Materials Project** üzerinde `SrTiO3` ara. Kişisel anahtar gerekir. **Birden fazla kayıt dönmesi** farklı faz, hesaplama ayrıntısı veya kaydı temsil edebilir; yalnız formüle göre birleştirme yapma.
2. Dört adede kadar sonucu işaretle ve **Malzeme özelliklerini karşılaştır** bölümünde `E_g`, `E_\mathrm{hull}`, yoğunluk, oluşum enerjisi, atom konumu ve simetriyi incele. Bu değerler *hesaplanmış* MP özetleridir.
3. Bir MP-ID'yi **Kristalde aç** ile yükle; ikinci uygun kaydı gerekirse ayrı bir çalışma alanında aç. **Malzemeler → Yapı Kartları** ile her faz için ayrı kaynak kimlikli kayıt oluştur.
4. **ML Tahminleri** P0/P1/P1.2 çıktılarının aynı hedefleri taşımadığını, özellikle hacim ve yerel koordinasyonun kapsam kapılarına bağlı olduğunu kontrol et. Modelin reddetmesi geçersiz/boş sayı üretmekten daha güvenlidir.
5. **Toz XRD ile aç** veya **Toz Kırınımı** üzerinden hesaplanmış deseni elde et. Seçili `(hkl)` piklerinin `d`, yapı faktörü ve şiddetlerinin yapısal ayrıntılara duyarlılığını incele.
6. Ölçüm yapılacaksa gerçek cihazın sıcaklığı, numune geçmişi, faz saflığı, λ ve kalibrasyonu kaydedilmeden “MP fazını doğruladık” deme.

**Not:** SrTiO₃ oda koşullarında sıkça kübik perovskit örneği olarak ele alınsa da sıcaklık, gerinim, yüzey, bozukluk ve kullanılan kaynak fazı önemlidir. Uygulamanın otomatik kübik indeksleme adayları **tam bir faz tanımlama** sistemi değildir.

**Hedef çıktı:** Seçili MP-ID'ler arasındaki hesaplanmış özellik tablosu + etiketli iki teorik toz deseni + farkların ve gerekli deneysel kontrollerin raporu.

---

## 4. C — MoS₂: katmanlı yapı, gerçek/karşı uzay, DFT protokolü

**Soru:** “MoS₂'nin tabakalı yapısını hangi ekranlar gösterir ve gerçek periyodik elektronik hesap nereye kadar desteklenir?”

1. MoS₂ için kaynağı belli bir CIF veya uygun MP kaydı aç; bu kaydın **tek katman 1H, bulk 2H veya 1T** hangisini temsil ettiğini kontrol et. Bunlar eşdeğer değildir.
2. **2B Figür** bölümünde veri kaynağı olarak **aktif çalışma alanının CIF'i** veya hazır 1H/1T öğretici örnekleri seç. Uygun normal yönünü, katman indeksi, üst/yan görünümü ve tekrar sayısını ayarla; SVG/PNG/PDF dışa aktarımı kullan. CIF katman çıkarımı ve hazır ideal örnek **her zaman aynı yapı/kalınlık** değildir.
3. **Toz Kırınımı** üzerinden aktif geometrinin teorik piklerini, **Karşı Uzay** üzerinden karşı örgü ve Brillouin bölgesi kavramlarını incele. Karşı Uzay → “Brillouin bölgesi ve bantlar” öğretici görünümü kendi başına ab initio QE sonucu değildir.
4. **DFT → Hesap hazırlığı**: gerçek QE elektronik hesabı amaçlanıyorsa doğrulanmış 2B/slab hücresi, yeterli vakum, UPF, k-örgüsü, fonksiyonel ve kaynak yapı uygunsa desteklenen **SCF → bant → DOS/PDOS** akışını seç. **Hesaplama sunucusu ayrı kurulmuş/etkin olmalıdır**.
5. **İşler ve kaynaklar** üzerinden gerçek, kimlik doğrulamalı işi takip et; ya da dışarıda yürütülmüş QE'nin `electronic-results.json` dosyasını **DFT → Sonuçları incele** ile aç. PDOS/orbital projeksiyonlarını kaynak ve enerji sıfırını koruyarak yorumla.
6. Çıktıları [MoS₂ gerçek yakınsama/elektronik protokolleri](qe-mos2-validation.md), [QE elektronik akışı](qe-electronic.md) ve [DFT çalışma alanı](qe-workspace.md) ile denetle. Spin/SOC, kusur, farklı fazlar veya optik geçişler için ayrı fiziksel protokol gerekir.

**Hedef çıktı:** Kaynaklandırılmış katmanlı figür + teorik XRD/karşı-uzay ekranları + gerçek QE işi varsa hash'li elektronik veri ve yakınsama kaydı.

---

## 5. D — α-Ti: gerçek açı örneğinden otomatik ve manuel pik indisleme

Bu örnek **MP API anahtarı ve gerçek DFT gerektirmez**. [Pik indisleme kılavuzundaki](powder-peak-indexing.md) kaynaklı öğretici tablo kullanılır.

1. **Toz Kırınımı → Pik İndisleme** bölümüne git; **Ti örnek verilerini yükle** ile başlangıç veri setini getir. Sistem: **Hekzagonal**, λ = **1,540562 Å**.
2. Mevcut hkl atamaları ile manuel modda `a`, `c`, `c/a`, `2θ` kalıntıları ve RMSE'yi gözle.
3. Otomatik yöntemi denemek için **Otomatik hkl · P1** seç; aşağıdaki `2θ` değerlerini **yalnız açı** olarak kullan. Ayarlar: hekzagonal; gerekirse varsayılan `a` [2,10] Å, `c` [2,15] Å ve tolerans 0,20°.
4. **Adayları hesapla** ile sıralı olası hücre/indislemeleri incele. Yalnız tüm ölçülen pikleri bire bir eşleştiren adaya **hkl atamalarını uygula**.
5. Manual ve otomatik sonrası **CSV dışa aktar** ile farkları koru; tek düşük RMSE'nin doğru faz kanıtı olmadığını not et.

| Öğretici örnek 2θ (°) | Referans hkl |
| ---: | :---: |
| 35,10 | 100 |
| 38,39 | 002 |
| 40,17 | 101 |
| 53,00 | 102 |
| 62,94 | 110 |
| 70,65 | 103 |
| 74,17 | 200 |

Beklenen yaklaşık uyum: `a≈2,950 Å`, `c≈4,684 Å`; yuvarlatma farkları olabilir. **Bu açıları yeni, bağımsız olarak yapılmış Ti ölçümünüz gibi sunmayın.** Kübik P/I/F ve hekzagonal aday arama; fazın, cihaz kalibrasyonunun ve uzay grubu sönümlerinin tamamının doğrulandığı anlamına gelmez.

---

## 6. E — Aynı “bant/DOS” adı altında iki farklı tarayıcı deneyi

| Deney | Nasıl başlatılır? | Hangi gerçek fizik işlenir? | Neler üretilmez? |
| --- | --- | --- | --- |
| **Grafen** | **DFT → Tarayıcı hesapları → P1 Periyodik grafen π Tight-Binding**; ideal grafen demo veya doğrulanmış iki-C hücre, `|t|`, k-mesh ve σ seç | En yakın komşu `p_z` Hamiltonyeni; Γ–M–K–Γ iki bant ve Gaussian genişletilmiş DOS; bant/DOS CSV | Kohn–Sham SCF, kuvvet, Ni/N katkılı grafen, gerçek DFT bant aralığı |
| **SiH₄** | **DFT → Tarayıcı hesapları → P0 GANSU Lite**; `SiH₄` seç, fonksiyonel ve grid ayarla, **Yerel WASM DFT hesapla** | Gerçek küçük-bazlı sonlu-molekül SCF; toplam Hartree enerjisi, orbital/yük/iterasyon | Elmas-Si bant yapısı, periyodik k-yolu/DOS veya Si'nin bulk örgü enerjisi |
| **SiH₄ bağ taraması** | Aynı bölümün **P0.4 enerji–geometri taraması**; 3–9 noktalı Si–H bağ aralığı tanımla | Her bağ uzunluğunda ayrı gerçek WASM SCF ve bağıl enerji eğrisi | Analitik sürekli potansiyel, kuvvet kökenli tam relaksasyon veya ileri baz-set yakınsaması |
| **MP Si bant/DOS (PR #247)** | Resmî Python `mp-api` ile JSON al, Kütüphane'de aç | **Daha önce MP'de hesaplanmış** gerçek elektronik eğrilerin yerel SVG gösterimi | Bu cihazda yeni DFT çözümü, kendiliğinden QE/MP nicel doğrulaması |

Bu ayrım özellikle öğrenciye veya yeni kullanıcıya “**hangi grafik modelin kendi hesabıdır, hangisi dış referans verisidir?**” sorusunu sordurmak için değerlidir.

---

## 7. Asgari laboratuvar/araştırma raporu ve kabul kontrol listesi

Her örnek için kısa rapor şu bilgileri içermeli:

- **Araştırma sorusu ve sonuç tipi:** kristal modelleme, ML, gerçek DFT, hesaplanmış XRD, deneysel XRD birbirinden ayrıldı mı?
- **Kimlik/provenans:** MP-ID veya CIF DOI/kaynak, polimorf, konvansiyonel/primitif hücre, atom koordinatları, tarih ve yazılım sürümü.
- **Hesap protokolü:** XRD dalga boyu ve model FWHM; ML hedef/veri sürümü; QE için XC, gerçek UPF kimlik/hash, `k`-örgüsü, `ecutwfc/ecutrho`, spin/SOC varsayımı; moleküler GANSU için STO-3G/fonksiyonel/grid.
- **Sayısal kalite:** hesap gerçek çalıştı mı, SCF/geom yakınsaması mı yoksa yalnız bir giriş kontrolü mü, uygun birimler ve enerji sıfırı ne?
- **Karşılaştırılabilirlik:** aynı faz, aynı yapı, aynı ölçülen/hazır kaynak, aynı fiziksel gözlenebilir ve karşılaştırılabilir fonksiyonel varsayımları var mı?
- **Çıktılar:** varsa CIF, CSV, MP JSON, ML JSON, QE ham girdi/çıktı, grafik ve SHA-256 kanıtları arşivlendi mi?
- **Doğrulama düzeyi:** birim testi, tarayıcı smoke testi, gerçek API/çözücü koşusu, laboratuvar ölçümü ve bağımsız bilimsel kabul **ayrı ayrı** mı işaretlendi?

### Sık karşılaşılan sorunlar

| Belirti | Önce bakılacak konu |
| --- | --- |
| MP sorgusu başarısız | Kişisel anahtar, internet, MP doğrudan CORS veya **isteğe bağlı** güvenilir Worker sürümü; anahtarı URL/issue içine yazma |
| “MP bant/DOS” butonu yok | [PR #247](https://github.com/alorak/kristalyapi/pull/247) henüz dağıtılmamış olabilir; MP özet araması ile ham spektrum erişimi ayrı özellikler |
| P1/P1.2 ML tahmini reddedildi | P1 tam doluluk/P1 atomları, veri alanı, fonksiyonel hedef ve kaynak/kapsama kapısı; **sessizce tahmin doldurma** |
| GANSU ile Si bant diyagramı çıkmıyor | Moleküler SCF **periyodik Si bant** motoru değil; `SiH₄` sonucu yalnız moleküle aittir |
| QE `İşler` kilitli | Gerçek sunucu/UPF, izin verilen iş tipi, 2B/3B boyutsallık ve API anahtarı hazır değil; dosya oluşturma ≠ işi çalıştırma |
| Si'de beklenen bazı hkl pikleri yok | Elmas atomik bazında yapı faktörü sönümü, `2θ` sınırı, kaynak dalga boyu, yansıma şiddeti; yalnız F merkezlenme yeterli değil |
| Otomatik indisleme birden fazla aday verdi | Kısıtlı `2θ` listesi fazı tekil belirlemez; yapı faktörü, kimya, veri kalitesi ve ek hkl gerekir |
| XRD ve deney uyuşmuyor | Yapı/polimorf, sıcaklık, λ, Kα çift çizgisi, sıfır kayması, cihaz profil/absorpsiyon ve olası çoklu faz; RMSE tek başına kanıt değildir |

## 8. İlgili proje içi teknik belgeler

- [Materials Project API, anahtar ve CIF aktarımı](materials-project.md)
- [MP gerçek bant/DOS iş akışı — PR #247, henüz `main` üzerinde değil](https://github.com/alorak/kristalyapi/pull/247/files)
- [Malzemeler yapı kanıtları ve XRD ölçüm kaydı](material-intelligence-p1.md)
- [ML P0 Matbench](materials-ml-p0.md) · [ML P1 ZEBRA](materials-ml-p1.md) · [ML P1.2 JARVIS/polimorf](materials-ml-p12.md) · [ML P1.3 veri doğrulama](materials-ml-p13.md)
- [Yerel GANSU Lite ve grafen Tight-Binding](browser-dft-tb.md) · [SiH₄ enerji taraması](gansu-p04-energy-geometry.md)
- [Gerçek Si QE SCF/doğrulama](qe-scf-validation.md) · [QE çalışma alanı](qe-workspace.md) · [QE elektronik bant/DOS](qe-electronic.md)
- [Pik İndisleme P0/P1.1/P1.2](powder-peak-indexing.md) · [XRD ölçüm bilimsel kabulü](materials-real-acceptance-plan.md)

**Sonuç:** En iyi ilk tur, **Si `mp-149` → aktif kristal → Malzemeler kart/ML → hesaplanmış toz XRD ve sönümler** yolunu izlemektir. Bunun üzerine gerçek **MP bant/DOS referansını** (PR #247) eklemek ve **QE hesabını** yalnız uygun kaynak/iş/protokol sağlandığında ayrı bir kanıt adımı olarak yürütmek, yöntemlerin sonuçlarını birbirine karıştırmadan kapsamlı bir öğretici çalışma sağlar.
