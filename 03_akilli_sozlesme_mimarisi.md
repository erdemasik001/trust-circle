# 🧠 Trust Circle — Akıllı Sözleşme Mimarisi & DeFi Mantığı

> Sözleşme tasarımı, güven ağı mekanizmaları ve DeFi'deki benzer protokoller

---

## 1. Mevcut DeFi Protokollerine Genel Bakış

### Over-Collateralization Problemi (Neden Trust Circle Var?)

```
MEVCUT DeFi (Aave, Compound, MakerDAO):
    100 USDC ödünç almak için → 150 USDC değerinde ETH kilitle
    Avantaj: Risk yok (teminat var)
    Dezavantaj: Sermayeyi kilitleyen zenginler için çalışır

TRUST CIRCLE:
    100 USDC ödünç almak için → 3 arkadaş kefil olsun
    Sybil koruması: World ID (her kefil gerçek insan)
    Gas: Sıfır (World Chain paymaster)
```

### Benzer Protokoller ve Farkları

| Protokol | Mekanizma | Trust Circle Farkı |
|----------|-----------|-------------------|
| **Union Finance** | Stake-based vouching (ETH stake) | World ID = bot yok, stake gerekmez |
| **GoldFinch** | KYC + UID token | Merkezi KYC yerine ZK proof |
| **TrustLine** | Social graph | ENS + LayerZero cross-chain |
| **Aave V3** | Over-collateralized | Teminatsız — asıl yenilik bu |

---

## 2. TrustCircle.sol — Tam Sözleşme Tasarımı

### Veri Yapıları

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrustCircle {
    
    // ─── STATE VARIABLES ─────────────────────────────────────────

    // World ID doğrulanmış kullanıcılar
    mapping(address => bool) public isVerified;
    // nullifier → kullanıldı mı? (replay attack engeli)
    mapping(uint256 => bool) public usedNullifiers;
    
    // Güven Limiti: kefil → borçlu → limit (USDC cinsinden, 6 decimal)
    mapping(address => mapping(address => uint256)) public trustLimit;
    
    // Kefillerin listesi: borçlu → kefillerçarrayı
    mapping(address => address[]) public vouchers;
    
    // Aktif kredi bilgisi
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;
    
    // Güncel açık kredi borcu: borçlu → toplam borç
    mapping(address => uint256) public outstandingDebt;

    // ─── STRUCTS ─────────────────────────────────────────────────

    struct Loan {
        address borrower;
        uint256 amount;        // USDC (6 decimal)
        uint256 createdAt;
        uint256 dueDate;       // opsiyonel: vade tarihi
        LoanStatus status;
    }

    enum LoanStatus { Active, Repaid, Defaulted }

    // ─── EVENTS ──────────────────────────────────────────────────

    event UserVerified(address indexed user, uint256 nullifierHash);
    event VouchGiven(address indexed voucher, address indexed borrower, uint256 limit);
    event VouchRevoked(address indexed voucher, address indexed borrower);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);

    // ─── CONSTANTS ───────────────────────────────────────────────

    uint256 public constant MIN_VOUCHERS_REQUIRED = 3;
    uint256 public constant MAX_LOAN_MULTIPLIER = 100; // % cinsinden
    IERC20 public immutable usdc;
    IWorldId public immutable worldId;
    uint256 public immutable groupId = 1; // Orb verified
    
    constructor(address _usdc, address _worldId) {
        usdc = IERC20(_usdc);
        worldId = IWorldId(_worldId);
    }
