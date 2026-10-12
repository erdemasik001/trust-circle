# Trust Circle — web

Next.js 16 + wagmi 3 + viem. Arc chain config lives in `src/lib/chains.ts`, contract addresses in `src/lib/contracts.ts`.

| Where | What |
|---|---|
| `src/app/` | Pages: `/` (landing and member dashboard), `/u/[address]` (public profile, vouching), `/register` (World ID), and the attestation API routes. |
| `src/lib/useTrustCircle.ts` | On-chain reads, batched per account. |
| `src/lib/actions.ts`, `useTx.ts` | Every state-changing call, simulated before it is sent, and the approve-then-spend sequence. |
| `src/lib/loan.ts`, `errors.ts` | Loan maths mirroring the contract's rounding, and its custom errors in plain words. Unit-tested. |

```bash
cp .env.example .env.local
npm install
npm run dev
```
