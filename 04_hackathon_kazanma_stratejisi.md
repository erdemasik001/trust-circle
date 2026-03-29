# 🏆 Trust Circle — Hackathon Kazanma Stratejisi & Ödül Kriterleri

> Her sponsor track için **ne bekleniyor**, **nasıl demo'lanır**, **jürinin dikkat ettiği noktalar**

---

## 1. World Mini App ($20.000)

### Jüri Kriterleri
1. **MiniKit entegrasyonu** — `verify`, `pay`, `sendTransaction` komutları kullanılmış
2. **World içi deneyim** — World App WebView'da düzgün açılıyor
3. **Kullanıcı deneyimi** — Cüzdan kurulumu yok, gas yok, mobil dostu
4. **World ID kullanımı** — Proof of Personhood entegre

### Demo Senaryosu (Bu sırayla göster)
```
1. World App → Trust Circle Mini App'i aç
2. "Doğrula" butonuna bas → World ID iris tarama animasyonu
3. Alice olarak giriş yap → Dashboard'da güven ağını göster
4. Bob'a kefil ol (ENS: bob.eth yazarak) → imzala
5. Bob hesabına geç → 3 kefilin olduğunu göster
6. "Kredi Al" → 50 USDC instant → cüzdanda görünüyor
7. Gas ücreti = 0₺ → bunu özellikle vurgula!
```

### Güçlü Noktalara Vurgu
- **"Kullanıcı ETH tutmak zorunda değil"** — gas World App karşılıyor
- **23 milyon hazır kullanıcı** — App launch'dan önce pazar var
- **Tanıdık mobil UX** — kripto bilmek gerekmiyor

---

## 2. LayerZero Omnichain Identity & State ($20.000)

### Jüri Kriterleri
1. **lzRead veya OApp kullanımı** — mesaj gerçekten zincirler arası iletiliyor
2. **Identity/State taşıma** — sadece token köprüsü değil, anlamlı veri
3. **Teknik derinlik** — DVN, Executor konfigürasyonu yapıldı
4. **Kullanım senaryosu** — neden cross-chain önemli, somut örnek

### Demo Senaryosu
```
1. World Chain Sepolia'da: Trust Score = 100 USDC göster
2. LayerZero Scan'i aç → "World Chain → Arbitrum" mesajını göster
3. Arbitrum Sepolia'da: TrustCircleRead'i aç
4. "Skor güncellendi: 100 USDC" → Arbiturum'da kredi kullanılabilir
5. "Kullanıcı Base'e geçse de skoru geçerli" → vizyonu anlat
```

### Güçlü Noktalara Vurgu
- **Token değil, state taşıyoruz** — bu layerzero'nun gerçek gücü
- **Güven tek zincirde kalmak zorunda değil** — omnichain trust score
- **lzRead ile "pull" modeli** — pasif değil, aktif sorgulama

