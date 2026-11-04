import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";
import { findTool } from "../src/utils/tools-manager.ts";

const isWindows = process.platform === "win32";

describe("findTool", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pi-find-tool-"));
		vi.stubEnv("PATH", tempDir);
		vi.stubEnv("PI_FD_PATH", "");
		vi.stubEnv("PI_RG_PATH", "");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		rmSync(tempDir, { recursive: true, force: true });
	});

	// A stand-in for a real tool: spawnSync runs it without a shell, as the grep and find tools do.
	function writeExecutable(path: string, exitCode = 0): string {
		writeFileSync(path, `#!/bin/sh\nexit ${exitCode}\n`);
		chmodSync(path, 0o755);
		return path;
	}

	it("reports how to configure a tool that is not installed", () => {
		expect(findTool("rg")).toEqual({
			type: "missing",
			message: "ripgrep not found. Set PI_RG_PATH to its executable or add it to PATH.",
		});
		expect(findTool("fd")).toEqual({
			type: "missing",
			message: "fd not found. Set PI_FD_PATH to its executable or add it to PATH.",
		});
	});

	it("does not touch the network when a tool is missing", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		findTool("rg");
		findTool("fd");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not run a binary an earlier version downloaded into the agent bin directory", () => {
		const binDir = join(tempDir, "agent", "bin");
		mkdirSync(binDir, { recursive: true });
		writeExecutable(join(binDir, isWindows ? "rg.exe" : "rg"));
		vi.stubEnv(ENV_AGENT_DIR, join(tempDir, "agent"));

		expect(findTool("rg").type).toBe("missing");
	});

	it.skipIf(isWindows)("uses the executables named by the environment variables", () => {
		const rgPath = writeExecutable(join(tempDir, "my-rg"));
		const fdPath = writeExecutable(join(tempDir, "my-fd"));
		vi.stubEnv("PI_RG_PATH", rgPath);
		vi.stubEnv("PI_FD_PATH", fdPath);

		expect(findTool("rg")).toEqual({ type: "found", path: rgPath });
		expect(findTool("fd")).toEqual({ type: "found", path: fdPath });
	});

	it.skipIf(isWindows)("prefers the environment variable over PATH", () => {
		writeExecutable(join(tempDir, "rg"));
		const rgPath = writeExecutable(join(tempDir, "my-rg"));
		vi.stubEnv("PI_RG_PATH", rgPath);

		expect(findTool("rg")).toEqual({ type: "found", path: rgPath });
	});

	it.skipIf(isWindows)("does not fall back to PATH when the configured path cannot be run", () => {
		writeExecutable(join(tempDir, "rg"));
		const rgPath = join(tempDir, "missing-rg");
		vi.stubEnv("PI_RG_PATH", rgPath);

		expect(findTool("rg")).toEqual({
			type: "missing",
			message: expect.stringContaining(`PI_RG_PATH is set to ${rgPath}, but it cannot be run:`),
		});
	});

	it.skipIf(isWindows)("rejects a configured executable that exits with an error", () => {
		const fdPath = writeExecutable(join(tempDir, "broken-fd"), 3);
		vi.stubEnv("PI_FD_PATH", fdPath);

		expect(findTool("fd")).toEqual({
			type: "missing",
			message: `PI_FD_PATH is set to ${fdPath}, but it exited with status 3`,
		});
	});

	it.skipIf(isWindows)("finds commands on PATH, including fd's Debian name", () => {
		writeExecutable(join(tempDir, "rg"));
		writeExecutable(join(tempDir, "fdfind"));

		expect(findTool("rg")).toEqual({ type: "found", path: "rg" });
		expect(findTool("fd")).toEqual({ type: "found", path: "fdfind" });
	});
});
