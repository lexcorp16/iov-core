import { Foo, IFoo, secureFoo } from "./secureWrap";

describe("Verify we don't leak secrets", () => {
  const validateFunctionality = (foo: IFoo, shared: string, secret: string) => {
    expect(foo.isSecret(shared)).toBe(false);
    expect(foo.isSecret(secret)).toBe(true);
    expect(foo.shared).toEqual(shared);
    // force a write and see we got it
    // tslint:disable-next-line:no-object-mutation
    (foo as any).shared = "new";
    expect(foo.shared).toEqual("new");
  };

  it("Can access fields of original variable", () => {
    const foo = new Foo("Public", "Private");
    validateFunctionality(foo, "Public", "Private");

    const stolen: any = (foo as any).secret;
    expect(stolen).toEqual("Private");
    // this was reset in validate functionality
    expect(foo.shared).toEqual("new");
  });

  it("Cannot access secret of wrapped variable", () => {
    const foo = new Foo("Public", "Private");
    const secure = secureFoo(foo);
    validateFunctionality(secure, "Public", "Private");

    const stolen: any = (secure as any).secret;
    expect(stolen).toEqual(undefined);
    // this was reset in validate functionality
    expect(secure.shared).toEqual("new");
    expect(foo.shared).toEqual("new");
  });
});
