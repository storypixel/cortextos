# Graph Report - src  (2026-06-29)

## Corpus Check
- 91 files · ~123,413 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1190 nodes · 2423 edges · 46 communities (42 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17253034`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `ts` - 275 edges
2. `ensureDir()` - 63 edges
3. `CodexAppServerPTY` - 49 edges
4. `atomicWriteSync()` - 38 edges
5. `TelegramAPI` - 38 edges
6. `AgentProcess` - 34 edges
7. `FastChecker` - 34 edges
8. `AgentManager` - 31 edges
9. `AgentPTY` - 16 edges
10. `stripBom()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `buildReplyContext()` --calls--> `stripControlChars()`  [EXTRACTED]
  daemon/agent-manager.ts → utils/validate.ts
- `describeImage()` --calls--> `log()`  [INFERRED]
  telegram/describe-image.ts → cli/bus.ts
- `transcribeVoice()` --calls--> `log()`  [INFERRED]
  telegram/transcribe.ts → cli/bus.ts
- `recordInboundTelegram()` --calls--> `log()`  [INFERRED]
  telegram/logging.ts → cli/bus.ts
- `saveAccounts()` --calls--> `ensureDir()`  [EXTRACTED]
  bus/oauth.ts → utils/atomic.ts

## Communities (46 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (149): agentEnv, agentMap, agentsDir, api, approvals, assignee, assigneePaths, att (+141 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (68): CronFireRecord, CronStateFile, cronStatePath(), parseDurationMs(), readCronState(), updateCronFire(), addCron(), CronsFile (+60 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (66): buildApprovalKeyboard(), createApproval(), listPendingApprovals(), pingAgentChatId(), postApprovalToActivityChannel(), clearEndMarkers(), detectDayNightMode(), END_TYPE_MARKERS (+58 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (38): writeCrons(), registerTelegramCommands(), log(), logLine(), AgentManager, convertEntry(), deleteMarker(), deleteTeachingMarker() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (49): addAgentCommand, createAgentsMd(), createMinimalAgent(), NON_CODEX_TEMPLATES, RuntimeKind, VALID_RUNTIMES, initCommand, CLOUDFLARED_CERT (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): browseCatalog(), CatalogBrowseOptions, CatalogBrowseResult, CatalogItem, extractRepoPath(), findCatalogPath(), getInstalledPath(), installCommunityItem() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (27): appendActivityLine(), dispatchHook(), emitHookBusEvent(), EMPTY_REGISTRY, Handler, HandlerFn, _handlerRegistry, HandlerResult (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (15): updateApproval(), ackInbox(), hardRestart(), FastChecker, LogFn, sleep(), KEYS, MessageDedup (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (43): main(), main(), extractKeywords(), FactEntry, main(), PreCompactPayload, blockCall(), countRepetitions() (+35 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (3): CodexAppServerPTY, isRecord(), sleep()

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (42): AgentRecord, checkAgentLiveness(), checkBuildFreshness(), checkDaemonCronHealth(), checkEnabledAgentGhosts(), checkFullDiskAccess(), checkPm2(), checkStateAndAgents() (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (25): CallbackHandler, EditedMessageHandler, MessageHandler, ReactionHandler, AgentHealthSummary, CronExecutionLogPage, CronHealthRow, CronHealthState (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (24): accountsPath(), AccountsStore, buildRotationReason(), checkUsageApi(), CheckUsageResult, getActiveAccount(), loadAccounts(), loadCache() (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (22): AgentMetrics, CatalogAddition, checkUpstream(), collectMetrics(), collectSkillFiles(), collectTelegramCommands(), deriveNameFromPath(), MetricsReport (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (22): createExperiment(), evaluateExperiment(), Experiment, ExperimentConfig, ExperimentContext, ExperimentCreateOptions, ExperimentCycle, ExperimentEvaluateOptions (+14 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (7): JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, MessageHandler, PendingRequest, WsUnixJsonRpcClient

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (16): pad(), describeImage(), DescribeImageOptions, extToMediaType(), resolveApiKey(), formatDate(), ProcessedMedia, processMediaMessage() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (11): busCommand, dashboardCommand, ecosystemCommand, getConfigCommand, crashAlertCommand, program, uninstallCommand, injectWorkerCommand (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (12): buildReplyContext(), LogFn, buildRecentHistory(), cacheLastSent(), logInboundMessage(), logOutboundMessage(), OutboundLogMetadata, recordInboundTelegram() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (13): countRecentCrashes(), CrashEvent, CrashHistory, crashHistoryPath(), Daemon, getOperatorChatCreds(), handleFatal(), readCrashHistory() (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (11): logEvent(), refreshHeartbeatTimestamp(), EventSeverity, Priority, VALID_PRIORITIES, isValidJson(), VALID_APPROVAL_CATEGORIES, VALID_CATEGORIES (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (5): sleep(), WorkerProcess, injectMessage(), WorkerStatus, WorkerStatusValue

### Community 24 - "Community 24"
Cohesion: 0.23
Nodes (3): loadStripAnsi(), OutputBuffer, redactSecrets()

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (4): ask(), setupCommand, validateTelegramCredsInteractive(), formatValidateError()

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (11): GoalResponse, IPty, IPtySpawnOptions, LOCAL_SLASH_COMMANDS, SkillsListResponse, SocketPointer, SpawnFn, THREAD_PERMISSION_OVERRIDES (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (5): restartCommand, startCommand, stopCommand, writeStopMarker(), IPCClient

### Community 28 - "Community 28"
Cohesion: 0.35
Nodes (10): buildKBEnv(), ensureKBDirs(), getVenvPython(), ingestKnowledgeBase(), kbConfigured(), KBQueryResponse, KBQueryResult, loadSecretsEnv() (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (7): LogFn, IPty, IPtySpawnOptions, SpawnFn, hermesDbExists(), AgentConfig, CtxEnv

### Community 30 - "Community 30"
Cohesion: 0.2
Nodes (9): AgentGoalStatus, autoCommit(), AutoCommitReport, BINARY_TEMP_EXTENSIONS, checkGoalStaleness(), EXCLUDED_DIR_PREFIXES, GoalStalenessReport, SCRIPT_EXTENSIONS (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.36
Nodes (9): classifyFromMarkers(), detectRateLimitInLog(), isQuietHoursLA(), main(), notifyAgents(), QUIET_SUPPRESSED_TYPES, readHookInput(), readMaxCrashesPerDay() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.28
Nodes (5): disableAgentCommand, enableAgentCommand, getEnabledAgentsPath(), readEnabledAgents(), writeEnabledAgents()

### Community 34 - "Community 34"
Cohesion: 0.31
Nodes (6): buildAgentInfo(), listAgents(), notifyAgent(), listAgentsCommand, notifyAgentCommand, AgentInfo

### Community 35 - "Community 35"
Cohesion: 0.36
Nodes (5): commandExists(), installCommand, tryInstallFfmpeg(), tryInstallJq(), tryInstallWhisperCpp()

### Community 36 - "Community 36"
Cohesion: 0.4
Nodes (5): displayStatuses(), formatUptime(), statusCommand, AgentStatus, Heartbeat

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (5): agentDir, goalsCommand, goalsJsonPath, goalsMdPath, lines

### Community 39 - "Community 39"
Cohesion: 0.4
Nodes (4): listSkillsCommand, parseFrontmatter(), scanSkillsDir(), SkillInfo

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): match, parseSkillFrontmatter(), scanSkillsDir()

## Knowledge Gaps
- **335 isolated node(s):** `EcosystemFeatureConfig`, `EcosystemConfig`, `TelegramReactionType`, `TelegramUser`, `TelegramChat` (+330 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ts` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 21`, `Community 27`, `Community 28`, `Community 30`, `Community 40`?**
  _High betweenness centrality (0.396) - this node is a cross-community bridge._
- **Why does `TelegramAPI` connect `Community 15` to `Community 0`, `Community 33`, `Community 2`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 17`, `Community 19`, `Community 25`, `Community 26`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `CodexAppServerPTY` connect `Community 9` to `Community 26`, `Community 29`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `EcosystemFeatureConfig`, `EcosystemConfig`, `TelegramReactionType` to the rest of the system?**
  _335 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._