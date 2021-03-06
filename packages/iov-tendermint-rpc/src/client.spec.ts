// tslint:disable:no-console readonly-array
import { ReadonlyDate } from "readonly-date";

import { Encoding } from "@iov/encoding";
import { Tag } from "@iov/tendermint-types";

import { v0_20 } from "./adaptor";
import { Client } from "./client";
import { randomId } from "./common";
import { buildTxQuery } from "./requests";
import * as responses from "./responses";
import { HttpClient, RpcClient, WebsocketClient } from "./rpcclient";

function skipTests(): boolean {
  return !process.env.TENDERMINT_ENABLED;
}

function pendingWithoutTendermint(): void {
  if (skipTests()) {
    pending("Set TENDERMINT_ENABLED to enable tendermint-based tests");
  }
}

// TODO: make flexible, support multiple versions, etc...
const tendermintUrl = "localhost:12345";

function buildKvTx(k: string, v: string): Uint8Array {
  return Encoding.toAscii(`${k}=${v}`);
}

function kvTestSuite(rpcFactory: () => RpcClient): void {
  const key = randomId();
  const value = randomId();

  it("Tries to connect with known version to tendermint", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);
    expect(await client.abciInfo()).toBeTruthy();
  });

  it("Tries to auto-discover tendermint", async () => {
    pendingWithoutTendermint();
    const client = await Client.detectVersion(rpcFactory());
    const info = await client.abciInfo();
    expect(info).toBeTruthy();
  });

  it("can disconnect", async () => {
    pendingWithoutTendermint();
    const client = await Client.detectVersion(rpcFactory());
    await client.abciInfo();
    client.disconnect();
  });

  it("Posts a transaction", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);
    const tx = buildKvTx(key, value);

    const response = await client.broadcastTxCommit({ tx: tx });
    expect(response.height).toBeGreaterThan(2);
    expect(response.hash.length).toEqual(20);
    // verify success
    expect(response.checkTx.code).toBeFalsy();
    expect(response.deliverTx).toBeTruthy();
    if (response.deliverTx) {
      expect(response.deliverTx.code).toBeFalsy();
    }
  });

  it("Queries the state", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);

    const binKey = Encoding.toAscii(key);
    const binValue = Encoding.toAscii(value);
    const queryParams = { path: "/key", data: binKey };

    const response = await client.abciQuery(queryParams);
    expect(new Uint8Array(response.key)).toEqual(binKey);
    expect(new Uint8Array(response.value)).toEqual(binValue);
    expect(response.code).toBeFalsy();
  });

  it("Sanity check - calls don't error", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);

    expect(await client.block()).toBeTruthy();
    expect(await client.blockchain(2, 4)).toBeTruthy();
    expect(await client.blockResults(3)).toBeTruthy();
    expect(await client.commit(4)).toBeTruthy();
    expect(await client.genesis()).toBeTruthy();
    expect(await client.health()).toBeNull();
    expect(await client.status()).toBeTruthy();
    expect(await client.validators()).toBeTruthy();
  });

  it("Can query a tx properly", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);

    const find = randomId();
    const me = randomId();
    const tx = buildKvTx(find, me);

    const txRes = await client.broadcastTxCommit({ tx });
    expect(responses.txCommitSuccess(txRes)).toBeTruthy();
    expect(txRes.height).toBeTruthy();
    const height: number = txRes.height || 0; // || 0 for type system
    expect(txRes.hash.length).not.toEqual(0);
    const hash = txRes.hash;

    // find by hash - does it match?
    const r = await client.tx({ hash, prove: true });
    // both values come from rpc, so same type (Buffer/Uint8Array)
    expect(r.hash).toEqual(hash);
    // force the type when comparing to locally generated value
    expect(new Uint8Array(r.tx)).toEqual(tx);
    expect(r.height).toEqual(height);
    expect(r.proof).toBeTruthy();

    // txSearch - you must enable the indexer when running
    // tendermint, else you get empty results
    const query = buildTxQuery({ tags: [{ key: "app.key", value: find }] });
    expect(query).toEqual(`app.key='${find}'`);

    const s = await client.txSearch({ query, page: 1, per_page: 30 });
    // should find the tx
    expect(s.totalCount).toEqual(1);
    // should return same info as querying directly,
    // except without the proof
    expect(s.txs[0]).toEqual({ ...r, proof: undefined });

    // ensure txSearchAll works as well
    const sall = await client.txSearchAll({ query });
    // should find the tx
    expect(sall.totalCount).toEqual(1);
    // should return same info as querying directly,
    // except without the proof
    expect(sall.txs[0]).toEqual({ ...r, proof: undefined });

    // and let's query the block itself to see this transaction
    const block = await client.block(height);
    expect(block.blockMeta.header.numTxs).toEqual(1);
    expect(block.block.txs.length).toEqual(1);
    expect(block.block.txs[0]).toEqual(tx);
  });

  it("Can paginate over all txs", async () => {
    pendingWithoutTendermint();
    const client = new Client(rpcFactory(), v0_20);

    const find = randomId();
    const query = buildTxQuery({ tags: [{ key: "app.key", value: find }] });

    const sendTx = async () => {
      const me = randomId();
      const tx = buildKvTx(find, me);

      const txRes = await client.broadcastTxCommit({ tx });
      expect(responses.txCommitSuccess(txRes)).toBeTruthy();
      expect(txRes.height).toBeTruthy();
      expect(txRes.hash.length).not.toEqual(0);
    };

    // send 3 txs
    await sendTx();
    await sendTx();
    await sendTx();

    // expect one page of results
    const s1 = await client.txSearch({ query, page: 1, per_page: 2 });
    expect(s1.totalCount).toEqual(3);
    expect(s1.txs.length).toEqual(2);

    // second page
    const s2 = await client.txSearch({ query, page: 2, per_page: 2 });
    expect(s2.totalCount).toEqual(3);
    expect(s2.txs.length).toEqual(1);

    // and all together now
    const sall = await client.txSearchAll({ query, per_page: 2 });
    expect(sall.totalCount).toEqual(3);
    expect(sall.txs.length).toEqual(3);
    // make sure there are in order from lowest to highest height
    const [tx1, tx2, tx3] = sall.txs;
    expect(tx2.height).toEqual(tx1.height + 1);
    expect(tx3.height).toEqual(tx2.height + 1);
  });
}

