# OpenClaw Mem0 Plugin

[中文文档](README_zh.md)

This is an OpenClaw plugin that integrates with [Mem0](https://github.com/mem0ai/mem0) to provide intelligent long-term memory capabilities for your agents.

## Features

- **Auto-Recall**: Automatically searches for relevant past interactions and injects them into the context before the agent starts (`before_agent_start`).
- **Auto-Capture**: Automatically analyzes conversation turns and stores key information into long-term memory after the agent finishes (`agent_end`).
- **Hybrid Scope**: Supports both **Session Memory** (short-term, current conversation) and **User Memory** (long-term, cross-conversation).
- **Dual Mode**: Supports both **Mem0 Platform** (Cloud) and **Open-Source** (Self-hosted) backends.
- **Multi-Agent Isolation**: Per-agent private memory namespaces with shared knowledge pools — each agent only sees its own memories plus team-shared knowledge.
- **Volcengine Async Support**: Native support for Volcengine-hosted Mem0 API with async job polling (`checkJobStatus`, `addAndWait`).
- **Tools**: Provides 5 powerful tools for agents to interact with memory manually:
  - `memory_search`: Search for specific information.
  - `memory_store`: Explicitly save important facts.
  - `memory_get`: Retrieve a specific memory by ID.
  - `memory_list`: List all memories for a user.
  - `memory_forget`: Delete specific or matching memories (GDPR compliant).

## Installation

Install via OpenClaw CLI (npm registry):

```bash
openclaw plugins install @apexlgf/openclaw-mem0-plugin
```

## Configuration

You can configure the plugin in your `~/.openclaw/openclaw.json`. The API key and host can be obtained from the platform.

### Platform Mode (Recommended)

Use the managed Mem0 Cloud service.

```json
"openclaw-mem0-plugin": {
    "enabled": true,
    "config": {
        "mode": "platform",
        "apiKey": "your-mem0-api-key",
        "userId": "openclaw-user",
        "host": "https://api.mem0.ai"
    }
}
```

### Volcengine-Hosted Mem0

For Volcengine (火山引擎) hosted Mem0 instances, just set the `host` to your Volcengine endpoint. The plugin automatically detects async responses (PENDING status with `event_id`) and handles job polling internally.

```json
"openclaw-mem0-plugin": {
    "enabled": true,
    "config": {
        "mode": "platform",
        "apiKey": "your-volcengine-api-key",
        "userId": "openclaw-user",
        "host": "https://mem0-xxx.mem0.volces.com:8000"
    }
}
```

> **Note**: Volcengine API processes memory writes asynchronously. Auto-capture uses fire-and-forget mode (non-blocking), while explicit tool calls like `memory_store` use `addAndWait` to poll until completion.

### Multi-Agent Memory Isolation

When running multiple agents (e.g., Research Agent + Code Review Agent + Planning Agent), enable `agentIsolation` to prevent memory cross-contamination:

```json
"openclaw-mem0-plugin": {
    "enabled": true,
    "config": {
        "mode": "platform",
        "apiKey": "your-mem0-api-key",
        "userId": "openclaw-user",
        "agentIsolation": true
    }
}
```

When enabled, the plugin creates a 3-layer namespace architecture:

| Layer | User ID Format | Purpose |
|-------|---------------|---------|
| **Private** | `agent_{agentId}_private` | Agent's own memories — only visible to this agent |
| **Shared** | `pool_shared` | Team-wide shared knowledge — visible to all agents |
| **System** | `system_knowledge` | System-level knowledge (reserved for future use) |

**How it works:**
- **Writes** go to the agent's private namespace (`agent_{agentId}_private`)
- **Reads** search both private and shared namespaces, merge and deduplicate results
- The `agentId` is automatically extracted from OpenClaw's `sessionKey` (format: `agent:{agentId}:{rest}`)
- When `agentIsolation: false` (default), all behavior is identical to pre-isolation versions — fully backward compatible

### Open-Source Mode (Self-Hosted)

Connect to your self-hosted Mem0 instance.

**Note**: You must manually install the `mem0ai` package in your OpenClaw environment, as this dependency is not bundled to keep the plugin lightweight.

```json
"openclaw-mem0-plugin": {
    "enabled": true,
    "config": {
        "mode": "open-source",
        "oss": {
            "vectorStore": {
                "provider": "chroma",
                "config": {
                    "collectionName": "memories",
                    "path": "./chroma_db"
                }
            }
        }
    }
}
```

## Usage

### 1. Automatic Memory (Zero-Shot)
Just enable the plugin. When you chat with your agent:
- It will automatically "remember" facts you shared in previous conversations.
- It will "recall" relevant context when you ask related questions.

### 2. Manual Tools
Your agents can proactively use tools:

- **User**: "Please remember that I'm allergic to peanuts."
- **Agent**: Calls `memory_store({ text: "User is allergic to peanuts", longTerm: true })`

- **User**: "What was that book I mentioned last week?"
- **Agent**: Calls `memory_search({ query: "book mentioned last week", scope: "long-term" })`

## CLI Commands

This plugin extends the OpenClaw CLI with memory management commands:

```bash
# Search memories
openclaw mem0 search "hobbies"

# Show memory statistics
openclaw mem0 stats
```

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `string` | `"platform"` | `"platform"` or `"open-source"` |
| `apiKey` | `string` | — | Mem0 API key (platform mode) |
| `host` | `string` | `"https://api.mem0.ai"` | Mem0 API endpoint |
| `userId` | `string` | `"default"` | Default user ID for scoping memories |
| `agentIsolation` | `boolean` | `false` | Enable per-agent memory isolation |
| `autoRecall` | `boolean` | `true` | Auto-inject memories before agent start |
| `autoCapture` | `boolean` | `true` | Auto-store memories after agent end |
| `topK` | `number` | `5` | Max memories to retrieve per search |
| `searchThreshold` | `number` | `0.5` | Minimum similarity score (0–1) |
| `enableGraph` | `boolean` | `false` | Enable graph memory (platform only) |
| `customInstructions` | `string` | — | Natural language rules for what to store/exclude |
| `customCategories` | `object` | — | Category name → description map for tagging |
| `oss` | `object` | — | Open-source mode config (embedder, vectorStore, llm) |

## Acknowledgements

This project is modified from [mem0/openclaw](https://github.com/mem0ai/mem0/tree/main/openclaw).

## License

Apache License Version 2.0
