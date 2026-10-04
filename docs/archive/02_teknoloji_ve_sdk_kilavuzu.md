# 🛠️ Trust Circle — Teknoloji & SDK Kılavuzu

> Her teknolojinin **ne olduğu**, **neden seçildiği**, **nasıl çalıştığı** ve **kritik kavramları**

---

## 📋 Teknoloji Haritası

```
┌─────────────────────────────────────────────────────────────────┐
│  KATMAN            │  TEKNOLOJİ                │  AMAÇ          │
├─────────────────────────────────────────────────────────────────┤
│  Kimlik            │  World ID + MiniKit       │  Sybil koruması│
│  Frontend          │  Next.js + Tailwind       │  Mini App UI   │
│  Blockchain        │  World Chain (OP Stack L2)│  Gas-free tx   │
│  Akıllı Sözleşme  │  Solidity + Hardhat       │  Kredi mantığı │
│  Çapraz Zincir    │  LayerZero V2 (lzRead)    │  Trust sync    │
│  Stablecoin       │  Circle USDC              │  Kredi birimi  │
│  İsimlendirme     │  ENS (viem/wagmi)         │  Kullanıcı kimliği│
│  Zincir Bağlantısı│  wagmi v2 + viem          │  Web3 state    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 🌍 World ID & MiniKit SDK

### Ne Yapar?
World ID, biyometrik Orb doğrulaması ile "sen gerçek bir insansın ve daha önce bu eylemi yapmadın" kanıtını — kimliğini ifşa etmeden — üretir. MiniKit ise bu altyapıyı World App içindeki Mini uygulamalarla kullanmayı sağlayan SDK'dır.

### Neden Trust Circle İçin Kritik?
- Bot hesapları (Sybil attack) sıfıra indirir — kefaleti sahte hesaplar veremez
- 23 milyon+ doğrulanmış kullanıcı = hazır pazar
- Gas ücretini World App otomatik karşılar (paymaster)

### Paket Kurulumu
```bash
npm install @worldcoin/minikit-js
```

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| `app_id` | Developer Portal'dan alınan uygulama kimliği |
| `rp_id` | Relying Party ID — proof'u kim talep ediyor |
| `signing_key` | RP imzası için gizli anahtar (backend'de sakla!) |
| `nullifier_hash` | Kullanıcı başına benzersiz kimlik — tekrar kullanımı engeller |
| `proof` | ZK ispatı — backend'de doğrulanmalı |
| `signal` | Kullanıcının onayladığı işlem hash'i |

### Entegrasyon Akışı

```
1. Frontend → MiniKit.commands.verify({ action, signal })
              ↓
2. World App → ZK proof üretir
              ↓
3. Frontend → Backend'e proof'u gönder
              ↓
4. Backend → POST /api/v4/verify/{rp_id}  (World'ün API'si)
              ↓
5. Onaylı ise → Kullanıcıyı sisteme kaydet
```

### Kod Örneği (Frontend)
```typescript
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';

// App mount edildiğinde
MiniKit.install(process.env.NEXT_PUBLIC_APP_ID);

// Doğrulama başlat
const { finalPayload } = await MiniKit.commandsAsync.verify({
  action: 'trust-circle-login',
  signal: userAddress, // cüzdan adresi
  verification_level: VerificationLevel.Orb,
});

// Backend'e gönder
await fetch('/api/verify-worldid', {
  method: 'POST',
  body: JSON.stringify({ payload: finalPayload }),
});
```

### Kod Örneği (Backend — Next.js API Route)
```typescript
// app/api/verify-worldid/route.ts
import { verifyCloudProof } from '@worldcoin/minikit-js';