```

### Temel Fonksiyonlar

```solidity
    // ─── WORLD ID DOĞRULAMA ───────────────────────────────────────

    /**
     * @notice World ID ZK ispatı ile kimlik doğrulama
     * @dev nullifier_hash bir kez kullanılabilir (replay koruması)
     */
    function verifyAndRegister(
        address signal,           // kullanıcının cüzdan adresi
        uint256 root,             // World ID merkle root
        uint256 nullifierHash,    // benzersiz kullanıcı tanımlayıcı
        uint256[8] calldata proof // ZK ispatı
    ) external {
        require(!usedNullifiers[nullifierHash], "Bu kimlik zaten kullanildi");
        
        // World ID ZK proof doğrulama
        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            abi.encodePacked(address(this), "trust-circle-login").hashToField(),
            proof
        );
        
        usedNullifiers[nullifierHash] = true;
        isVerified[msg.sender] = true;
        
        emit UserVerified(msg.sender, nullifierHash);
    }

    // ─── KEFİL OLMA (VOUCHING) ────────────────────────────────────

    /**
     * @notice Bir kullanıcıya güven limiti tanımla
     * @param borrower Kefil verilen kullanıcı adresi
     * @param limit    Max USDC miktarı (6 decimal, örn: 50_000000 = 50 USDC)
     */
    function vouch(address borrower, uint256 limit) external {
        require(isVerified[msg.sender], "Sadece dogrulanmis kullanicilar kefil olabilir");
        require(isVerified[borrower], "Sadece dogrulanmis kullanicilara kefil olunabilir");
        require(msg.sender != borrower, "Kendine kefil olamazsin");
        require(limit > 0, "Limit sifirdan buyuk olmali");
        
        // İlk kez kefil olunuyorsa listeye ekle
        if (trustLimit[msg.sender][borrower] == 0) {
            vouchers[borrower].push(msg.sender);
        }
        
        trustLimit[msg.sender][borrower] = limit;
        emit VouchGiven(msg.sender, borrower, limit);
    }

    /**
     * @notice Verilen kefaleti geri çek
     */
    function revokeVouch(address borrower) external {
        require(trustLimit[msg.sender][borrower] > 0, "Kefalet yok");
        
        // Aktif borç varsa geri çekme
        require(outstandingDebt[borrower] == 0, "Aktif borcu olan kullanicidan kefalet cekilemez");
        
        trustLimit[msg.sender][borrower] = 0;
        
        // Vouchers listesinden çıkar
        _removeVoucher(borrower, msg.sender);
        
        emit VouchRevoked(msg.sender, borrower);
    }

    // ─── KREDİ TALEP ─────────────────────────────────────────────

    /**
     * @notice Kefil eşiği sağlanıyorsa teminatsız USDC kredisi al
     * @param amount İstenen kredi miktarı (6 decimal USDC)
     */
    function requestLoan(uint256 amount) external returns (uint256 loanId) {
        require(isVerified[msg.sender], "Dogrulanmamis kullanici");
        require(outstandingDebt[msg.sender] == 0, "Actik borcunuzu once odeyin");
        
        // Minimum kefil sayısı ve toplam limit kontrolü
        (bool eligible, uint256 totalLimit) = _checkEligibility(msg.sender);
        require(eligible, "Yeterli kefil sayisi yok (min 3 gerekli)");
        require(amount <= totalLimit, "Talep edilen miktar toplam kefalet limitini asiyor");
        require(usdc.balanceOf(address(this)) >= amount, "Havuzda yeterli USDC yok");
        
        // Kredi oluştur
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            amount: amount,
            createdAt: block.timestamp,
            dueDate: block.timestamp + 30 days,
            status: LoanStatus.Active
        });
        
        outstandingDebt[msg.sender] = amount;
        
        // USDC transfer
        usdc.transfer(msg.sender, amount);
        
        emit LoanRequested(loanId, msg.sender, amount);
    }

    // ─── GERİ ÖDEME ───────────────────────────────────────────────

    /**
     * @notice Aktif krediyi geri öde
     * @dev Kullanıcının önce approve() yapması gerekir
     */
    function repay(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Bu kredi size ait degil");
        require(loan.status == LoanStatus.Active, "Kredi aktif degil");
        
        usdc.transferFrom(msg.sender, address(this), loan.amount);
        loan.status = LoanStatus.Repaid;
        outstandingDebt[msg.sender] = 0;
        
        emit LoanRepaid(loanId, msg.sender);
    }

    // ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────

    /**
     * @notice Kullanıcının kredi almaya uygun olup olmadığını kontrol et
     */
    function _checkEligibility(address borrower) 
        internal view 
        returns (bool eligible, uint256 totalLimit) 
    {
        address[] memory userVouchers = vouchers[borrower];
        uint256 activeVoucherCount = 0;
        
        for (uint i = 0; i < userVouchers.length; i++) {
            uint256 limit = trustLimit[userVouchers[i]][borrower];
            if (limit > 0) {
                activeVoucherCount++;
                totalLimit += limit;
            }
        }
        
        eligible = activeVoucherCount >= MIN_VOUCHERS_REQUIRED;
    }
    
    /**
     * @notice Kullanıcının güven skorunu döndür
     * @dev LayerZero tarafından cross-chain okunacak
     */
    function getTrustScore(address user) external view returns (uint256) {
        (, uint256 totalLimit) = _checkEligibility(user);
        return totalLimit;
    }
    
    function getVoucherCount(address user) external view returns (uint256) {
        return vouchers[user].length;
    }
```

---

## 3. Güvenlik Kontrol Listesi

### ReentrancyGuard
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TrustCircle is ReentrancyGuard, Ownable {
    // requestLoan ve repay fonksiyonlarına nonReentrant ekle
    function requestLoan(uint256 amount) external nonReentrant returns (uint256) { ... }
    function repay(uint256 loanId) external nonReentrant { ... }
}
```

### Kritik Güvenlik Kontrolleri

| Risk | Mitigation |
|------|-----------|
| **Reentrancy** | `nonReentrant` modifier + Checks-Effects-Interactions pattern |
| **Replay Attack** | `nullifierHash` mapping ile tekrar kullanımı engelle |
| **Sybil Attack** | World ID Proof of Personhood — her insan bir kez doğrulanabilir |
| **Integer Overflow** | Solidity 0.8+ checked arithmetic (otomatik) |
| **Access Control** | `isVerified` mapping — doğrulanmamış kullanıcı işlem yapamaz |
| **Emergency Stop** | `Ownable` + `pause()` mekanizması |
| **Drain Attack** | `outstandingDebt > 0` iken kefalet çekimi engele |

---

## 4. LayerZero Cross-Chain Güven Senkronizasyonu