describe("Client", () => {
  it("can connect to a given url", async () => {
    pendingWithoutTendermint();

    // default connection
    const client = await Client.connect(tendermintUrl);
    const info = await client.abciInfo();
    expect(info).toBeTruthy();

    // http connection
    const client2 = await Client.connect("http://" + tendermintUrl);
    const info2 = await client2.abciInfo();
    expect(info2).toBeTruthy();

    // ws connection
    const client3 = await Client.connect("ws://" + tendermintUrl);
    const info3 = await client3.abciInfo();
    expect(info3).toBeTruthy();
  });

  describe("With HttpClient", () => {
    kvTestSuite(() => new HttpClient(tendermintUrl));
  });

  describe("With WebsocketClient", () => {
    // don't print out WebSocket errors if marked pending
    const onError = skipTests() ? () => 0 : console.log;
    kvTestSuite(() => new WebsocketClient(tendermintUrl, onError));

    it("can subscribe to block header events", done => {
      pendingWithoutTendermint();

      const testStart = ReadonlyDate.now();

      (async () => {
        const events: responses.NewBlockHeaderEvent[] = [];
        const client = await Client.connect("ws://" + tendermintUrl);
        const stream = client.subscribeNewBlockHeader();
        expect(stream).toBeTruthy();
        const subscription = stream.subscribe({
          next: event => {
            expect(event.chainId).toMatch(/^[-a-zA-Z0-9]{3,30}$/);
            expect(event.height).toBeGreaterThan(0);
            expect(event.time.getTime()).toBeGreaterThan(testStart);
            expect(event.numTxs).toEqual(0);
            expect(event.lastBlockId).toBeTruthy();
            expect(event.totalTxs).toBeGreaterThan(0);

            // merkle roots for proofs
            expect(event.appHash).toBeTruthy();
            expect(event.consensusHash).toBeTruthy();
            expect(event.dataHash).toBeTruthy();
            expect(event.evidenceHash).toBeTruthy();
            expect(event.lastCommitHash).toBeTruthy();
            expect(event.lastResultsHash).toBeTruthy();
            expect(event.validatorsHash).toBeTruthy();

            events.push(event);

            if (events.length === 2) {
              subscription.unsubscribe();
              expect(events.length).toEqual(2);
              expect(events[1].chainId).toEqual(events[0].chainId);
              expect(events[1].height).toEqual(events[0].height + 1);
              expect(events[1].time.getTime()).toBeGreaterThan(events[0].time.getTime());
              expect(events[1].totalTxs).toEqual(events[0].totalTxs);

              expect(events[1].appHash).toEqual(events[0].appHash);
              expect(events[1].consensusHash).toEqual(events[0].consensusHash);
              expect(events[1].dataHash).toEqual(events[0].dataHash);
              expect(events[1].evidenceHash).toEqual(events[0].evidenceHash);
              expect(events[1].lastCommitHash).not.toEqual(events[0].lastCommitHash);
              expect(events[1].lastResultsHash).not.toEqual(events[0].lastResultsHash);
              expect(events[1].validatorsHash).toEqual(events[0].validatorsHash);
              done();
            }
          },
          error: fail,
          complete: () => fail("Stream must not close just because we don't listen anymore"),
        });
      })().catch(fail);
    });

    it("can subscribe to block events", done => {
      pendingWithoutTendermint();

      const testStart = ReadonlyDate.now();

      (async () => {
        const events: responses.NewBlockEvent[] = [];
        const client = await Client.connect("ws://" + tendermintUrl);
        const stream = client.subscribeNewBlock();
        expect(stream).toBeTruthy();
        const subscription = stream.subscribe({
          next: event => {
            expect(event.header.chainId).toMatch(/^[-a-zA-Z0-9]{3,30}$/);
            expect(event.header.height).toBeGreaterThan(0);
            expect(event.header.time.getTime()).toBeGreaterThan(testStart);
            expect(event.header.numTxs).toEqual(1);
            expect(event.header.lastBlockId).toBeTruthy();
            expect(event.header.totalTxs).toBeGreaterThan(0);

            // merkle roots for proofs
            expect(event.header.appHash).toBeTruthy();
            expect(event.header.consensusHash).toBeTruthy();
            expect(event.header.dataHash).toBeTruthy();
            expect(event.header.evidenceHash).toBeTruthy();
            expect(event.header.lastCommitHash).toBeTruthy();
            expect(event.header.lastResultsHash).toBeTruthy();
            expect(event.header.validatorsHash).toBeTruthy();

            events.push(event);

            if (events.length === 2) {
              subscription.unsubscribe();
              expect(events.length).toEqual(2);
              expect(events[1].header.height).toEqual(events[0].header.height + 1);
              expect(events[1].header.chainId).toEqual(events[0].header.chainId);
              expect(events[1].header.time.getTime()).toBeGreaterThan(events[0].header.time.getTime());
              expect(events[1].header.totalTxs).toEqual(events[0].header.totalTxs + 1);

              expect(events[1].header.appHash).not.toEqual(events[0].header.appHash);
              expect(events[1].header.validatorsHash).toEqual(events[0].header.validatorsHash);
              done();
            }
          },
          error: fail,
          complete: () => fail("Stream must not close just because we don't listen anymore"),
        });

        const transaction1 = buildKvTx(randomId(), randomId());
        const transaction2 = buildKvTx(randomId(), randomId());

        await client.broadcastTxCommit({ tx: transaction1 });
        await client.broadcastTxCommit({ tx: transaction2 });
      })().catch(fail);
    });

    it("can subscribe to transaction events", done => {
      pendingWithoutTendermint();

      (async () => {
        const events: responses.TxEvent[] = [];
        const client = await Client.connect("ws://" + tendermintUrl);
        const stream = client.subscribeTx();
        expect(stream).toBeTruthy();
        const subscription = stream.subscribe({
          next: event => {
            expect(event.height).toBeGreaterThan(0);
            expect(event.index).toEqual(0);
            expect(event.result).toBeTruthy();
            expect(event.tx.length).toBeGreaterThan(10);

            events.push(event);

            if (events.length === 2) {
              subscription.unsubscribe();
              expect(events.length).toEqual(2);
              expect(events[1].height).toEqual(events[0].height + 1);
              expect(events[1].result.tags).not.toEqual(events[0].result.tags);
              done();
            }
          },
          error: fail,
          complete: () => fail("Stream must not close just because we don't listen anymore"),
        });

        const transaction1 = buildKvTx(randomId(), randomId());
        const transaction2 = buildKvTx(randomId(), randomId());

        await client.broadcastTxCommit({ tx: transaction1 });
        await client.broadcastTxCommit({ tx: transaction2 });
      })().catch(fail);
    });

    it("can subscribe to transaction events filtered by creator", done => {
      pendingWithoutTendermint();

      (async () => {
        const events: responses.TxEvent[] = [];
        const client = await Client.connect("ws://" + tendermintUrl);
        const tags: ReadonlyArray<Tag> = [{ key: "app.creator", value: "jae" }];
        const stream = client.subscribeTx(tags);
        expect(stream).toBeTruthy();
        const subscription = stream.subscribe({
          next: event => {
            expect(event.height).toBeGreaterThan(0);
            expect(event.index).toEqual(0);
            expect(event.result).toBeTruthy();
            expect(event.tx.length).toBeGreaterThan(10);

            events.push(event);

            if (events.length === 2) {
              subscription.unsubscribe();
              expect(events.length).toEqual(2);
              expect(events[1].height).toEqual(events[0].height + 1);
              expect(events[1].result.tags).not.toEqual(events[0].result.tags);
              done();
            }
          },
          error: fail,
          complete: () => fail("Stream must not close just because we don't listen anymore"),
        });

        const transaction1 = buildKvTx(randomId(), randomId());
        const transaction2 = buildKvTx(randomId(), randomId());

        await client.broadcastTxCommit({ tx: transaction1 });
        await client.broadcastTxCommit({ tx: transaction2 });
      })().catch(fail);
    });
  });
});