export async function POST(req: Request) {
  const { payload } = await req.json();
  
  const result = await verifyCloudProof(
    payload,
    process.env.APP_ID as `app_${string}`,
    'trust-circle-login',
    userAddress // signal
  );
  
  if (result.success) {
    // Kullanıcıyı verified olarak işaretle
  }
}
```

### MiniKit Pay Komutu (USDC Transfer)
```typescript
import { Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

const { finalPayload } = await MiniKit.commandsAsync.pay({
  reference: loanId, // benzersiz referans
  to: contractAddress,
  tokens: [{
    symbol: Tokens.USDCE, // World Chain'deki USDC.e
    token_amount: tokenToDecimals(amount, Tokens.USDCE).toString(),
  }],
  description: 'Trust Circle kredi geri ödemesi',
});
```

### Önemli Notlar
- `signing_key` **asla frontend'e koyma** — backend env var'ı
- World ID 4.0'dan itibaren `rp_context` **zorunlu**
- "Sign in with World ID v1" **deprecated** — yeni API'yi kullan
- Dev Mode: World App'te `Developer Mode` açık olmalı

### Kaynaklar
- Resmi docs: https://docs.world.org/
- Developer Portal: https://developer.worldcoin.org/
- MiniKit npm: `@worldcoin/minikit-js`

---

## 2. ⛓️ LayerZero V2 — Omnichain Messaging & lzRead

### Ne Yapar?
LayerZero, farklı blockchainler arasında mesaj ve veri taşıyan bir protokoldür. **lzRead** ise "push" yerine "pull" modeli kullanır: bir zincirdeki sözleşme, başka bir zincirdeki veriyi **okuma isteği** gönderir ve yanıtı alır.

### Neden Trust Circle İçin Kritik?
- Kullanıcı World Chain'de güven skoru kazandı → Arbitrum'da kredi kullanabilmeli
- `lzRead` ile World Chain'deki `trustScore[address]` değeri Arbitrum'dan okunabilir
- OApp (Omnichain App) standardı zincirler arası state sync için idealdir

### Paket Kurulumu
```bash
npm install @layerzerolabs/lz-evm-oapp-v2
npm install -g create-lz-oapp
# Yeni proje için:
# npx create-lz-oapp@latest
```

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| `OApp` | Omnichain App — temel sözleşme standardı |
| `OAppRead` | lzRead için özel OApp türü — okuma sorguları yapar |
| `DVN` | Decentralized Verification Network — mesajları doğrular |
| `Executor` | Hedef zincirde işlemi tetikleyen agent |
| `EndpointV2` | Zincir üzerindeki LayerZero ana sözleşmesi |
| `eid` | Endpoint ID — her desteklenen zincir için benzersiz sayı |
| `BQL` | Blockchain Query Language — lzRead sorgu dili |
| `_lzReceive` | Gelen mesajı/yanıtı işleyen fonksiyon |

### LayerZero Endpoint ID'leri (Önemli Ağlar)

| Ağ | Endpoint ID (eid) | Testnet |
|----|-------------------|---------|
| World Chain | Kontrol et: layerzero.network | World Chain Sepolia |
| Arbitrum One | 30110 | Arbitrum Sepolia: 40231 |
| Base | 30184 | Base Sepolia: 40245 |
| Optimism | 30111 | Optimism Sepolia: 40232 |

### Entegrasyon Akışı (lzRead)

```
1. Arbitrum'daki TrustCircleRead.sol   →  "World Chain'de 0xABC'nin trust score'u nedir?"
              ↓  _buildReadRequest()
2. LayerZero DVN'leri                  →  World Chain'e sorgu gönder
              ↓
3. World Chain verisi                  →  DVN'ler doğrular
              ↓
4. TrustCircleRead._lzReceive()        →  Yanıtı al ve işle
              ↓
5. Arbitrum'da                         →  Güven skoru güncellendi → kredi kullanılabilir
```

### Sözleşme Yapısı

```solidity
// contracts/TrustCircleRead.sol (Arbitrum'da deploy edilecek)
import { OAppRead } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppRead.sol";

contract TrustCircleRead is OAppRead {
    // World Chain endpoint ID
    uint32 constant WORLD_CHAIN_EID = /* World Chain eid */;
    
    // Okunan güven skoru cache'i
    mapping(address => uint256) public crossChainTrustScore;
    
    // Okuma isteği başlat
    function readTrustScore(address user) external payable {
        bytes memory cmd = _buildReadRequest(user);
        _lzSend(WORLD_CHAIN_EID, cmd, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }
    
    // Yanıtı al
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address,
        bytes calldata
    ) internal override {
        (address user, uint256 score) = abi.decode(_message, (address, uint256));
        crossChainTrustScore[user] = score;
    }
}
```

### Konfigürasyon (layerzero.config.ts)
```typescript
import { EndpointId } from '@layerzerolabs/lz-definitions';

const config = {
  contracts: [
    {
      contract: require('./deployments/world-chain/TrustCircle.json'),
      config: {
        sendLibrary: '0x...', // SendUln302 adresi
        receiveLibraryConfig: { receiveLibrary: '0x...' },
        sendConfig: {
          executorConfig: { executor: '0x...' },
          ulnConfig: { requiredDVNs: ['0x...'] }, // LayerZero DVN
        },
      },
    },
  ],
  connections: [
    {
      from: { contractName: 'TrustCircleRead', endpointId: EndpointId.ARBITRUM_SEPOLIA },
      to: { contractName: 'TrustCircle', endpointId: EndpointId.WORLDCHAIN_TESTNET },
    },
  ],
};
```

### Önemli Notlar
- `create-lz-oapp` CLI ile başlamak **çok zaman kazandırır**
- DVN konfigürasyonu olmadan mesajlar **hiç çalışmaz** — önce test et
- LayerZero Scan ile mesaj durumunu takip et: https://layerzeroscan.com
- Testnet'te `fee` hesaplamak için `quoteSend()` kullan

### Kaynaklar
- lzRead Docs: https://layerzero.network/docs/v2/evm/protocol/read/overview
- GitHub: https://github.com/LayerZero-Labs/create-lz-oapp
- lzScan: https://layerzeroscan.com

---

## 3. 💵 Circle USDC & CCTP V2

### Ne Yapar?
USDC, Circle tarafından çıkarılan ABD Doları'na bağlı stablecoin'dir. CCTP (Cross-Chain Transfer Protocol), USDC'yi zincirler arasında "yak-bas" (burn-and-mint) mekanizmasıyla taşır — wrapped token yok, likidite havuzu yok.

### Neden Trust Circle İçin Kritik?
- Kredi birimi USDC (volatil token değil)
- `minikit.pay()` komutu doğrudan USDC transferi yapar
- CCTP V2 ile farklı zincirlere kredi dağıtımı mümkün

### Paket Kurulumu
```bash
# Doğrudan Solidity interface'i kullan, ayrı SDK gerekmeyebilir
# Frontend için:
npm install viem  # USDC contract çağrıları için
```

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| `USDC` | Circle'ın native stablecoin'i |
| `USDC.e` | World Chain'deki bridged USDC versiyonu |
| `CCTP V2` | Cross-chain burn-and-mint protokolü |
| `TokenMessenger` | CCTP'nin ana sözleşmesi (yak işlemi) |
| `MessageTransmitter` | Attestation ile bas işlemi |
| `depositForBurn` | Kaynak zincirde USDC yak |
| `receiveMessage` | Hedef zincirde USDC bas |

### World Chain'deki USDC Adresi
```
World Chain Sepolia: Resmi docs'tan al (çalışma sırasında kontrol et)
World Chain Mainnet: 0x... (developer.worldapp.com'dan kontrol et)
```

### MiniKit ile USDC Transfer
```typescript
// MiniKit içinde ödeme — kullanıcıya onay dialogu gösterir
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

async function disburseLoan(borrowerAddress: string, amount: number) {
  const { finalPayload } = await MiniKit.commandsAsync.pay({
    reference: crypto.randomUUID(), // benzersiz ödeme ID'si
    to: borrowerAddress,            // doğrudan kullanıcıya
    tokens: [{
      symbol: Tokens.USDCE,
      token_amount: tokenToDecimals(amount, Tokens.USDCE).toString(),
    }],
    description: `Trust Circle: ${amount} USDC kredi`,
  });
  
  if (finalPayload.status === 'success') {
    // tx hash'i al ve sözleşmeye kaydet
    return finalPayload.transaction_id;
  }
}
```

### Sözleşmedeki USDC İşlemleri
```solidity
// IERC20 interface kullan
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TrustCircle {
    IERC20 public usdc;
    
    constructor(address _usdcAddress) {
        usdc = IERC20(_usdcAddress);
    }
    
    // Kredi dağıt (sözleşme cüzdanından)
    function disburseLoan(address borrower, uint256 amount) internal {
        require(usdc.balanceOf(address(this)) >= amount, "Yetersiz bakiye");
        usdc.transfer(borrower, amount);
    }
    
    // Geri ödeme al
    function repay(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        usdc.transferFrom(msg.sender, address(this), loan.amount);
        loan.status = LoanStatus.Repaid;
    }
}
```

### CCTP V2 Entegrasyonu (Çapraz Zincir USDC)
```solidity
interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external returns (uint64 nonce);
}
```

### Önemli Notlar
- CCTP V1 **Temmuz 2026'da kapatılıyor** — direkt V2 kullan
- Hackathon MVP'si için CCTP gerekli olmayabilir — önce `minikit.pay()` yeterli
- Sözleşmenin USDC tutabilmesi için `approve()` / `allowance()` yönetimini unutma
- Testnet USDC için Circle faucet kullan

### Kaynaklar
- Circle Developer Hub: https://developers.circle.com/
- CCTP V2 Docs: https://developers.circle.com/stablecoins/cctp

---

## 4. 🔤 ENS — Ethereum Name Service

### Ne Yapar?
ENS, Ethereum adreslerini okunabilir `.eth` isimlerine çevirir (`0xd8dA6B...` → `vitalik.eth`). Kullanıcıların birbirini tanıması ve kefalet vermesi için adres yerine isim kullanılabilmesini sağlar.

### Neden Trust Circle İçin Kritik?
- Kullanıcılar uzun hex adresleri yerine `alice.eth` ile kefalet verir
- ENS ödülü (10.000$) için derinlemesine entegrasyon gerekli
- Sosyal güven ağında isimler kimliği insanlaştırır

### Paket Kurulumu
```bash
npm install viem wagmi
# ENS için ayrı SDK gerekmez — viem ve wagmi natively destekler
```

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| `Forward Resolution` | `alice.eth` → `0x1234...` |
| `Reverse Resolution` | `0x1234...` → `alice.eth` |
| `Text Records` | ENS profilindeki ek bilgiler (avatar, email, twitter) |
| `Universal Resolver` | Tüm ENS lookup'larını yöneten ana sözleşme |
| `normalize()` | ENS ismini standart forma getir (zorunlu adım!) |

### Wagmi Hooks (Frontend)
```typescript
import { useEnsAddress, useEnsName, useEnsAvatar } from 'wagmi';
import { normalize } from 'viem/ens';

// ENS ismi → Adres
function VouchByENS({ ensName }: { ensName: string }) {
  const { data: address } = useEnsAddress({
    name: normalize(ensName),
    chainId: 1, // ENS Ethereum mainnet'te
  });
  
  const { data: avatar } = useEnsAvatar({
    name: normalize(ensName),
  });
  
  return (
    <div>
      <img src={avatar} />
      <span>{ensName}</span>
      <span>{address}</span>
    </div>
  );
}

// Adres → ENS ismi (reverse lookup)
function UserProfile({ address }: { address: `0x${string}` }) {
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
  });
  
  return <span>{ensName ?? address.slice(0, 6) + '...'}</span>;
}
```

### Viem (Backend veya Server Component)
```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// ENS resolve
const address = await publicClient.getEnsAddress({
  name: normalize('alice.eth'),
});

