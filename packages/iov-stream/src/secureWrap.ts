/*
TODO: this needs to move somewhere else...
but this was the closest to a Util package, so....

Motivation is https://github.com/iov-one/iov-core/issues/336
To not accidentally expose objects at UI boundaries
*/

// tslint:disable-next-line:interface-name
export interface IFoo {
  readonly shared: string;
  readonly isSecret: (guess: string) => boolean;
}

export class Foo {
  public readonly shared: string;
  private readonly secret: string;

  constructor(shared: string, secret: string) {
    this.shared = shared;
    this.secret = secret;
  }

  public isSecret(guess: string): boolean {
    return guess === this.secret;
  }
}

// the output cannot leak secret, even if we force the type systems
export function secureFoo(raw: Foo): IFoo {
  return {
    get shared(): string {
      return raw.shared;
    },
    // set is not needed for readonly variables...
    set shared(val: string) {
      // tslint:disable-next-line:no-object-mutation
      (raw as any).shared = val;
    },
    isSecret: raw.isSecret.bind(raw),
  };
}
