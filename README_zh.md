# OpenClaw Mem0 插件

这是一个 OpenClaw 插件，集成了 [Mem0](https://github.com/mem0ai/mem0)，为您的智能体提供智能的长期记忆能力。

## 功能特性

- **自动回忆 (Auto-Recall)**：在智能体开始处理请求之前，自动搜索相关的历史交互并将其注入到上下文中 (`before_agent_start`)。
- **自动捕获 (Auto-Capture)**：在智能体完成响应后，自动分析对话轮次并将关键信息存储到长期记忆中 (`agent_end`)。
- **混合作用域 (Hybrid Scope)**：同时支持**会话记忆**（短期，当前对话）和**用户记忆**（长期，跨对话）。
- **双模式 (Dual Mode)**：支持 **Mem0 平台**（云端）和 **开源**（自托管）后端。
- **多 Agent 隔离**：每个 Agent 拥有独立的私有记忆命名空间，同时共享团队知识池 — Agent 只能看到自己的记忆和团队共享知识。
- **火山引擎异步支持**：原生支持火山引擎托管的 Mem0 API，自动处理异步任务轮询（`checkJobStatus`、`addAndWait`）。
- **工具 (Tools)**：为智能体提供 5 个强大的工具来手动操作记忆：
  - `memory_search`: 搜索特定信息。
  - `memory_store`: 显式保存重要事实。
  - `memory_get`: 通过 ID 获取特定记忆。
  - `memory_list`: 列出用户的所有记忆。
  - `memory_forget`: 删除指定或匹配的记忆（符合 GDPR）。

## 安装

通过 OpenClaw CLI 安装（npm 源）：

```bash
openclaw plugins install @apexlgf/openclaw-mem0-plugin
```

## 配置

您可以在 `~/.openclaw/openclaw.json` 中配置该插件。API Key 和 Host 可以从平台获取。

### 平台模式（推荐）

使用托管的 Mem0 云服务。

```json
“openclaw-mem0-plugin”: {
  “enabled”: true,
  “config”: {
    “mode”: “platform”,
    “apiKey”: “your-mem0-api-key”,
    “host”: “https://api.mem0.ai”,
    “userId”: “openclaw-user”
  }
}
```

### 火山引擎托管 Mem0

使用火山引擎托管的 Mem0 实例时，只需将 `host` 设置为火山引擎端点即可。插件会自动检测异步响应（PENDING 状态 + `event_id`）并在内部处理任务轮询。

```json
“openclaw-mem0-plugin”: {
  “enabled”: true,
  “config”: {
    “mode”: “platform”,
    “apiKey”: “your-volcengine-api-key”,
    “userId”: “openclaw-user”,
    “host”: “https://mem0-xxx.mem0.volces.com:8000”
  }
}
```

> **注意**：火山引擎 API 以异步方式处理记忆写入。自动捕获采用 fire-and-forget 模式（非阻塞），而显式工具调用如 `memory_store` 使用 `addAndWait` 轮询直到完成。

### 多 Agent 记忆隔离

当运行多个 Agent（如 Research Agent + Code Review Agent + Planning Agent 协同工作）时，启用 `agentIsolation` 可防止记忆交叉污染：

```json
“openclaw-mem0-plugin”: {
  “enabled”: true,
  “config”: {
    “mode”: “platform”,
    “apiKey”: “your-mem0-api-key”,
    “userId”: “openclaw-user”,
    “agentIsolation”: true
  }
}
```

启用后，插件创建三层命名空间架构：

| 层级 | User ID 格式 | 用途 |
|------|-------------|------|
| **私有层** | `agent_{agentId}_private` | Agent 自己的记忆 — 仅对该 Agent 可见 |
| **共享层** | `pool_shared` | 团队共享知识 — 所有 Agent 可见 |
| **系统层** | `system_knowledge` | 系统级知识（预留扩展） |

**工作原理：**
- **写入**进入 Agent 的私有命名空间（`agent_{agentId}_private`）
- **读取**同时搜索私有和共享命名空间，合并去重后返回
- `agentId` 自动从 OpenClaw 的 `sessionKey` 提取（格式：`agent:{agentId}:{rest}`）
- 当 `agentIsolation: false`（默认值）时，所有行为与隔离前版本完全一致 — 完全向后兼容

### 开源模式（自托管）

连接到您自托管的 Mem0 实例。

**注意**：要使用开源模式，您必须在 OpenClaw 环境中手动安装 `mem0ai` 包，因为为了保持核心轻量化，本插件不再内置该依赖。

```json
“openclaw-mem0-plugin”: {
  “enabled”: true,
  “config”: {
    “mode”: “open-source”,
    “oss”: {
      “vectorStore”: {
        “provider”: “chroma”,
        “config”: {
          “collectionName”: “memories”,
          “path”: “./chroma_db”
        }
      }
    }
  }
}
```

## 使用方法

### 1. 自动记忆（零配置）
只需启用插件即可。当您与智能体聊天时：
- 它会自动”记住”您在之前的对话中分享的事实。
- 当您提出相关问题时，它会自动”回忆”相关的上下文。

### 2. 手动工具
您的智能体可以主动使用工具：

- **用户**：”请记住我对花生过敏。”
- **智能体**：调用 `memory_store({ text: “用户对花生过敏”, longTerm: true })`

- **用户**：”我上周提到的那本书叫什么？”
- **智能体**：调用 `memory_search({ query: “上周提到的书”, scope: “long-term” })`

## CLI 命令

本插件扩展了 OpenClaw CLI，增加了记忆管理命令：

```bash
# 搜索记忆
openclaw mem0 search “爱好”

# 显示记忆统计
openclaw mem0 stats
```

## 配置参考

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `string` | `”platform”` | `”platform”` 或 `”open-source”` |
| `apiKey` | `string` | — | Mem0 API 密钥（平台模式） |
| `host` | `string` | `”https://api.mem0.ai”` | Mem0 API 端点 |
| `userId` | `string` | `”default”` | 记忆作用域的默认用户 ID |
| `agentIsolation` | `boolean` | `false` | 启用 Agent 记忆隔离 |
| `autoRecall` | `boolean` | `true` | 自动注入相关记忆 |
| `autoCapture` | `boolean` | `true` | 自动存储对话记忆 |
| `topK` | `number` | `5` | 每次搜索最大返回数 |
| `searchThreshold` | `number` | `0.5` | 最低相似度阈值（0–1） |
| `enableGraph` | `boolean` | `false` | 启用图记忆（仅平台模式） |
| `customInstructions` | `string` | — | 自定义存储/排除规则 |
| `customCategories` | `object` | — | 分类名称→描述的映射 |
| `oss` | `object` | — | 开源模式配置 |

## 致谢

本项目修改自 [mem0/openclaw](https://github.com/mem0ai/mem0/tree/main/openclaw)。

## 许可证

Apache License Version 2.0
