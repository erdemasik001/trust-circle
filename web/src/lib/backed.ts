"use client";

import { useSyncExternalStore } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { defaultChain } from "./chains";

/**
 * The members this wallet has vouched for, remembered in this browser. The contract indexes vouches by
 * borrower only, and Arc's public RPC does not serve log queries far enough back to rebuild the list, so
 * it is kept locally. Nothing is lost if it is cleared: a stake is always shown on the borrower's profile.
 */
const storageKey = (account: Address) => `trustcircle:backed:${defaultChain.id}:${account.toLowerCase()}`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(account: Address): string {
  try {
    return window.localStorage.getItem(storageKey(account)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Address[] {
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((a): a is string => typeof a === "string" && isAddress(a)).map((a) => getAddress(a));
  } catch {
    return [];
  }
}

export function rememberBacked(account: Address, borrower: Address) {
  const current = parse(read(account));
  if (current.includes(getAddress(borrower))) return;
  try {
    window.localStorage.setItem(storageKey(account), JSON.stringify([...current, getAddress(borrower)]));
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

export function useBacked(account: Address): Address[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(account),
    () => "[]",
  );
  return parse(raw);
}