// ENS text records (profil bilgileri)
const twitter = await publicClient.getEnsText({
  name: normalize('alice.eth'),
  key: 'com.twitter',
});
```

### Sözleşmede ENS Kullanımı (On-chain Resolve)
```solidity
// ENS Registry interface
interface IENSResolver {
    function addr(bytes32 node) external view returns (address);
}

// NOT: On-chain ENS resolve pahalıdır. 
// Frontend'de resolve et, sözleşmede adresi kullan.
// ENS isim → adres dönüşümünü UI katmanında yap.
```

### Sözleşmede ENS İsmi Saklama
```solidity
contract TrustCircle {
    // Kullanıcının ENS ismini sakla (opsiyonel, gasları göz önüne al)
    mapping(address => string) public ensName;
    
    function registerENS(string calldata name) external {
        // Sadece kayıt, doğrulama yok (trust sistemi bunu halleder)
        ensName[msg.sender] = name;
        emit ENSRegistered(msg.sender, name);
    }
}
```

### Önemli Notlar
- ENS Ethereum mainnet'te çalışır; `chainId: 1` ile sorgu yap
- **`normalize()` çağrısını unutma!** ENS isimleri normalize edilmeden sorgu yapılırsa hata verir
- ENS'in World Chain'de native desteği yoktur — Ethereum mainnet üzerinden resolve et
- ENS text records'u kullanarak kullanıcı avatarı göstermek ENS derinliği gösterir

### Kaynaklar
- Viem ENS Docs: https://viem.sh/docs/ens/introduction
- Wagmi ENS Hooks: https://wagmi.sh/react/api/hooks/useEnsAddress
- ENS App: https://app.ens.domains

---

## 5. ⛓️ World Chain (Blockchain Katmanı)

### Ne Yapar?
World Chain, Worldcoin ekibi tarafından OP Stack üzerine kurulan Ethereum L2'sidir. Doğrulanmış World ID kullanıcıları için **gas ücretlerini otomatik olarak karşılan**.

### Neden Trust Circle İçin Kritik?
- Sıfır gas ücreti = mikro-kredi için uygun
- World App ile native entegrasyon
- World ID Proof of Personhood native desteği

### Ağ Bilgileri

| Parametre | Değer |
|-----------|-------|
| Ağ Adı | World Chain |
| Chain ID (Mainnet) | 480 |
| Chain ID (Testnet) | 4801 (World Chain Sepolia) |
| RPC (Mainnet) | https://worldchain-mainnet.g.alchemy.com/public |
| RPC (Testnet) | https://worldchain-sepolia.g.alchemy.com/public |
| Block Explorer | https://worldscan.org |
| L1 | Ethereum Mainnet (OP Stack) |

### wagmi Konfigürasyonu
```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { worldchain, worldchainSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [worldchain, worldchainSepolia],
  transports: {
    [worldchain.id]: http('https://worldchain-mainnet.g.alchemy.com/public'),
    [worldchainSepolia.id]: http('https://worldchain-sepolia.g.alchemy.com/public'),
  },
});
```

### Gas Sponsorluğu Nasıl Çalışır?
```
Kullanıcı (World ID doğrulanmış)
    ↓
