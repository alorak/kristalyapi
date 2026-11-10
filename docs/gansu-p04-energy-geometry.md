# P0.4 · GANSU Lite bağımsız WASM SCF enerji–geometri taraması

## Kapsam
DFT → Tarayıcı hesapları → P0.4. H₂ (H–H), H₂O (sabit H–O–H açısında iki O–H) veya SiH₄ (sabit tetrahedral yönlerde dört Si–H) için kullanıcı tarafından onaylanan **3–9 ayrı moleküler Kohn–Sham DFT/SCF** hesabı yapılır. Her nokta yeni GANSU Lite WASM Worker hesaplamasıdır. Önceden hesaplanmış enerji veya parametrik potansiyel kullanılmaz; JSON/CSV ancak bütün SCF noktaları başarıyla tamamlandığında sunulur.

Girdiler: mevcut XYZ, fonksiyonel (SVWN/PBE/B3LYP), integrasyon grid, yük/spin çokluğu ve Å bağ aralığı. Bir baz fonksiyoneliyle kullanılan STO-3G paketi ve upstream commit P0.2 ile aynıdır. Molekül kimliği ve simetrik bağ koşulları ön kontrolden geçmezse sistem hesaplamayı reddeder. Sonuçlarda toplam Hartree enerjisi, numune minimumuna göre bağıl eV, SCF iterasyonu, sürüm ve tarama şeması bulunur.

**Yorum sınırı:** Grafikte işaretlenen minimum yalnız incelenen ayrık bağ uzunlukları arasındakidir; otomatik geometri optimizasyonu veya kuvvet sıfırı kanıtı değildir. H₂O açısı ve SiH₄ tetrahedral açıları sabitlenir. Sınırlı STO-3G, integrasyon grid ve XC fonksiyoneli sonuçların gerçek molekül veya deneyle yakınsamasını garanti etmez. SiH₄ sonucu periyodik elmas-Si hesaplaması değildir. Kaynak: [GANSU P0.3/PySCF karşılaştırması](gansu-p03-silicon-validation.md).

## Kabul
- `node --test tests/gansu-geometry-scan.test.mjs tests/gansu-local-engine.test.mjs` deterministik üreteç, sayısal sınırlar, iptal, WASM kökeni ve başarısız SCF retlerini kontrol eder. Mock motor yalnız bu birim testinde kullanılır.
- Gerçek browser/SCF koşusu `node tests/browser/gansu-local.test.mjs` ile P0.2 motorun sağlığını test eder; **çok noktalı P0.4 PySCF bağımsız doğrulaması bu PR kapsamında henüz yoktur**.
- Bilimsel kabul için tarama noktalarının bağımsız PySCF ile tekrarı, ayrık gridden minimum seçiminin gride duyarlılığı ve en az iki fonksiyonel/grid kıyası gerekli.
- Fail-closed: herhangi bir noktada SCF/WASM doğrulanamazsa önceki kabul raporu geçersiz kılınır; eksik eğri başarıyla dışa aktarılamaz.
