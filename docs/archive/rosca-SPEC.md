# Trust Circle — Teknik Spesifikasyon (v0.1)

> Arc Microgrants başvurusu için. Son teslim: **14 Ekim 2026, 23:59 ET** — hedef teslim **12 Ekim**.
> Bu doküman sözleşmelerin davranışını tanımlar; `contracts/src/interfaces/` altındaki arayüzler bu dokümanın koddaki karşılığıdır. İkisi çelişirse **bu doküman** kazanır ve arayüz düzeltilir.

---

## 1. Ürün

**Trust Circle, Arc üzerinde USDC ile çalışan bir altın günü (ROSCA) protokolüdür.**

- N kişilik bir grup her dönem havuza `C` USDC koyar; her dönem havuzu (`N × C`) sırayla bir üye alır.
- Havuzu erken alan kişi geri kalan dönemler için gruba borçlu kalır. Bu borç **her zaman karşılanmış** olmalıdır: üyenin kendi teminatı, **kefillerinin kilitlediği USDC** ya da **havuzdan kesinti** ile.
- Kefil (voucher) ne kadar çoksa üye o kadar erken ve o kadar kesintisiz havuz alır: **güven = erken sıra**.
- Grubu aksatmadan bitiren üyenin zincir üstü güven geçmişi (`Reputation`) oluşur.

### Neden Arc?
| Arc özelliği | Trust Circle'a etkisi |
|---|---|
| USDC native gas | Kullanıcının sadece USDC'si olması yeterli; ETH/ikinci token yok. Hedef kitle (kripto bilmeyen altın günü grupları) için kritik. |
| Düşük ve öngörülebilir ücret | 1–100 USDC'lik katkılarda ücret katkıyı yemiyor. |
| Deterministik, < 1 sn finality | Havuz ödemesi anında kesin; "para geldi mi" belirsizliği yok. |
| EURC / StableFX (gelecek) | Gurbetçi grupları için EUR bazlı çemberler (bkz. §11). |

### Kapsam dışı (MVP'de yok)
Sıra için açık artırma, kefil ücreti, çember dışı kredi limiti, EURC, gizlilik, sybil direnci, yükseltilebilir sözleşme, admin'in fonlara erişimi.

---

## 2. Terimler

| Terim | Anlamı |
|---|---|
| `C` | Dönem başı katkı (USDC, 6 ondalık birim) |
| `N` | Üye sayısı = dönem sayısı |
| `P` | Dönem süresi (saniye) |
| Dönem `j` | `0 … N-1`. Dönem `j`'nin alıcısı `order[j]` |
| Slot | Üyenin havuzu aldığı dönem indeksi `s` |
| Teminat (deposit) | Üyenin katılırken kendi kilitlediği USDC |
| Kefalet (stake) | Bir kefilin belirli bir üye için kilitlediği USDC |
| Kesinti (holdback) | Havuzdan üye adına tutulan, gelecek katkılarını otomatik ödemek için kullanılan tutar |
| Kapsam (coverage) | `deposit + Σ stake` |
| Açık (shortfall) | Hiçbir kaynaktan karşılanamayan eksik katkı |
| Temerrüt (default) | Üyenin katkısının kesinti dışında bir kaynaktan (teminat, kefil) karşılanması ya da karşılanamaması |

---

## 3. Parametreler ve sınırlar

`createCircle(CircleParams)`:

| Alan | Tip | Kural |
|---|---|---|
| `contribution` (`C`) | `uint256` | `1e6 ≤ C ≤ MAX_CONTRIBUTION` (**100e6 = 100 USDC**). Denetimsiz kod için tavan. |
| `memberCount` (`N`) | `uint8` | `2 ≤ N ≤ 20` |
| `roundDuration` (`P`) | `uint32` | `60 ≤ P ≤ 90 gün`. 60 sn alt sınır mainnet demosu için. |
| `minDeposit` | `uint256` | `C ≤ minDeposit ≤ N × C`. UI varsayılanı `C`. |
| `joinDeadline` | `uint64` | `now < joinDeadline ≤ now + 30 gün` |
| `name` | `string` | 1–64 byte, sadece event'te yayımlanır |

Sabitler: `MAX_VOUCHERS_PER_MEMBER = 5`, `MAX_MEMBERS = 20`.

Token: **yalnızca** Arc USDC ERC-20 arayüzü `0x3600000000000000000000000000000000000000` (6 ondalık). Factory constructor'da alınır; testte mock kullanılır.

---

## 4. Sözleşmeler

```
CircleFactory ──(EIP-1167 clone)──▶ Circle (her grup için bir tane)
      │                                  │
      └── registerCircle ──▶ Reputation ◀┘ (sadece kayıtlı Circle'lar yazar)
```

