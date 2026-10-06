#!/usr/bin/env bash
# Signs a TrustCircle registration attestation (EIP-712) with the attester key, locally.
#
# Used for the testnet rehearsal, and as the fallback if the World ID backend is down:
# an owner-signed invite uses the same signature format as the backend.
#
#   script/sign-attestation.sh <wallet> [testnet|mainnet]
#
# Env overrides:
#   NULLIFIER    default: keccak256("trustcircle-invite:" + wallet). Real registrations use the
#                World ID nullifier hash instead; an invite nullifier never collides with one.
#   DEADLINE     default: now + 1 hour (unix seconds)
#   SIGNER_ARGS  default: "--account attester" (keystore); e.g. "--private-key 0x…" for local tests
#   TC, CHAIN_ID, RPC_URL  default: read from deployments/arc-<network>.json and the Arc RPC
set -euo pipefail

cd "$(dirname "$0")/.."

wallet="${1:?usage: $0 <wallet> [testnet|mainnet]}"
network="${2:-testnet}"

case "$network" in
  testnet) default_rpc="https://rpc.testnet.arc.io" ;;
  mainnet) default_rpc="https://rpc.mainnet.arc.io" ;;
  *) echo "network must be testnet or mainnet" >&2; exit 1 ;;
esac

deployment="deployments/arc-$network.json"
rpc="${RPC_URL:-$default_rpc}"
tc="${TC:-$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["trustCircle"])' "$deployment")}"
chain_id="${CHAIN_ID:-$(cast chain-id --rpc-url "$rpc")}"

wallet="$(cast to-check-sum-address "$wallet")"
lower="$(echo "$wallet" | tr '[:upper:]' '[:lower:]')"
nullifier="${NULLIFIER:-$(cast to-dec "$(cast keccak "trustcircle-invite:$lower")")}"
deadline="${DEADLINE:-$(( $(date +%s) + 3600 ))}"

if [ "$(cast call "$tc" 'usedNullifier(uint256)(bool)' "$nullifier" --rpc-url "$rpc")" = "true" ]; then
  echo "nullifier already used: $nullifier" >&2
  exit 1
fi

typed_data="$(mktemp)"
trap 'rm -f "$typed_data"' EXIT
cat > "$typed_data" <<EOF
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Attestation": [
      {"name": "wallet", "type": "address"},
      {"name": "nullifierHash", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ]
  },
  "primaryType": "Attestation",
  "domain": {"name": "TrustCircle", "version": "1", "chainId": $chain_id, "verifyingContract": "$tc"},
  "message": {"wallet": "$wallet", "nullifierHash": "$nullifier", "deadline": "$deadline"}
}
EOF

# shellcheck disable=SC2086 # SIGNER_ARGS is intentionally split into flags
sig="$(cast wallet sign --data --from-file "$typed_data" ${SIGNER_ARGS:---account attester})"

# Dry-run register as the wallet: proves the signature recovers to the on-chain attester.
if ! cast call "$tc" 'register(uint256,uint256,bytes)' "$nullifier" "$deadline" "$sig" \
  --from "$wallet" --rpc-url "$rpc" > /dev/null; then
  echo "signature does not register on-chain (wrong attester key or wallet already registered?)" >&2
  exit 1
fi

cat <<EOF
wallet     $wallet
nullifier  $nullifier
deadline   $deadline ($(date -r "$deadline" '+%Y-%m-%d %H:%M'))
signature  $sig

Register (as $wallet):
cast send $tc "register(uint256,uint256,bytes)" $nullifier $deadline $sig --account <wallet> --rpc-url $rpc
EOF
