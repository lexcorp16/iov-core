import {
  Address,
  BcpSwapQuery,
  isQueryBySwapId,
  isQueryBySwapRecipient,
  isQueryBySwapSender,
} from "@iov/bcp-types";
import { Encoding } from "@iov/encoding";
import { Tag } from "@iov/tendermint-types";

import { bucketKey, hashIdentifier, indexKey } from "./util";

export function bnsFromOrToTag(addr: Address): Tag {
  const id = Uint8Array.from([...Encoding.toAscii("wllt:"), ...addr]);
  const key = Encoding.toHex(id).toUpperCase();
  const value = "s"; // "s" for "set"
  return { key, value };
}

export function bnsNonceTag(addr: Address): Tag {
  const id = Uint8Array.from([...Encoding.toAscii("sigs:"), ...addr]);
  const key = Encoding.toHex(id).toUpperCase();
  const value = "s"; // "s" for "set"
  return { key, value };
}

export function bnsSwapQueryTags(query: BcpSwapQuery, set = true): Tag {
  let binKey: Uint8Array;
  const bucket = "esc";
  if (isQueryBySwapId(query)) {
    binKey = Uint8Array.from([...bucketKey(bucket), ...query.swapid]);
  } else if (isQueryBySwapSender(query)) {
    binKey = Uint8Array.from([...indexKey(bucket, "sender"), ...query.sender]);
  } else if (isQueryBySwapRecipient(query)) {
    binKey = Uint8Array.from([...indexKey(bucket, "recipient"), ...query.recipient]);
  } else {
    // if (isQueryBySwapHash(query))
    binKey = Uint8Array.from([...indexKey(bucket, "arbiter"), ...hashIdentifier(query.hashlock)]);
  }

  const key = Encoding.toHex(binKey).toUpperCase();
  // "s" for set, "d" for delete.... we need to watch both changes to be clear
  // But if we return two tags here, that would AND not OR
  const value = set ? "s" : "d";
  return { key, value };
}