| Sözleşme | Sorumluluk | Sahiplik |
|---|---|---|
| `CircleFactory` | Parametre doğrulama, Circle klonlama, Reputation'a kayıt | `owner` sadece `setCreationPaused(bool)` yapabilir. Fonlara erişimi yok. |
| `Circle` | Bir grubun tüm yaşam döngüsü ve muhasebesi | Sahipsiz. `creator` sadece Open aşamasında `kick`/`cancel`/`start` yapabilir. |
| `Reputation` | Adres başına güven geçmişi | Sahipsiz. Yazma yetkisi factory'nin kaydettiği Circle'larda. |

Hiçbiri yükseltilebilir değildir. Tüm fonlar ilgili `Circle` içinde durur.

---

## 5. Durum makinesi

```
           join/leave/vouch/unvouch/kick
          ┌───────────┐
          ▼           │
  ──▶  [Open] ────────┘
          │   start()  (grup dolu; creator istediğinde ya da joinDeadline sonrası herkes)
          │
          ├──────────────▶ [Cancelled]  cancel(): creator Open'da her an;
          │                              herkes joinDeadline sonrası ve grup başlamamışsa
          ▼
      [Active]  contribute(j) · settleRound()
          │   settleRound() son dönemi kapatınca
          ▼
     [Completed]  withdraw()
```

`withdraw()` her durumda çağrılabilir; sadece `withdrawable[msg.sender]` tutarını öder.

---

## 6. Fonksiyonlar

### 6.1 Open

**`join()`** — `msg.sender` üye olur, `minDeposit` kadar USDC teminat yatırır (`transferFrom`).
- Revert: durum Open değil · `now > joinDeadline` · grup dolu · zaten üye.
- Aynı adres hem üye hem başka üyenin kefili olabilir.

**`leave()`** — üye çıkar. Teminatı `withdrawable`'a eklenir; bu üyeye verilmiş tüm kefaletler kefillerin `withdrawable`'ına döner.

**`kick(member)`** — sadece `creator`. `leave` ile aynı iade mantığı.

**`vouch(member, amount)`** — `msg.sender`, `member` için `amount` USDC kilitler.
- `amount ≥ 1e6`. `msg.sender ≠ member`. `member` üye olmalı.
- Aynı kefil aynı üyeye tekrar `vouch` ederse tutar artar (yeni kefil sayılmaz).
- Üye başına en fazla 5 farklı kefil.