MiniKit.send() / minikit.pay()
    ↓
World App → Paymaster Sözleşmesi
    ↓
Gas ücreti otomatik karşılanır (kullanıcı ETH tutmak zorunda değil)
```

### Hardhat Konfigürasyonu
```typescript
// hardhat.config.ts
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    worldchain_sepolia: {
      url: "https://worldchain-sepolia.g.alchemy.com/public",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 4801,
    },
    worldchain: {
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 480,
    },
  },
};
```

### Kaynaklar
- World Chain Docs: https://docs.world.org/world-chain/
- World Scan: https://worldscan.org

---

## 6. 🔗 wagmi v2 + viem (Web3 Frontend)

### Ne Yapar?
- **wagmi**: React hooks ile Ethereum bağlantısı, sözleşme çağrıları, hesap yönetimi
- **viem**: TypeScript-first Ethereum client — düşük seviye blockchain işlemleri

### Paket Kurulumu
```bash
npm install wagmi viem @tanstack/react-query
```

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| `WagmiProvider` | Tüm uygulamayı saran context provider |
| `useAccount` | Bağlı cüzdan bilgisi |
| `useReadContract` | Sözleşmeden veri oku |
| `useWriteContract` | Sözleşmeye işlem gönder |
| `useWaitForTransactionReceipt` | Tx onayını bekle |
| `PublicClient` | Salt okunur blockchain sorguları |
| `WalletClient` | İmzalama ve işlem gönderme |

### Temel Kurulum
```typescript
// app/providers.tsx
'use client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Sözleşme Okuma
```typescript
import { useReadContract } from 'wagmi';
import { TRUST_CIRCLE_ABI, TRUST_CIRCLE_ADDRESS } from '@/lib/contracts';

function TrustScore({ address }: { address: `0x${string}` }) {
  const { data: score } = useReadContract({
    address: TRUST_CIRCLE_ADDRESS,
    abi: TRUST_CIRCLE_ABI,
    functionName: 'getTrustScore',
    args: [address],
  });
  
  return <span>Trust Score: {score?.toString()}</span>;
}
```

