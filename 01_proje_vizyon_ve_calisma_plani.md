# 🔵 Trust Circle — Proje Vizyonu & Çalışma Planı

> **Cannes Hackathon** hedefli yol haritası | Hazırlanma: Mart 2026

---

## 📌 Proje Özeti

**Trust Circle**, teminatsız (uncollateralized) sosyal kredi protokolüdür. Mevcut DeFi'nin en büyük açığını — aşırı teminatlandırma zorunluluğunu — "Gerçek İnsan" kimlik doğrulaması ve arkadaşların birbirine kefil olması mekanizmasıyla çözer.

```
Problem          : Aave gibi protokoller 150$ teminat → 100$ kredi
Çözüm            : World ID + Sosyal Kefalet → 0$ teminat ile kredi
Sybil Koruması   : World ID Proof of Personhood (23M+ doğrulanmış insan)
Gas Ücreti       : World Chain'de sıfır (World App sponsorlu paymaster)
Çapraz Zincir    : LayerZero V2 ile güven skoru tüm zincirlerde geçerli
```

---

## 🏆 Hedeflenen Ödüller (Toplam: ~60.000$)

| Sponsor | Ödül | Kategori | Nasıl Kazanılır |
|---------|------|----------|----------------|
| **World** | $20.000 | Best Mini App | MiniKit ile World App içi deneyim |
| **LayerZero** | $20.000 | Omnichain Identity & State | lzRead ile çapraz zincir güven verisi |
| **Circle** | $10.000 | Best USDC Use Case | Kredi dağıtımı USDC ile |
| **ENS** | $10.000 | ENS Integration | .eth isimleriyle tanımlama ve kefalet |

---

## 🗺️ Sistem Mimarisi (Yüksek Seviye)

```
┌─────────────────────────────────────────────────────────┐
│                    WORLD APP (MiniKit)                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ World ID │  │ ENS Resolver │  │  USDC Pay Cmd    │  │
│  │  Verify  │  │ (.eth names) │  │  minikit.pay()   │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │     WORLD CHAIN (L2)         │
          │  TrustCircle Smart Contract  │
          │  - vouch(address, limit)     │
          │  - requestLoan(amount)       │
          │  - repay(loanId)             │
          └──────────────┬──────────────┘
                         │
          ┌──────────────▼──────────────┐
          │     LAYERZERO V2 (lzRead)    │
          │  TrustScore cross-chain sync │
          │  World Chain ↔ Arbitrum      │
          │  World Chain ↔ Base          │
          └──────────────────────────────┘
```

---

## 📅 Çalışma Planı (Hackathon 3 Günü)

### 🔴 GÜN 0 — Setup (Hackathon Öncesi Hazırlık)

> **Bu adımlar hackathon başlamadan tamamlanmalı!**

- [ ] Node.js 20+, pnpm/yarn kurulu olduğunu doğrula
- [ ] World Developer Portal'da app kaydet → `app_id`, `rp_id`, `signing_key` al
- [ ] Hardhat + LayerZero CLI kurulumunu dene
- [ ] World Chain Sepolia testnet RPC erişimi kontrol et
- [ ] MiniKit geliştirme ortamı (`Dev Mode` ile World App simülatörü) hazırla
- [ ] Tüm SDK'ları `package.json`'a ekle (kurulum yapma, sadece listele)

---

### 🟡 GÜN 1 — Kimlik & Kefalet Altyapısı (MVP Çekirdeği)

**Hedef:** World ID login çalışıyor, kefalet sistemi sözleşmede var.

#### Sabah (09:00–13:00) — Smart Contract
- [ ] `TrustCircle.sol` temel yapısını kur
  - `mapping(address => mapping(address => uint256)) public trustLimit`
  - `mapping(worldId => bool) public verified`
  - `vouch(address borrower, uint256 limit)` fonksiyonu
  - `requestLoan(uint256 amount)` — 3 kefil kontrolü
  - `repay(uint256 loanId)` fonksiyonu

- [ ] World ID doğrulaması için `IWorldId` arayüzünü entegre et
  - `verifyProof(root, groupId, signal, nullifier, proof)` parametreleri

- [ ] USDC ERC-20 transfer mantığını ekle
  - World Chain USDC contract adresini kullan

#### Öğleden Sonra (14:00–18:00) — Frontend Temel
- [ ] Next.js projesi oluştur: `npx create-next-app@latest --typescript`
- [ ] MiniKit Provider'ı `_app.tsx` veya `layout.tsx`'e ekle
- [ ] World ID verify butonu ve flow'u implement et
- [ ] ENS isim çözümleme hook'larını ekle (wagmi + viem)

#### Akşam (19:00–22:00) — Entegrasyon
- [ ] Backend API: `/api/verify-worldid` endpoint'i
- [ ] Sözleşmeyi World Chain Sepolia'ya deploy et
- [ ] Frontend → Contract bağlantısı test et

---

### 🟠 GÜN 2 — Ödeme & Cross-Chain

**Hedef:** USDC kredisi çalışıyor, LayerZero mesajı gönderiliyor.

#### Sabah (09:00–13:00) — USDC Ödeme
- [ ] `minikit.pay()` komutu implement et
  - `tokenAddress: USDC_ADDRESS`
  - `to: contract_address`
  - `amount: loan_amount`
