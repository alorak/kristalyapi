# CI yeniden tetikleme kaydı

Bu değişiklik, GitHub Actions'ın `main` dalına merge edilen bir commit sonrasında
çalışıp çalışmadığını doğrulamak için hazırlanmıştır.

Beklenen iş akışları:

- `Validate and deploy crystal studio` — `main` push
- `CIF crystal accuracy · Gemmi reference` — `main` push, `tests/validation/**` yol filtresi

Bu dosyanın `tests/validation/` altında olması CIF doğrulama iş akışının
`paths` filtresini de karşılar. Yalnızca PR açılması yeterli değildir;
merge tamamlandığında iki iş akışı da tetiklenmelidir.

Beklenen sonuç oluşmazsa Actions ayarları, workflow etkinliği ve merge
commit'inin tetikleyici olayı ayrıca incelenmelidir.
