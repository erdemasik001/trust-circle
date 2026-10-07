# Testnet rehearsal: Arc testnet, 6 Oct 2026

One full cycle on Arc testnet (chain 5042002) with the deployed, verified contract, driven from the command line with `cast`. Registration used `contracts/script/sign-attestation.sh` (attester-signed invite) instead of the World ID backend.

Contract (first testnet deployment, since replaced by [`0xe4b2…0b06`](https://testnet.arcscan.app/address/0xe4b2f7fdb7960160c8003409c2a9eb97046a0b06) with the `MIN_BORROW` and `rejectVouch` fixes): [`0xefbECEc96fd11c05469B43F5c18975F7Aa571B6F`](https://testnet.arcscan.app/address/0xefbecec96fd11c05469b43f5c18975f7aa571b6f), 300 s activation delay, default beta config.

| Step | Who | Transaction | Gas | Fee (USDC) |
|---|---|---|---|---|
| Deploy + verify | deployer | [`0x4126ea4f…`](https://testnet.arcscan.app/tx/0x4126ea4fafa921cf99df53fbad0a7c50c3ac2d3acfcc9a84634fafce5749d84f) | 3,105,468 | 0.1007 |
| Register | borrower | [`0xc7408ef3…`](https://testnet.arcscan.app/tx/0xc7408ef3553b662a73e3bfc3d4e4d59d8e7b650b2c1f72a566275432b78caa2b) | 101,021 | 0.0030 |
| Register | voucher | [`0x0ff405e8…`](https://testnet.arcscan.app/tx/0x0ff405e806e26500303dce3a9861fa42cdb1c38aa009e8be01ea765509fd5c61) | 101,021 | 0.0031 |
| Vouch 10 USDC | voucher | [`0xd7a80221…`](https://testnet.arcscan.app/tx/0xd7a80221a1e57a34b409fcd574fe949a51f0488be79cede0d1a3d47c0781d8f5) | 179,252 | 0.0053 |
| Borrow 5 USDC | borrower | [`0x95a020cd…`](https://testnet.arcscan.app/tx/0x95a020cd64a352cbb0cfa495bdb1c4c3db3c6ec65b3ddd28a948c057a483c4d8) | 195,060 | 0.0061 |
| Repay 5.75 USDC | borrower | [`0xdf16eb86…`](https://testnet.arcscan.app/tx/0xdf16eb860db1169fdb9d3402d14865a5eae14dfb51e61eadaa41a17a772d115c) | 145,583 | 0.0046 |
| Claim interest | voucher | [`0x346556c7…`](https://testnet.arcscan.app/tx/0x346556c747adb95e5d3984ed699a7bdf7c14a1461b6b45e8c407a2d75554abca) | 53,625 | 0.0016 |

The two ERC-20 `approve` calls (before vouch and repay) are not listed.

## Results

| | Expected | On chain |
|---|---|---|
| Borrower receives | 5 − 1% insurance fee = 4.95 | 4.95 |
| Insurance pool | 0.05 | 0.05 |
| Owed | 5 + 15% = 5.75 | 5.75 |
| Voucher's locked stake while the loan is open | 5 of 10 | 5 of 10 |
| Voucher's interest (80%) | 0.60 | 0.60, claimed |
| Protocol fee (20%) | 0.15 | 0.15 |
| Borrower reputation | 100 → 110 | 110 |
| Contract balance after repay | 10 escrow + 0.60 + 0.05 + 0.15 = 10.80 | 10.80 |

A borrower's whole cycle (register, borrow, repay) cost about **0.014 USDC** in fees, paid in USDC; nobody needed a second token.