**`unvouch(member)`** — kefil, o üyeye verdiği kefaletin tamamını geri çeker (`withdrawable`'a).

**`start()`** — grup dolu (`members.length == N`) olmalı. `creator` her an çağırabilir; `now > joinDeadline` ise herkes çağırabilir.
- **Sıralama:** üyeler kapsamlarına (`deposit + Σ stake`) göre **azalan** sıralanır; eşitlikte katılma sırası korunur (stable insertion sort, `N ≤ 20`).
- `startTime = block.timestamp`. `deadline(j) = startTime + (j + 1) × P`.
- Bu andan itibaren teminat ve kefaletler **kilitlidir**.

**`cancel()`** — `creator` Open'da her an; herkes `now > joinDeadline` ise. Tüm teminat ve kefaletler `withdrawable`'a döner.

### 6.2 Active

**`contribute(j)`** — üye, dönem `j` için `C` USDC öder (`transferFrom`).
- `currentRound ≤ j < N` (ileri dönemleri **önceden ödemek** serbest) · `now ≤ deadline(j)` · bu dönem için daha önce ödememiş.
- Kesintisi (holdback) olan üye de elle ödeyebilir; bu durumda kesinti dokunulmadan kalır ve sonda iade edilir.

**`settleRound()`** — dönem `j = currentRound`'u kapatır. **Herkes** çağırabilir (bot gerekmez).
- Koşul: `now > deadline(j)` **veya** tüm üyeler `j` için ödemiş.
- Algoritma §7'de.
- Son dönemi kapatan çağrı durumu `Completed` yapar ve §8'deki kapanış hesabını aynı işlemde yürütür (`N ≤ 20`, kefil ≤ 5 ⇒ en fazla ~100 iterasyon).

### 6.3 Her durumda

**`withdraw()`** — `withdrawable[msg.sender]` tutarının tamamını gönderir, sıfırlar. Pull-payment: bir alıcının Arc blocklist'inde olması diğer kimseyi etkilemez.

### 6.4 View'lar
`status()`, `params()`, `members()`, `order()`, `currentRound()`, `deadline(j)`, `hasPaid(j, m)`, `memberInfo(m)` (deposit, holdback, kapsam, slot, temerrüt durumu, borç/alacak), `vouchersOf(m)`, `requiredCoverage(slot)`, `previewHoldback(m)`, `withdrawable(a)`.

---

## 7. `settleRound()` algoritması

Dönem `j`, alıcı `r = order[j]`, `pot = 0`.

**Adım 1 — Katkıları topla.** Her üye `m` için:
- `hasPaid(j, m)` ise `pot += C`, `Reputation.onTime(m)`.
- Değilse `cover(m, C)` çağrılır. Kaynaklar **bu sırayla** tüketilir:
  1. `holdback[m]` — temerrüt **sayılmaz** (planlı otomatik ödeme).
  2. `deposit[m]` — temerrüt.
  3. `m`'nin kefilleri, kalan kefaletleriyle **orantılı** (tam bölünmeyen kalan, listede kalan kefaleti olan ilk kefilden). Her çekim `voucherDrawn[m][v]`'ye yazılır. Temerrüt.
  4. Kalan tutar **açık**tır: `m ≠ r` ise `debt[m] += x`, `credit[r] += x`. `m == r` ise sadece `r`'nin havuzu küçülür, borç yazılmaz.
- Karşılanan kısım `pot`'a eklenir. Adım 2–4 kullanıldıysa `defaulted[m] = true`, `Reputation.missed(m)`.

**Adım 2 — Alıcıya öde.**
- `defaulted[r]` ise: **havuzun tamamı** `holdback[r]`'ye yazılır (escrow). Alıcı hiçbir şey çekemez; bu tutar kalan katkılarını otomatik öder, fazlası kapanışta iade edilir.
- Değilse:
  - `required = (N − 1 − j) × C` (alıcının gelecekte ödemesi gereken katkılar)
  - `covered = deposit[r] + Σ kalan stake[r]`
  - `hold = min(pot, max(0, required − covered))`
  - `holdback[r] += hold`, `withdrawable[r] += pot − hold`
- `RoundSettled(j, r, pot, pot − hold, hold)` event'i.

**Adım 3.** `currentRound++`. `currentRound == N` ise §8.

### Neden havuz hiç açık vermez
- Temerrüde **düşmemiş** bir alıcıda, ödeme anında `holdback + deposit + stake ≥ required`. Teminat ve kefaletler Active'de çekilemediği ve temerrüt olmadan tüketilmediği için bu üyenin **kalan tüm dönemleri** karşılanmıştır ⇒ ödeme sonrası asla **açık** doğmaz. Tek olası kayıp kefilin kefaletidir; kefil bu riski bilerek almıştır.
- Temerrüde düşmüş üyenin havuzu tamamen escrow'a alınır. Bir üyenin toplam yükümlülüğü (`N × C`) toplam hakkına (`N × C`) eşit olduğundan escrow; kendi açıklarını, kefillerden çekilenleri ve sonraki katkılarını karşılar (bkz. §8 kanıt taslağı, §10 invariant I4).

---

## 8. Kapanış hesabı (Completed)

Her üye `m` için:

```
available = holdback[m] + deposit[m] + credit[m]
1. borç:      pay = min(available, debt[m]);                available -= pay
2. kefiller:  reimb = min(available, Σ voucherDrawn[m][·]); available -= reimb
              reimb, kefillere voucherDrawn oranında dağıtılır → withdrawable[v]
3. kalan:     withdrawable[m] += available
```
Her kefil `v` için: `withdrawable[v] += kalan stake[m][v]` (tüm üyeler için).

Borç/alacak **salt muhasebedir**: tüm USDC aynı sözleşmededir; `credit[r]` alacaklı üyenin `available`'ına eklenir, `debt[m]` borçlunun `available`'ından düşülür. Σ debt = Σ credit olduğundan toplam korunur.

**Kanıt taslağı (borç her zaman ödenir).** `m`'nin tüm dönemlerdeki yükümlülüğü `N × C = selfPaid + depositDrawn + voucherDrawn + debt + holdbackDrawn + ownShort`. `m`'ye havuzundan yazılan (`captured` veya `payout + hold`) artı `credit[m]`, `N × C − ownShort`'a eşittir. Temerrüde düşmüş üyede tamamı escrow'dadır, yani `available = N×C − ownShort − holdbackDrawn + depositLeft = selfPaid + depositDrawn + voucherDrawn + debt + depositLeft ≥ debt + voucherDrawn`. ⇒ Borç ve kefil iadesi tamdır. Temerrüde **ödeme sonrası** düşen üyede borç doğmaz (§7), eksik kalan yalnızca kefil iadesidir: **tasarlanmış kefil kaybı**. Bu taslak invariant testleriyle (§10) doğrulanacaktır.

Bu hesaptan sonra `Reputation.completed(m, clean = !defaulted[m])`, kefil kayıpları `Reputation.voucherLoss(v, amount)`.

---

## 9. Reputation

```solidity
struct Record {
    uint32 circlesJoined;
    uint32 circlesCompleted;      // temerrütsüz tamamlanan
    uint32 circlesDefaulted;
    uint32 roundsOnTime;
    uint32 roundsMissed;
    uint32 vouchesGiven;
    uint128 vouchedVolume;        // USDC, 6 ondalık
    uint128 voucherLosses;        // USDC, 6 ondalık
}
```
- Sadece `factory.registerCircle` ile kaydedilen Circle'lar yazar.
- **Bilinen sınırlama:** kendi kendine çember kurup puan kasmak (sybil) mümkündür. MVP'de UI bu veriyi "karşı taraf sayısı ve hacim" ile birlikte gösterir; sybil direnci §11'de.

---

## 10. Test planı

| Katman | İçerik |
|---|---|
| Birim | Her fonksiyonun mutlu yolu ve her revert koşulu |
| Senaryo | (a) herkes zamanında öder; (b) ödeme öncesi temerrüt, teminat yeter; (c) ödeme öncesi temerrüt, açık doğar, kapanışta kapanır; (d) 1. dönemde havuzu alıp kaçan üye, kefiller karşılar; (e) kefilsiz erken alıcı, kesintiyle alır; (f) Open'da leave/kick/cancel iadeleri; (g) blocklist benzeri revert eden alıcı diğerlerini kilitlemez |
| Fuzz | Parametre sınırları; `N`, `C`, kefalet dağılımı rastgele |
| Invariant (handler) | Rastgele join/vouch/contribute/atla/zaman atla/settle dizileri |
| Arc | `arc-forge test --network arc` ve testnet fork'unda gerçek `0x3600…` USDC ile duman testi |

**Invariantlar**
- **I1 Ödeme gücü:** `USDC.balanceOf(circle) ≥ Σ deposit + Σ stake + Σ holdback + Σ withdrawable` (ödenmemiş taraf).
- **I2 Korunum:** toplam giriş − toplam çıkış = iç yükümlülükler toplamı. Muhasebe **asla** `balanceOf`'a dayanmaz (Arc'ta dışarıdan native USDC gönderilebilir).
- **I3 Dürüst üye kaybetmez:** tüm dönemleri kendisi ödeyen üye kapanışta `≥ ödediği + teminatı` alır.
- **I4 Borç kapanır:** Completed'da her `m` için borç tamamen ödenmiştir.
- **I5 Kefil kaybı yalnız ödeme sonrası temerrütte:** kefilin geri alamadığı tutar > 0 ise vouchee havuzu temerrüde düşmeden almıştır.

