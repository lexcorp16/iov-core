# @iov/tendermint-rpc

[![npm version](https://img.shields.io/npm/v/@iov/tendermint-rpc.svg)](https://www.npmjs.com/package/@iov/tendermint-rpc)

This package provides a type-safe wrapper around tendermint rpc. Notably, all binary data is passed
in and out as Uint8Array/Buffer, and this module is reponsible for the hex/base64 encoding/decoding
depending on the field and version of tendermint. Also handles converting numbers to and from strings
for tendermint v0.22+ (not yet implemented).

In fact, the simplest possible user of the module is to assume it does everything
automatically, and call:

```
const client = await Client.connect('wss://bov.wolfnet.iov.one');
```

Supported tendermint versions:
* v0.20.x
* v0.21.x
(help welcome to extend this list)

## Code Overview

The main entry point is the [Client](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/classes/_client_.client.html).

The connection to the blockchain is defned by a flexible [RpcClient](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/modules/_rpcclient_.html)
interface, with implmentations for Http (POST) and Websockets. You can add your own connection type
or just wrap one with custom retry rules, error handling, etc. This client is just responsible for
sending JsonRpc requests and returning the responses.

The actual domain knowledge is embeded in the [Adaptor](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/modules/_adaptor_.html),
which defines a class for encoding [Params](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/interfaces/_adaptor_.params.html)
and another for decoding [Responses](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/interfaces/_adaptor_.responses.html).
There is currently an [implementation for v0.20](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/modules/_v0_20_index_.html),
which is compatible with `v0.21` as well. This knowledge is mainly for those who
want to add support for new versions, which should be added to the
[auto-detect method](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/classes/_client_.client.html#detectversion).

## API Documentation

[https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/](https://iov-one.github.io/iov-core-docs/latest/iov-tendermint-rpc/)

## License

This package is part of the IOV-Core repository, licensed under the Apache License 2.0
(see [NOTICE](https://github.com/iov-one/iov-core/blob/master/NOTICE) and [LICENSE](https://github.com/iov-one/iov-core/blob/master/LICENSE)).
