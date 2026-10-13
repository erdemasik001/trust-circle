# Trust Circle

**Uncollateralized USDC micro-loans on [Arc](https://arc.io), backed by friends who vouch for you.**

Every member is a unique, verified human (World ID). A voucher stakes USDC for someone they trust; that stake is held in escrow by the contract and sets the borrower's limit. When the borrower repays, vouchers earn 80% of the interest and the borrower's reputation grows, unlocking higher tiers. If the borrower defaults, the vouchers' stake covers the loss.

> Status: **live on Arc mainnet as a capped beta**, built for Arc Microgrants (Oct 2026). Unaudited: loans are capped at 100 USDC each and total stakes at 2,000 USDC.

## Why Arc
- **USDC is gas.** Members only ever hold USDC: no second token, which matters for people who have never used crypto.
- **Cheap, predictable fees.** Loans of 10–100 USDC are economical for the first time.
- **Sub-second deterministic finality.** A loan or repayment is final the moment it lands.
- **CCTP.** Fund from any chain that has USDC.

## Repository
```
contracts/   Foundry: TrustCircle, tests, deploy + attestation scripts
web/         Next.js + wagmi + viem: register, vouch, borrow, repay, claim
docs/        SECURITY.md — trust assumptions, beta limits, Slither
             testnet-rehearsal.md — a full cycle on Arc testnet with tx hashes
             archive/ — earlier design notes
```

## The app
| Page | What it does |
|---|---|
| `/register` | Verify with World ID (Selfie Check) and register the wallet in one transaction. |
| `/` | A member's dashboard: reputation and tier, the borrow form with a quote of fee, interest and due date, the open loan with a repay button, who vouches for them (an unwanted vouch can be declined), whom they vouch for, and interest ready to claim. |
| `/u/<address>` | A member's public profile. The borrower shares this link; a friend opens it to vouch (approve + stake), add to a stake or withdraw the part that is not lent out. Anyone can close a loan here once it is past its grace period. |

Amounts, limits, fees and waiting periods are read from the contract, so the app shows whatever the deployment enforces. Every action is simulated before the wallet is asked to sign, and a revert is shown as the contract's own reason (for example "You can borrow up to 10.00 USDC right now").

## Deployments
| Network | TrustCircle |
|---|---|
| Arc mainnet (`5042`) | [`0x36307eFf9D3E446754184De2E7d355511521A95E`](https://explorer.arc.io/address/0x36307eFf9D3E446754184De2E7d355511521A95E), deployed in [`0xce66df72…`](https://explorer.arc.io/tx/0xce66df72026f8f492049daec54ea1189b919cc9d86133aac70d5494d7e59d653), source verified on [Sourcify](https://sourcify.dev/server/v2/contract/5042/0x36307eFf9D3E446754184De2E7d355511521A95E) (exact match) |
| Arc testnet (`5042002`) | [`0xe4b2F7fDb7960160C8003409c2a9eb97046A0b06`](https://testnet.arcscan.app/address/0xe4b2f7fdb7960160c8003409c2a9eb97046a0b06) (verified) |

## Live on Arc mainnet
Set up on 13 Oct 2026 with the contract in the table above:

| Step | Who | Transaction | Gas | Fee (USDC) |
|---|---|---|---|---|
| Deploy | deployer | [`0xce66df72…`](https://explorer.arc.io/tx/0xce66df72026f8f492049daec54ea1189b919cc9d86133aac70d5494d7e59d653) | 3,198,030 | 0.0640 |
| Register | borrower | [`0x74c439bf…`](https://explorer.arc.io/tx/0x74c439bf3f9d4820141fd9d2782dbf9fe070e742421bf9101f3d8dd69feb94fa) | 101,021 | 0.0020 |
| Register | voucher | [`0xb8a10059…`](https://explorer.arc.io/tx/0xb8a100593a4a0fa14075ee1ac37d2901ea5744da1ff874431397cac64c99861d) | 101,021 | 0.0020 |
| Approve 2 USDC | voucher | [`0xe49ceb7e…`](https://explorer.arc.io/tx/0xe49ceb7e45c9685b02007176d8d9a456fe780c3b3a1dd9d449618fff03341d45) | 55,438 | 0.0011 |
| Vouch 2 USDC | voucher | [`0xe4709d5f…`](https://explorer.arc.io/tx/0xe4709d5fed416aa9a2b0413c2cb2885ab4afe6924e3e0bdaa75d856ef27b769a) | 179,252 | 0.0036 |

The voucher's 2 USDC stake is in the contract's escrow and counts towards the borrower's limit after the 48-hour activation delay, from 15 Oct 2026 18:07 UTC. The first mainnet loan (borrow, repay, claim) follows then; the same cycle on testnet is in [docs/testnet-rehearsal.md](docs/testnet-rehearsal.md).

Both seed accounts ([borrower](https://explorer.arc.io/address/0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490), [voucher](https://explorer.arc.io/address/0x715aaB67Fc6eA3E8a8994AEAa481cb8F7a40aF1d)) belong to the team and were registered with attester-signed invites (`contracts/script/sign-attestation.sh`) rather than a World ID proof.

## Develop
Requires [Foundry](https://getfoundry.sh) and Node 22.

```bash
git submodule update --init --recursive
cd contracts && forge test
```

Arc's USDC is a system contract whose transfers go through an Arc precompile, so the fork tests that move real USDC (`test/fork/TrustCircleCycle.fork.t.sol`) need [Arc Foundry](https://github.com/circlefin/arc-foundry); plain `forge` skips them. CI runs everything with Arc Foundry:

```bash
cd contracts && arc-forge test --network arc
```

```bash
cd web && npm install && npm run dev
```

Networks: Arc mainnet `5042` (`https://rpc.mainnet.arc.io`) · Arc testnet `5042002` (`https://rpc.testnet.arc.io`). USDC ERC-20 interface: `0x3600000000000000000000000000000000000000` (6 decimals).

## License
MIT