---

## 11. Gelecek (başvurudaki "potansiyel" bölümü)
1. **Açık artırmalı sıra** (chit fund modeli): erken sıra için indirim teklifi; indirimi diğer üyeler paylaşır.
2. **EURC çemberleri + StableFX:** Avrupa'daki gurbetçiler EURC ile katkı yapar, alıcı USDC/EURC seçer.
3. **Güven geçmişinden kredi limiti:** temiz geçmişi olan üyeye çember dışı mikro kredi.
4. **Kefil ücreti:** alıcının havuzundan kefillere küçük pay.
5. **Sybil direnci:** karşı taraf çeşitliliği ağırlıklı skor; opsiyonel kimlik kanıtı.
6. **Gasless UX:** Circle Wallets / paymaster ile e-posta tabanlı cüzdan.

---

## 12. Arc'a özgü notlar (docs.arc.io)
- USDC tek varlık, iki arayüz: native **18**, ERC-20 **6** ondalık. Sözleşme **yalnızca ERC-20** arayüzünü kullanır; `payable` fonksiyon yok, `msg.value` yok.
- Blocklist'teki adrese transfer revert eder ⇒ pull-payment (`withdraw`), toplu transfer yok.
- `PREVRANDAO` her zaman 0 ⇒ sıralamada rastgelelik **kullanılmaz** (kapsama göre deterministik).
- Blok zaman damgası artmayabilir (non-decreasing) ⇒ `deadline` karşılaştırmaları `>`/`≤` ile tutarlı; aynı saniyede birden fazla blok sorun değildir.
- Minimum base fee 20 gwei; altındaki işlemler **sessizce düşer** ⇒ deploy script'i ve frontend ücret tahminini RPC'den alır.
- Mainnet: chain `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`. Testnet: `5042002`, `https://rpc.testnet.arc.io`, `https://explorer.testnet.arc.io`.
