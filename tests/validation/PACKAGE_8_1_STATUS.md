# Paket 8.1 — CIF bütünlüğü ve ADP site-symmetry

## Bilimsel kapsam

Değişmemiş kaynak CIF bellek içindeki `cifOriginal` kaydından byte düzeyinde korunur.
Düzenleme sonrası üretilen CIF yalnız güvenli yayın kaynak alanlarının (`_publ_author_*`, `_citation_*`, `_journal_*`) skaler ve loop değerlerini korur.
Yapısal/rafinman/ölçüm verileri (`_atom_site_*`, `_geom_*`, `_refine_*`, `_diffrn_*`) eski geometriyi tarif edebileceğinden kaynak metinden kopyalanmaz.
Değiştirilmiş yapının eski `_cod_database_code` kimliği kopyalanmaz. Bileşim değişince formül ve kimyasal ad yeniden kullanılmaz.
Bibliyografi aktarımı bütün CIF sözlüklerine veya CIF2 değer tiplerine uyum iddiası değildir. Toplam 100.000 karakter, 12 kolon, 256 satır/loop ve değer başına 8192 karakter sınırı vardır.
Kaynak metin proje JSON'una veya tarayıcının son-yapı kalıcı kaydına eklenmez. Yeniden açılan proje özgün CIF baytlarını otomatik geri kazanamaz.

## Özel konum ADP

Konumu simetri altında kendine eşlenen atomun Uij tensörü Kartezyen kovaryans olarak `R U Rᵀ` dönüşümünde sabit kalmalıdır.
Mutlak 0.002 Å² veya diagonal büyüklüğünün %3'ü toleransı kabul edilir; daha büyük sapmada içe aktarma hata verir. Tensör otomatik projeksiyonla değiştirilmez.
Genel konumdaki eşdeğer atomlar doğru döndürülür ve siteye geri dönmedikleri sürece bu sabitlik kısıtına tabi değildir.
Bu kontrol tam deneysel ADP rafinmanı ya da her Wyckoff konumunun belirsizlik analizi değildir.

## Referans ve test

- 28 sabitlenmiş gerçek CIF (real-01–14 ve real-16–29): orijinal dosya koruması, düzenleme, atom çokluğu ve yayın-kaynak kaydı round-trip.
- real-15 eksik atom koordinatı ve real-30 Gemmi referansında bozuk kaynak nedeniyle bilinçli olarak geçerli-pass kapsamına sokulmaz.
- Analitik ayna ve 4 katlı eksen site-symmetry testleri; genel konum dönüşümleri; çok satırlı bibliyografi ve yapıya bağlı metadata dışlama testleri.
- `tests/validation/test_package81_gemmi.py`, uygulamanın JS dışa aktarıcısının düzenlenmiş CIF çıktısını bağımsız Gemmi 0.7.4 ile ayrıştırır.
- Önceki 30 gerçek + 10 sentetik Gemmi kontrolü korunur; mevcut iki bilinen `inconclusive` kaynağı gizlenmez.

## Kalanlar

Genel metadata kayıp raporu, CIF2 ve çok veri bloğu, kapsamlı Hall/orijin özel-konum ADP referansları ve belirsizlik değerlendirmesi.

## Bağımsız kaynaklar

- [IUCr CIF 1.1 sözdizimi](https://www.iucr.org/what-we-do/digital-standards/cif/cif1/file-syntax)
- [IUCr ADP site-symmetry restrictions](https://doi.org/10.1107/S2053273315008372)
