# Kristal Yapı · 3B Studio

Yalnızca tarayıcıda çalışan, **VESTA'dan esinlenen bir kristal yapı görüntüleyicisi/editörü**.

## Kullanım

- [index.html](index.html) tek başına arayüzü, CSS'yi ve uygulama JavaScript'ini içerir. Derleme, backend, veritabanı veya API anahtarı gerekmez.
- 3B motor için sabitlenmiş **Three.js 0.182.0** ve OrbitControls/ConvexGeometry modülleri jsDelivr CDN'den yüklenir. **İlk açılışta internet bağlantısı gerekir; tamamen çevrimdışı, tek dosya değildir.** Kristal dosyaları bir sunucuya yüklenmez.
- GitHub Pages için depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilir. `main` dalına merge sonrasında doğrulama ve dağıtım çalışır; PR açıldığı anda CI tetiklenmez.
- Yerelde statik sunucu kullanabilirsiniz: `python3 -m http.server 8000` ve `http://localhost:8000` adresini açın.

## Çalışma alanı ve sol panel sekmeleri

Beyaz tema, **3B model görünümünü saf beyaz**, sol düzenleme panelini hafif mavi-gri, sağ yapı/ölçüm panelini daha açık gri, üst menüyü ayrı kırık beyaz yüzey olarak kullanır. Bölümlerin kart sınırları, araç çubuğu ve alt durum çubuğu düşük yoğunluklu çizgi/gölgeyle ayrılır. Bu düzen yalnızca görünüme etki eder; kristal hesaplamalarının sonucu değişmez.

Sol sidebar'ın en altında **her zaman görünür iki sekme** bulunur:

- **Genel**: birim hücre, uzay grubu, bağ kuralları, süperhücre, Miller düzlemleri, örgü dönüşümü ve 3B görünüm ayarları.
- **Atomlar**: daha önce sol panelin en sonunda bulunan **Asimetrik konumlar / atomlar** tablosu, kesirli koordinatlar, Wyckoff eşleşmeleri ve atom ekleme/silme işlevleri. Sekme başlığında mevcut yapının bağımsız atom/konum sayısı gösterilir.

Tab çubuğu sol panelin kaydırılabilir kısmının **dışında** tutulur; içerik uzasa da kaybolmaz. Sekmeler ayrı kaydırma konumlarını hatırlar. CIF/POSCAR/XYZ veya yerleşik örnek içe aktarımından sonra Atomlar tablosu ve sayaç, `state.sites` üzerinden yeniden çizilir. Mobilde sol panel kapalı kalır, menü düğmesiyle açıldığında iki sekme de görünür.

## Kütüphane → Örnek Yapılar

**Kütüphane** sayfasında artık üç ayrı sekme var: **COD'da ara**, **Örnek Yapılar** ve **Yer imleri**. Yerleşik örnek kristallerin seçimi ve yeni P1 oluşturma işlemi 3B editörün sol panelinden kaldırılmıştır.

- **Örnek Yapılar** sekmesindeki açılır listede Si (diamond cubic), NaCl, CsCl, elmas, FCC Cu, BaTiO₃ ve grafit bulunur. Seçim yapıldığında yalnızca sağdaki **bilgi önizlemesi** güncellenir; açık 3B yapı değiştirilmez.
- **Seçilen yapıyı içe aktar** düğmesi, editöre döner ve yeni örneğin hücre parametrelerini, atomlarını, uygun uzay grubu numarasını, bağ sınırını ve 1×1×1 birim hücre gösterimini yükler. Önceki yapının görüntüleme kesiti/atom türü kuralı yeni örneğe taşınmaz. Yapı geçerli olduğunda 3B sahne yeniden oluşturulur.
- **Yeni P1 oluştur** aynı sekmede 5 Å kenarlı, tek Si atomlu düzenlenebilir bir başlangıç hücresi oluşturur.
- Örnek kristaller idealize edilmiştir; deneysel ölçüm ya da veri tabanı CIF kaydının yerine geçmez. İşlem, editördeki mevcut yapıyı değiştirir.

## Kaydet / dışa aktar modalı

Üst menüdeki **↓ Kaydet**, yapı dosyası formatı seçilebilen bir modal açar:

- **Proje dosyası (JSON)**: Mevcut yapı ve uygulama ayarları, sonradan tekrar düzenlemek için saklanır.
- **CIF**: Kristalografi dosyası (gerekli olduğunda simetri operatörleriyle).
- **POSCAR**: VASP uyumlu hücre ve atom konumları.
- **XYZ**: Görüntülenen süperhücrenin Kartezyen atom konumları.
- **PNG**: Beyaz zeminli 3B görsel.