### Sözleşme Yazma
```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

function VouchButton({ target, limit }: { target: `0x${string}`, limit: bigint }) {
  const { writeContract, data: hash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  
  return (
    <button onClick={() => writeContract({
      address: TRUST_CIRCLE_ADDRESS,
      abi: TRUST_CIRCLE_ABI,
      functionName: 'vouch',
      args: [target, limit],
    })}>
      {isSuccess ? '✅ Kefalet Verildi' : 'Kefil Ol'}
    </button>
  );
}
```

---

## 7. ⚡ Next.js + Tailwind CSS (Frontend Framework)

### Neden Bu Stack?
- MiniKit resmi örnekleri Next.js kullanıyor
- App Router ile Server Components → backend mantığı next'e entegre
- Tailwind ile hızlı, responsive UI

### MiniKit ile Özel Konfigürasyonlar
```typescript
// app/layout.tsx — MiniKit Provider en üste
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MiniKitProvider>
          {children}
        </MiniKitProvider>
      </body>
    </html>
  );
}
```

### World App Detection
```typescript
// MiniKit yüklü mü kontrol et
import { MiniKit } from '@worldcoin/minikit-js';

if (!MiniKit.isInstalled()) {
  // World App dışında açılıyor — fallback göster
  return <div>Lütfen World App'i açın</div>;
}
```

---

## 8. 🔨 Geliştirme Araçları

### Hardhat (Solidity Geliştirme)
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### OpenZeppelin (Sözleşme Güvenliği)
```bash
npm install @openzeppelin/contracts
# ReentrancyGuard, Ownable, ERC20 interface'leri için
```

### LayerZero CLI
```bash
npm install -g create-lz-oapp
npx create-lz-oapp@latest
```

### Test Araçları
| Araç | Amaç |
|------|------|
| Hardhat Test | Solidity unit testleri |
| LayerZero Scan | Cross-chain mesaj takibi |
| World App Dev Mode | MiniKit entegrasyonu test |
| Tenderly | Sözleşme simülasyonu ve debug |

---

## 📦 Tam package.json Bağımlılıkları

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@worldcoin/minikit-js": "^latest",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0",
    "@tanstack/react-query": "^5.56.0",
    "@layerzerolabs/lz-evm-oapp-v2": "^latest"
  },
  "devDependencies": {
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0"
  }
}
```

---

*Son güncelleme: Mart 2026*
