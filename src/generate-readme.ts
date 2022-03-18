import path from "path";
import fs from "fs/promises";
import { ChainId } from "./types";
import { getEnumAsArray } from "./helpers";
import { format } from "prettier";

const README_PATH = path.resolve(__dirname, "..", "README.md");

async function main() {
  const content = await fs.readFile(README_PATH, "utf-8");
  const replaced = replace(
    content,
    "versions",
    Array.from(makeVersions()).join("\n")
  );
  const formatted = format(replaced, { parser: "markdown" });
  await fs.writeFile(README_PATH, formatted, "utf-8");
}

main();

function* makeVersions() {
  yield "| Chain | Chain Id | Link | Viewer |";
  yield "| - | -: | - | - |";
  for (const { key, value } of getEnumAsArray(ChainId)) {
    yield `| ${key} | ${value} | [latest][link-${key}] | [token-list][viewer-${key}] |`;
  }
  yield "";
  for (const { key, value } of getEnumAsArray(ChainId)) {
    yield `[link-${key}]: https://tokens.r2d2.to/latest/${value}/tokens.json`;
  }
  for (const { key, value } of getEnumAsArray(ChainId)) {
    yield `[viewer-${key}]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/${value}/tokens.json`;
  }
}

function replace(content: string, name: string, replaced: string) {
  const pattern = new RegExp(
    `(<!-- begin ${name} -->)(.+)(<!-- end ${name} -->)`,
    "gs"
  );
  return content.replace(pattern, `$1\n\n${replaced}\n\n$3`);
}
