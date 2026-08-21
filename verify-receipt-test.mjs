import fs from "node:fs";
import path from "node:path";
import { verifyReceipt } from "./src/receipt-verifier.mjs";

const directory = "./examples/conformance/receipt";

const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort();

let passed = 0;
let failed = 0;

for (const file of files) {
    const filePath = path.join(directory, file);
    const vector = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const actual = verifyReceipt(vector);

    if (JSON.stringify(actual) === JSON.stringify(vector.expected)) {
        console.log(`PASS ${file} (${vector.name})`);
        passed++;
    } else {
        console.log(`FAIL ${file} (${vector.name})`);
        console.log("  Expected:", vector.expected);
        console.log("  Actual:  ", actual);
        failed++;
    }
}

console.log("");
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}