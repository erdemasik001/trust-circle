# Security notes

Trust Circle is **unaudited**. The mainnet beta is capped so that the money at risk stays small.

## Trust assumptions

| Who | Can do | Cannot do |
|---|---|---|
| **Attester** (backend key) | Sign registrations after verifying a World ID proof. It can also sign invites without World ID (`script/sign-attestation.sh`, used for the testnet rehearsal and as a fallback). A leaked key could register fake humans. Rotated with `setAttester`. | Move funds, change limits. |
| **Owner** (deployer EOA, two-step transfer) | Pause new registrations, vouches and loans; set beta limits up to the hard caps; pay vouchers from the insurance pool (`compensate`); withdraw protocol fees. | Touch vouchers' escrow, claimable balances or loans; pause `repay`, `withdraw`, `claim` or `liquidate`; raise limits above the hard caps. |
| **World ID (Device level)** | One identity per device, not per person. | — |

### What the attestation API checks

Before the attester signs, `web/src/lib/server/verifyAndAttest.ts` requires: the expected World ID environment (a staging proof never registers on mainnet), the `trustcircle-register` action, exactly one proof of the configured credential, a `signal_hash` equal to the hash of the requesting wallet (so a proof cannot be replayed for another wallet), a successful response from `developer.world.org/api/v4/verify`, and that neither the nullifier nor the wallet is registered on-chain yet. The contract's `usedNullifier` mapping is the nullifier store, so there is no database to keep in sync. Each rule has a unit test, and a TypeScript-signed attestation was accepted by the Solidity contract on a local chain.

### Why Device level is acceptable

A voucher's stake is their own money, and a loan is funded only by its vouchers' escrow. Someone who vouches for their own second identity and then defaults has just moved their own USDC around, minus the 1% fee and gas. The only shared money is the insurance pool, so the beta pays nothing out of it automatically: there is no liquidation reward and no automatic insurance cover. The owner can compensate vouchers case by case. `test_liquidate_sybilDefaultGainsNothing` checks this.

### Other abuse cases handled

| Abuse | Defence |
|---|---|
| Farming reputation with dust loans whose interest and fee round to zero | `MIN_BORROW` = 1 USDC: every repaid loan costs at least 0.15 USDC interest. |
| Filling a borrower's 10 voucher slots with 1 USDC stakes from strangers | The borrower can `rejectVouch` any unlocked vouch; the stake returns to the voucher via `claim()`. |
| A voucher front-running a borrow by withdrawing | The borrow reverts with `ExceedsLimit`; no funds move. |

### Known limitations

- The circuit breaker (defaults > 10% of lent principal, armed after 1,000 USDC lent) cannot be reset. If it trips, new loans stop for good; repay, withdraw, claim and liquidate keep working, and the fix is a new deployment.
- Interest is a flat fee per loan (15% Newcomer), not time-based: repaying on day 1 costs the same as on day 30.

## Beta limits

| Parameter | Beta value | Hard cap (in code) |
|---|---|---|
| `maxBorrowPerUser` | 100 USDC | 1,000 USDC |
| `tvlCap` (total escrow) | 2,000 USDC | 50,000 USDC |
| `maxTierOpen` | Rising | Leader |
| Activation delay | 48 h (immutable) | — |
| Vouchers per borrower | 10 | constant |

## Tests

- Unit tests for registration, escrow, limits, the 40% voucher cap, repayment, liquidation, blocklisted vouchers, vouch rejection, beta limits and pause.
- Fuzz test: for any 1–10 vouchers and any amount within the limit, pro-rata locking locks exactly the loan amount and never more than a voucher's capped contribution.
- Invariant test: under random sequences of vouch, withdraw, borrow, repay, liquidate, claim and time jumps (and with any unexpected revert counted as a failure), the contract's USDC balance always covers `escrow + claimable + insurance pool + protocol fees`.

## Slither (0.11.4)

`slither src/TrustCircle.sol --filter-paths lib/` reports no High findings.

| Detector | Severity | Status |
|---|---|---|
| `incorrect-equality` in `availableLimit` | Medium | False positive: compares a `LoanStatus` enum, not a balance. |
| `uninitialized-local` | Medium | Fixed: counters are initialized explicitly. |
| `timestamp` (register deadline, due date, grace period, activation) | Low | Accepted: periods are hours to days; validator drift of a few seconds does not matter. |
