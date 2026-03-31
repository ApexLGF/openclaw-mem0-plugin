# OpenClaw Mem0 Plugin

[中文文档](README_zh.md)

This is an OpenClaw plugin that integrates with [Mem0](https://github.com/mem0ai/mem0) to provide intelligent long-term memory capabilities for your agents.

## Features

- **Auto-Recall**: Automatically searches for relevant past interactions and injects them into the context before the agent starts (`before_agent_start`).
- **Auto-Capture**: Automatically analyzes conversation turns and stores key information into long-term memory after the agent finishes (`agent_end`).
- **Hybrid Scope**: Supports both **Session Memory** (short-term, current conversation) and **User Memory** (long-term, cross-conversation).
- **Dual Mode**: Supports both **Mem0 Platform** (Cloud) and **Open-Source** (Self-hosted) backends.
- **Three-Layer Memory Architecture**: System knowledge (read-only from file), shared pool (cross-agent), and private namespaces (per-agent) — providing fine-grained memory isolation and sharing.
- **Volcengine Async Support**: Native support for Volcengine-hosted Mem0 API with async job polling (`checkJobStatus`, `addAndWait`).
- **Tools**: Provides 5 powerful tools for agents to interact with memory manually:
  - `memory_search`: Search for specific information.
  - `memory_store`: Explicitly save important facts (with `scope` for shared/private control).
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

> **Note**: Volcengine API processes memory writes asynchronously. All writes (including auto-capture and `memory_store`) use fire-and-forget mode — the tool returns immediately while the memory is queued for processing (~2-3 minutes). Use `addAndWait()` programmatically if you need confirmation before proceeding.

## Three-Layer Memory Architecture

When `agentIsolation` is enabled, the plugin creates a three-layer namespace architecture to manage memory visibility and isolation:

```
┌─────────────────────────────────────────────────────────┐
│                    Memory Layers                         │
├──────────────────┬──────────────────┬────────────────────┤
│  System Layer    │  Shared Layer    │  Private Layer     │
│  (system_        │  (pool_shared)   │  (agent_{id}_      │
│   knowledge)     │                  │   private)         │
├──────────────────┼──────────────────┼────────────────────┤
│  Read: All       │  Read: All       │  Read: Owner only  │
│  Write: File     │  Write: Agents   │  Write: Owner only │
│         only     │    (scope:       │    (default)       │
│                  │     "shared")    │                    │
├──────────────────┼──────────────────┼────────────────────┤
│  Company rules,  │  User profile,   │  Agent-specific    │
│  SOPs, domain    │  cross-team      │  working context,  │
│  knowledge       │  decisions       │  domain prefs      │
└──────────────────┴──────────────────┴────────────────────┘
```

| Layer | User ID Format | Read | Write | Source |
|-------|---------------|------|-------|--------|
| **System** | `system_knowledge` | All agents | File owner only | `systemMemoryFile` config |
| **Shared** | `pool_shared` | All agents | Agents via `scope: "shared"` | `memory_store` tool |
| **Private** | `agent_{agentId}_private` | Owner agent only | Owner agent only | Default behavior |

### Enabling Multi-Agent Isolation

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

**How it works:**
- **Writes** go to the agent's private namespace by default (`agent_{agentId}_private`)
- **Reads** search across all applicable layers (private + shared + system), merge and deduplicate results
- The `agentId` is automatically extracted from OpenClaw's `sessionKey` (format: `agent:{agentId}:{rest}`)
- When `agentIsolation: false` (default), all behavior is identical to pre-isolation versions — fully backward compatible

### Writing Shared Memories

Agents can write to the shared layer using the `scope` parameter in `memory_store`:

```
User: "Remember that our company's fiscal year starts in April — all agents should know this."
Agent: calls memory_store({ text: "Company fiscal year starts in April", scope: "shared" })
```

- `scope: "private"` (default) — only this agent can see it
- `scope: "shared"` — all agents can see it, suitable for user preferences, company facts, cross-agent decisions

### System Memory (Read-Only Knowledge Base)

System memory provides a **file-based, read-only** knowledge layer. Contents are loaded from a Markdown file on plugin startup and made available to all agents via vector search — but agents cannot modify it.

#### Configuration

```json
"openclaw-mem0-plugin": {
    "enabled": true,
    "config": {
        "mode": "platform",
        "apiKey": "your-mem0-api-key",
        "userId": "openclaw-user",
        "agentIsolation": true,
        "systemMemoryFile": "./System_Memory.md"
    }
}
```

#### File Location

The path is resolved via OpenClaw's `resolvePath()`, which is **relative to the agent's workspace directory** (where your config file lives):

```
your-agent/
├── openclaw.plugin.json
├── config.yaml
├── System_Memory.md        ← place it here
└── ...
```

You can also use an absolute path:

```json
"systemMemoryFile": "/path/to/shared/System_Memory.md"
```

#### File Format

The file is split into chunks by `## ` (H2) headers for optimal Mem0 ingestion. Each section becomes a separate memory entry.

**Example `System_Memory.md`:**

```markdown
# Company Knowledge Base

## Company Profile
Acme Corp was founded in 2020. Headquarters in San Francisco.
Our mission is to make AI accessible to every business.
The fiscal year runs from April 1 to March 31.

## Product Information
Our main product is AcmeBot, an AI-powered customer service platform.
Pricing: Starter ($29/mo), Professional ($99/mo), Enterprise (custom).
Free trial: 14 days, no credit card required.

## Customer Service Policies
Refund window: 30 days from purchase for all plans.
SLA: 99.9% uptime for Enterprise plans, 99.5% for others.
Support hours: Mon-Fri 9am-6pm PST (Enterprise: 24/7).
Escalation: After 2 failed resolution attempts, escalate to senior support.

## Communication Guidelines
Always address customers by name when available.
Use professional but friendly tone.
Never share internal pricing or roadmap details.
For competitor comparisons, focus on our strengths without disparaging others.
```

#### How It Works

1. On plugin startup, the file is read and a SHA-256 content hash is computed
2. The hash is compared against a local cache file (`.System_Memory.md.hash`)
3. If unchanged — no API calls are made (zero startup cost)
4. If changed — old system memories are deleted and new content is re-synced to Mem0
5. All agents automatically search the `system_knowledge` layer during auto-recall and `memory_search`

> **Note**: System memory is **read-only** for agents. To update system knowledge, edit the Markdown file and restart the plugin. The change detection ensures only modified content triggers re-sync.

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

- **User**: "Save this as shared knowledge for all agents: our API rate limit is 1000 req/min."
- **Agent**: Calls `memory_store({ text: "API rate limit is 1000 req/min", scope: "shared" })`

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
| `agentIsolation` | `boolean` | `false` | Enable per-agent memory isolation (three-layer architecture) |
| `systemMemoryFile` | `string` | — | Path to a Markdown file for system-level knowledge (read-only layer) |
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
