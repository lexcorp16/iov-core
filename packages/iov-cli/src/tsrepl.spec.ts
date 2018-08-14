import { join } from "path";

import { TsRepl } from "./tsrepl";

const tsConfigPath = join(__dirname, "..", "tsconfig_repl.json");

describe("TsRepl", () => {
  it("can be constructed", () => {
    const noCode = new TsRepl(tsConfigPath, "");
    expect(noCode).toBeTruthy();

    const jsCode = new TsRepl(tsConfigPath, "const a = 'foo'");
    expect(jsCode).toBeTruthy();

    const tsCode = new TsRepl(tsConfigPath, "const a: string = 'foo'");
    expect(tsCode).toBeTruthy();
  });
});