### TrustCircleRead.sol (Arbitrum'da Deploy Edilecek)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OAppRead } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppRead.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract TrustCircleRead is OAppRead {
    // World Chain'deki TrustCircle sözleşme adresi
    address public worldChainTrustCircle;
    uint32 public worldChainEid; // World Chain endpoint ID
    
    // Arbitrum'da cache'lenen güven skorları
    mapping(address => uint256) public cachedTrustScore;
    mapping(address => uint256) public lastSyncTimestamp;
    
    // Senkronizasyon süresi (örn: 1 saat)
    uint256 public constant SYNC_TTL = 1 hours;
    
    constructor(
        address _endpoint,
        address _delegate,
        address _worldChainTrustCircle,
        uint32 _worldChainEid
    ) OAppRead(_endpoint, _delegate) {
        worldChainTrustCircle = _worldChainTrustCircle;
        worldChainEid = _worldChainEid;
    }
    
    /**
     * @notice World Chain'deki güven skorunu oku
     */
    function readTrustScore(address user) external payable {
        // Cache TTL kontrol
        if (block.timestamp - lastSyncTimestamp[user] < SYNC_TTL) {
            return; // Cache hâlâ geçerli
        }
        
        // lzRead isteği oluştur
        bytes memory callData = abi.encodeWithSignature(
            "getTrustScore(address)", user
        );
        
        // Mesaj gönder (fee estimation önceden yapılmalı)
        _lzSend(
            worldChainEid,
            callData,
            _getOptions(),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }
    
    /**
     * @notice World Chain'den gelen yanıtı işle
     */
    function _lzReceive(
        Origin calldata /* _origin */,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        (address user, uint256 score) = abi.decode(_message, (address, uint256));
        cachedTrustScore[user] = score;
        lastSyncTimestamp[user] = block.timestamp;
    }
    
    /**
     * @notice Arbitrum'da kredi verilebilir mi?
     */
    function canBorrow(address user, uint256 amount) external view returns (bool) {
        return cachedTrustScore[user] >= amount;
    }
    
    /**
     * @dev Fee hesaplama yardımcısı
     */
    function quoteFee(address user) external view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature(
            "getTrustScore(address)", user
        );
        MessagingFee memory fee = _quote(worldChainEid, callData, _getOptions(), false);
        return fee.nativeFee;
    }
}
```

---

## 5. Olası Ödeme Senaryoları (Demo için)

### Senaryo 1: Tam MVP (En Önemli)
```
Alice (World ID ✓) → vouch(Bob, 50 USDC)
Carol (World ID ✓) → vouch(Bob, 30 USDC)  
Dave  (World ID ✓) → vouch(Bob, 20 USDC)

Bob   → requestLoan(80 USDC)
      → 3 kefil var ✓, toplam limit 100 USDC ✓
      → 80 USDC anında transfer ✓
      
Bob   → repay(loanId)
      → 80 USDC geri ödenir ✓
```

### Senaryo 2: Yetersiz Kefil (Hata Handling)
```
Alice → vouch(Eve, 100 USDC)

Eve   → requestLoan(50 USDC)
      → Sadece 1 kefil var ✗
      → "Yeterli kefil sayısı yok" hatası ✓
```

### Senaryo 3: Cross-Chain (LayerZero Demo)
```
1. World Chain'de: Bob 100 USDC güven skoru kazandı
2. Arbitrum'da: TrustCircleRead.readTrustScore(Bob)
3. LayerZero: World Chain → Arbitrum mesaj iletilir
4. Arbitrum'da: cachedTrustScore[Bob] = 100 ✓
5. Arbitrum'da: Bob 50 USDC kredi kullanabilir ✓
```

---

## 6. Sözleşme Deployment Sırası

```
1. World Chain Sepolia'ya:
   └── TrustCircle.sol (USDC adresi + World ID adresi ile)
   
2. Arbitrum Sepolia'ya:
   └── TrustCircleRead.sol (LayerZero endpoint + TrustCircle adresi ile)
   
3. LayerZero konfigürasyonu:
   └── npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts
   
4. World Developer Portal'da:
   └── Sözleşme adresini whitelist et
   └── Allowed domains'e frontend URL'i ekle
```

---

## 7. Geliştirme Kontrol Listesi

### Gün 1 Sabahı Bitene Kadar
- [ ] `TrustCircle.sol` derlenebiliyor (Hardhat `compile` başarılı)
- [ ] `verifyAndRegister()` World ID mock ile test edildi
- [ ] `vouch()` ve `getTrustScore()` unit test geçti
- [ ] `requestLoan()` 3 kefil ile çalışıyor
- [ ] World Chain Sepolia'ya deploy başarılı

### Gün 2 Öğleden Sonrasına Kadar
- [ ] `TrustCircleRead.sol` derleniyor
- [ ] LayerZero endpoint adresleri doğru konfigüre edildi
- [ ] `lz:oapp:wire` başarıyla çalıştı
- [ ] Test mesajı LayerZero Scan'de görünüyor
- [ ] `cachedTrustScore` Arbitrum Sepolia'da güncellendi

---

*Son güncelleme: Mart 2026*
