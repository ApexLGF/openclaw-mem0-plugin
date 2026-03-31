# OpenClaw Mem0 Plugin

Mem0 integration for OpenClaw. Adds intelligent long-term memory to your agents with a three-layer architecture: system knowledge (read-only from file), shared pool (cross-agent), and private namespaces (per-agent).

## When to use

- You want your agent to remember user details (name, job, preferences) across sessions
- You need "infinite context" by retrieving relevant past interactions
- You want to build a personalized assistant that learns over time
- You run **multiple agents** and need memory isolation with shared knowledge
- You need both cloud (managed) and self-hosted (local) memory options

## Setup

### Platform Mode (Recommended)

1. Get a free API key at [mem0.ai](https://mem0.ai)
2. Set environment variables (optional but recommended):
   - `MEM0_API_KEY`: Your Mem0 API Key
   - `MEM0_HOST`: Your Mem0 Host (optional)
3. Add to your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "openclaw-mem0-plugin": {
        "enabled": true,
        "config": {
          "mode": "platform",
          "host": "mem0-platform-host",
          "apiKey": "your-mem0-api-key",
          "userId": "default-user"
        }
      }
    }
  }
}
```

### Multi-Agent with System Memory (Full Setup)

```json
{
  "plugins": {
    "entries": {
      "openclaw-mem0-plugin": {
        "enabled": true,
        "config": {
          "mode": "platform",
          "apiKey": "your-mem0-api-key",
          "userId": "default-user",
          "agentIsolation": true,
          "systemMemoryFile": "./System_Memory.md"
        }
      }
    }
  }
}
```

### Open-Source Mode (Self-Hosted)

Connect to your own Mem0 instance (requires `mem0ai` package installed):

```json
{
  "plugins": {
    "entries": {
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
    }
  }
}
```

## Three-Layer Memory Architecture

When `agentIsolation` is enabled, memories are organized into three layers:

| Layer | Read | Write | Use Case |
|-------|------|-------|----------|
| **System** (`system_knowledge`) | All agents | File only (`systemMemoryFile`) | Company rules, SOPs, domain knowledge |
| **Shared** (`pool_shared`) | All agents | Agents via `scope: "shared"` | User profile, cross-team decisions |
| **Private** (`agent_{id}_private`) | Owner only | Owner only (default) | Agent working context, domain preferences |

### System Memory File

Place a `System_Memory.md` in your agent workspace directory. Split content with `## ` headers for best results:

```markdown
# Company Knowledge

## Product Info
Main product: AcmeBot, AI customer service platform.
Pricing: Starter ($29/mo), Pro ($99/mo), Enterprise (custom).

## Support Policies
Refund window: 30 days. SLA: 99.9% (Enterprise), 99.5% (others).
```

The file is synced to Mem0 on startup with hash-based change detection — unchanged files cause zero API calls.

## Usage

This plugin works automatically (Zero-Shot) but also provides manual tools.

### Automatic Features

- **Auto-Recall**: Before every agent turn, searches memory across all applicable layers (private + shared + system) and injects relevant context into the system prompt.
- **Auto-Capture**: After every agent turn, analyzes the conversation and stores key facts into the agent's private memory.

### Manual Tools

The agent can proactively call these tools:

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `memory_store` | Save a fact | `text`, `scope` ("private"\|"shared"), `longTerm` (bool) |
| `memory_search` | Search memories | `query`, `scope` ("session"\|"long-term"\|"all") |
| `memory_get` | Get memory by ID | `memoryId` |
| `memory_list` | List all memories | `userId` |
| `memory_forget` | Delete a memory | `memoryId` or `query` |

### Example

**User**: "I'm moving to Tokyo next month."
*Agent automatically captures this fact to its private memory.*

**(Two weeks later)**
**User**: "What's a good restaurant for my farewell dinner?"
*Agent automatically recalls "User is moving to Tokyo" and suggests a restaurant in their current city.*

**User**: "Remember for all agents: our company fiscal year starts in April."
*Agent calls `memory_store({ text: "Company fiscal year starts in April", scope: "shared" })`*

## Plugin Structure

```
openclaw-mem0-plugin/
  src/
    index.ts              # Plugin entry point
    types.ts              # Type definitions
    config.ts             # Configuration parsing & defaults
    namespace.ts          # Three-layer namespace manager
    agent-resolver.ts     # Agent ID extraction from sessionKey
    helpers.ts            # buildAddOptions, buildSearchOptions
    hooks.ts              # Auto-recall & auto-capture lifecycle hooks
    system-memory.ts      # System memory file loader
    cli.ts                # CLI commands (search, stats)
    providers/            # Mem0 Platform & OSS providers
    tools/                # 5 memory tools (search, store, get, list, forget)
    lib/                  # Internal Mem0 client (async polling support)
  SKILL.md                # This file
  README.md               # Full English documentation
  README_zh.md            # Full Chinese documentation
```

## Author

Maintained by @apexlgf. Modified from the original Mem0 OpenClaw integration.
