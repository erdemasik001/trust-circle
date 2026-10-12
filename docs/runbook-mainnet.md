# G4 runbook: Arc mainnet deploy + seed vouch

**Teslim: 14 Ekim 23:59 ET = 15 Ekim 06:59 İstanbul.** Aktivasyon 48 saat. Seed vouch 13 Ekim 06:59'dan sonra zincire girerse borç döngüsü teslimden önce yapılamaz; o durumda deploy + kayıt + vouch ile başvurulur, döngü 48 saat dolunca tamamlanıp README'ye eklenir.

Tüm komutlar `contracts/` klasöründen çalışır:

```bash
cd ~/Desktop/projects/trust-circle/contracts
```

## 0. Ön koşullar

| Gerekli | Kimde | Miktar |
|---|---|---|
| Deploy gas'ı | deployer `0xdCa9…0cd8` | ≥ 0,3 USDC (simülasyon en kötü 0,17; testnet'te gerçek 0,10) |
| Stake + gas | kefil (arkadaş) | 2,1 USDC |
| Faiz + gas | borrower `0x9717…8490` | 0,3 USDC |
| **Toplam** | | **~3 USDC** (+ çekim ücreti); kalıcı harcama ~0,15 USDC |

- [ ] Kefil arkadaşın Arc mainnet cüzdan adresi elimde. Arkadaş yetişmezse kefil olarak ikinci cüzdanımız `voucher-test` (`0x715aaB67Fc6eA3E8a8994AEAa481cb8F7a40aF1d`) kullanılır; README'de seed hesapların ekibe ait olduğu yazılır.
- [ ] Deployer'dan **hiçbir işlem gönderilmedi** (sadece para alındı). Böylece kontrat adresi `0x36307eFf9D3E446754184De2E7d355511521A95E` olur.

Bakiyeleri kontrol et:

```bash
for a in 0xdCa9e29B2D1FCC6a29bA71797557BC6DDBa50cd8 0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490; do cast call 0x3600000000000000000000000000000000000000 "balanceOf(address)(uint256)" $a --rpc-url https://rpc.mainnet.arc.io; done
```

## 1. Son adres kontrolü

```bash
cast chain-id --rpc-url https://rpc.mainnet.arc.io
```
`5042` olmalı.

## 2. Deploy + verify

```bash
ACTIVATION_DELAY=172800 forge script script/Deploy.s.sol --rpc-url arc_mainnet --account deployer --broadcast
```

`--verify` ekleme: explorer.arc.io API'si komut satırı isteklerini Cloudflare ile engelliyor (12 Ekim'de 403), deploy geçse bile doğrulama adımı hata verir. Doğrulama Sourcify üzerinden yapılır (Arc mainnet destekli; aynı komut testnet kontratında denendi):

```bash
forge verify-contract <adres> src/TrustCircle.sol:TrustCircle --chain 5042 --verifier sourcify
```

Kabul:
- [ ] `TrustCircle 0x…` adresi not edildi, `deployments/arc-mainnet.json` oluştu.
- [ ] Tarayıcıda `https://explorer.arc.io/address/<adres>` sayfasında kaynak kod görünüyor. Görünmüyorsa aynı sayfada Verify & publish → "Solidity (Standard JSON input)", derleyici `v0.8.30`; yüklenecek dosyayı şu komut üretir:

```bash
forge verify-contract <adres> src/TrustCircle.sol:TrustCircle --chain 5042 --show-standard-json-input > trustcircle-input.json
```

- [ ] Ayarlar doğru:

```bash
TC=<adres>; for f in "owner()(address)" "attester()(address)" "activationDelay()(uint256)" "betaConfig()(uint128,uint128,uint8)"; do cast call $TC "$f" --rpc-url https://rpc.mainnet.arc.io; done
```
Beklenen: deployer, attester `0x712C…E358`, `172800`, `100000000 2000000000 1`.

## 3. Kayıtlar (önce borrower, sonra kefil)

Seed hesapları attester imzalı davetle kaydedilir (World ID'nin production ayarları yayındaki uygulamada hazır olana kadar yedek yol). **README'de belirtilecek:** seed hesapları World ID yerine attester daveti ile kaydedildi.

```bash
script/sign-attestation.sh 0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490 mainnet
```
Çıkan `cast send` komutundaki `<wallet>` yerine `borrower` yazıp çalıştır.

Kefil için:
```bash
script/sign-attestation.sh <KEFIL_ADRESI> mainnet
```
Kefil bu işlemi **kendi cüzdanından** göndermeli. Foundry'si yoksa explorer'daki kontrat sayfasının "Write contract" sekmesinden `register(nullifierHash, deadline, signature)` fonksiyonunu çağırabilir: üç değeri script çıktısından kopyalar.

## 4. Seed vouch

Kefil kendi cüzdanından iki işlem gönderir:
1. USDC (`0x3600…0000`) kontratında `approve(<TC>, 2000000)`
2. TrustCircle'da `vouchForUser(0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490, 2000000)`

Kabul:
```bash
cast call $TC "getVouch(address,address)((uint128,uint128,uint64))" <KEFIL_ADRESI> 0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490 --rpc-url https://rpc.mainnet.arc.io
```
Üçüncü değer (`activatesAt`) borcun alınabileceği andır:
```bash
date -r <activatesAt>
```

## 5. Vouch'tan 48 saat sonra: döngü

Web arayüzünden de yapılabilir (borrower panelinde Borrow ve Repay, kefil panelinde Claim); komut satırı karşılığı:

```bash
cast send $TC "borrow(uint256)" 1000000 --account borrower --rpc-url https://rpc.mainnet.arc.io
cast send 0x3600000000000000000000000000000000000000 "approve(address,uint256)" $TC 1150000 --account borrower --rpc-url https://rpc.mainnet.arc.io
cast send $TC "repay()" --account borrower --rpc-url https://rpc.mainnet.arc.io
```
Kefil: `claim()`, sonra isterse `revokeVouch(borrower)` ile 2 USDC'yi geri alır.

Kabul: borrower itibarı 110, kefilin claim ettiği 0,12 USDC; tüm tx hash'leri README'ye.

## Bir şey ters giderse

| Durum | Yapılacak |
|---|---|
| Deploy'da beklenmeyen hata | Para harcanmadan durur; çıktıyı paylaş. |
| Kontratta bug | `cast send $TC "pause()" --account deployer …` — repay/claim/withdraw açık kalır; düzelt + yeniden deploy. |
| İşlem pending'de kalıyor | Komuta `--with-gas-price 25gwei` ekle. |
| Kefil arkadaş yetişemiyor | `voucher-test` cüzdanıyla devam et (adım 0). |
