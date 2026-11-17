/// <reference types="node" />
/** @vitest-environment node */

import { readFileSync } from "node:fs";
import { compile } from "tailwindcss";
import { expect, it } from "vitest";

it("gates hover styles in the keyboard question area without gating keyboard focus", async () => {
  const styles = readFileSync(
    new URL("../../../../main.css", import.meta.url),
    "utf8",
  );
  const variant = styles.slice(
    styles.indexOf("@custom-variant hover"),
    styles.indexOf("@theme inline"),
  );
  const compiler = await compile(`@tailwind utilities;\n${variant}`);
  const hover = compiler.build(["hover:bg-[red]"]);
  expect(hover).toContain("@media (hover: hover)");
  expect(hover).toContain(
    ":hover:where(:not([data-question-keyboard], [data-question-keyboard] *))",
  );
  const focusCompiler = await compile(`@tailwind utilities;\n${variant}`);
  const focus = focusCompiler.build(["focus-visible:bg-[blue]"]);
  expect(focus).toContain(":focus-visible");
  expect(focus).not.toContain("data-question-keyboard");
});
