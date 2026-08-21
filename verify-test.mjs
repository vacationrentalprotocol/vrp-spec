import fs from "node:fs";
import { verifyOffer } from "./src/verifier.mjs";

const files = fs
  .readdirSync("./examples/conformance/offer")
  .filter((file) => file.endsWith(".json"))
  .sort();

for (const file of files) {
  const vector = JSON.parse(
    fs.readFileSync(
      `./examples/conformance/offer/${file}`,
      "utf8"
    )
  );

  const actual = verifyOffer(vector);

  const passed =
    actual.verified === vector.expected.verified &&
    actual.fresh === vector.expected.fresh &&
    actual.reason === vector.expected.reason;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${file} (${vector.name})`
  );

  if (!passed) {
    console.log("  Expected:", vector.expected);
    console.log("  Actual:  ", actual);
  }
}