- [ ] Geri ödeme akışını tasarla (repay butonu)
- [ ] Kredi durumu takibi için `LoanStatus` enum ekle sözleşmeye

#### Öğleden Sonra (14:00–18:00) — LayerZero Entegrasyonu
- [ ] `TrustCircleRead.sol` implement et (`OAppRead` kalıtımı)
  - `_buildReadRequest()` ile World Chain'deki trust score'u sorgula
  - `_lzReceive()` ile yanıtı al
- [ ] LayerZero Sepolia endpoint adreslerini konfigüre et
- [ ] DVN ve Executor ayarlarını yap (`layerzero.config.ts`)
- [ ] Arbitrum Sepolia'ya `TrustCircleRead.sol` deploy et

#### Akşam (19:00–22:00) — UI Tamamlama
- [ ] "Bana Kefil Olan" listesi UI'ı
- [ ] "Kefil Limitim" göstergesi
- [ ] Kredi talep formu (ENS adı ile)
- [ ] Loading states ve error handling

---

### 🟢 GÜN 3 — Demo & Sunum Hazırlığı

**Hedef:** Her şey demo-ready, sunum materyalleri hazır.

#### Sabah (09:00–12:00) — Test & Bug Fix
- [ ] End-to-end akış testi: Login → Kefalet → Kredi → Geri Ödeme
- [ ] Mobile görünüm (World App için) test et
- [ ] Hata durumları test et (yetersiz kefil, limit aşımı)
- [ ] LayerZero Scan'den cross-chain mesajını doğrula

#### Öğleden Sonra (13:00–17:00) — Demo Senaryosu
- [ ] 3 farklı hesap hazırla (Alice, Bob, Charlie)
- [ ] Demo scripti yaz: Alice Bob'a kefil → Charlie Bob'a kefil → Bob kredi çeker
- [ ] Sunum slayti hazırla (Problem → Çözüm → Demo → Neden Kazanırız)
- [ ] README'i güncelle

#### Akşam (17:00–) — Son Rötuşlar
- [ ] Deploy URL'leri kontrol et (Vercel veya benzeri)
- [ ] Tüm env variable'ların production'da doğru olduğunu kontrol et
- [ ] LayerZero testnet mesajlarının başarılı gittiğini belgele (screenshot)

---

## ⚠️ Risk Matrisi

| Risk | Olasılık | Etki | Mitigation |
|------|----------|------|-----------|
| LayerZero lzRead kurulumu karmaşık | Yüksek | Yüksek | Gün 1 akşamı basit OApp ile başla, lzRead'i Gün 2'de ekle |
| World App Dev Mode bağlantı sorunları | Orta | Yüksek | Browser simülatörü ile fallback geliştirme |
| USDC testnet bakiyesi yetersiz | Düşük | Orta | World Chain Sepolia faucet'i önceden kullan |
| Smart contract bug | Orta | Yüksek | Basit tutun; karmaşık reentrancy yerine minimal vault |

---

## 🔑 Kritik MVP Özellikleri (Bu 3'ü Olmadan Sunma)

```
1. ✅ World ID Login     → MiniKit verify + backend proof doğrulaması
2. ✅ Vouch (Kefalet)   → ENS adı ile kefil ol + sözleşmeye işle
3. ✅ USDC Disbursement → minikit.pay() ile kristal net ödeme
```

---

## 📂 Proje Klasör Yapısı (Önerilen)

```
trust-circle/
├── contracts/
│   ├── TrustCircle.sol          # Ana kredi sözleşmesi (World Chain)
│   ├── TrustCircleRead.sol      # LayerZero OAppRead (Arbitrum/Base)
│   └── interfaces/
│       └── IWorldId.sol         # World ID doğrulama arayüzü
├── frontend/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # MiniKit Provider burada
│   │   ├── page.tsx             # Ana sayfa (Dashboard)
│   │   └── api/
│   │       ├── verify-worldid/  # Proof doğrulama backend'i
│   │       └── initiate-pay/    # Ödeme başlatma
│   ├── components/
│   │   ├── WorldIdButton.tsx
│   │   ├── VouchForm.tsx
│   │   └── LoanRequest.tsx
│   └── lib/
│       ├── wagmi.ts             # Chain konfigürasyonu
│       └── contracts.ts         # ABI + adresler
├── scripts/
│   ├── deploy.ts                # Hardhat deploy script
│   └── configure-lz.ts          # LayerZero wireing script
├── layerzero.config.ts           # LZ endpoint konfigürasyonu
└── README.md
```

---

## 🎯 Jüri Sunumu için Anahtar Mesajlar

1. **"23 milyon hazır kullanıcı"** — World App içinde, cüzdan kurmadan, gas ödemeden mikro-kredi
2. **"Sybil-proof kefalet"** — Proof of Personhood sayesinde bot hesaplar sisteme giremez
3. **"Zincirler arası güven"** — LayerZero ile World Chain'deki güven skoru her zincirde geçerli
4. **"Gerçek kullanım senaryosu"** — DeFi'nin en büyük eksikliğini çözüyoruz, teori değil

---

*Son güncelleme: Mart 2026*