Modal `Escape`, **Vazgeç** veya kapat düğmesiyle kapanır. Dışa aktarma ve örnek yapılar artık sol panelde yer kaplamaz. 3B editörün sol paneli hücre, simetri, bağ ve model düzenleme işlevlerine ayrılmıştır. Kod tek `index.html` içindedir; backend gerektirmez.

## COD Kütüphane (yalnızca frontend)

Üst navigasyonda **Kristal Yapı** yazısına tıklamak 3B editöre, **Kütüphane** bağlantısına tıklamak aynı `index.html` içindeki COD arama sayfasına gider. Logo ve `3B Studio` rozeti kaldırılmıştır.

- **Gelişmiş COD filtreleri**: metin, COD numarası, kimyasal formül (Hill notasyonu), uzay grubu, dergi, yayın yılı, cilt, sayı, DOI; bulunması gereken 8 ve bulunmaması gereken 4 element; farklı element sayısı, hücre hacmi, Z, Z′ aralıkları; Fobs, tekrar kayıtları, hatalı/teorik kayıt seçenekleri.
- Örnek **La–Mn–Ge–In** aramasını tek düğmeyle doldurabilir, sonuçları COD kimliği, formül, uzay grubu, hücre, hacim, yayın bilgisi ve CIF bağlantısı üzerinden inceleyebilirsin. Sonuçların ilk 600 kaydı, sayfa başına 30 kayıt gösterilir. COD REST API geniş sorgularda çok büyük cevap döndürebilir; filtreleri daraltmak gerekir.
- Her sonuç için **↧ İçe aktar**, uzak CIF dosyasını çalışma belleğine alıp mevcut CIF ayrıştırıcısıyla 3B editörde açmayı dener. İçe aktarım sadece başarılı olduğunda editöre geçilir. Hata halinde COD sayfasından CIF'i elle indirip **Kristal Yapı → Aç** üzerinden içe aktarabilirsin.
- **☆ Yer imleri** düğmesi `localStorage` içinde **yalnızca üstverileri** (`codId`, formül, hücre/uzay grubu, bibliyografi, `cifUrl`, `entryUrl`, ekleme zamanı) saklar. CIF metni, atom koordinatları ya da CIF dosyasının kendisi saklanmaz. Yer imlerine yeniden girişte uzak CIF yeniden alınır. Ayrıca yer imleri JSON olarak dışa aktarılabilir. Kayıtlar tarayıcı/profil bazlıdır; diğer cihazlara kendiliğinden eşitlenmez.

### COD erişimi ve CORS sınırları

COD'nin resmî arama uç noktası `https://www.crystallography.net/cod/result?format=json`, CIF erişimi `https://www.crystallography.net/cod/<COD-ID>.cif` biçimindedir; belgeler: https://wiki.crystallography.net/RESTful_API/ .

**COD API tarayıcıdaki CORS isteklerine izin vermeyebilir.** Bu nedenle bağlantı ayarlarında `Yalnız doğrudan`, `Otomatik` ve `Harici aracı` seçenekleri vardır. Otomatikte önce doğrudan COD'ye, bu olmazsa `proxy.cors.dev` ve `api.allorigins.win` açık CORS aracılarına başvurulur. Bu, uygulamanın kendi backend'i değildir; ancak **harici servis bağımlılığıdır** ve bu servisler kesintiye uğrayabilir veya oran sınırları koyabilir.

**Gizlilik:** Harici aracı aktifse COD arama URL'si, arama ölçütleri ve indirilecek CIF bağlantısı aracı sağlayıcısına gönderilir. COD dosyasının içeriği aracı üzerinden akar. Bu sınırlama form içinde de belirtilir. Özel/veri gizliliği gerektiren sorgular için `Yalnız doğrudan` seçilmeli veya CIF manuel yüklenmelidir. Gerçek COD sunucusuna bu çalışma ortamından uçtan uca tarayıcı/CORS doğrulaması yapılamamıştır; her zaman manuel açma yolu sunulur.

## Özellikler

