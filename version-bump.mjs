import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];
const minAppVersion = process.argv[3];

// read minAppVersion from manifest.json if not provided
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion: currentMinAppVersion } = manifest;
if (!minAppVersion && !currentMinAppVersion) {
    console.error("Please provide minAppVersion");
    process.exit(1);
}

// update manifest.json
if (targetVersion) {
    manifest.version = targetVersion;
    writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));
}

// update versions.json (create if not exists)
let versions = {};
try {
    versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (e) {}

const newMinAppVersion = minAppVersion || currentMinAppVersion;

if (targetVersion && newMinAppVersion) {
    versions[targetVersion] = newMinAppVersion;
    writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
}
