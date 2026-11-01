# P1.1 — Orijinal kanıt dosyalarını yeniden SHA-256 ile doğrulama ve Ed25519 imza zinciri

Bu paket, **Malzemeler** ekranının mevcut `materials-evidence.json` paketini okuyan, **dosya baytlarını** yeniden hash'leyen ve isteğe bağlı olarak operatörün **önceden güvenilir olarak sabitlediği** Ed25519 açık anahtarına göre **ayrık imza** doğrulayan çevrimdışı CLI ekler.

## Neden gerekiyor?

Tarayıcı önceki sürümde eklenen CIF, XRD veya QE dosyalarını saklamıyordu. JSON içindeki hash ve kaynak kimliği kullanıcı beyanıydı; bir başkası dosyanın gerçek baytları olmadan bunları doğrulayamıyordu. Yeni `tools/material_evidence_attestation.mjs` dosyaları tekrar okur; yalnız hash'ler eşleşirse bütünlük raporu verir.

## Dosya düzeni ve kullanım

Tarayıcıda **Malzemeler > Kaynaklı JSON** ile `materials-evidence.json` dosyasını dışa aktarın. Orijinal kanıt dosyalarını aynı isimle aşağıdaki gibi hazırlayın:

```text
provenance/
  materials-evidence.json
  evidence/
    card-1/
      sample.cif
      scan.csv
    card-2/
      qe-input.in
      qe-output.out
```

`card-1`…`card-4`, JSON'daki kart sırasına karşılık gelir. Bir kartın kanıt kaydı olmasa bile geometrisi doğrulanır. Gerçek orijinal dosya bulunmayan kanıt kaydı için doğrulama **hata verir**, geçerli saymaz. Sınır: kart başına 12 dosya ve dosya başına 12 MiB; JSON 2 MB. Symlink, traversal ve hatalı dosya boyutu reddedilir.

```bash
node tools/material_evidence_attestation.mjs verify \
  --bundle provenance/materials-evidence.json \
  --files-dir provenance/evidence \
  --output provenance/verification.json
```

Sonuçta `artifactBytesReverified=true` ve `cards[].artifacts[].rawBytesReverified=true` bilgileri dosyaların ham içeriğinin **gerçekten yeniden hesaplandığını** gösterir. Orijinal içerik rapora veya internete gönderilmez. `verification.json` varsa başka bir çıktı dosyası seçin; CLI üzerine yazmaz.

## İsteğe bağlı ayrık Ed25519 imza

**Gizli anahtarın kendisini repoya koymayın.** Kurum içinde key custody ve erişim politikası oluşturun. Şu örnek, kurumun kendi oluşturup koruduğu Ed25519 PEM anahtarları içindir.

```bash
node tools/material_evidence_attestation.mjs sign \
  --bundle provenance/materials-evidence.json \
  --files-dir provenance/evidence \
  --private-key /secure/private-ed25519.pem \
  --signature-out provenance/manifest.sig
```

CLI imzadan önce tüm dosyaların mevcut hash'lerle eşleşmesini **zorunlu** tutar. Çıktıdaki `publicKeySpkiSha256` fingerprint değerini **ayrı ve güvenilir kanaldan** doğrulayarak kaydedin. İmza base64 biçimindedir ve JSON'un **tam ham baytlarına** bağlıdır: görünüşte önemsiz bir boşluk değişikliği bile imzayı geçersiz kılar.

```bash
node tools/material_evidence_attestation.mjs verify \
  --bundle provenance/materials-evidence.json \
  --files-dir provenance/evidence \
  --signature provenance/manifest.sig \
  --public-key /trusted/operator-public.pem \
  --trusted-key-sha256 <SHA-256-of-trusted-SPKI-DER>
```

Bu değer terminal komutunda gerçek 64 haneli hex olarak kullanılmalıdır; yer tutucu doğrudan çalışmaz. İmza güvenilen anahtarla eşleşmiyorsa, JSON ya da kanıt baytları değişmişse işlem hata ile sonlanır. Kurumsal anahtar kimliğinin önceden doğrulandığını bu kod varsayamaz; `signerInstitutionAuthenticated=false` ve `scientificAcceptance=false` kalır.

## Bilimsel sınırlar ve sıradaki adım

- Dosya hash'i **bütünlük kanıtıdır**, kaynağın bilimsel/kurumsal kimliği ya da ölçüm doğruluğu değildir. İmzalanmış sahte/yanlış içerik matematiksel olarak geçerli bir imza üretebilir.
- Kanonik P1 geometri özeti atom türleri, doluluk ve hücre ölçülerini kapsar; `ADP`, spin, kullanılan fonksiyonel, QE parametreleri, Kα veya cihaz ayarlarının tümünü kapsamaz. Bunlar kanıt dosyası kaydına ayrıca eklenmelidir.
- Ed25519 ortak anahtarının laboratuvara ait olduğunu bağımsız bir süreç göstermeli; anahtar rotasyonu ve iptal kayıtları haricen yönetilmelidir.
- QE job, UPF dosyası ve yapının **semantik olarak eşleşmesi**, XRD bağımsız referans ve gerçek bulk DFT deneyleri sonraki P1 adımlarıdır.

## Test

```bash
node --test tests/material-evidence-attestation.test.mjs
```

Sentetik CIF/dosya fixture'ları ve geçici test anahtarları kullanılır; gerçek kurum anahtarı veya gerçek bilimsel veri bulunmaz.
