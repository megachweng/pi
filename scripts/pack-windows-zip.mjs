#!/usr/bin/env node

// Builds .artifacts/pi-win32-x64.zip: a folder that runs pi on Windows x64 with
// only Node.js installed. It holds the built packages, their production
// dependencies at the versions of the reviewed install lock, and pi.cmd.
// Run from the repository root with: npm run pack:windows

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execNpmSync } from "./npm-command.mjs";
import { produceArtifactSet } from "./package-artifacts.mjs";

const workspaceScope = "@earendil-works/";
const repoRoot = process.cwd();
const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
if (rootPackageJson.name !== "pi-monorepo") throw new Error("Run this script from the repository root");

const outDir = join(repoRoot, ".artifacts", "pi-win32-x64");
const appDir = join(outDir, "pi");
const zipPath = join(repoRoot, ".artifacts", "pi-win32-x64.zip");

// Offline build: a normal build regenerates the tracked model data from the network.
const artifactSet = produceArtifactSet({
	force: true,
	offlineModelData: true,
	outDir: join(outDir, "artifacts"),
	repoRoot,
});

// Install from the install lock, with the workspace packages taken from the
// tarballs packed above instead of the registry.
mkdirSync(appDir, { recursive: true });
const lockDir = join(repoRoot, "packages", "coding-agent", "install-lock");
copyFileSync(join(lockDir, "package.json"), join(appDir, "package.json"));
const lock = JSON.parse(readFileSync(join(lockDir, "package-lock.json"), "utf8"));
for (const [path, entry] of Object.entries(lock.packages)) {
	const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
	if (!name.startsWith(workspaceScope)) continue;
	const artifact = artifactSet.getPackage(name);
	entry.resolved = pathToFileURL(artifact.tarballPath).href;
	entry.integrity = artifact.integrity;
}
writeFileSync(join(appDir, "package-lock.json"), JSON.stringify(lock, null, "\t"));
// --os and --cpu select optional native packages for the target, not for this machine.
execNpmSync(["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", "--os=win32", "--cpu=x64"], {
	cwd: appDir,
	stdio: "inherit",
});

// After the install these files only record tarball paths of this machine.
rmSync(join(appDir, "package.json"));
rmSync(join(appDir, "package-lock.json"));
rmSync(join(appDir, "node_modules", ".package-lock.json"));
rmSync(join(appDir, "node_modules", ".bin"), { force: true, recursive: true });
// Native add-ons for other systems are never loaded on Windows.
for (const platform of ["darwin", "linux"]) {
	rmSync(join(appDir, "node_modules", "@earendil-works", "pi-tui", "native", platform), { recursive: true });
}

const crlf = (lines) => `${lines.join("\r\n")}\r\n`;
writeFileSync(
	join(appDir, "pi.cmd"),
	crlf([
		"@echo off",
		"rem Runs pi from this folder. Needs Node.js 22.19 or newer on PATH.",
		"rem pi looks for rg.exe and fd.exe on PATH. If they are elsewhere, remove",
		"rem the two rem prefixes below and set the paths.",
		"setlocal",
		'set "PI_OFFLINE=1"',
		'rem set "PI_RG_PATH=C:\\path\\to\\rg.exe"',
		'rem set "PI_FD_PATH=C:\\path\\to\\fd.exe"',
		'node "%~dp0node_modules\\@earendil-works\\pi-coding-agent\\dist\\bundle\\cli.js" %*',
	]),
);
writeFileSync(
	join(appDir, "README.txt"),
	crlf([
		`pi ${lock.version} for Windows x64`,
		"",
		"1. Install Node.js 22.19 or newer.",
		"2. If the zip was downloaded or mailed: Properties > Unblock, then unzip.",
		"   Unzip to a short path, for example C:\\tools\\pi.",
		"3. Put rg.exe (ripgrep) and fd.exe on PATH, or set their paths in pi.cmd.",
		"4. Run pi.cmd from Windows Terminal.",
		"5. On first start, run /login or configure a provider. No keys are included.",
		"",
		"Git for Windows provides the Bash that pi uses for commands.",
	]),
);

rmSync(zipPath, { force: true });
// Windows ships bsdtar, which writes zip archives; other systems have zip.
if (process.platform === "win32") {
	execFileSync("tar", ["-a", "-c", "-f", zipPath, "-C", outDir, "pi"], { stdio: "inherit" });
} else {
	execFileSync("zip", ["-q", "-r", "-X", zipPath, "pi"], { cwd: outDir, stdio: "inherit" });
}
console.log(`\nCreated ${zipPath}`);
