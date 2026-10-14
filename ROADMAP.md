# Kristal Yapı — VESTA farkları ve geliştirme sırası

Bu plan gerçek VESTA özellikleriyle mevcut tek-`index.html` tarayıcı uygulamasını karşılaştırır. Sıra hem bilimsel doğruluğu hem de kullanıcı arayüzünün anlaşılabilirliğini esas alır. **Bir özellik UI'da mevcut diye bilimsel olarak doğrulanmış sayılmaz.** Canlı COD araması internet/CORS'a; 3B görüntü Three.js CDN'ine bağlıdır.

## Kısa vade · PR #12 (bu geliştirme)

| Sıra | İş | Durum / teslim ölçütü |
| --- | --- | --- |
| K1 | Görselde tekrar eden yapı başlığını kaldır | Yapı adı sağdaki Yapı Bilgileri'nde kalır; sahnede başlık kartı bulunmaz |
| K2 | Kamera kontrolleri ikonlaştırma | Sığdır / üst / ön / yan / projeksiyon için beş kompakt erişilebilir SVG ikon, hover metni ve projeksiyon durumu |
| K3 | Bağ ve çokyüzlü iş akışı | Atom çifti bazlı min–maks eşik editörü, geometrik öneri, kural kaldırma; PBC komşularından çokyüzlü üretme, komşu/kesim sınırı |
| K4 | Ölçüm arayüzü | 2 atom mesafe, 3 atom açı, 4 atom torsiyon; periyodik komşuluk özeti; ölçüm geçmişi/CSV |
| K5 | Çoklu Miller gösterimi | 8 ek (hkl) katmanı, ayrı renk/görünürlük/silme; tekrar eden paralel düzlemler ve ayarlar proje/son-kristal kaydında korunur |

Bu adımlar **kodlandı ve 84/84 regresyon testi başarılı**. Ancak gerçek tarayıcı/WebGL görsel E2E, farklı CIF dosyalarıyla koordinasyon kriterleri ve büyük yapıların performansı merge sonrası ayrıca denetlenmelidir. Çokyüzlüler geometrik yakınlığa dayanır; oksidasyon ve bağ mertebesini saptamaz. Ek Miller katmanları gösterim içindir: slab üretimi yalnız birincil `t` düzlemini kullanır.

## Öncelikli kalite kapısı (her yeni bilimsel özellikten önce)

- COD 4335507, grafit, NaCl, CsCl, Si ve triklinik örneklerde hücre, atom çokluğu, periyodik mesafe ve bağ/koordinasyon farklarını **Gemmi referansıyla** raporla.
- Kullanıcı tanımlı eşik değişiminde atom koordinatlarının etkilenmediğini; toplam atom, tahmini koordinasyon ve çokyüzlü köşe sayılarının beklenen sınırlarda olduğunu test et.
- Otomatik CI yalnızca **main merge** sonrası çalışsın; hata veya `inconclusive` kayıtlar raporda açık kalsın. Eşik düzeltmeleri gerçek sapmaları gizlememeli.
- Mobil ve masaüstünde gerçek WebGL screenshot/duman testi, GPU bellek/çizim sınırı ve yükleme hatası deneyleri ekle.

## Orta vade · önerilen uygulama sırası

| Öncelik | Paket | Kabul kriteri |
| --- | --- | --- |
| O1 | Undo/Redo + nesne/katman yönetimi | Atom, bağ, Miller ve görünüm düzenlemeleri geri alınabilir; performans sınırı ve klavye kısayolları test edilir |
| O2 | Çok seviyeli izoyüzey | Tek CUBE/CHGCAR/XSF alanında birden fazla izodeğer, ayrı renk/opacity ve katman kontrolü |
| O3 | Çoklu hacim alanı + uyum kontrolü | Aynı yapıya birden fazla yoğunluk/potansiyel haritası; birim, koordinat çerçevesi ve grid interpolasyonu açıkça doğrulanır |
| O4 | Gelişmiş 2B kesitler | Orta/kenar düzlemleri, nicel skala, kontur seviyeleri, PNG/SVG çıktısı ve eğik hücrede örnekleme doğruluğu |
| O5 | Kristal morfolojisi / crystal faces | Ayrı `{hkl}` yüz aileleri, orijinden mesafe, kapalı morfoloji poliedri ve bağımsız renk/etiket katmanı |
| O6 | Koordinasyon/bağ kimyasının bilimsel kontrolü | Site bazında CN, bağ uzunluğu dağılımı, minimum-image tolerans kontrolü, kısmi occupancy ayrımı; testli BVS hazırlığı |

## Uzun vade · önerilen uygulama sırası

| Öncelik | Paket | Kabul kriteri |
| --- | --- | --- |
| U1 | ADP/termal elipsoitler | CIF `Uij`/eşdeğer parametrelerini okuma, pozitif tanımlı tensör kontrolü, seçilebilir olasılık düzeyi |
| U2 | Best-fit plane ve gelişmiş geometri | Seçili atom kümesine en küçük kareler düzlemi, RMS sapma, düzlem–düzlem açı ve dihedral karşılaştırmaları |
| U3 | Çoklu yapı bindirme | Aynı anda iki CIF modeli, ayrı hücre/baz dönüşümü, atom hizalama ve karşılaştırmalı görünürlük |
| U4 | Patterson ve türetilmiş alanlar | Sadece veri gösterimi değil: formüle dayalı Fourier/Patterson, Laplasyen ve fiziksel birim testleri |
| U5 | Voronoi integrali ve ileri kristal-kimya | Periyodik hücrede bölüşüm ve sayısal integral testi; occupancy ile yük/elektron sayımı denetimi |
| U6 | Gelişmiş format/yayın çıktıları | Kesin atom/alan metadata kaybı raporu, yüksek çözünürlüklü vektör çıktı, dönüşümlerde round-trip testleri |

### Mimari ilkeler

- Üretim yine frontend ağırlıklı ve tarayıcı tabanlı kalmalı. Büyük hacimsel veriler için Web Worker/WASM tercih edilebilir.
- CUBE/CHGCAR/XSF dosyalarındaki nicelikler **dosyada ne varsa odur**; renklendirmenin tek başına elektron yoğunluğu veya elektrostatik potansiyel hesapladığı söylenmemeli.
- Eklenecek her fiziksel hesap için referans fixture, ölçülebilir tolerans ve bilinen bilimsel sınırlama gerekir.
- Çalışma yapılırken tek dosya düzeni, harici Three.js CDN bağımlılığı ve çevrimdışı kullanım hedefi birlikte değerlendirilmelidir.

## VESTA referansları

- [VESTA resmî kullanım kılavuzu](https://www.jp-minerals.org/vesta/archives/VESTA_Manual.pdf)
- K. Momma & F. Izumi, *VESTA 3 for three-dimensional visualization of crystal, volumetric and morphology data*, J. Appl. Cryst. **44**, 1272–1276 (2011), DOI: 10.1107/S0021889811038970
- K. Momma & F. Izumi, *VESTA: a three-dimensional visualization system for electronic and structural analysis*, J. Appl. Cryst. **41**, 653–658 (2008), DOI: 10.1107/S0021889808012016