### LayerZero Scan Screenshot'ı Demo'da Göster
- `layerzeroscan.com`'da verified yeşil tik görünmeli
- Mesaj latency (genellikle < 30 saniye testnet'te) ekilenip

---

## 3. Circle Best USDC Use Case ($10.000)

### Jüri Kriterleri
1. **USDC kullanım anlamlılığı** — sadece "ödeme" değil, yenilikçi kullanım
2. **Finansal kapsayıcılık** — bir sorunu USDC ile çözüyor
3. **Teknik implementasyon** — sözleşmede USDC akışı doğru

### Demo Senaryosu
```
1. "DeFi'de borç almak için 23 milyon kişinin parasını kilitlemesi gerekiyor" → problem
2. "Trust Circle ile teminat yok" → çözüm
3. USDC disbursement'ı göster: kredi anında, gas yok
4. "Bu, World App'teki 23 milyon kişi için mikro-finans demek"
```

### Güçlü Noktalara Vurgu
- **Gerçek kullanım = Mikro-finans** — gelişmekte olan ülkeler için anlamlı
- **Native USDC** (wrapped değil) — Circle'ın fayda anlayışına uygun
- **Gas-free USDC** — minikit.pay() World App ödüyor

---

## 4. ENS Integration ($10.000)

### Jüri Kriterleri
1. **ENS isimlerinin kullanılması** — adres yerine isimle işlem
2. **ENS'e özgü özellik** — sadece "isim gösterme" değil, anlamlı kullanım
3. **UX geliştirme** — ENS olmadan daha mı zor?

### Demo Senaryosu
```
1. Kefil olma formunda: "0x1234..." yerine "bob.eth" gir
2. Otomatik ENS resolve → adres göster → onay → vouch işlemi
3. Feed'de: "alice.eth, bob.eth'e kefil oldu" (sezgisel UX)
4. Profil sayfasında: ENS avatar + isim göster
```

### Güçlü Noktalara Vurgu
- **"Kripto adresini bilmek zorunda değilsin"** — ENS bunu mümkün kılıyor
- **Sosyal güven ağı insan simleri ister** — `alice.eth`, `0xd8dA...`'dan güvenilir görünür
- **ENS text records** — avatar, twitter, bio çek (derinlik gösterir)

---

## 5. 5 Dakikalık Sunum Taslağı

### Zaman Dağılımı
```
0:00–0:45 → Problem (DeFi'nin eksikliği)
0:45–1:30 → Çözüm (Trust Circle nedir?)
1:30–3:30 → Live Demo (sıfır gas, kefalet, kredi)
3:30–4:15 → Teknik Derinlik (LayerZero slaytı)
4:15–5:00 → Neden Kazanırız + Kapanış
```

### Açılış Cümlesi
> *"Size 23 milyon kişiyi DeFi'ye katabilecek bir çözüm göstereceğim. Bugün DeFi'de borç almak için önce paranızı kilitlemek zorundasınız. Trust Circle'da tek ihtiyacınız gerçek insanlığınızı ispatlamanız."*

### Kapanış Cümlesi
> *"Trust Circle; World ID'nin Sybil koruması, LayerZero'nun omnichain altyapısı, Circle USDC'nin stabilitesi ve ENS'in insan tanımlı kimliği ile DeFi'nin en dirençli sorununu çözüyor. 23 milyon hazır kullanıcı, sıfır gas ücreti, sıfır teminat."*

---

## 6. Sık Sorulan Jüri Soruları & Cevapları

**S: "Kullanıcı geri ödemezse ne olur?"**
> C: "Kefiller, kefaletlerini çekemez — bu sosyal baskı yaratır. İlerleyen versiyonda kefillerin kefalet payları risk fonuna kilitleneceği bir staking mekanizması eklenebilir."

**S: "Why not just use Aave on World Chain?"**
> C: "Aave still requires collateral. Our innovation is removing collateral entirely — someone with no assets can borrow because their friends' trust is the collateral."

**S: "LayerZero'yu neden kullandınız, bridge yeterli değil miydi?"**
> C: "Köprü token taşır. Biz güven durumu (state) taşıyoruz. Bu, lzRead'in güçlü olduğu kesin use case — tek yönlü, güvenilir veri okuma."

**S: "ENS sadece display name olarak mı kullanıyorsunuz?"**
> C: "ENS, kefalet adresini insan okunabilir kılıyor ve ENS profil verilerini (avatar, sosyal hesaplar) güven ağındaki kullanıcı profillerinde gösteriyoruz. Gelecekte ENS subdomains ile trust circle üyeliği mümkün olabilir."

---

## 7. Teknik Hazırlık Son Kontrol

### Hackathon Gününden 1 Gün Önce
- [ ] World Developer Portal'da app kayıtlı ve `app_id` var
- [ ] World Chain Sepolia'da sözleşme deploy edildi ve adresi not alındı
- [ ] USDC testnet bakiyesi havuzda var (faucet'ten al)
- [ ] Vercel/Netlify deploy edildi, URL çalışıyor
- [ ] ENS testnet isimleri hazır (demo hesapları için)
- [ ] LayerZero Scan'de başarılı test mesajı ekran görüntüsü alındı

### Demo Günü Sabahı
- [ ] Phone'da World App açık ve Developer Mode aktif
- [ ] 3 demo hesap hazır: Alice, Bob, Charlie (farklı cihaz/incognito)  
- [ ] Sözleşme adresleri ve TX hashleri copy-paste hazır
- [ ] Yedek plan: Ekran kaydı hazır (canlı demo tutmazsa)

---

*Bu strateji belgesini sunum sabahı bir kez daha oku.*
