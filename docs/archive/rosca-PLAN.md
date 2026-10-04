# Trust Circle — Arc Microgrants Çalışma Planı

> Spesifikasyon: [SPEC.md](SPEC.md) · Etkinlik: [Arc Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
> **Son teslim: 14 Ekim 2026 (Çar) 23:59 ET.** Hedef teslim: **12 Ekim (Pzt)**. 13–14 Ekim tampon, yeni iş açılmaz.

## Başvuruda istenenler (hepsi zorunlu)
- [ ] Arc **mainnet**'te canlı, çalışan deployment + çalışan link
- [ ] Public repo
- [ ] Kısa açıklama: ne yapıyor, Arc'ı nasıl kullanıyor
- [ ] Public builder profili (GitHub / X / Farcaster)
- [ ] Ödül için Arc'ta USDC alabilen cüzdan adresi

Jüri kriterleri: **Arc'la ilgisi · teknik güvenilirlik · uygulama kalitesi · gelecek potansiyeli** ("promise > traction").

## Roller
| | Dev 1 — Sözleşmeler | Dev 2 — Web |
|---|---|---|
| Sahiplik | `contracts/` (Circle, Factory, Reputation, testler, deploy) | `web/` (Next.js 16 + wagmi 3 + viem), hosting, demo videosu |
| Ortak | SPEC değişiklikleri, mainnet demo, başvuru metni | |

Senkron noktası: **`contracts/src/interfaces/`**. Arayüz değişikliği = SPEC + interface aynı PR'da, diğer dev'e haber.

## Kilometre taşları
| # | Tarih | Tamam sayılması için |
|---|---|---|
| M0 | 30 Eyl | Repo, araçlar, SPEC, arayüzler hazır ✅ · **Mainnet'e USDC köprüleme başlatıldı** |
| M1 | 5 Eki | Sözleşmeler özellik-tamam; birim + senaryo testleri yeşil |
| M2 | 7 Eki | Invariant testleri yeşil · testnet deploy + explorer'da doğrulandı · web testnet'te uçtan uca |
| M3 | 8 Eki | **Mainnet deploy + doğrulama** |
| M4 | 11 Eki | Mainnet'te 2 gerçek çember tamamlandı (mutlu yol + temerrüt), tx hash'leri README'de |
| M5 | 12 Eki | Başvuru gönderildi |

---

## Gün gün

### Gün 1 — 30 Eylül (Çar) · Kurulum ✅
- [x] Repo iskeleti, Arc Foundry `v0.8.0-2`, OZ 5.7, forge-std
- [x] SPEC v0.1, `ICircle` / `ICircleFactory` / `IReputation`
- [x] Next.js 16 + wagmi 3 iskeleti, Arc mainnet/testnet zincir ayarları
- [x] CI: contracts (arc-forge + fork testi) ve web
- [ ] **Herkes:** Arc mainnet'te USDC'li bir cüzdan. Deployer + 3–4 demo cüzdanı için toplam ~50 USDC köprüle (CCTP / Circle bridge). *Köprü gecikebilir; bugün başlat.*
- [ ] **Herkes:** testnet USDC al — https://faucet.circle.com
- [ ] SPEC'i ikiniz de okuyup §7–8 üzerinde anlaşın; itirazlar bugün.

### Gün 2 — 1 Ekim (Per)
**Dev 1**
- [ ] `Reputation.sol` (küçük, önce bitir → Circle yazarken hazır olsun)
- [ ] `CircleFactory.sol`: parametre doğrulama, `Clones.clone`, `registerCircle`, pause, listeleme view'ları
- [ ] `Circle.sol` iskeleti: storage düzeni, `initialize`, Open fonksiyonları (`join/leave/kick/vouch/unvouch/cancel`)
- [ ] Open aşaması birim testleri

**Dev 2**
- [ ] ABI'yi arayüzlerden üret (`arc-forge build` → `out/*.json` → `web/src/lib/abi/`) — küçük bir `npm run abi` script'i
- [ ] Sayfa iskeletleri ve yönlendirme: `/`, `/new`, `/c/[address]`, `/u/[address]`
- [ ] Tasarım: **mobil öncelikli** (kullanıcılar linke WhatsApp'tan gelecek)

### Gün 3 — 2 Ekim (Cum)
**Dev 1**
- [ ] `start()`: kapsama göre stable sıralama, kilitleme
- [ ] `contribute(j)`: önceden ödeme dahil
- [ ] `settleRound()` Adım 1: `cover()` kaynak zinciri (holdback → deposit → kefiller orantılı → açık)

**Dev 2**
- [ ] `/new` — çember oluşturma formu (C, N, P, minDeposit, joinDeadline, isim), doğrulamalar SPEC §3 ile aynı
- [ ] USDC `approve` + işlem akışı bileşeni (bekliyor / onaylandı / hata; Arc'ta 1 onay = final)

### Gün 4 — 3 Ekim (Cmt)
**Dev 1**
- [ ] `settleRound()` Adım 2–3: alıcı ödemesi, `required/covered/hold`, escrow
- [ ] Kapanış hesabı (§8), `withdraw()`
- [ ] Senaryo testleri (a)–(c)

**Dev 2**
- [ ] `/c/[address]` Open görünümü: üyeler, kapsamlar, "Katıl" ve "Kefil ol" akışları, paylaşım linki + WhatsApp butonu
- [ ] `previewHoldback` ile "şu an sıran gelse ne kadar alırsın" göstergesi (**güven = erken sıra** burada görünür olmalı)

### Gün 5 — 4 Ekim (Paz)
**Dev 1**
- [ ] Senaryo testleri (d)–(g), tüm revert yolları
- [ ] Reputation çağrılarının bağlanması
- [ ] Gas raporu (`arc-forge test --gas-report`), 20 üye × 5 kefil ile en kötü durum son `settleRound`

**Dev 2**
- [ ] `/c/[address]` Active görünümü: dönem zaman çizelgesi, kim ödedi, geri sayım, "Öde", "Dönemi kapat", "Çek"
- [ ] Mock veriyle tüm durumlar (Open/Active/Completed/Cancelled) ekran görüntüsü

### Gün 6 — 5 Ekim (Pzt) · **M1**
**Dev 1**
- [ ] Fuzz testleri (parametre sınırları, kefalet dağılımı)
- [ ] Invariant handler: rastgele join/vouch/contribute/atla/`warp`/settle → I1–I5
- [ ] Slither ya da `arc-forge lint` temiz

**Dev 2**
- [ ] `/u/[address]` profil: Reputation kaydı + katıldığı çemberler (`circlesOf`)
- [ ] Ana sayfa: açık çemberler listesi (`circles(offset, limit)`)

### Gün 7 — 6 Ekim (Sal)
**Dev 1**
- [ ] `Deploy.s.sol` tamamla; **testnet deploy + `--verify`**
- [ ] Adresleri `web/src/lib/contracts.ts`'e yaz
- [ ] Kendi kendine güvenlik gözden geçirmesi: reentrancy, yuvarlama tozu, `N=2` / `N=20` sınırları, blocklist'li alıcı

**Dev 2**
- [ ] Web'i testnet sözleşmelerine bağla, mock'ları kaldır
- [ ] Hosting (Vercel): `NEXT_PUBLIC_ARC_NETWORK=testnet` önizleme

### Gün 8 — 7 Ekim (Çar) · **M2**
**İkiniz birlikte:** testnet'te 3 cüzdanla tam döngü, `P = 2 dk`
- [ ] Mutlu yol: oluştur → katıl → kefil ol → başlat → 3 dönem → çek
- [ ] Temerrüt: 1. dönemin alıcısı sonraki dönemleri ödemez → kefilden çekilir → kapanış
- [ ] Bulunan hataları düzelt; sözleşmede değişiklik olursa testnet'e yeniden deploy

### Gün 9 — 8 Ekim (Per) · **M3 — Mainnet**
- [ ] Son kod dondurma (sözleşme). Commit hash'i not al.
- [ ] **Mainnet deploy** + explorer.arc.io'da kaynak doğrulama
- [ ] `MAX_CONTRIBUTION = 100 USDC` tavanı ve "denetlenmedi" uyarısı README'de ve UI'da
- [ ] Web `NEXT_PUBLIC_ARC_NETWORK=mainnet` → prod domain

### Gün 10–12 — 9–11 Ekim (Cum–Paz) · **M4 — Gerçek mainnet çemberleri**
- [ ] **Çember A (mutlu yol):** 3–4 kişi, `C = 1 USDC`, `P = 10 dk`, en az bir kefil
- [ ] **Çember B (temerrüt):** 3 kişi, 1. dönemin alıcısı 2. dönemde ödemez → kefil kesintisi görülür → kapanışta hesap
- [ ] Her kritik işlemin tx hash'i README'deki "Live on Arc mainnet" tablosuna
- [ ] Ekran kaydı: 2–3 dk demo videosu (oluştur → WhatsApp linki → katıl → kefil → dönemler → temerrüt → kapanış)
- [ ] UI cilası, boş/yükleniyor/hata durumları, mobil kontrol

### Gün 13 — 12 Ekim (Pzt) · **M5 — Başvuru**
- [ ] README (İngilizce): problem, mekanizma diyagramı, neden Arc, canlı linkler, sözleşme adresleri, tx tablosu, test/invariant özeti, bilinen sınırlamalar, yol haritası (SPEC §11)
- [ ] Kısa açıklama metni (≤ 150 kelime)
- [ ] Builder profilleri
- [ ] **Başvuruyu gönder**

### 13–14 Ekim · Tampon
Sadece kritik hata. Yeni özellik yok.

---

## Geride kalırsak kesilecekler (sırayla)
1. Profil sayfası (`/u`) → sadece çember sayfasında Reputation özeti
2. Ana sayfadaki çember listesi → yalnızca link ile erişim
3. `kick()` ve `unvouch()` (Open'da `leave` + `cancel` yeterli)
4. Erken settle (herkes ödediğinde) → sadece deadline sonrası

**Asla kesilmeyecekler:** kesinti/escrow mekanizması (§7), kapanış hesabı (§8), invariant testleri, mainnet'te gerçek iki çember. Başvurunun özgün ve güvenilir kısmı bunlar.

## Riskler
| Risk | Etki | Önlem |
|---|---|---|
| Mainnet'e USDC köprüsü gecikir | Deploy yapılamaz | **1. gün** başlat; yedek olarak Arc'ı destekleyen bir borsadan çekim |
| Kapanış hesabında muhasebe hatası | Fon kilitlenir | Invariant I1–I5, çok küçük tutarlar, 100 USDC tavanı |
| Arc'a özgü davranış (18/6 ondalık, blocklist, 20 gwei taban ücret) | Sessiz hata | Yalnız ERC-20 arayüzü; `--network arc` testleri; fork testi; ücret RPC'den |
| Sözleşme mainnet'te değiştirilemez | Hata = yeni deploy | Factory yeni deploy'la değişir; eski çemberler kendi başına çalışmaya devam eder |
| Zaman | Kapsam kayması | Yukarıdaki kesme listesi; 12 Ekim hedefi |

## Mainnet bütçesi (tahmini)
| Kalem | USDC |
|---|---|
| Deploy (3 sözleşme) + doğrulama | < 5 (gas) |
| Çember A: 4 kişi × (1 teminat + 4 katkı) + 1 kefalet ×2 | ~22, kapanışta geri döner |
| Çember B: 3 kişi × (1 + 3) + kefalet 2 | ~14, kefil kaybı hariç geri döner |
| Tampon | 10 |
| **Toplam kilitlenecek** | **~50**, net harcama yalnızca gas + kasıtlı temerrüt kaybı |
