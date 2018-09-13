import { Foo, IFoo, secureFoo } from "./secureWrap";

describe("Verify we don't leak secrets", () => {
  const validateFunctionality = (foo: IFoo, shared: string, secret: string) => {
    expect(foo.isSecret(shared)).toBe(false);
    expect(foo.isSecret(secret)).toBe(true);
    expect(foo.shared).toEqual(shared);
  };

  it("Can access fields of original variable", () => {
    const foo = new Foo("Public", "Private");

    validateFunctionality(foo, "Public", "Private");
    const stolen: any = (foo as any).secret;
    expect(stolen).toEqual("Private");
  });

  it("Cannot access secret of wrapped variable", () => {
    const foo = new Foo("Public", "Private");
    const secure = secureFoo(foo);

    validateFunctionality(secure, "Public", "Private");
    const stolen: any = (secure as any).secret;
    expect(stolen).toEqual(undefined);
  });
});
