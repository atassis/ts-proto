
- With `--ts_proto_opt=globalThisPolyfill=true`, ts-proto will include a polyfill for globalThis.

  Defaults to `false`, i.e. we assume `globalThis` is available.

- With `--ts_proto_opt=context=true`, the services will have a Go-style `ctx` parameter, which is useful for tracing/logging/etc. if you're not using node's `async_hooks` api due to performance reasons.

- With `--ts_proto_opt=forceLong=long`, all 64-bit numbers will be parsed as instances of `Long` (using the [long](https://www.npmjs.com/package/long) library).

  With `--ts_proto_opt=forceLong=string`, all 64-bit numbers will be output as strings.

  With `--ts_proto_opt=forceLong=bigint`, all 64-bit numbers will be output as `BigInt`s. This option still uses the `long` library to encode/decode internally within `protobuf.js`, but then converts to/from `BigInt`s in the ts-proto-generated code.

  The default behavior is `forceLong=number`, which will internally still use the `long` library to encode/decode values on the wire (so you will still see a `util.Long = Long` line in your output), but will convert the `long` values to `number` automatically for you. Note that a runtime error is thrown if, while doing this conversion, a 64-bit value is larger than can be correctly stored as a `number`.

- With `--ts_proto_opt=useJsTypeOverride`, 64-bit numbers will be ouput as the [FieldOption.JSType](https://protobuf.dev/reference/java/api-docs/com/google/protobuf/DescriptorProtos.FieldOptions.JSType) specified on the field. This takes precendence over the `forceLong` option provided.

- With `--ts_proto_opt=esModuleInterop=true` changes output to be `esModuleInterop` compliant.

  Specifically the `Long` imports will be generated as `import Long from 'long'` instead of `import * as Long from 'long'`.

- With `--ts_proto_opt=env=node` or `browser` or `both`, ts-proto will make environment-specific assumptions in your output. This defaults to `both`, which makes no environment-specific assumptions.

  Using `node` changes the types of `bytes` from `Uint8Array` to `Buffer` for easier integration with the node ecosystem which generally uses `Buffer`.

  Currently `browser` doesn't have any specific behavior other than being "not `node`". It probably will soon/at some point.

- With `--ts_proto_opt=useOptionals=messages` (for message fields) or `--ts_proto_opt=useOptionals=all` (for message and scalar fields), fields are declared as optional keys, e.g. `field?: Message` instead of the default `field: Message | undefined`.

  ts-proto defaults to `useOptionals=none` because it:

    1. Prevents typos when initializing messages, and
    2. Provides the most consistent API to readers
    3. Ensures production messages are properly initialized with all fields.

  For typo prevention, optional fields make it easy for extra fields to slip into a message (until we get [Exact Types](https://github.com/microsoft/TypeScript/issues/12936)), i.e.:

  ```typescript
  interface SomeMessage {
    firstName: string;
    lastName: string;
  }
  // Declared with a typo
  const data = { firstName: "a", lastTypo: "b" };
  // With useOptionals=none, this correctly fails to compile; if `lastName` was optional, it would not
  const message: SomeMessage = { ...data };
  ```

  For a consistent API, if `SomeMessage.lastName` is optional `lastName?`, then readers have to check _two_ empty conditions: a) is `lastName` `undefined` (b/c it was created in-memory and left unset), or b) is `lastName` empty string (b/c we read `SomeMessage` off the wire and, per the proto3 spec, initialized `lastName` to empty string)?

  For ensuring proper initialization, if later `SomeMessage.middleInitial` is added, but it's marked as optional `middleInitial?`, you may have many call sites in production code that _should_ now be passing `middleInitial` to create a valid `SomeMessage`, but are not.

  So, between typo-prevention, reader inconsistency, and proper initialization, ts-proto recommends using `useOptionals=none` as the "most safe" option.

  All that said, this approach does require writers/creators to set every field (although `fromPartial` and `create` are meant to address this), so if you still want to have optional keys, you can set `useOptionals=messages` or `useOptionals=all`.

  (See [this issue](https://github.com/stephenh/ts-proto/issues/120#issuecomment-678375833) and [this issue](https://github.com/stephenh/ts-proto/issues/397#issuecomment-977259118) for discussions on `useOptional`.)

- With `--ts_proto_opt=exportCommonSymbols=false`, utility types like `DeepPartial` and `protobufPackage` won't be `export`d.

  This should make it possible to use create barrel imports of the generated output, i.e. `import * from ./foo` and `import * from ./bar`.

  Note that if you have the same message name used in multiple `*.proto` files, you will still get import conflicts.

- With `--ts_proto_opt=oneof=unions`, `oneof` fields will be generated as ADTs.

  See the "OneOf Handling" section.

- With `--ts_proto_opt=unrecognizedEnumName=<NAME>` enums will contain a key `<NAME>` with value of the `unrecognizedEnumValue` option.

  Defaults to `UNRECOGNIZED`.

- With `--ts_proto_opt=unrecognizedEnumValue=<NUMBER>` enums will contain a key provided by the `unrecognizedEnumName` option with value of `<NUMBER>`.

  Defaults to `-1`.

- With `--ts_proto_opt=unrecognizedEnum=false` enums will not contain an unrecognized enum key and value as provided by the `unrecognizedEnumName` and `unrecognizedEnumValue` options.

- With `--ts_proto_opt=removeEnumPrefix=true` generated enums will have the enum name removed from members.

  `FooBar.FOO_BAR_BAZ = "FOO_BAR_BAZ"` will generate `FooBar.BAZ = "FOO_BAR_BAZ"`

- With `--ts_proto_opt=lowerCaseServiceMethods=true`, the method names of service methods will be lowered/camel-case, i.e. `service.findFoo` instead of `service.FindFoo`.

- With `--ts_proto_opt=snakeToCamel=false`, fields will be kept snake case in both the message keys and the `toJSON` / `fromJSON` methods.

  `snakeToCamel` can also be set as a `_`-delimited list of strings (comma is reserved as the flag delimited), i.e. `--ts_proto_opt=snakeToCamel=keys_json`, where including `keys` will make message keys be camel case and including `json` will make JSON keys be camel case.

  Empty string, i.e. `snakeToCamel=`, will keep both messages keys and `JSON` keys as snake case (it is the same as `snakeToCamel=false`).

  Note that to use the `json_name` attribute, you'll have to use the `json`.

  The default behavior is `keys_json`, i.e. both will be camel cased, and `json_name` will be used if set.

- With `--ts_proto_opt=outputEncodeMethods=false`, the `Message.encode` and `Message.decode` methods for working with protobuf-encoded/binary data will not be output.

  This is useful if you want "only types".

- With `--ts_proto_opt=outputJsonMethods=false`, the `Message.fromJSON` and `Message.toJSON` methods for working with JSON-coded data will not be output.

  This is also useful if you want "only types".

- With `--ts_proto_opt=outputJsonMethods=to-only` and `--ts_proto_opt=outputJsonMethods=from-only` you will be able to export only one between the `Message.toJSON` and `Message.fromJSON` methods.

  This is useful if you're using ts-proto just to `encode` or `decode` and not for both.

- With `--ts_proto_opt=outputPartialMethods=false`, the `Message.fromPartial` and `Message.create` methods for accepting partially-formed objects/object literals will not be output.

- With `--ts_proto_opt=stringEnums=true`, the generated enum types will be string-based instead of int-based.

  This is useful if you want "only types" and are using a gRPC REST Gateway configured to serialize enums as strings.

  (Requires `outputEncodeMethods=false`.)

- With `--ts_proto_opt=outputClientImpl=false`, the client implementations, i.e. `FooServiceClientImpl`, that implement the client-side (in Twirp, see next option for `grpc-web`) RPC interfaces will not be output.

- With `--ts_proto_opt=outputClientImpl=grpc-web`, the client implementations, i.e. `FooServiceClientImpl`, will use the [@improbable-eng/grpc-web](https://github.com/improbable-eng/grpc-web) library at runtime to send grpc messages to a grpc-web backend.

  (Note that this only uses the grpc-web runtime, you don't need to use any of their generated code, i.e. the ts-proto output replaces their `ts-protoc-gen` output.)

  You'll need to add the `@improbable-eng/grpc-web` and a transport to your project's `package.json`; see the `integration/grpc-web` directory for a working example. Also see [#504](https://github.com/stephenh/ts-proto/issues/504) for integrating with [grpc-web-devtools](https://github.com/SafetyCulture/grpc-web-devtools).

- With `--ts_proto_opt=returnObservable=true`, the return type of service methods will be `Observable<T>` instead of `Promise<T>`.

- With`--ts_proto_opt=addGrpcMetadata=true`, the last argument of service methods will accept the grpc `Metadata` type, which contains additional information with the call (i.e. access tokens/etc.).

  (Requires `nestJs=true`.)

- With`--ts_proto_opt=addNestjsRestParameter=true`, the last argument of service methods will be an rest parameter with type any. This way you can use custom decorators you could normally use in nestjs.

  (Requires `nestJs=true`.)

- With `--ts_proto_opt=nestJs=true`, the defaults will change to generate [NestJS protobuf](https://docs.nestjs.com/microservices/grpc) friendly types & service interfaces that can be used in both the client-side and server-side of NestJS protobuf implementations. See the [nestjs readme](NESTJS.markdown) for more information and implementation examples.

  Specifically `outputEncodeMethods`, `outputJsonMethods`, and `outputClientImpl` will all be false, `lowerCaseServiceMethods` will be true and `outputServices` will be ignored.

  Note that `addGrpcMetadata`, `addNestjsRestParameter` and `returnObservable` will still be false.

- With `--ts_proto_opt=useDate=false`, fields of type `google.protobuf.Timestamp` will not be mapped to type `Date` in the generated types. See [Timestamp](#timestamp) for more details.

- With `--ts_proto_opt=useMongoObjectId=true`, fields of a type called ObjectId where the message is constructed to have on field called value that is a string will be mapped to type `mongodb.ObjectId` in the generated types. This will require your project to install the mongodb npm package. See [ObjectId](#objectid) for more details.

- With `--ts_proto_opt=annotateFilesWithVersion=false`, the generated files will not contain the versions of `protoc` and `ts-proto` used to generate the file. This option is normally set to `true`, such that files list the versions used.

- With `--ts_proto_opt=outputSchema=true`, meta typings will be generated that can later be used in other code generators. If outputSchema is instead specified to be `no-file-descriptor` then we do not include the file descriptor in the generated schema. This is useful if you are trying to minimize the size of the generated schema.

- With `--ts_proto_opt=outputTypeAnnotations=true`, each message will be given a `$type` field containing its fully-qualified name. You can use `--ts_proto_opt=outputTypeAnnotations=static-only` to omit it from the `interface` declaration, or `--ts_proto_opt=outputTypeAnnotations=optional` to make it an optional property on the `interface` definition. The latter option may be useful if you want to use the `$type` field for runtime type checking on responses from a server.

- With `--ts_proto_opt=outputTypeRegistry=true`, the type registry will be generated that can be used to resolve message types by fully-qualified name. Also, each message will be given a `$type` field containing its fully-qualified name.

- With `--ts_proto_opt=outputServices=grpc-js`, ts-proto will output service definitions and server / client stubs in [grpc-js](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js) format.

- With `--ts_proto_opt=outputServices=generic-definitions`, ts-proto will output generic (framework-agnostic) service definitions. These definitions contain descriptors for each method with links to request and response types, which allows to generate server and client stubs at runtime, and also generate strong types for them at compile time. An example of a library that uses this approach is [nice-grpc](https://github.com/deeplay-io/nice-grpc).

- With `--ts_proto_opt=outputServices=nice-grpc`, ts-proto will output server and client stubs for [nice-grpc](https://github.com/deeplay-io/nice-grpc). This should be used together with generic definitions, i.e. you should specify two options: `outputServices=nice-grpc,outputServices=generic-definitions`.

- With `--ts_proto_opt=metadataType=Foo@./some-file`, ts-proto add a generic (framework-agnostic) metadata field to the generic service definition.

- With `--ts_proto_opt=outputServices=generic-definitions,outputServices=default`, ts-proto will output both generic definitions and interfaces. This is useful if you want to rely on the interfaces, but also have some reflection capabilities at runtime.

- With `--ts_proto_opt=outputServices=false`, or `=none`, ts-proto will output NO service definitions.

- With `--ts_proto_opt=rpcBeforeRequest=true`, ts-proto will add a function definition to the Rpc interface definition with the signature: `beforeRequest(service: string, message: string, request: <RequestType>)`. It will will also automatically set `outputServices=default`. Each of the Service's methods will call `beforeRequest` before performing it's request.

- With `--ts_proto_opt=rpcAfterResponse=true`, ts-proto will add a function definition to the Rpc interface definition with the signature: `afterResponse(service: string, message: string, response: <ResponseType>)`. It will will also automatically set `outputServices=default`. Each of the Service's methods will call `afterResponse` before returning the response.

- With `--ts_proto_opt=rpcErrorHandler=true`, ts-proto will add a function definition to the Rpc interface definition with the signature: `handleError(service: string, message: string, error: Error)`. It will will also automatically set `outputServices=default`.

- With `--ts_proto_opt=useAbortSignal=true`, the generated services will accept an `AbortSignal` to cancel RPC calls.

- With `--ts_proto_opt=useAsyncIterable=true`, the generated services will use `AsyncIterable` instead of `Observable`.

- With `--ts_proto_opt=emitImportedFiles=false`, ts-proto will not emit `google/protobuf/*` files unless you explicit add files to `protoc` like this
  `protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto my_message.proto google/protobuf/duration.proto`

- With `--ts_proto_opt=fileSuffix=<SUFFIX>`, ts-proto will emit generated files using the specified suffix. A `helloworld.proto` file with `fileSuffix=.pb` would be generated as `helloworld.pb.ts`. This is common behavior in other protoc plugins and provides a way to quickly glob all the generated files.

- With `--ts_proto_opt=importSuffix=<SUFFIX>`, ts-proto will emit file imports using the specified suffix. An import of `helloworld.ts` with `fileSuffix=.js` would generate `import "helloworld.js"`. The default is to import without a file extension. Supported by TypeScript 4.7.x and up.

- With `--ts_proto_opt=enumsAsLiterals=true`, the generated enum types will be enum-ish object with `as const`.

- With `--ts_proto_opt=useExactTypes=false`, the generated `fromPartial` and `create` methods will not use Exact types.

  The default behavior is `useExactTypes=true`, which makes `fromPartial` and `create` use Exact type for its argument to make TypeScript reject any unknown properties.

- With `--ts_proto_opt=unknownFields=true`, all unknown fields will be parsed and output as arrays of buffers.

- With `--ts_proto_opt=onlyTypes=true`, only types will be emitted, and imports for `long` and `protobufjs/minimal` will be excluded.

  This is the same as setting `outputJsonMethods=false,outputEncodeMethods=false,outputClientImpl=false,nestJs=false`

- With `--ts_proto_opt=usePrototypeForDefaults=true`, the generated code will wrap new objects with `Object.create`.

  This allows code to do hazzer checks to detect when default values have been applied, which due to proto3's behavior of not putting default values on the wire, is typically only useful for interacting with proto2 messages.

  When enabled, default values are inherited from a prototype, and so code can use Object.keys().includes("someField") to detect if someField was actually decoded or not.

  Note that, as indicated, this means Object.keys will not include set-by-default fields, so if you have code that iterates over messages keys in a generic fashion, it will have to also iterate over keys inherited from the prototype.

- With `--ts_proto_opt=useJsonName=true`, `json_name` defined in protofiles will be used instead of message field names.

- With `--ts_proto_opt=useJsonWireFormat=true`, the generated code will reflect the JSON representation of Protobuf messages.

  Requires `onlyTypes=true`. Implies `useDate=string` and `stringEnums=true`. This option is to generate types that can be directly used with marshalling/unmarshalling Protobuf messages serialized as JSON.
  You may also want to set `useOptionals=all`, as gRPC gateways are not required to send default value for scalar values.

- With `--ts_proto_opt=useNumericEnumForJson=true`, the JSON converter (`toJSON`) will encode enum values as int, rather than a string literal.

- With `--ts_proto_opt=initializeFieldsAsUndefined=false`, all optional field initializers will be omited from the generated base instances.

- With `--ts_proto_opt=disableProto2Optionals=true`, all optional fields on proto2 files will not be set to be optional. Please note that this flag is primarily for preserving ts-proto's legacy handling of proto2 files, to avoid breaking changes, and as a result, it is not intended to be used moving forward.

- With `--ts_proto_opt=disableProto2DefaultValues=true`, all fields in proto2 files that specify a default value will not actually use that default value. Please note that this flag is primarily for preserving ts-proto's legacy handling of proto2 files, to avoid breaking changes, and as a result, it is not intended to be used moving forward.

- With `--ts_proto_opt=Mgoogle/protobuf/empty.proto=./google3/protobuf/empty`, ('M' means 'importMapping', similar to [protoc-gen-go](https://developers.google.com/protocol-buffers/docs/reference/go-generated#package)), the generated code import path for `./google/protobuf/empty.ts` will reflect the overridden value:

    - `Mfoo/bar.proto=@myorg/some-lib` will map `foo/bar.proto` imports into `import ... from '@myorg/some-lib'`.
    - `Mfoo/bar.proto=./some/local/lib` will map `foo/bar.proto` imports into `import ... from './some/local/lib'`.
    - `Mfoo/bar.proto=some-modules/some-lib` will map `foo/bar.proto` imports into `import ... from 'some-module/some-lib'`.
    - **Note**: Uses are accummulated, so multiple values are expected in the form of `--ts_proto_opt=M... --ts_proto_opt=M...` (one `ts_proto_opt` per mapping).
    - **Note**: Proto files that match mapped imports **will not be generated**.

- With `--ts_proto_opt=useMapType=true`, the generated code for protobuf `map<key_type, value_type>` will become `Map<key_type, value_type>` that uses JavaScript Map type.

  The default behavior is `useMapType=false`, which makes it generate the code for protobuf `map<key_type, value_type` with the key-value pair like `{[key: key_type]: value_type}`.

- With `--ts_proto_opt=useReadonlyTypes=true`, the generated types will be declared as immutable using typescript's `readonly` modifer.

- With `--ts_proto_opt=useSnakeTypeName=false` will remove snake casing from types.

  Example Protobuf

  ```protobuf
  message Box {
      message Element {
            message Image {
                  enum Alignment {
                        LEFT = 1;
                        CENTER = 2;
                        RIGHT = 3;
                  }
            }
        }
  }
  ```

  by default this is enabled which would generate a type of `Box_Element_Image_Alignment`. By disabling this option the type that is generated would be `BoxElementImageAlignment`.

- With `--ts_proto_opt=outputExtensions=true`, the generated code will include proto2 extensions

  Extension encode/decode methods are compliant with the `outputEncodeMethods` option, and if `unknownFields=true`,
  the `setExtension` and `getExtension` methods will be created for extendable messages, also compliant with `outputEncodeMethods` (setExtension = encode, getExtension = decode).

- With `--ts_proto_opt=outputIndex=true`, index files will be generated based on the proto package namespaces.

  This will disable `exportCommonSymbols` to avoid name collisions on the common symbols.

- With `--ts_proto_opt=emitDefaultValues=json-methods`, the generated toJSON method will emit scalars like `0` and `""` as json fields.

- With `--ts_proto_opt=comments=false`, comments won't be copied from the proto files to the generated code.

- With `--ts_proto_opt=bigIntLiteral=false`, the generated code will use `BigInt("0")` instead of `0n` for BigInt literals. BigInt literals aren't supported by TypeScript when the "target" compiler option set to something older than "ES2020".

- With `--ts_proto_opt=useNullAsOptional=true`, `undefined` values will be converted to `null`, and if you use `optional` label in your `.proto` file, the field will have `undefined` type as well. for example:

- With `--ts_proto_opt=typePrefix=MyPrefix`, the generated interfaces, enums, and factories will have a prefix of `MyPrefix` in their names.

- With `--ts_proto_opt=typeSuffix=MySuffix`, the generated interfaces, enums, and factories will have a suffix of `MySuffix` in their names.

```protobuf
message ProfileInfo {
    int32 id = 1;
    string bio = 2;
    string phone = 3;
}

message Department {
    int32 id = 1;
    string name = 2;
}

message User {
    int32 id = 1;
    string username = 2;
    /*
     ProfileInfo will be optional in typescript, the type will be ProfileInfo | null | undefined
     this is needed in cases where you don't wanna provide any value for the profile.
    */
    optional ProfileInfo profile = 3;

    /*
      Department only accepts a Department type or null, so this means you have to pass it null if there is no value available.
    */
    Department  department = 4;
}
```

the generated interfaces will be:

```typescript
export interface ProfileInfo {
  id: number;
  bio: string;
  phone: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  profile?: ProfileInfo | null | undefined; // check this one
  department: Department | null; // check this one
}
```

- With `--ts_proto_opt=noDefaultsForOptionals=true`, `undefined` primitive values will not be defaulted as per the protobuf spec. Additionally unlike the standard behavior, when a field is set to it's standard default value, it *will* be encoded allowing it to be sent over the wire and distinguished from undefined values. For example if a message does not set a boolean value, ordinarily this would be defaulted to `false` which is different to it being undefined.

This option allows the library to act in a compatible way with the [Wire implementation](https://square.github.io/wire/) maintained and used by Square/Block. Note: this option should only be used in combination with other client/server code generated using Wire or ts-proto with this option enabled.
