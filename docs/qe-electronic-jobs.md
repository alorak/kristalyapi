# D4 — API üzerinden gerçek bant / DOS / atom-orbital PDOS

Durum: kod ve sentetik süreç testleri hazır; gerçek MoS₂ kabulü D3'ün
son kuvvet/geometri referansından sonra çalıştırılacak. Test değerleri
bilimsel sonuç değildir.

Yeni `kristalyapi.qe-electronic-job.v1` şeması `calculation=electronic`
ve kesin alanlı `electronic` nesnesini kullanır: `nbnd` 1–128,
`nscf_k` 2–24, `band_path` 2–16 açık `crystal_b` noktası. Her nokta
`label`, üçlü `k` ve `segments` içerir. Son ağırlık 1, toplam bölüm
sayısı ≤300, kz=0 ve SCF ağı kz=1 olmalıdır. Yalnız PBE/spinsiz/sabit
doluluklu 2B slab akışı desteklenir. Bant sayısının fiziksel uygunluğu
operatörün sorumluluğundadır; metadata ön kontrolü hesap yakınsaması değildir.

Worker mevcut `tools/qe_pipeline.py` işlevlerini bir alt süreç grubu olarak
kullanır: `scf → bands → bands.x → nscf → dos.x → projwfc.x`.
Kullanıcı dosya yolu, QE metni veya program adı gönderemez. Prefix/outdir
aynı pipeline içinde paylaşılır. Her aşama tamamlanmadan sonrakine geçilmez;
iptal ve toplam wall-time sınırı alt solver süreçlerini de sonlandırır.
Ham dosyalar, aşama manifesti ve atom/orbital PDOS dosya hash'leri korunur.
API ancak tüm aşamalar ve mevcut bant/DOS/PDOS ayrıştırıcıları geçerse
sonuç yayınlar; hata/kısmi sonuçlar 409 olarak kalır. Kaynak SCF son hata
tahmini ayrıca ≤1e-8 Ry olmalıdır. Sonuç JSON'u 24 MB ile sınırlıdır.

Arayüzde Sunucu iş akışı → SCF/bant/DOS seçilir. K-yolu yapıya göre
açıkça girilmelidir; placeholder otomatik yol seçimi değildir. D3 sonucu
altındaki düğme son geometriyi yeni hesabın girdisi olarak seçer; aktif
çalışma alanını değiştirmez. Seçili son yapı hash'i ön kontrolde eşleşmezse
iş gönderilmez. Alternatif olarak açıkça aktif yapı seçilebilir.

API sonucundaki `electronic` alanı mevcut bant/DOS/PDOS grafiğine doğrudan
bağlıdır. Ham QE enerji sıfırı kullanılır; Fermi/vakum hizalaması, bant
aralığı doğruluğu veya optik geçiş/tek-foton yorumları yapılmaz.

Kurulum için [iş API kılavuzu](qe-jobs.md). Docker imajı mevcut pipeline
ve PDOS ayrıştırıcılarını içerir; API 0.4.0 `electronic` yeteneğini duyurur.
Yoğun MoS₂ hesabı için D3'teki aynı doğrulanmış UPF ve kaynak profili
kullanılmalıdır. Gerçek Si işleyiş ve MoS₂ kabul sonuçları ayrıca eklenecek.
