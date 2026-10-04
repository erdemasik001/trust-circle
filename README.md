# Trust Circle

**Uncollateralized USDC micro-loans on [Arc](https://arc.io), backed by friends who vouch for you.**

Every member is a unique, verified human (World ID). A voucher stakes USDC for someone they trust; that stake is held in escrow by the contract and sets the borrower's limit. When the borrower repays, vouchers earn 80% of the interest and the borrower's reputation grows, unlocking higher tiers. If the borrower defaults, the vouchers' stake covers the loss.

> Status: **in development for Arc Microgrants (Oct 2026).** Unaudited — mainnet beta is capped at 100 USDC per loan and 2,000 USDC total.

## Why Arc
- **USDC is gas.** Members only ever hold USDC: no second token, which matters for people who have never used crypto.
- **Cheap, predictable fees.** Loans of 10–100 USDC are economical for the first time.
- **Sub-second deterministic finality.** A loan or repayment is final the moment it lands.
- **CCTP.** Fund from any chain that has USDC.

## Repository
```
contracts/   Foundry: TrustCircle and tests
web/         Next.js + wagmi + viem
docs/        archive/ — earlier design notes
```

## Develop
Requires [Foundry](https://getfoundry.sh) and Node 22.

```bash
git submodule update --init --recursive
cd contracts && forge test
```

```bash
cd web && npm install && npm run dev
```

Networks: Arc mainnet `5042` (`https://rpc.mainnet.arc.io`) · Arc testnet `5042002` (`https://rpc.testnet.arc.io`). USDC ERC-20 interface: `0x3600000000000000000000000000000000000000` (6 decimals).

## License
MIT
