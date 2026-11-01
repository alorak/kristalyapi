# P1 — Malzeme kanıt zinciri, XRD kaynak bilgisi ve bulk hazırlığı

## Kapsam ve durum

Bu sürüm üç ayrı P1 araştırma hazırlığı uygular; fiziksel doğrulama veya üretim kabulü anlamına gelmez.

### P1.1 · Yerel kanıt kaydı (uygulandı)
- **Malzemeler** sayfasındaki her kartın açık P1 atomları, dolulukları ve 6 hücre ölçüsünden **kanonik geometri v1** üretilir. Atom sırası normalize edilerek aynı geometrinin SHA-256 özeti hesaplanır. Yapı adları, site etiketleri, ADP, kaynak URL'leri ve gösterim ayarları özete **dahil değildir**.
- Her karta en fazla 12 kanıt dosyası eklenebilir; türü (`cif`, `xrd-scan`, `qe-input`, `qe-output`, `qe-protocol`, `other`), elle girilmiş kaynak/numune/iş kimliği, dosya ismi, uzunluğu ve **dosyanın ham baytlarının SHA-256 özeti** tutulur. Tek dosya sınırı 12 MiB. Dosyaların baytları JSON'a konulmaz ve ağ üzerinden aktarılmaz.
- JSON kanıt paketinde tam kanonik geometri yer alır. İçeri alınan kayıt için **geometri özeti ve yapı özeti** yeniden hesaplanır; kanıt metaverisi ile geometri bağının tutarlılığı kontrol edilir. Kaynak dosyası olmadan dış artefaktın SHA-256'sı yeniden doğrulanmış sayılmaz.
- **Önemli ayrım:** SHA-256 bütünlük ve tekrar üretilebilir kimliktir. Belge imzası, dış kaynak kimlik doğrulaması, DFT protokolü güvenilirliği, bilimsel yakınsama veya deneysel uygunluk **değildir**. Üzerinde yetkisiz değişiklik yapılmış paket tüm hash'leri de yeniden hesaplayarak geçerli görünebilir; imza/kurum içi doğrulama P1'in sonraki adımıdır.
- Kartlar sekme belleğinde tutulur. Yerel dışa aktarma ve kullanıcı kontrollü JSON doğrulama sağlanır.

### P1.2 · XRD ölçüm kaydı ve karşılaştırma kapısı (ilk aşama uygulandı)
- Sağ XRD panelinde numune kimliği, cihaz/model, kaynak türü, ölçülen birincil dalga boyu, Kα₂ durumu ve **varsa operatörce girilen** kalibrasyon standardı referansı istenir.
- Yüklenen CSV'nin **ham dosya baytları** SHA-256 ile etiketlenir. Pik konumu karşılaştırması için operatörün ölçüm/model 2θ ve dalga boyu uyumunu onaylaması ve iki ana dalga boyunun **|Δλ| ≤ 0.0005 Å** olması gerekir. Bu eşik kullanıcı girdilerinin tutarlılık kontrolüdür, kalibrasyon ölçümü değildir.
- Rapor model/ölçüm parametreleri, uyumluluk uyarıları, eşleşen/eşleşmeyen konumlar ve ölçülen dosyanın hash kaydıyla **JSON** indirilebilir. Önceki CSV raporu korunur.
- Cihaz kalibrasyonu, Kα₂ ayrıştırma, background/zero-shift, çoklu faz çözümleme, referans faz tanısı, Rietveld ve kabul/red kararı yapılmaz. 'Standart referansı var' beyanının sertifikası doğrulanmaz. Girişin yanlış, eksik veya cihazla uyumsuz olması hâlinde bilimsel karar üretilmemelidir.
- **Açık gerçek cihaz işi:** iki bağımsız cihazdan (referans standardı ve kör numune) gerçek ölçüm, ham dosya ve operatör kalibrasyon günlükleri toplanıp karşılaştırılmalı. Depoda böyle bir deneysel kabul kanıtı oluşturulmadı.

### P1.3 · GaN/AlN/SiC 3B bulk çalışma hazırlığı (yalnız plan)
- Etkin kristalden 3D Kartezyen örgü, bileşim, doluluk ve kullanıcı tanımlı `k_x × k_y × k_z` (her eksen 2–64) içeren **yürütülemeyen** `kristalyapi.bulk-study-plan.v1` manifesti üretilir.
- GaN/AlN/SiC yalnız 1:1 nominal bileşimle **uyum** açısından kontrol edilir. Hangi polimorf/uzay grubu olduğunu tahmin etmez. Primitive/konvansiyonel hücre, farklı atom sayılı supercell, faz kimliği uzman doğrulamasına muhtaçtır.
- `executable=false`, `existingApiSupports3DBulk=false`, `scientificallyAccepted=false`: Mevcut **QE elektronik API 2B/slab (kz=0 band yolu ve NSCF kz=1)** kısıtlıdır; bu panelden gerçek 3B bulk SCF/NSCF/bands hesaplanamaz.
- Gerçek fiziksel hesap için: 3B destekli QE API/worker, 3B simetriye uygun doğrulanmış `k` yolu, doğru UPF ve işlevsel, kesme/mesh/kuvvet yakınsaması, gerekirse spin/SOC, ham kaynak/kanıt hash'leri ve deneysel bağımsız referans gereklidir. PBE bant aralığı doğrudan RF/mobilite/güç elektroniği metriklerine eşitlenmemelidir.

## Testler

```sh
node --test tests/material-evidence-p1.test.mjs tests/xrd-acquisition-p1.test.mjs tests/bulk-study-p1.test.mjs
node --test tests/pages-assets.test.mjs tests/offline.test.mjs
node tests/browser/materials-xrd.test.mjs
```

- Birim testleri digest kararlılığı/bozulması, kayıt fail-closed kontrolleri, kalibrasyon meta verisi, dalga boyu uyumu ve bulk planının kesinlikle yürütülemez olmasını sınar.
- Browser testi yerel **sentetik CSV** kullanır; fiziksel XRD standardı veya cihaz kanıtı değildir.
- GitHub PR CI ve statik Pages/offline shell dağıtım listeleri yeni modülleri içerir.

## Açık P1 kabul maddeleri

1. Kurum içi imza/attestation ve gerekirse QE job/UPF dosyalarının **gerçek dosya ile hash doğrulaması**, kanıt kökeni ve birim şeması; mevcut dosya kaydı bunu tek başına yapmaz.
2. İki gerçek XRD cihazı ve standart numune ile referans ölçüm korpusu, sıfır kayması/Kα₂/cihaz profili gözlemi ve bağımsız hata bütçesi.
3. Bulk destekli QE sunucusu ile gerçek GaN, AlN ve SiC polimorflarının güvenilir 3D SCF/bands yakınsaması, kaynaklı/tekrarlanabilir bilimsel kabul.
4. Çoklu referans adayıyla faz tanısı ve ileri profil rafinmanını **ancak** bağımsız deneysel doğrulama sonrası değerlendirme.
