[![npm](https://img.shields.io/npm/v/ts-proto)](https://www.npmjs.com/package/ts-proto)
[![build](https://github.com/stephenh/ts-proto/workflows/Build/badge.svg)](https://github.com/stephenh/ts-proto/actions)

# ts-proto

> `ts-proto` transforms your `.proto` files into strongly-typed, idiomatic TypeScript files!

## Table of contents

- [ts-proto](#ts-proto)
  - [Table of contents](#table-of-contents)
- [Overview](#overview)
- [QuickStart](#quickstart)
  - [Buf](#buf)
  - [ESM](#esm)
- [Goals](#goals)
  - [Non-Goals](#non-goals)
- [Example Types](#example-types)
- [Highlights](#highlights)
- [Auto-Batching / N+1 Prevention](#auto-batching--n1-prevention)
- [Usage](#usage)
  - [Supported options](#supported-options)
  - [NestJS Support](#nestjs-support)
  - [Watch Mode](#watch-mode)
  - [Basic gRPC implementation](#basic-grpc-implementation)
- [Sponsors](#sponsors)
- [Development](#development)
- [Assumptions](#assumptions)
- [Todo](#todo)
- [OneOf Handling](#oneof-handling)
- [Default values and unset fields](#default-values-and-unset-fields)
- [Well-Known Types](#well-known-types)
  - [Wrapper Types](#wrapper-types)
  - [JSON Types (Struct Types)](#json-types-struct-types)
  - [Timestamp](#timestamp)
- [Number Types](#number-types)
- [Current Status of Optional Values](#current-status-of-optional-values)

# Overview

ts-proto generates TypeScript types from protobuf schemas.

I.e. given a `person.proto` schema like:

```proto
message Person {
  string name = 1;
}
```

ts-proto will generate a `person.ts` file like:

```typescript
interface Person {
  name: string
}

const Person = {
  encode(person): Writer { ... }
  decode(reader): Person { ... }
  toJSON(person): unknown { ... }
  fromJSON(data): Person { ... }
}
```

It also knows about services and will generate types for them as well, i.e.:

```typescript
export interface PingService {
  ping(request: PingRequest): Promise<PingResponse>;
}
```

It will also generate client implementations of `PingService`; currently [Twirp](https://github.com/twitchtv/twirp), [grpc-web](./integration/grpc-web), [grpc-js](./integration/grpc-js) and [nestjs](./NESTJS.markdown) are supported.

# QuickStart

- `npm install ts-proto`
- `protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=. ./simple.proto`
  - (Note that the output parameter name, `ts_proto_out`, is named based on the suffix of the plugin's name, i.e. "ts_proto" suffix in the `--plugin=./node_modules/.bin/protoc-gen-ts_proto` parameter becomes the `_out` prefix, per `protoc`'s CLI conventions.)
  - On Windows, use `protoc --plugin=protoc-gen-ts_proto=".\\node_modules\\.bin\\protoc-gen-ts_proto.cmd" --ts_proto_out=. ./simple.proto` (see [#93](https://github.com/stephenh/ts-proto/issues/93))
  - Ensure you're using a modern `protoc` (see [installation instructions for your platform](https://grpc.io/docs/protoc-installation/), i.e. `protoc` v`3.0.0` doesn't support the `_opt` flag

This will generate `*.ts` source files for the given `*.proto` types.

If you want to package these source files into an npm package to distribute to clients, just run `tsc` on them as usual to generate the `.js`/`.d.ts` files, and deploy the output as a regular npm package.

## Buf

If you're using Buf, pass `strategy: all` in your `buf.gen.yaml` file ([docs](https://docs.buf.build/configuration/v1/buf-gen-yaml#strategy)).

```yaml
version: v1
plugins:
  - name: ts
    out: ../gen/ts
    strategy: all
    path: ../node_modules/ts-proto/protoc-gen-ts_proto
```

To prevent `buf push` from reading irrelevent `.proto` files, configure `buf.yaml` like so:

```yaml
build:
  excludes: [node_modules]
```

You can also use the official plugin published to the Buf Registry.

```yaml
version: v1
plugins:
  - plugin: buf.build/community/stephenh-ts-proto
    out: ../gen/ts
    opt:
      - outputServices=...
      - useExactTypes=...
```

## ESM

If you're using a modern TS setup with either `esModuleInterop` or running in an ESM environment, you'll need to pass `ts_proto_opt`s of:

- `esModuleInterop=true` if using `esModuleInterop` in your `tsconfig.json`, and
- `importSuffix=.js` if executing the generated ts-proto code in an ESM environment

# Goals

In terms of the code that `ts-proto` generates, the general goals are:

- Idiomatic TypeScript/ES6 types
  - `ts-proto` is a clean break from either the built-in Google/Java-esque JS code of `protoc` or the "make `.d.ts` files the `*.js` comments" approach of `protobufjs`
  - (Techically the `protobufjs/minimal` package is used for actually reading/writing bytes.)
- TypeScript-first output
- Interfaces over classes
  - As much as possible, types are just interfaces, so you can work with messages just like regular hashes/data structures.
- Only supports codegen `*.proto`-to-`*.ts` workflow, currently no runtime reflection/loading of dynamic `.proto` files

## Non-Goals

Note that ts-proto is not an out-of-the-box RPC framework; instead it's more of a swiss-army knife (as witnessed by its many config options), that lets you build _exactly_ the RPC framework you'd like on top of it (i.e. that best integrates with your company's protobuf ecosystem; for better or worse, protobuf RPC is still a somewhat fragmented ecosystem).

If you'd like an out-of-the-box RPC framework built on top of ts-proto, there are a few examples:

- [nice-grpc](https://github.com/deeplay-io/nice-grpc)
- [starpc](https://github.com/aperturerobotics/starpc)

(Note for potential contributors, if you develop other frameworks/mini-frameworks, or even blog posts/tutorials, on using `ts-proto`, we're happy to link to them.)

We also don't support clients for `google.api.http`-based [Google Cloud](https://cloud.google.com/endpoints/docs/grpc/transcoding) APIs, see [#948](https://github.com/stephenh/ts-proto/issues/948) if you'd like to submit a PR.

# Example Types

The generated types are "just data", i.e.:

```typescript
export interface Simple {
  name: string;
  age: number;
  createdAt: Date | undefined;
  child: Child | undefined;
  state: StateEnum;
  grandChildren: Child[];
  coins: number[];
}
```

Along with `encode`/`decode` factory methods:

```typescript
export const Simple = {
  create(baseObject?: DeepPartial<Simple>): Simple {
    ...
  },

  encode(message: Simple, writer: Writer = Writer.create()): Writer {
    ...
  },

  decode(reader: Reader, length?: number): Simple {
    ...
  },

  fromJSON(object: any): Simple {
    ...
  },

  fromPartial(object: DeepPartial<Simple>): Simple {
    ...
  },

  toJSON(message: Simple): unknown {
    ...
  },
};
```

This allows idiomatic TS/JS usage like:

```typescript
const bytes = Simple.encode({ name: ..., age: ..., ... }).finish();
const simple = Simple.decode(Reader.create(bytes));
const { name, age } = simple;
```

Which can dramatically ease integration when converting to/from other layers without
creating a class and calling the right getters/setters.

# Highlights

- A poor man's attempt at "please give us back optional types"

  The canonical protobuf wrapper types, i.e. `google.protobuf.StringValue`, are mapped as optional values, i.e. `string | undefined`, which means for primitives we can kind of pretend the protobuf type system has optional types.

  (**Update**: ts-proto now also supports the proto3 `optional` keyword.)

- Timestamps are mapped as `Date`

  (Configurable with the `useDate` parameter.)

- `fromJSON`/`toJSON` use the [proto3 canonical JSON encoding format](https://developers.google.com/protocol-buffers/docs/proto3#json) (e.g. timestamps are ISO strings), unlike [`protobufjs`](https://github.com/protobufjs/protobuf.js/issues/1304).

- ObjectIds can be mapped as `mongodb.ObjectId`

  (Configurable with the `useMongoObjectId` parameter.)

# Auto-Batching / N+1 Prevention

(Note: this is currently only supported by the Twirp clients.)

If you're using ts-proto's clients to call backend micro-services, similar to the N+1 problem in SQL applications, it is easy for micro-service clients to (when serving an individual request) inadvertantly trigger multiple separate RPC calls for "get book 1", "get book 2", "get book 3", that should really be batched into a single "get books [1, 2, 3]" (assuming the backend supports a batch-oriented RPC method).

ts-proto can help with this, and essentially auto-batch your individual "get book" calls into batched "get books" calls.

For ts-proto to do this, you need to implement your service's RPC methods with the batching convention of:

- A method name of `Batch<OperationName>`
- The `Batch<OperationName>` input type has a single repeated field (i.e. `repeated string ids = 1`)
- The `Batch<OperationName>` output type has either a:
  - A single repeated field (i.e. `repeated Foo foos = 1`) _where the output order is the same as the input `ids` order_, or
  - A map of the input to an output (i.e. `map<string, Entity> entities = 1;`)

When ts-proto recognizes methods of this pattern, it will automatically create a "non-batch" version of `<OperationName>` for the client, i.e. `client.Get<OperationName>`, that takes a single id and returns a single result.

This provides the client code with the illusion that it can make individual `Get<OperationName>` calls (which is generally preferrable/easier when implementing the client's business logic), but the actual implementation that ts-proto provides will end up making `Batch<OperationName>` calls to the backend service.

You also need to enable the `useContext=true` build-time parameter, which gives all client methods a Go-style `ctx` parameter, with a `getDataLoaders` method that lets ts-proto cache/resolve request-scoped [DataLoaders](https://github.com/graphql/dataloader), which provide the fundamental auto-batch detection/flushing behavior.

See the `batching.proto` file and related tests for examples/more details.

But the net effect is that ts-proto can provide SQL-/ORM-style N+1 prevention for clients calls, which can be critical especially in high-volume / highly-parallel implementations like GraphQL front-end gateways calling backend micro-services.

# Usage

`ts-proto` is a `protoc` plugin, so you run it by (either directly in your project, or more likely in your mono-repo schema pipeline, i.e. like [Ibotta](https://medium.com/building-ibotta/building-a-scaleable-protocol-buffers-grpc-artifact-pipeline-5265c5118c9d) or [Namely](https://medium.com/namely-labs/how-we-build-grpc-services-at-namely-52a3ae9e7c35)):

- Add `ts-proto` to your `package.json`
- Run `npm install` to download it
- Invoke `protoc` with a `plugin` parameter like:

```bash
protoc --plugin=node_modules/ts-proto/protoc-gen-ts_proto ./batching.proto -I.
```

`ts-proto` can also be invoked with [Gradle](https://gradle.org) using the [protobuf-gradle-plugin](https://github.com/google/protobuf-gradle-plugin):

```groovy
protobuf {
    plugins {
        // `ts` can be replaced by any unused plugin name, e.g. `tsproto`
        ts {
            path = 'path/to/plugin'
        }
    }

    // This section only needed if you provide plugin options
    generateProtoTasks {
        all().each { task ->
            task.plugins {
                // Must match plugin ID declared above
                ts {
                    option 'foo=bar'
                }
            }
        }
    }
}
```

Generated code will be placed in the Gradle build directory.

# Supported options

See [here](./docs/supported-options-new.md)

### NestJS Support

We have a great way of working together with [nestjs](https://docs.nestjs.com/microservices/grpc). `ts-proto` generates `interfaces` and `decorators` for you controller, client. For more information see the [nestjs readme](NESTJS.markdown).

### Watch Mode

If you want to run `ts-proto` on every change of a proto file, you'll need to use a tool like [chokidar-cli](https://www.npmjs.com/package/chokidar-cli) and use it as a script in `package.json`:

```json
"proto:generate": "protoc --ts_proto_out=. ./<proto_path>/<proto_name>.proto --ts_proto_opt=esModuleInterop=true",
"proto:watch": "chokidar \"**/*.proto\" -c \"npm run proto:generate\""
```

### Basic gRPC implementation

`ts-proto` is RPC framework agnostic - how you transmit your data to and from
your data source is up to you. The generated client implementations all expect
a `rpc` parameter, which type is defined like this:

```ts
interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}
```

If you're working with gRPC, a simple implementation could look like this:

```ts
type RpcImpl = (service: string, method: string, data: Uint8Array) => Promise<Uint8Array>;

const sendRequest: RpcImpl = (service, method, data) => {
  // Conventionally in gRPC, the request path looks like
  //   "package.names.ServiceName/MethodName",
  // we therefore construct such a string
  const path = `/${service}/${method}`;

  return new Promise((resolve, reject) => {
    // makeUnaryRequest transmits the result (and error) with a callback
    // transform this into a promise!
    const resultCallback: UnaryCallback<any> = (err, res) => {
      if (err) {
        return reject(err);
      }
      resolve(res);
    };

    function passThrough(argument: any) {
      return argument;
    }

    // Using passThrough as the serialize and deserialize functions
    conn.makeUnaryRequest(path, passThrough, passThrough, data, resultCallback);
  });
};

const rpc: Rpc = { request: sendRequest };
```

# Sponsors

Kudos to our sponsors:

- [ngrok](https://ngrok.com) funded ts-proto's initial grpc-web support.

If you need ts-proto customizations or priority support for your company, you can ping me at [via email](mailto:stephen.haberman@gmail.com).

# Development

This section describes how to contribute directly to ts-proto, i.e. it's not required for running `ts-proto` in `protoc` or using the generated TypeScript.

**Requirements**

- [Docker](https://www.docker.com)
- `yarn` — `npm install -g yarn`

**Setup**

The commands below assume you have **Docker** installed. If you are using OS X, install **coreutils**, `brew install coreutils`.

- Check out the [repository]() for the latest code.
- Run `yarn install` to install the dependencies.
- Run `yarn build:test` to generate the test files.
  > _This runs the following commands:_
  >
  > - `proto2ts` — Runs `ts-proto` on the `integration/**/*.proto` files to generate `.ts` files.
  > - `proto2pbjs` — Generates a reference implementation using `pbjs` for testing compatibility.
- Run `yarn test`

**Workflow**

- Add/update an integration test for your use case
  - Either find an existing `integration/*` test that is close enough to your use case, e.g. has a `parameters.txt` that matches the `ts_proto_opt` params necessary to reproduce your use case
  - If creating a new integration test:
    - Make a new `integration/your-new-test/parameters.txt` with the necessary `ts_proto_opt` params
    - Create a minimal `integration/your-new-test/your-new-test.proto` schema to reproduce your use case
  - After any changes to `your-new-test.proto`, or an existing `integration/*.proto` file, run `yarn proto2bin`
    - You can also leave `yarn watch` running, and it should "just do the right thing"
  - Add/update a `integration/your-new-test/some-test.ts` unit test, even if it's as trivial as just making sure the generated code compiles
- Modify the `ts-proto` code generation logic:
  - Most important logic is found in [src/main.ts](src/main.ts).
  - After any changes to `src/*.ts` files, run `yarn proto2ts` to re-codegen all integration tests
    - Or `yarn proto2ts your-new-test` to re-codegen a specific test
    - Again leaving `yarn watch` running should "just do the right thing"
- Run `yarn test` to verify your changes pass all existing tests
- Commit and submit a PR
  - Run `yarn format` to format the typescript files.
  - Make sure to `git add` all of the `*.proto`, `*.bin`, and `*.ts` files in `integration/your-new-test`
    - Sometimes checking in generated code is frowned upon, but given ts-proto's main job is to generate code, seeing the codegen diffs in PRs is helpful

**Testing in your projects**

You can test your local ts-proto changes in your own projects by running `yarn add ts-proto@./path/to/ts-proto`, as long as you run `yarn build` manually.

**Dockerized Protoc**

The repository includes a dockerized version of `protoc`, which is configured in [docker-compose.yml](docker-compose.yml).

It can be useful in case you want to manually invoke the plugin with a known version of `protoc`.

Usage:

```bash
# Include the protoc alias in your shell.
. aliases.sh

# Run protoc as usual. The ts-proto directory is available in /ts-proto.
protoc --plugin=/ts-proto/protoc-gen-ts_proto --ts_proto_out=./output -I=./protos ./protoc/*.proto

# Or use the ts-protoc alias which specifies the plugin path for you.
ts-protoc --ts_proto_out=./output -I=./protos ./protoc/*.proto
```

- All paths must be relative paths _within_ the current working directory of the host. `../` is not allowed
- Within the docker container, the absolute path to the project root is `/ts-proto`
- The container mounts the current working directory in `/host`, and sets it as its working directory.
- Once `aliases.sh` is sourced, you can use the `protoc` command in any folder.

# Assumptions

- TS/ES6 module name is the proto package

# Todo

- Support the string-based encoding of duration in `fromJSON`/`toJSON`
- Make `oneof=unions-value` the default behavior in 2.0
- Probably change `forceLong` default in 2.0, should default to `forceLong=long`
- Make `esModuleInterop=true` the default in 2.0

# OneOf Handling

By default, ts-proto models `oneof` fields "flatly" in the message, e.g. a message like:

```protobuf
message Foo {
  oneof either_field { string field_a = 1; string field_b = 2; }
}
```

Will generate a `Foo` type with two fields: `field_a: string | undefined;` and `field_b: string | undefined`.

With this output, you'll have to check both `if object.field_a` and `if object.field_b`, and if you set one, you'll have to remember to unset the other.

Instead, we recommend using the `oneof=unions-value` option, which will change the output to be an Algebraic Data Type/ADT like:

```typescript
interface YourMessage {
  eitherField?: { $case: "field_a"; value: string } | { $case: "field_b"; value: string };
}
```

As this will automatically enforce only one of `field_a` or `field_b` "being set" at a time, because the values are stored in the `eitherField` field that can only have a single value at a time.

(Note that `eitherField` is optional b/c `oneof` in Protobuf means "at most one field" is set, and does not mean one of the fields _must_ be set.)

In ts-proto's currently-unscheduled 2.x release, `oneof=unions-value` will become the default behavior.

There is also a `oneof=unions` option, which generates a union where the field names are included in each option:

```typescript
interface YourMessage {
  eitherField?: { $case: "field_a"; field_a: string } | { $case: "field_b"; field_b: string };
}
```

This is no longer recommended as it can be difficult to write code and types to handle multiple oneof options:

## OneOf Type Helpers

The following helper types may make it easier to work with the types generated from `oneof=unions`, though they are generally not needed if you use `oneof=unions-value`:

```ts
/** Extracts all the case names from a oneOf field. */
type OneOfCases<T> = T extends { $case: infer U extends string } ? U : never;

/** Extracts a union of all the value types from a oneOf field */
type OneOfValues<T> = T extends { $case: infer U extends string; [key: string]: unknown } ? T[U] : never;

/** Extracts the specific type of a oneOf case based on its field name */
type OneOfCase<T, K extends OneOfCases<T>> = T extends {
  $case: K;
  [key: string]: unknown;
}
  ? T
  : never;

/** Extracts the specific type of a value type from a oneOf field */
type OneOfValue<T, K extends OneOfCases<T>> = T extends {
  $case: infer U extends K;
  [key: string]: unknown;
}
  ? T[U]
  : never;
```

For comparison, the equivalents for `oneof=unions-value`:

```ts
/** Extracts all the case names from a oneOf field. */
type OneOfCases<T> = T['$case'];

/** Extracts a union of all the value types from a oneOf field */
type OneOfValues<T> = T['value'];

/** Extracts the specific type of a oneOf case based on its field name */
type OneOfCase<T, K extends OneOfCases<T>> = T extends {
  $case: K;
  [key: string]: unknown;
}
  ? T
  : never;

/** Extracts the specific type of a value type from a oneOf field */
type OneOfValue<T, K extends OneOfCases<T>> = T extends {
  $case: infer U extends K;
  value: unknown;
}
  ? T[U]
  : never;
```

# Default values and unset fields

In core Protobuf (and so also `ts-proto`), values that are _unset_ or equal to the default value are not sent over the wire.

For example, the default value of a message is `undefined`. Primitive types take their natural default value, e.g. `string` is `''`, `number` is `0`, etc.

Protobuf chose/enforces this behavior because it enables forward compatibility, as primitive fields will always have a value, even when omitted by outdated agents.

This is good, but it also means _default_ and _unset_ values cannot be distinguished in `ts-proto` fields; it's just fundamentally how Protobuf works.

If you need primitive fields where you can detect set/unset, see [Wrapper Types](#wrapper-types).

**Encode / Decode**

`ts-proto` follows the Protobuf rules, and always returns default values for unsets fields when decoding, while omitting them from the output when serialized in binary format.

```protobuf
syntax = "proto3";
message Foo {
  string bar = 1;
}
```

```typescript
protobufBytes; // assume this is an empty Foo object, in protobuf binary format
Foo.decode(protobufBytes); // => { bar: '' }
```

```typescript
Foo.encode({ bar: "" }); // => { }, writes an empty Foo object, in protobuf binary format
```

**fromJSON / toJSON**

Reading JSON will also initialize the default values. Since senders may either omit unset fields, or set them to the default value, use `fromJSON` to normalize the input.

```typescript
Foo.fromJSON({}); // => { bar: '' }
Foo.fromJSON({ bar: "" }); // => { bar: '' }
Foo.fromJSON({ bar: "baz" }); // => { bar: 'baz' }
```

When writing JSON, `ts-proto` normalizes messages by omitting unset fields and fields set to their default values.

```typescript
Foo.toJSON({}); // => { }
Foo.toJSON({ bar: undefined }); // => { }
Foo.toJSON({ bar: "" }); // => { } - note: omitting the default value, as expected
Foo.toJSON({ bar: "baz" }); // => { bar: 'baz' }
```

# Well-Known Types

Protobuf comes with several predefined message definitions, called "[Well-Known Types](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf)".
Their interpretation is defined by the Protobuf specification, and libraries are expected to convert these messages to corresponding native types in the target language.

`ts-proto` currently automatically converts these messages to their corresponding native types.

- [google.protobuf.BoolValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#boolvalue) &lrarr; `boolean`
- [google.protobuf.BytesValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#bytesvalue) &lrarr; `Uint8Array`
- [google.protobuf.DoubleValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#doublevalue) &lrarr; `number`
- [google.protobuf.FieldMask](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#fieldmask) &lrarr; `string[]`
- [google.protobuf.FloatValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#floatvalue) &lrarr; `number`
- [google.protobuf.Int32Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#int32value) &lrarr; `number`
- [google.protobuf.Int64Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#int64value) &lrarr; `number`
- [google.protobuf.ListValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#listvalue) &lrarr; `any[]`
- [google.protobuf.UInt32Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#uint32value) &lrarr; `number`
- [google.protobuf.UInt64Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#uint64value) &lrarr; `number`
- [google.protobuf.StringValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#stringvalue) &lrarr; `string`
- [google.protobuf.Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#value) &lrarr; `any` (i.e. `number | string | boolean | null | array | object`)
- [google.protobuf.Struct](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#struct) &lrarr; `{ [key: string]: any }`

## Wrapper Types

Wrapper Types are messages containing a single primitive field, and can be imported in `.proto` files with `import "google/protobuf/wrappers.proto"`.

Since these are _messages_, their default value is `undefined`, allowing you to distinguish unset primitives from their default values, when using Wrapper Types.
`ts-proto` generates these fields as `<primitive> | undefined`.

For example:

```protobuf
// Protobuf
syntax = "proto3";

import "google/protobuf/wrappers.proto";

message ExampleMessage {
  google.protobuf.StringValue name = 1;
}
```

```typescript
// TypeScript
interface ExampleMessage {
  name: string | undefined;
}
```

When encoding a message the primitive value is converted back to its corresponding wrapper type:

```typescript
ExampleMessage.encode({ name: "foo" }); // => { name: { value: 'foo' } }, in binary
```

When calling toJSON, the value is not converted, because wrapper types are idiomatic in JSON.

```typescript
ExampleMessage.toJSON({ name: "foo" }); // => { name: 'foo' }
```

## JSON Types (Struct Types)

Protobuf's language and types are not sufficient to represent all possible JSON values, since JSON may contain values whose type is unknown in advance.
For this reason, Protobuf offers several additional types to represent arbitrary JSON values.

These are called Struct Types, and can be imported in `.proto` files with `import "google/protobuf/struct.proto"`.

- [google.protobuf.Value](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#Value) &lrarr; `any`
  - This is the most general type, and can represent any JSON value (i.e. `number | string | boolean | null | array | object`).
- [google.protobuf.ListValue](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#ListValue) &lrarr; `any[]`
  - To represent a JSON array
- [google.protobuf.Struct](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#Struct) &lrarr; `{ [key: string]: any }`
  - To represent a JSON object

`ts-proto` automatically converts back and forth between these Struct Types and their corresponding JSON types.

Example:

```protobuf
// Protobuf
syntax = "proto3";

import "google/protobuf/struct.proto";

message ExampleMessage {
  google.protobuf.Value anything = 1;
}
```

```typescript
// TypeScript
interface ExampleMessage {
  anything: any | undefined;
}
```

Encoding a JSON value embedded in a message, converts it to a Struct Type:

```typescript
ExampleMessage.encode({ anything: { name: "hello" } });
/* Outputs the following structure, encoded in protobuf binary format:
{
  anything: Value {
    structValue = Struct {
      fields = [
        MapEntry {
          key = "name",
          value = Value {
            stringValue = "hello"
          }
        ]
      }
    }
 }
}*/

ExampleMessage.encode({ anything: true });
/* Outputs the following structure encoded in protobuf binary format:
{
  anything: Value {
    boolValue = true
  }
}*/
```

## Timestamp

The representation of `google.protobuf.Timestamp` is configurable by the `useDate` flag.
The `useJsonTimestamp` flag controls precision when `useDate` is `false`.

| Protobuf well-known type    | Default/`useDate=true` | `useDate=false`                      | `useDate=string` | `useDate=string-nano` |
| --------------------------- | ---------------------- | ------------------------------------ | ---------------- | --------------------- |
| `google.protobuf.Timestamp` | `Date`                 | `{ seconds: number, nanos: number }` | `string`         | `string`              |

When using `useDate=false` and `useJsonTimestamp=raw` timestamp is represented as `{ seconds: number, nanos: number }`, but has nanosecond precision.

When using `useDate=string-nano` timestamp is represented as an ISO string with nanosecond precision `1970-01-01T14:27:59.987654321Z` and relies on [nano-date](https://www.npmjs.com/package/nano-date) library for conversion. You'll need to install it in your project.

# Number Types

Numbers are by default assumed to be plain JavaScript `number`s.

This is fine for Protobuf types like `int32` and `float`, but 64-bit types like `int64` can't be 100% represented by JavaScript's `number` type, because `int64` can have larger/smaller values than `number`.

ts-proto's default configuration (which is `forceLong=number`) is to still use `number` for 64-bit fields, and then throw an error if a value (at runtime) is larger than `Number.MAX_SAFE_INTEGER`.

If you expect to use 64-bit / higher-than-`MAX_SAFE_INTEGER` values, then you can use the ts-proto `forceLong` option, which uses the [long](https://www.npmjs.com/package/long) npm package to support the entire range of 64-bit values.

The protobuf number types map to JavaScript types based on the `forceLong` config option:

| Protobuf number types | Default/`forceLong=number` | `forceLong=long` | `forceLong=string` |
| --------------------- | -------------------------- | ---------------- | ------------------ |
| double                | number                     | number           | number             |
| float                 | number                     | number           | number             |
| int32                 | number                     | number           | number             |
| int64                 | number\*                   | Long             | string             |
| uint32                | number                     | number           | number             |
| uint64                | number\*                   | Unsigned Long    | string             |
| sint32                | number                     | number           | number             |
| sint64                | number\*                   | Long             | string             |
| fixed32               | number                     | number           | number             |
| fixed64               | number\*                   | Unsigned Long    | string             |
| sfixed32              | number                     | number           | number             |
| sfixed64              | number\*                   | Long             | string             |

Where (\*) indicates they might throw an error at runtime.

# Current Status of Optional Values

- Required primitives: use as-is, i.e. `string name = 1`.
- Optional primitives: use wrapper types, i.e. `StringValue name = 1`.
- Required messages: not available
- Optional messages: use as-is, i.e. `SubMessage message = 1`.
