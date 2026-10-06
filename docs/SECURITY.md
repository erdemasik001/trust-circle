# Security notes

Trust Circle is **unaudited**. The mainnet beta is capped so that the money at risk stays small.

## Trust assumptions

| Who | Can do | Cannot do |
|---|---|---|
| **Attester** (backend key) | Sign registrations after verifying a World ID proof. A leaked key could register fake humans. Rotated with `setAttester`. | Move funds, change limits. |
| **Owner** (deployer EOA, two-step transfer) | Pause new registrations, vouches and loans; set beta limits up to the hard caps; pay vouchers from the insurance pool (`compensate`); withdraw protocol fees. | Touch vouchers' escrow, claimable balances or loans; pause `repay`, `withdraw`, `claim` or `liquidate`; raise limits above the hard caps. |
| **World ID (Device level)** | One identity per device, not per person. | — |

### Why Device level is acceptable

A voucher's stake is their own money, and a loan is funded only by its vouchers' escrow. Someone who vouches for their own second identity and then defaults has just moved their own USDC around, minus the 1% fee and gas. The only shared money is the insurance pool, so the beta pays nothing out of it automatically: there is no liquidation reward and no automatic insurance cover. The owner can compensate vouchers case by case. `test_liquidate_sybilDefaultGainsNothing` checks this.

## Beta limits

| Parameter | Beta value | Hard cap (in code) |
|---|---|---|
| `maxBorrowPerUser` | 100 USDC | 1,000 USDC |
| `tvlCap` (total escrow) | 2,000 USDC | 50,000 USDC |
| `maxTierOpen` | Rising | Leader |
| Activation delay | 48 h (immutable) | — |
| Vouchers per borrower | 10 | constant |

## Tests

- Unit tests for registration, escrow, limits, the 40% voucher cap, pro-rata locking, repayment, liquidation, blocklisted vouchers, beta limits and pause.
- Invariant test: under random sequences of vouch, withdraw, borrow, repay, liquidate, claim and time jumps, the contract's USDC balance always covers `escrow + claimable + insurance pool + protocol fees`.

## Slither (0.11.4)

`slither src/TrustCircle.sol --filter-paths lib/` reports no High findings.

| Detector | Severity | Status |
|---|---|---|
| `incorrect-equality` in `availableLimit` | Medium | False positive: compares a `LoanStatus` enum, not a balance. |
| `uninitialized-local` | Medium | Fixed: counters are initialized explicitly. |
| `timestamp` (register deadline, due date, grace period, activation) | Low | Accepted: periods are hours to days; validator drift of a few seconds does not matter. |