- Si (diamond cubic), C (elmas), NaCl, CsCl, Cu (FCC), BaTiO₃ (ideal kübik), grafit örnekleri
- Birim hücre parametreleri (**a, b, c, α, β, γ**); triklinik hücre desteği
- Kesirli koordinatlardan Kartezyen koordinatlara dönüşüm, atom ekleme/silme/düzenleme
- 1–6 arasında üç eksende tekrar, dış sınır atomları, hücre çizgileri ve eksenler
- Ball & stick, space filling, stick ve wireframe gösterimi; geometrik bağ eşiği; seçili tür etrafında konveks koordinasyon çokyüzlüleri
- Perspektif/ortografik kamera, animasyon, standart bakışlar, PNG kaydı
- Atom seçimi ile iki atom arası uzaklık ve üç atom açısı
- **İçe aktarma:** CIF (fraksiyonel atom konumları ve dosyada açıkça verilen simetri işlemleri), VASP POSCAR/CONTCAR, basit XYZ ve uygulamanın JSON projesi
- **Dışa aktarma:** CIF, POSCAR, XYZ, proje JSON ve PNG
- Node.js'in yerleşik test çalıştırıcısıyla kristal geometri ve temel dosya ayrıştırma regresyon testleri

## Beyaz tema ve VESTA benzeri görünüm

- Tüm uygulamada **beyaz/açık tema**: başlık, sol/sağ paneller, formlar, tablolar, menüler, ölçüm panelleri ve 3B çalışma alanı.
- Atomlar **elementlerine göre Jmol/CPK-esinli farklı renklerle** gösterilir (118 element için kararlı renkler); beyaz fondaki kontrast için nötr ışıklandırma kullanılır.
- 3B sahnenin sol altında kamerayla birlikte dönen **XYZ yön göstergesi** vardır: X kırmızı, Y yeşil, Z mavi. Bu gösterge Kartezyen eksenlerdir; triklinik yapılarda birim hücrenin a/b/c örgü vektörleriyle karıştırılmamalıdır.
- **Otomatik bağ uzunluğu (elemente göre)** varsayılan açıktır. Bağ uzunluğu, genel eşik ile yaklaşık kovalan yarıçapları toplamının (1,2×) küçüğüyle sınırlandırılır. Özel element-çifti kuralları bu otomatik sınırı geçersiz kılar. Bu yalnızca geometrik bir görselleştirme sezgisidir; VESTA dosyalarındaki kullanıcı tanımlı bağ kurallarını yeniden üretmez.
- Bağ çubukları inceltildi, hücre çizgileri beyaz fonda okunacak gri tona getirildi ve PNG dışa aktarımı beyaz zeminle yapılıyor.
- Orijinal 3B sahnedeki renkli kristal ekseni çizgileri varsayılan olarak kapalıdır; **Görünüm → Kristal eksenlerini yapı içinde göster** ile tekrar açılabilir. Sol alt XYZ göstergesi sabit görünür.

## Kristalografik temel (Aşama 1)

- **230 uzay grubu, 274 referans/alternatif setting**, HTML içine gömülü simetri operatörleri ve Wyckoff referans konumları.
- Belirlenen uzay grubunun **asimetrik atom konumlarını tam birim hücreye** genişletme; eşdeğer atomları koordinat toleransıyla tekilleştirme.
- Simetri modu açıkken, en çok 60 bağımsız konum için site çokluğu ve Wyckoff sınıfı **atom koordinatlarından otomatik olarak** eşleştirilir (affine pozisyon kısıtları ve simetri eşdeğerleri). Wyckoff konumlarını otomatik *oluşturma* ve koordinatları simetrik ideal konuma zorlama özelliği yoktur.
- Hücre metriğiyle uyumsuz simetri operatörlerinin uygulanmasını engelleyen doğrulama.
- Tür bazlı bağ kuralları; görünür hücre sınırını geçen periyodik bağların çizimi (100 veya daha az temel atom için tam yöntem, büyük yapılarda mevcut uzaysal eşik yöntemi).
- Mesafe ölçümünde doğrudan uzaklığın yanında **minimum periyodik görüntü uzaklığı** (komşu 27 görüntünün taranması).
- CIF içe aktarımı: Dosyada verilen simetri operatörlerini uygular; operatör yoksa tanınan uzay grubu ve referans ayarıyla genişletir, setting/orijin varsayımını uyarıyla bildirir.
- CIF dışa aktarımı: Asimetrik konumlara simetri uygulanıyorsa seçilen grup ve operatörler korunur; önceden genişletilmiş (P1) atomlar P1 olarak yazılır.

## Miller düzlemleri ve dönüşümler (Aşama 2)

