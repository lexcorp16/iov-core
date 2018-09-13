export interface IFoo {
    readonly shared: string;
    readonly isSecret: (guess: string) => boolean;
}
export declare class Foo {
    readonly shared: string;
    private readonly secret;
    constructor(shared: string, secret: string);
    isSecret(guess: string): boolean;
}
export declare function secureFoo(raw: Foo): IFoo;
