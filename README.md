# Kristal Yapı · 3B Studio

Yalnızca tarayıcıda çalışan, **VESTA'dan esinlenen bir kristal yapı görüntüleyicisi/editörü**.

## Kullanım

- [index.html](index.html) tek başına arayüzü, CSS'yi ve uygulama JavaScript'ini içerir. Derleme, backend, veritabanı veya API anahtarı gerekmez.
- 3B motor için sabitlenmiş **Three.js 0.182.0** ve OrbitControls/ConvexGeometry modülleri jsDelivr CDN'den yüklenir. **İlk açılışta internet bağlantısı gerekir; tamamen çevrimdışı, tek dosya değildir.** Kristal dosyaları bir sunucuya yüklenmez.
- GitHub Pages için depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilir. `main` dalına merge sonrasında doğrulama ve dağıtım çalışır; PR açıldığı anda CI tetiklenmez.
- Yerelde statik sunucu kullanabilirsiniz: `python3 -m http.server 8000` ve `http://localhost:8000` adresini açın.

## İlk sürümün özellikleri

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

## Bilimsel kapsam ve sınırlar

- **Bu bir VESTA eşdeğeri değildir.** Elektron yoğunluğu / potansiyel alanları, CHGCAR/CUBE/XSF hacimsel izoyüzeyleri, manyetik yapı, çok fazlı görselleştirme, termal elipsoitler, Wyckoff veri tabanı ve tam 230 uzay grubu çözümlemesi bu sürümde yoktur.
- CIF'de uzay grubu adı olup simetri operasyonları verilmemişse, tüm simetri eşdeğer atomları üretilemez. Uygulama bunu açıkça bildirir ve yalnızca verilen atom konumlarını kullanır.
- CIF okuyucu yaygın CIF 1.x metinsel altkümesini hedefler; tüm CIF/mCIF standartlarını uygulamaz. mCIF manyetik verileri dikkate alınmaz.
- İçe aktarılan CIF simetrisi açık P1 atom konumlarına genişletilir; dışa aktarılan CIF, **P1** olarak yazılır. Özgün uzay grubu/meta verileri korunmaz.
- XYZ periyodik kafes bilgisi taşımaz; program atomları suni bir dik kutuya yerleştirir.
- Bağlar, kullanıcı tarafından belirlenen mesafe eşiğine göre çizilir. Kimyasal bağların varlığı, bağ mertebesi veya koordinasyon kimyası doğrulanmaz.
- Mesafe/açı ölçümü, görselde seçilen belirli atom görüntüleri arasında yapılır. Otomatik minimum-görüntü (minimum image) hesabı yapılmaz.
- Sahne koruması için görüntülenen atom sayısı 1800, bağ sayısı 6500 ile sınırlıdır.
- Editör ağırlıklı olarak yapısal görselleştirmeye odaklanır; deneysel parametreler ve kristalografik sonuçlar bilimsel kaynaklarla ayrıca doğrulanmalıdır.

## Geliştirici testi

```sh
node --test tests/core.test.cjs
```

Uygulamanın kaynak dosyası tek başına `index.html` dosyasıdır. Testler ve GitHub Actions yalnızca geliştirme/deploy içindir.
