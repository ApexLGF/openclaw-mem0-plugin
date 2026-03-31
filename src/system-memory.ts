/**
 * System Memory Loader
 *
 * Loads a user-specified Markdown file into the system_knowledge memory layer.
 * Contents are synced to Mem0 on plugin startup, using a content hash stored
 * in a local file to avoid redundant writes when the file hasn't changed.
 *
 * The system_knowledge layer is read-only for agents — they can search it
 * but cannot write to it via tools. Only the file owner controls its content.
 */

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, basename, resolve as pathResolve } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, AddOptions } from "./types.js";
import { Namespace } from "./namespace.js";

/**
 * Compute SHA-256 hash of content for change detection.
 */
function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Get the path for the local hash cache file.
 * Stored alongside the system memory file as `.{filename}.hash`.
 */
function hashFilePath(systemMemoryPath: string): string {
  const dir = dirname(systemMemoryPath);
  const name = basename(systemMemoryPath);
  return pathResolve(dir, `.${name}.hash`);
}

/**
 * Split markdown content into chunks suitable for Mem0 ingestion.
 * Splits by ## headers; chunks without headers are grouped as one block.
 */
function splitIntoChunks(content: string): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") && current.length > 0) {
      const text = current.join("\n").trim();
      if (text) chunks.push(text);
      current = [line];
    } else {
      current.push(line);
    }
  }

  const last = current.join("\n").trim();
  if (last) chunks.push(last);

  return chunks;
}

/**
 * Load system memory file and sync to Mem0's system_knowledge layer.
 *
 * Strategy:
 * 1. Read file, compute content hash
 * 2. Compare against locally cached hash (stored in .{filename}.hash)
 * 3. If hash unchanged → skip (no API calls)
 * 4. If hash changed → delete old system memories, add new chunks, save hash
 */
export async function loadSystemMemory(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
): Promise<void> {
  if (!cfg.systemMemoryFile) return;

  // Use OpenClaw's resolvePath to resolve relative to workspace/config dir
  const filePath = api.resolvePath(cfg.systemMemoryFile);
  let content: string;

  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    api.logger.warn(
      `openclaw-mem0-plugin: system memory file not found: ${filePath}`,
    );
    return;
  }

  content = content.trim();
  if (!content) {
    api.logger.info("openclaw-mem0-plugin: system memory file is empty, skipping");
    return;
  }

  const hash = contentHash(content);
  const hashFile = hashFilePath(filePath);
  const systemUserId = Namespace.SYSTEM; // "system_knowledge"

  // Check local hash cache for change detection
  try {
    const cachedHash = (await readFile(hashFile, "utf-8")).trim();
    if (cachedHash === hash) {
      api.logger.info(
        `openclaw-mem0-plugin: system memory unchanged (hash: ${hash}), skipping sync`,
      );
      return;
    }
    api.logger.info(
      `openclaw-mem0-plugin: system memory changed (${cachedHash} → ${hash}), re-syncing`,
    );
  } catch {
    // No cached hash — first time load
    api.logger.info(
      `openclaw-mem0-plugin: system memory first load (hash: ${hash})`,
    );
  }

  // Delete existing system memories before re-adding
  try {
    const existing = await provider.getAll({
      user_id: systemUserId,
      page_size: 1000,
    });
    if (existing.length > 0) {
      let deleted = 0;
      const failed: string[] = [];
      for (const mem of existing) {
        try {
          await provider.delete(mem.id);
          deleted++;
        } catch (err) {
          failed.push(mem.id);
          api.logger.warn(
            `openclaw-mem0-plugin: failed to delete system memory ${mem.id}: ${String(err)}`,
          );
        }
      }
      api.logger.info(
        `openclaw-mem0-plugin: cleaned up ${deleted}/${existing.length} old system memories${failed.length > 0 ? ` (${failed.length} failed: ${failed.join(", ")})` : ""}`,
      );
    }
  } catch (err) {
    api.logger.warn(
      `openclaw-mem0-plugin: failed to list existing system memories: ${String(err)}`,
    );
  }

  // Split content and add each chunk
  const chunks = splitIntoChunks(content);
  const addOpts: AddOptions = { user_id: systemUserId };
  if (cfg.mode === "platform") {
    addOpts.output_format = "v1.1";
  }

  let totalAdded = 0;
  for (const chunk of chunks) {
    try {
      const result = await provider.add(
        [{ role: "user", content: chunk }],
        addOpts,
      );
      const count = result.results?.length ?? 0;
      totalAdded += count;
    } catch (err) {
      api.logger.warn(
        `openclaw-mem0-plugin: failed to add system memory chunk: ${String(err)}`,
      );
    }
  }

  // Save hash to local file only after successful add
  try {
    await writeFile(hashFile, hash, "utf-8");
  } catch (err) {
    api.logger.warn(
      `openclaw-mem0-plugin: failed to save hash cache: ${String(err)}`,
    );
  }

  api.logger.info(
    `openclaw-mem0-plugin: loaded system memory — ${chunks.length} chunks, ${totalAdded} memories extracted (hash: ${hash})`,
  );
}
