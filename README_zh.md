# OpenClaw Mem0 插件

这是一个 OpenClaw 插件，集成了 [Mem0](https://github.com/mem0ai/mem0)，为您的智能体提供智能的长期记忆能力。

## 功能特性

- **自动回忆 (Auto-Recall)**：在智能体开始处理请求之前，自动搜索相关的历史交互并将其注入到上下文中 (`before_agent_start`)。
- **自动捕获 (Auto-Capture)**：在智能体完成响应后，自动分析对话轮次并将关键信息存储到长期记忆中 (`agent_end`)。
- **混合作用域 (Hybrid Scope)**：同时支持**会话记忆**（短期，当前对话）和**用户记忆**（长期，跨对话）。
- **双模式 (Dual Mode)**：支持 **Mem0 平台**（云端）和 **开源**（自托管）后端。
- **三层记忆架构**：系统知识（文件只读加载）、共享池（跨 Agent）、私有空间（Agent 独有）— 提供细粒度的记忆隔离与共享。
- **火山引擎异步支持**：原生支持火山引擎托管的 Mem0 API，自动处理异步任务轮询（`checkJobStatus`、`addAndWait`）。
- **工具 (Tools)**：为智能体提供 5 个强大的工具来手动操作记忆：
  - `memory_search`: 搜索特定信息。
  - `memory_store`: 显式保存重要事实（支持 `scope` 参数控制共享/私有）。
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
"openclaw-mem0-plugin": {
  "enabled": true,
  "config": {
    "mode": "platform",
    "apiKey": "your-mem0-api-key",
    "host": "https://api.mem0.ai",
    "userId": "openclaw-user"
  }
}
```

### 火山引擎托管 Mem0

使用火山引擎托管的 Mem0 实例时，只需将 `host` 设置为火山引擎端点即可。插件会自动检测异步响应（PENDING 状态 + `event_id`）并在内部处理任务轮询。

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

> **注意**：火山引擎 API 以异步方式处理记忆写入。所有写入（包括自动捕获和 `memory_store`）均采用 fire-and-forget 模式 — 工具立即返回，记忆在后台排队处理（约 2-3 分钟）。如需等待确认写入完成，可在代码中使用 `addAndWait()` 方法。

## 三层记忆架构

启用 `agentIsolation` 后，插件创建三层命名空间架构来管理记忆的可见性和隔离：

```
┌─────────────────────────────────────────────────────────┐
│                      记忆层级                            │
├──────────────────┬──────────────────┬────────────────────┤
│  系统层           │  共享层           │  私有层             │
│  (system_        │  (pool_shared)   │  (agent_{id}_      │
│   knowledge)     │                  │   private)         │
├──────────────────┼──────────────────┼────────────────────┤
│  读取: 所有Agent  │  读取: 所有Agent  │  读取: 仅所属Agent  │
│  写入: 仅文件     │  写入: Agent     │  写入: 仅所属Agent  │
│       加载       │  (scope:"shared")│  （默认行为）        │
├──────────────────┼──────────────────┼────────────────────┤
│  公司规则、SOP、  │  用户画像、       │  Agent 工作上下文、 │
│  领域知识        │  跨团队决策       │  领域偏好           │
└──────────────────┴──────────────────┴────────────────────┘
```

| 层级 | User ID 格式 | 读取 | 写入 | 来源 |
|------|-------------|------|------|------|
| **系统层** | `system_knowledge` | 所有 Agent | 仅文件所有者 | `systemMemoryFile` 配置 |
| **共享层** | `pool_shared` | 所有 Agent | Agent 通过 `scope: "shared"` | `memory_store` 工具 |
| **私有层** | `agent_{agentId}_private` | 仅该 Agent | 仅该 Agent | 默认行为 |

### 启用多 Agent 隔离

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

**工作原理：**
- **写入**默认进入 Agent 的私有命名空间（`agent_{agentId}_private`）
- **读取**同时搜索所有适用层（私有 + 共享 + 系统），合并去重后返回
- `agentId` 自动从 OpenClaw 的 `sessionKey` 提取（格式：`agent:{agentId}:{rest}`）
- 当 `agentIsolation: false`（默认值）时，所有行为与隔离前版本完全一致 — 完全向后兼容

### 写入共享记忆

Agent 可以通过 `memory_store` 的 `scope` 参数写入共享层：

```
用户："记住我们公司的财年从4月开始 — 所有 Agent 都应该知道这一点。"
Agent：调用 memory_store({ text: "公司财年从4月开始", scope: "shared" })
```

- `scope: "private"`（默认）— 仅当前 Agent 可见
- `scope: "shared"` — 所有 Agent 可见，适合用户偏好、公司事实、跨 Agent 决策

### 系统记忆（只读知识库）

系统记忆提供一个**基于文件的只读**知识层。内容在插件启动时从 Markdown 文件加载，通过向量搜索对所有 Agent 可用 — 但 Agent 无法修改它。

#### 配置方法

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

#### 文件位置

路径通过 OpenClaw 的 `resolvePath()` 解析，**相对于 Agent 的工作区目录**（即配置文件所在目录）：

```
your-agent/
├── openclaw.plugin.json
├── config.yaml
├── System_Memory.md        ← 放在这里
└── ...
```

也支持绝对路径：

```json
"systemMemoryFile": "/path/to/shared/System_Memory.md"
```

#### 文件格式

文件按 `## `（二级标题）分割成多个块，每个块作为一条独立的记忆写入 Mem0，以获得最优的向量检索效果。

**示例 `System_Memory.md`：**

```markdown
# 公司知识库

## 公司简介
Acme Corp 成立于 2020 年，总部位于旧金山。
我们的使命是让每个企业都能使用 AI。
财年从每年 4 月 1 日到次年 3 月 31 日。

## 产品信息
主产品是 AcmeBot，AI 驱动的客服平台。
定价方案：入门版（$29/月）、专业版（$99/月）、企业版（定制报价）。
免费试用：14 天，无需信用卡。

## 客服政策
退款窗口：所有方案购买后 30 天内可退。
SLA：企业版 99.9% 可用性，其他版本 99.5%。
工作时间：周一至周五 9:00-18:00（企业版：7×24 小时）。
升级规则：2 次未解决后自动升级至高级支持。

## 沟通准则
有客户姓名时必须称呼客户姓名。
使用专业但友好的语气。
不得透露内部定价或产品路线图。
竞品对比时聚焦自身优势，不贬低竞品。
```

#### 工作原理

1. 插件启动时读取文件，计算 SHA-256 内容哈希
2. 与本地缓存文件（`.System_Memory.md.hash`）中的哈希对比
3. 如果未变化 — 不发起任何 API 调用（零启动开销）
4. 如果有变化 — 删除旧的系统记忆，重新同步新内容到 Mem0
5. 所有 Agent 在自动回忆和 `memory_search` 时自动搜索 `system_knowledge` 层

> **注意**：系统记忆对 Agent 是**只读的**。要更新系统知识，编辑 Markdown 文件后重启插件即可。变更检测机制确保只有内容发生变化时才触发重新同步。

### 开源模式（自托管）

连接到您自托管的 Mem0 实例。

**注意**：要使用开源模式，您必须在 OpenClaw 环境中手动安装 `mem0ai` 包，因为为了保持核心轻量化，本插件不再内置该依赖。

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

## 使用方法

### 1. 自动记忆（零配置）
只需启用插件即可。当您与智能体聊天时：
- 它会自动"记住"您在之前的对话中分享的事实。
- 当您提出相关问题时，它会自动"回忆"相关的上下文。

### 2. 手动工具
您的智能体可以主动使用工具：

- **用户**："请记住我对花生过敏。"
- **智能体**：调用 `memory_store({ text: "用户对花生过敏", longTerm: true })`

- **用户**："我上周提到的那本书叫什么？"
- **智能体**：调用 `memory_search({ query: "上周提到的书", scope: "long-term" })`

- **用户**："把这条信息存为共享知识：我们的 API 限流是 1000 次/分钟。"
- **智能体**：调用 `memory_store({ text: "API 限流 1000 次/分钟", scope: "shared" })`

## CLI 命令

本插件扩展了 OpenClaw CLI，增加了记忆管理命令：

```bash
# 搜索记忆
openclaw mem0 search "爱好"

# 显示记忆统计
openclaw mem0 stats
```

## 配置参考

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `string` | `"platform"` | `"platform"` 或 `"open-source"` |
| `apiKey` | `string` | — | Mem0 API 密钥（平台模式） |
| `host` | `string` | `"https://api.mem0.ai"` | Mem0 API 端点 |
| `userId` | `string` | `"default"` | 记忆作用域的默认用户 ID |
| `agentIsolation` | `boolean` | `false` | 启用 Agent 记忆隔离（三层架构） |
| `systemMemoryFile` | `string` | — | 系统知识 Markdown 文件路径（只读层） |
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
