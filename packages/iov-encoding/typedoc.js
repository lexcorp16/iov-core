const packageJson = require("./package.json");

module.exports = {
  src: ["./src"],
  out: "docs",
  exclude: "**/*.spec.ts",
  target: "es6",
  name: `${packageJson.name} Documentation`,
  readme: "none",
  mode: "file",
  excludePrivate: true,
  excludeNotExported: true,
  ignoreCompilerErrors: true,
}