import type { Mem0Provider, Mem0Config, AddOptions, SearchOptions, ListOptions, MemoryItem, AddResult } from "../types.js";
import { normalizeAddResult, normalizeSearchResults, normalizeMemoryItem } from "./normalizers.js";

export class OSSProvider implements Mem0Provider {
  private memory: any;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly ossConfig?: Mem0Config["oss"],
    private readonly customPrompt?: string,
    private readonly resolvePath?: (p: string) => string,
  ) {}

  private async ensureMemory(): Promise<void> {
    if (this.memory) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      const { Memory } = await import("mem0ai/oss");
      const config: Record<string, unknown> = { version: "v1.1" };
      if (this.ossConfig?.embedder) config.embedder = this.ossConfig.embedder;
      if (this.ossConfig?.vectorStore)
        config.vectorStore = this.ossConfig.vectorStore;
      if (this.ossConfig?.llm) config.llm = this.ossConfig.llm;

      if (this.ossConfig?.historyDbPath) {
        const dbPath = this.resolvePath
          ? this.resolvePath(this.ossConfig.historyDbPath)
          : this.ossConfig.historyDbPath;
        config.historyDbPath = dbPath;
      }

      if (this.customPrompt) config.customPrompt = this.customPrompt;

      this.memory = new Memory(config);
    } catch (error) {
      throw new Error("Failed to load 'mem0ai/oss'. Open-source mode requires 'mem0ai' package to be installed manually: " + String(error));
    }
  }

  async add(
    messages: Array<{ role: string; content: string }>,
    options: AddOptions,
  ): Promise<AddResult> {
    await this.ensureMemory();
    const addOpts: Record<string, unknown> = { userId: options.user_id };
    if (options.run_id) addOpts.runId = options.run_id;
    const result = await this.memory.add(messages, addOpts);
    return normalizeAddResult(result);
  }

  async search(query: string, options: SearchOptions): Promise<MemoryItem[]> {
    await this.ensureMemory();
    const opts: Record<string, unknown> = { userId: options.user_id };
    if (options.run_id) opts.runId = options.run_id;
    if (options.limit != null) opts.limit = options.limit;
    else if (options.top_k != null) opts.limit = options.top_k;
    if (options.keyword_search != null) opts.keyword_search = options.keyword_search;
    if (options.reranking != null) opts.reranking = options.reranking;

    const results = await this.memory.search(query, opts);
    return normalizeSearchResults(results);
  }

  async get(memoryId: string): Promise<MemoryItem> {
    await this.ensureMemory();
    const result = await this.memory.get(memoryId);
    return normalizeMemoryItem(result);
  }

  async getAll(options: ListOptions): Promise<MemoryItem[]> {
    await this.ensureMemory();
    const getAllOpts: Record<string, unknown> = { userId: options.user_id };
    if (options.run_id) getAllOpts.runId = options.run_id;
    const results = await this.memory.getAll(getAllOpts);
    if (Array.isArray(results)) return results.map(normalizeMemoryItem);
    if (results?.results && Array.isArray(results.results))
      return results.results.map(normalizeMemoryItem);
    return [];
  }

  async delete(memoryId: string): Promise<void> {
    await this.ensureMemory();
    await this.memory.delete(memoryId);
  }
}