- Tam örgü metriğinden **Miller (hkl) düzlemi** ve **d(hkl)** düzlemler arası uzaklık hesaplaması (kübik ile sınırlı değildir).
- Gerçek 3B örgü üzerinde birim/süperhücreyle kesişen saydam düzlem poligonu.
- Seçili düzlem etrafında Å cinsinden kalınlıkla **görsel atom-merkezi kesiti** (slab filtreleme), ayrıca **vakumlu slab hücresi oluşturma**: (hkl) yüzeyinin iki primitive 2B örgü vektörü, yüzeye dik üçüncü hücre ekseni, belirtilen Å kalınlığı ve vakum boşluğu. Oluşturulan P1 slab CIF/POSCAR olarak dışa aktarılabilir. Yüzey relaksasyonu, yeniden yapılanma, pasivasyon, dipol düzeltmesi ve DFT çalıştırma bu uygulamanın kapsamı dışındadır.
- Pozitif determinantlı özel **3×3 örgü dönüşümü**, atomların koordinatlarına uygun baz değişikliği ve dönüştürülen hücrede atomların yeniden bulunması.
- FCC/BCC conventional → primitive, FCC primitive → conventional, eksen değişimi ve bir yönde çoğaltma örnek dönüşüm matrisleri.
- Dönüştürülmüş hücre P1 olarak atanır; özgün simetri grubu otomatik olarak tekrar çözümlenmez.
- Dar ekranda üst araç çubuğunun başlığa taşması engellendi; gereksiz alt başlık kaldırılarak 3B çalışma alanı büyütüldü.

## Bilimsel kapsam ve sınırlar

- **Bu bir VESTA eşdeğeri değildir.** Elektron yoğunluğu / potansiyel alanları, CHGCAR/CUBE/XSF hacimsel izoyüzeyleri, manyetik yapı, çok fazlı görselleştirme, termal elipsoitler ve otomatik uzay grubu belirleme bu sürümde yoktur.
- CIF'de simetri operasyonları verilmemişse, tanınan uzay grubunun referans ayarı/orijini varsayılır. Alternatif orijin ve eksen ayarlarında fiziksel doğruluğu bağımsız olarak kontrol etmek gerekir.
- CIF okuyucu yaygın CIF 1.x metinsel altkümesini hedefler; tüm CIF/mCIF standartlarını uygulamaz. mCIF manyetik verileri dikkate alınmaz.
- CIF içe aktarımı atomları görünür P1 konumlarına genişletir. **Simetri modu açık ise** dışa aktarma seçilen uzay grubunu açık operatörlerle korur; simetri modu kapalı ise P1 yazılır. Her iki durumda da kaynak dosyanın bütün kristalografik meta verileri korunmaz.
- XYZ periyodik kafes bilgisi taşımaz; program atomları suni bir dik kutuya yerleştirir.
- Bağlar, kullanıcı eşiğiyle element yarıçapına dayalı otomatik sınırlama (ve varsa özel çift kuralları) kullanılarak çizilir. Kimyasal bağların varlığı, bağ mertebesi veya koordinasyon kimyası doğrulanmaz.
- Mesafe/açı ölçümü seçilen görüntüler arasında yapılır; buna ek olarak iki atom için 27 komşu görüntü taranarak periyodik minimum mesafe sunulur. Açı için minimum-görüntüye dayalı yeniden seçim yapılmaz.
- Sahne koruması için görüntülenen atom sayısı 1800, bağ sayısı 6500 ile sınırlıdır. 100'den fazla temel atom içeren yapılarda periyodik bağların dış sınırda tam çizilmesi yerine yalnızca uzaysal eşik yaklaşımı kullanılır.
- Editör ağırlıklı olarak yapısal görselleştirmeye odaklanır; deneysel parametreler ve kristalografik sonuçlar bilimsel kaynaklarla ayrıca doğrulanmalıdır.

## Geliştirici testi

```sh
node --test tests/core.test.cjs
```

Veriler: https://github.com/anoopkcn/wyckoff (MIT; Anoop K. Chandran) ile https://github.com/spglib/spglib (BSD-3-Clause; Spglib team) kaynaklarından türetilen referans tabloları HTML içinde taşınır; telif/lisans bildirimleri de HTML içinde yer alır.

Vakumlu slab üreticisi, atom merkezlerini kesen ideal geometrik yüzey üretir. Fiziksel yüzey kararlılığı / kutupluluk değerlendirmesi yapmaz; DFT hesabı öncesinde doğrulanmalıdır.

Uygulamanın kaynak dosyası tek başına `index.html` dosyasıdır. Testler ve GitHub Actions yalnızca geliştirme/deploy içindir.
