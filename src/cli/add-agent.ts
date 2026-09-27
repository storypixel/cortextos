import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync, symlinkSync, lstatSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { OrgContext } from '../types';
import { validateAgentName, validateOrgName } from '../utils/validate';

const VALID_RUNTIMES = ['claude-code', 'hermes', 'codex-app-server', 'opencode'] as const;
type RuntimeKind = typeof VALID_RUNTIMES[number];

// Templates that don't have a codex variant yet. Pairing any of these with
// --runtime codex-app-server used to silently scaffold claude-only bootstrap
// (`.claude/skills/`, `CLAUDE_CODE_OAUTH_TOKEN`, `/loop` references) into a
// codex agent — degrading on first boot. Reject the combo until codex
// variants exist (PR 11+).
const NON_CODEX_TEMPLATES = ['orchestrator', 'analyst', 'm2c1-worker', 'hermes'] as const;

/**
 * Every agent template on disk, derived from the SAME artifact the guard uses:
 * a directory under templates/ containing IDENTITY.md.
 *
 * WHY DERIVED AND NOT LISTED (california-tom, 2026-07-26): this file carried THREE
 * lists of agent templates — the guard (artifact-derived), the guard's error message
 * (hand-maintained), and the `--template` help string (hand-maintained). The help
 * string had drifted to four entries, MISSING `agent-opencode` AND `hermes`, both
 * real working templates. The flag that reaches hermes was undiscoverable from
 * `--help` on the same night hermes was being repaired.
 *
 * Worse, the guard's own comment cited that help string as the advertised set —
 * NAMING AS SOURCE OF TRUTH THE ONE LIST OF THE THREE THAT WAS STALE. Same shape as
 * the rest of today's defects: two lineages diverge and the one designated
 * authoritative is the out-of-date one.
 *
 * The behaviour was keyed on the artifact and the PROSE was left hand-maintained —
 * the part that executes got fixed, the part that TELLS YOU got left. Deriving all
 * three from one scan makes them agree by construction, with no list to maintain.
 */
function listAgentTemplates(projectRoot?: string): string[] {
  const root = projectRoot || process.env.CTX_FRAMEWORK_ROOT || process.env.CTX_PROJECT_ROOT || process.cwd();
  const roots = [
    join(root, 'templates'),
    join(root, 'node_modules', 'cortextos', 'templates'),
    join(__dirname, '..', '..', 'templates'),
  ];
  for (const dir of roots) {
    if (!existsSync(dir)) continue;
    try {
      const found = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && existsSync(join(dir, d.name, 'IDENTITY.md')))
        .map(d => d.name)
        .sort();
      if (found.length > 0) return found;
    } catch { /* unreadable templates dir — try the next candidate root */ }
  }
  return [];
}

// Computed once at load so --help and the guard cannot disagree.
//
// A ZERO-LENGTH SCAN IS NEVER A REAL STATE — templates/ always contains at least
// `agent`. So an empty result means the SCAN is broken (wrong cwd, missing dir,
// packaging move), not that there are no templates.
//
// This originally fell back to a hardcoded list, which is exactly the defect the
// cron sweeper was fixed for earlier tonight: AN INSTRUMENT THAT EXAMINED ZERO
// ITEMS MUST NOT BE ABLE TO EMIT A PLAUSIBLE ANSWER. A confident, well-formed,
// possibly-wrong advertised set with nothing saying the scan failed is precisely
// how the stale list this code replaced got born in the first place (roscoe).
//
// Not thrown at module load — this file is imported by the whole CLI, so a throw
// here would take down `bus`, `start`, and everything else over a templates dir
// that those commands never touch. The help string announces the failure instead,
// and the ACTION re-scans with the properly-resolved projectRoot and exits 2.
const AGENT_TEMPLATES = listAgentTemplates();
const TEMPLATE_LIST = AGENT_TEMPLATES.length > 0
  ? AGENT_TEMPLATES.join(', ')
  : '⚠ template scan found none — run from the framework root';

export const addAgentCommand = new Command('add-agent')
  .argument('<name>', 'Agent name')
  .option('--template <type>', `Agent template (${TEMPLATE_LIST})`, 'agent')
  .option('--org <org>', 'Organization name')
  .option('--instance <id>', 'Instance ID', 'default')
  .option('--runtime <runtime>', `Agent runtime (${VALID_RUNTIMES.join(', ')})`, 'claude-code')
  .option('--buzz-channel <uuid>', 'Buzz (Nostr/NIP-29) channel UUID to scaffold this agent onto')
  .description('Add a new agent to the organization')
  .action(async (name: string, options: { template: string; org?: string; instance: string; runtime: string; buzzChannel?: string }) => {
    if (!VALID_RUNTIMES.includes(options.runtime as RuntimeKind)) {
      console.error(`Error: --runtime must be one of: ${VALID_RUNTIMES.join(', ')} (got "${options.runtime}")`);
      process.exit(1);
    }

    if (options.runtime === 'codex-app-server' && (NON_CODEX_TEMPLATES as readonly string[]).includes(options.template)) {
      console.error(`Error: no codex variant of "${options.template}" yet. Use --template agent for a codex agent (or file an issue to track adding a codex-${options.template} variant).`);
      process.exit(1);
    }
    // BUG-041 fix: validate the agent name BEFORE creating anything on disk.
    // Without this, mixed-case names like 'CortextDesigner' pass through
    // add-agent, get written to disk, and THEN fail every `cortextos bus *`
    // command at runtime because `src/utils/env.ts:resolveEnv()` strictly
    // validates CTX_AGENT_NAME via the same `validateAgentName()` function.
    // The mismatch made affected agents half-functional — daemon-managed
    // fine but unable to use any bus command (including send-telegram).
    // Canonical rule lives in `src/utils/validate.ts`:
    //   AGENT_NAME_REGEX = /^[a-z0-9_-]+$/
    try {
      validateAgentName(name);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      console.error(`Agent names must match /^[a-z0-9_-]+$/ (lowercase letters, numbers, underscores, hyphens).`);
      console.error(`Examples of valid names: paul, sentinel, cortext-designer, build_worker, agent_1`);
      process.exit(1);
    }

    const projectRoot = process.env.CTX_FRAMEWORK_ROOT || process.env.CTX_PROJECT_ROOT || process.cwd();

    // Auto-detect org if not specified
    let org = options.org;
    if (!org) {
      const orgsDir = join(projectRoot, 'orgs');
      if (existsSync(orgsDir)) {
        const orgs = readdirSync(orgsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        if (orgs.length === 1) {
          org = orgs[0];
        } else if (orgs.length > 1) {
          console.error('Multiple organizations found. Specify one with --org <name>');
          process.exit(1);
        }
      }
    }

    if (!org) {
      console.error('No organization found. Run "cortextos init <org>" first.');
      process.exit(1);
    }

    // Mirror the BUG-041 fix above for the resolved org name.
    // Mixed-case orgs pass through add-agent today (whether supplied via --org or
    // auto-detected from the orgs/ directory), get committed to disk, and then
    // break every `cortextos bus *` invocation at runtime because env.ts strictly
    // validates CTX_ORG. The dashboard API also rejects them with HTTP 400.
    // Canonical rule: src/utils/validate.ts:validateOrgName (/^[a-z0-9_-]+$/).
    try {
      validateOrgName(org);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      console.error(`Org names must match /^[a-z0-9_-]+$/ (lowercase letters, numbers, underscores, hyphens).`);
      process.exit(1);
    }

    const agentDir = join(projectRoot, 'orgs', org, 'agents', name);
    if (existsSync(agentDir)) {
      console.error(`Agent "${name}" already exists at ${agentDir}`);
      process.exit(1);
    }

    // Resolve the template BEFORE anything is created on disk, so a rejected
    // template leaves no half-made agent directory behind.
    const isCodexAppServer = options.runtime === 'codex-app-server';
    const isOpencode = options.runtime === 'opencode';
    const effectiveTemplate = isCodexAppServer && options.template === 'agent'
      ? 'agent-codex'
      : isOpencode && options.template === 'agent'
        ? 'agent-opencode'
        : options.template;
    const templateDir = findTemplateDir(projectRoot, effectiveTemplate);

    // Fatal-on-zero, with projectRoot properly resolved. An empty scan here means
    // the install is broken; continuing would validate `--template` against nothing
    // and let the IDENTITY.md guard pass by vacuum rather than by inspection.
    const templatesOnDisk = listAgentTemplates(projectRoot);
    if (templatesOnDisk.length === 0) {
      console.error(`Error: found no agent templates under ${projectRoot}/templates (looked for directories containing IDENTITY.md).`);
      console.error(`This is a broken install or a wrong working directory, not an empty template set — refusing to guess.`);
      process.exit(2);
    }

    // A TEMPLATE WITH NO IDENTITY.md WAS NEVER MEANT TO BE AN AGENT (roscoe, 2026-07-26).
    // Any directory under templates/ is reachable via --template, which is NOT the same
    // as being a supported agent template — the advertised set is in the --template help
    // string (itself derived from this same scan), and NON_CODEX_TEMPLATES is a
    // codex-incompatibility list, not a registry.
    //
    // Without this, backfillMissingAgentFiles would happily give `--template m2c1-worker`
    // a full spine and produce A BOOTABLE AGENT THAT IS MEANINGLESS: its three skills all
    // assume it is a supervised ephemeral worker receiving a brain dump from a supervisor
    // via `cortextos spawn-worker`. That is arguably worse than the 0/10 it produced
    // before, because 0/10 fails loudly and a spined one boots and sits there.
    //
    // Keyed on IDENTITY.md in the SOURCE dir rather than on a maintained list, so new
    // skill-bundle dirs are excluded automatically and nobody has to remember to add them.
    if (templateDir && !existsSync(join(templateDir, 'IDENTITY.md'))) {
      console.error(`Error: "${effectiveTemplate}" is not an agent template — it has no IDENTITY.md.`);
      console.error(`It is a skill/scaffold bundle, not a persistent agent. Agent templates: ${TEMPLATE_LIST}.`);
      if (effectiveTemplate === 'm2c1-worker') {
        console.error(`For an M2C1 build session use \`cortextos spawn-worker\` — it is supervised by an existing agent, not created as one.`);
      }
      process.exit(1);
    }

    console.log(`\nAdding agent: ${name}`);
    console.log(`  Template: ${options.template}`);
    console.log(`  Organization: ${org}`);
    console.log(`  Directory: ${agentDir}\n`);

    // Create agent directory
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(agentDir, 'memory'), { recursive: true });

    // For codex-app-server, skills live under plugins/cortextos-agent-skills/skills
    // and are copied in by the template; .claude/skills is Claude-Code-only.
    if (!isCodexAppServer && !isOpencode) {
      mkdirSync(join(agentDir, '.claude', 'skills'), { recursive: true });
    }

    // Copy template files (templateDir/effectiveTemplate resolved above, pre-mkdir)
    if (templateDir) {
      copyTemplateFiles(templateDir, agentDir, name, org);
      console.log(`  Copied template files from ${effectiveTemplate}`);
      // Partial templates must not yield a less complete agent than no template
      // at all. Fills genuine absences only; never overwrites what a template ships.
      const backfilled = backfillMissingAgentFiles(agentDir, name, org, options.template, options.runtime);
      if (backfilled.length > 0) {
        console.log(`  Backfilled ${backfilled.length} standard file(s) the ${effectiveTemplate} template omits: ${backfilled.join(', ')}`);
      }
    } else {
      // Create minimal files
      createMinimalAgent(agentDir, name, org, options.template, options.runtime);
      console.log('  Created minimal agent files');
    }

    // Codex agents: link each local skill into ~/.codex/skills/<agent>__<skill>
    // so codex-app-server's host-wide skill discovery sees the per-agent set.
    if (isCodexAppServer) {
      try {
        const linksCreated = installCodexSkillSymlinks(agentDir, name);
        if (linksCreated > 0) {
          console.log(`  Linked ${linksCreated} skill(s) into ~/.codex/skills/`);
        }
      } catch (err) {
        console.error(`Warning: failed to install codex skill symlinks: ${(err as Error).message}`);
      }
    }

    // OpenCode agents: expose the same local Cortext skill bundle through
    // agent-local `.opencode/skills/<skill>` symlinks so OpenCode's native
    // `skill` tool can discover them without relying on host-global state.
    if (isOpencode) {
      try {
        const linksCreated = installOpencodeSkillSymlinks(agentDir);
        if (linksCreated > 0) {
          console.log(`  Linked ${linksCreated} skill(s) into .opencode/skills/`);
        }
      } catch (err) {
        console.error(`Warning: failed to install opencode skill symlinks: ${(err as Error).message}`);
      }
    }

    // Create goals.json (empty — orchestrator will populate on morning cascade)
    const goalsJsonPath = join(agentDir, 'goals.json');
    if (!existsSync(goalsJsonPath)) {
      writeFileSync(goalsJsonPath, JSON.stringify({
        focus: '',
        goals: [],
        bottleneck: '',
        updated_at: '',
        updated_by: '',
      }, null, 2) + '\n', 'utf-8');
    }

    // Create config.json
    const configPath = join(agentDir, 'config.json');
    if (!existsSync(configPath)) {
      writeFileSync(configPath, JSON.stringify({
        agent_name: name,
        startup_delay: 0,
        max_session_seconds: 255600,
        enabled: true,
        crons: [],
      }, null, 2) + '\n', 'utf-8');
    }

    // Persist non-default runtime into config.json regardless of whether the
    // file came from a template or was created above. The template-supplied
    // config.json wins file existence, so we read-merge-write to inject the
    // runtime field that agent-process.ts branches on.
    if (options.runtime !== 'claude-code' && existsSync(configPath)) {
      try {
        const existingCfg = JSON.parse(readFileSync(configPath, 'utf-8'));
        existingCfg.runtime = options.runtime;
        writeFileSync(configPath, JSON.stringify(existingCfg, null, 2) + '\n', 'utf-8');
      } catch (err) {
        console.error(`Warning: failed to set runtime field in config.json: ${(err as Error).message}`);
      }
    }

    // Create .env placeholder with helpful comments
    const envPath = join(agentDir, '.env');
    if (!existsSync(envPath)) {
      writeFileSync(envPath, [
        `# Agent environment for ${name}`,
        '#',
        '# BOT_TOKEN: Create a Telegram bot with @BotFather and paste the token here',
        '# CHAT_ID: Send a message to your bot, then run:',
        '#   curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | jq \'.result[-1].message.chat.id\'',
        '#',
        'BOT_TOKEN=',
        'CHAT_ID=',
        '',
        '# Claude Code v2.1.111+ gives Sonnet 4.6 a 1M context window by default.',
        '# On plans WITHOUT "extra usage" billing, compaction fails at 100% ctx with:',
        '#   "Extra usage is required for 1M context"',
        '# If you see that error on a Sonnet or Haiku agent, uncomment the line below',
        '# to revert to the standard 200K window.',
        '# (Opus on Max / Team / Enterprise includes 1M natively — leave this commented.)',
        '# CLAUDE_CODE_DISABLE_1M_CONTEXT=true',
        '',
      ].join('\n'), 'utf-8');
      chmodSync(envPath, 0o600); // credentials — owner read/write only
    }

    // Generate SYSTEM.md from context.json (static org context only).
    // This overwrites whatever the template wrote — context.json is the source of truth.
    // Dynamic data (agent roster, health) is discovered live via list-agents + read-all-heartbeats.
    const contextPath = join(projectRoot, 'orgs', org, 'context.json');
    if (existsSync(contextPath)) {
      // Read context.json once and reuse for both SYSTEM.md generation and config seeding.
      let ctx: OrgContext | null = null;
      try {
        ctx = JSON.parse(readFileSync(contextPath, 'utf-8')) as OrgContext;
      } catch { /* leave template SYSTEM.md in place if context.json is unreadable */ }

      if (ctx) {
        // Generate SYSTEM.md
        try {
          const orgName = ctx.name || org;
          const timezone = ctx.timezone || 'UTC';
          const orchestrator = ctx.orchestrator || '(not set)';
          const dashboardUrl = ctx.dashboard_url || '(not configured)';
          const systemMd = [
            '# System Context',
            '',
            `**Organization:** ${orgName}`,
            `**Description:** ${ctx.description || '(not set)'}`,
            `**Timezone:** ${timezone}`,
            `**Orchestrator:** ${orchestrator}`,
            `**Dashboard:** ${dashboardUrl}`,
            `**Communication Style:** ${ctx.communication_style || 'casual'}`,
            `**Day Mode:** ${ctx.day_mode_start || '08:00'} - ${ctx.day_mode_end || '00:00'}`,
            '**Framework:** cortextOS Node.js',
            '',
            '---',
            '',
            '## Team Roster',
            '',
            '> This section is populated during onboarding. For the live roster:',
            '```bash',
            'cortextos list-agents',
            '```',
            '',
            '## Agent Health',
            '',
            '```bash',
            'cortextos bus read-all-heartbeats',
            '```',
            '',
            '## Communication',
            '',
            '- Agent-to-agent: `cortextos bus send-message <agent> <priority> "<text>"`',
            '- Telegram to user: `cortextos bus send-telegram <chat_id> "<text>"`',
            '- React to a Telegram message (single emoji ack, no verbal noise): `cortextos bus react-telegram <chat_id> <message_id> 👍`',
            '- Check inbox: `cortextos bus check-inbox`',
            '',
          ].join('\n');
          writeFileSync(join(agentDir, 'SYSTEM.md'), systemMd, 'utf-8');
        } catch { /* leave template SYSTEM.md in place on write error */ }

        // Seed org-level tuning knobs into agent config.json
        try {
          const agentConfigPath = join(agentDir, 'config.json');
          if (existsSync(agentConfigPath)) {
            const agentCfg = JSON.parse(readFileSync(agentConfigPath, 'utf-8'));
            agentCfg.timezone = ctx.timezone || 'UTC';
            // Only seed day_mode_start/end if they look like valid HH:MM strings
            const timeRegex = /^\d{2}:\d{2}$/;
            agentCfg.day_mode_start = (typeof ctx.day_mode_start === 'string' && timeRegex.test(ctx.day_mode_start))
              ? ctx.day_mode_start : '08:00';
            agentCfg.day_mode_end = (typeof ctx.day_mode_end === 'string' && timeRegex.test(ctx.day_mode_end))
              ? ctx.day_mode_end : '00:00';
            agentCfg.communication_style = ctx.communication_style || 'direct and casual';
            agentCfg.approval_rules = {
              always_ask: Array.isArray(ctx.default_approval_categories)
                ? ctx.default_approval_categories
                : ['external-comms', 'financial', 'deployment', 'data-deletion'],
              never_ask: [],
            };
            writeFileSync(agentConfigPath, JSON.stringify(agentCfg, null, 2) + '\n', 'utf-8');
          }
        } catch { /* org context may be incomplete — agent keeps template defaults */ }
      }
    }

    // Update org context.json if this is the orchestrator
    if (options.template === 'orchestrator') {
      const contextPath = join(projectRoot, 'orgs', org, 'context.json');
      if (existsSync(contextPath)) {
        try {
          const context = JSON.parse(readFileSync(contextPath, 'utf-8'));
          if (!context.orchestrator) {
            context.orchestrator = name;
            writeFileSync(contextPath, JSON.stringify(context, null, 2) + '\n', 'utf-8');
          }
        } catch { /* ignore */ }
      }
    }

    // Register in enabled-agents.json
    const instanceId = options.instance;
    const ctxRoot = join(homedir(), '.cortextos', instanceId);
    const enabledPath = join(ctxRoot, 'config', 'enabled-agents.json');
    const configDir = join(ctxRoot, 'config');
    mkdirSync(configDir, { recursive: true });

    let enabledAgents: Record<string, any> = {};
    try {
      if (existsSync(enabledPath)) {
        enabledAgents = JSON.parse(readFileSync(enabledPath, 'utf-8'));
      }
    } catch { /* start fresh */ }

    if (!enabledAgents[name]) {
      enabledAgents[name] = {
        enabled: true,
        status: 'configured',
        ...(org ? { org } : {}),
      };
      writeFileSync(enabledPath, JSON.stringify(enabledAgents, null, 2) + '\n', 'utf-8');
      console.log(`  Registered in enabled-agents.json`);
    }

    // Scaffold buzz.json when --buzz-channel is given. Deliberately does
    // NOT generate a keypair here — identity minting stays a separate,
    // out-of-band operator step (buzz-admin generate-key), matching the
    // Slack precedent of requiring the operator to create the Slack app
    // and paste in a token rather than add-agent silently minting and
    // printing a secret that could end up in scrollback/screen-recordings.
    // allowed_pubkeys defaults to empty — fail-closed until the operator
    // explicitly grants access, same posture as Slack's allowed_users.
    if (options.buzzChannel) {
      const buzzConfig = {
        pubkey: '',
        display_name: name,
        channels: [options.buzzChannel],
        allowed_pubkeys: [] as string[],
      };
      writeFileSync(join(agentDir, 'buzz.json'), JSON.stringify(buzzConfig, null, 2) + '\n', 'utf-8');
      console.log(`  Scaffolded buzz.json for channel ${options.buzzChannel}`);
      console.log(`    NOTE: pubkey is empty and allowed_pubkeys is empty (fail-closed).`);
      console.log(`    Run \`buzz-admin generate-key\` to mint this agent's identity, fill in`);
      console.log(`    "pubkey" above, set BUZZ_PRIVATE_KEY in ${join('orgs', org, 'agents', name, '.env')},`);
      console.log(`    and add trusted senders' hex pubkeys to "allowed_pubkeys" before starting.`);
    }

    console.log(`\n  Agent "${name}" created.`);
    console.log(`\n  Next steps:`);
    console.log(`    1. Edit ${join('orgs', org, 'agents', name, '.env')} with your Telegram settings`);
    console.log(`    2. Customize identity files (IDENTITY.md, SOUL.md, GOALS.md)`);
    console.log(`    3. Start: cortextos start ${name}\n`);
  });

/**
 * Walk an agent's plugins/cortextos-agent-skills/skills tree and create one
 * symlink per skill in ~/.codex/skills/<agent_name>__<skill_name>.
 *
 * The agent-name prefix prevents collisions when multiple codex agents share
 * the host's ~/.codex/skills directory (codex's default skill discovery
 * location). Existing symlinks pointing at the same target are replaced;
 * non-symlink entries with the same name are left alone (we don't clobber
 * unknown files the user may have placed there).
 *
 * Returns the number of symlinks successfully created or refreshed.
 */
function installCodexSkillSymlinks(agentDir: string, agentName: string): number {
  const skillsRoot = join(agentDir, 'plugins', 'cortextos-agent-skills', 'skills');
  if (!existsSync(skillsRoot)) return 0;

  const codexSkillsDir = join(homedir(), '.codex', 'skills');
  mkdirSync(codexSkillsDir, { recursive: true });

  let linked = 0;
  const entries = readdirSync(skillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillSrc = join(skillsRoot, entry.name);
    const linkPath = join(codexSkillsDir, `${agentName}__${entry.name}`);
    try {
      // Replace an existing symlink — but never an actual file/dir owned by the user.
      if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false } as any)) {
        try {
          const st = lstatSync(linkPath);
          if (st.isSymbolicLink()) {
            unlinkSync(linkPath);
          } else {
            // Skip — something else is here, leave it.
            continue;
          }
        } catch { /* path likely doesn't exist; continue to symlink */ }
      }
      symlinkSync(skillSrc, linkPath, 'dir');
      linked++;
    } catch (err) {
      // Don't abort the whole scaffold for one bad symlink.
      console.error(`    Warning: failed to symlink ${linkPath}: ${(err as Error).message}`);
    }
  }
  return linked;
}

function installOpencodeSkillSymlinks(agentDir: string): number {
  const skillsRoot = join(agentDir, 'plugins', 'cortextos-agent-skills', 'skills');
  if (!existsSync(skillsRoot)) return 0;

  const opencodeSkillsDir = join(agentDir, '.opencode', 'skills');
  mkdirSync(opencodeSkillsDir, { recursive: true });

  let linked = 0;
  const entries = readdirSync(skillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillSrc = join(skillsRoot, entry.name);
    const linkPath = join(opencodeSkillsDir, entry.name);
    try {
      if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false } as any)) {
        try {
          const st = lstatSync(linkPath);
          if (st.isSymbolicLink()) {
            unlinkSync(linkPath);
          } else {
            continue;
          }
        } catch { /* path likely doesn't exist; continue to symlink */ }
      }
      symlinkSync(skillSrc, linkPath, 'dir');
      linked++;
    } catch (err) {
      console.error(`    Warning: failed to symlink ${linkPath}: ${(err as Error).message}`);
    }
  }
  return linked;
}

function findTemplateDir(projectRoot: string, template: string): string | null {
  const frameworkRoot = process.env.CTX_FRAMEWORK_ROOT || projectRoot;
  const candidates = [
    join(projectRoot, 'templates', template),
    join(frameworkRoot, 'templates', template),
    join(projectRoot, 'node_modules', 'cortextos', 'templates', template),
    // Relative to this file for development
    join(__dirname, '..', '..', 'templates', template),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function copyTemplateFiles(templateDir: string, agentDir: string, name: string, org: string): void {
  const files = readdirSync(templateDir);
  for (const file of files) {
    const srcPath = join(templateDir, file);
    const destPath = join(agentDir, file);
    try {
      const stat = require('fs').statSync(srcPath);
      if (stat.isFile()) {
        let content = readFileSync(srcPath, 'utf-8');
        // Replace template placeholders
        content = content.replace(/\{\{agent_name\}\}/g, name);
        content = content.replace(/\{\{org\}\}/g, org);
        content = content.replace(/\{\{current_timestamp\}\}/g, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
        writeFileSync(destPath, content, 'utf-8');
      } else if (stat.isDirectory() && file !== 'node_modules') {
        mkdirSync(destPath, { recursive: true });
        copyTemplateFiles(srcPath, destPath, name, org);
      }
    } catch { /* skip files that can't be read */ }
  }
}

/**
 * The standard agent file set, as filename -> content.
 *
 * SINGLE SOURCE OF TRUTH for what every agent must have, shared by the
 * no-template path (createMinimalAgent) and the template path (backfill).
 * They diverged before this existed, and the divergence ran the wrong way —
 * see backfillMissingAgentFiles.
 */
function standardAgentFiles(name: string, org: string, template: string, runtime = 'claude-code'): Record<string, string> {
  const role = template === 'orchestrator' ? 'Orchestrator'
    : template === 'analyst' ? 'Analyst'
    : 'Agent';

  // CLAUDE.md is CLAUDE-CODE-ONLY and must not be backfilled onto other runtimes.
  // codex-app-server reads AGENTS.md; a CLAUDE.md there is dead weight, and
  // tests/unit/cli/add-agent-codex.test.ts:95 asserts its absence.
  // THE FILE SET IS RUNTIME-DEPENDENT, NOT UNIVERSAL — I wrote this generator as
  // universal on the first pass and the codex test caught it. Same shape as every
  // container-as-label error today: I classified by the artifact's name rather
  // than by what actually consumes it.
  const claudeOnly = runtime === 'claude-code';

  return {
    'IDENTITY.md': `# ${name}\n\nYou are ${name}, a ${role} for ${org}.\n`,
    'SOUL.md': `# Soul\n\nYou are helpful, precise, and proactive.\n`,
    'GOALS.md': `# Goals\n\n- Awaiting goal configuration\n`,
    'HEARTBEAT.md': `# Heartbeat Checklist\n\n- [ ] Check inbox\n- [ ] Update heartbeat\n`,
    'MEMORY.md': `# Long-Term Memory\n\nNothing recorded yet.\n`,
    'USER.md': `# User Profile\n\nNot configured yet.\n`,
    'SYSTEM.md': `# System Context\n\nOrganization: ${org}\n`,
    'TOOLS.md': `# Available Tools\n\nUse \`cortextos bus <command>\` for bus operations.\n`,
    // CLAUDE.md is a thin wrapper that imports AGENTS.md (works with Claude Code's @ import syntax)
    ...(claudeOnly ? { 'CLAUDE.md': '@AGENTS.md\n' } : {}),
    'AGENTS.md': createAgentsMd(name, org, template),
  };
}

function createMinimalAgent(agentDir: string, name: string, org: string, template: string, runtime = 'claude-code'): void {
  for (const [file, content] of Object.entries(standardAgentFiles(name, org, template, runtime))) {
    writeFileSync(join(agentDir, file), content);
  }
}

/**
 * Fill in any standard file the chosen template omitted. Returns what it wrote.
 *
 * WHY THIS EXISTS (california-tom + zerocool, 2026-07-26) — THE INVERSION:
 * `add-agent` copied ONE resolved template dir with no base merge, and ran the
 * full-spine generator ONLY in the `else` branch, when no template dir was found.
 * So an agent got the complete file set precisely when its template DID NOT EXIST:
 *
 *   --template hermes       -> no GOALS.md, no AGENTS.md, no CLAUDE.md
 *   --template m2c1-worker  -> 9 of 10 missing; it booted with NO IDENTITY AT ALL
 *   --template <typo>       -> all 10, because the lookup failed
 *
 * ASKING FOR A REGISTERED TEMPLATE PRODUCED A LESS COMPLETE AGENT THAN ASKING FOR
 * ONE THAT DOES NOT EXIST — having a template was strictly worse than not having
 * one, on a documented command (both names are in NON_CODEX_TEMPLATES and both are
 * reachable via `cortextos add-agent <name> --template <t>`).
 *
 * Fixed as a BACKFILL rather than by hand-authoring the missing files into the two
 * templates that happened to be caught. Hand-authoring repairs the instances and
 * leaves the class: the next partial template re-creates the defect silently, and
 * nothing checks. The generator is already the source of truth for "what an agent
 * needs" — this just stops the template path from bypassing it.
 *
 * NEVER OVERWRITES. A template that ships a file is authoritative for that file;
 * this only fills genuine absences, so it is a no-op for complete templates.
 * SYSTEM.md is additionally regenerated downstream from orgs/<org>/context.json,
 * which is gated on that file existing and NOT on the template — so SYSTEM.md was
 * the one member of this set already covered for every template.
 */
function backfillMissingAgentFiles(agentDir: string, name: string, org: string, template: string, runtime = 'claude-code'): string[] {
  const written: string[] = [];
  for (const [file, content] of Object.entries(standardAgentFiles(name, org, template, runtime))) {
    if (existsSync(join(agentDir, file))) continue;
    writeFileSync(join(agentDir, file), content);
    written.push(file);
  }
  return written;
}

function createAgentsMd(name: string, org: string, template: string): string {
  return `# cortextOS ${template.charAt(0).toUpperCase() + template.slice(1)}

## BOOTSTRAP PROTOCOL - READ EVERY FILE BEFORE DOING ANYTHING

Read these files at the start of EVERY session:
1. IDENTITY.md
2. SOUL.md
3. GOALS.md
4. HEARTBEAT.md
5. MEMORY.md
6. memory/$(date -u +%Y-%m-%d).md (today's session state)
7. TOOLS.md
8. SYSTEM.md
9. config.json
10. USER.md

## Bus Commands

Send messages: \`cortextos bus send-message <agent> <priority> "<text>"\`
Check inbox: \`cortextos bus check-inbox\`
ACK messages: \`cortextos bus ack-inbox <id>\`
Create tasks: \`cortextos bus create-task "<title>" --assignee <agent> --priority <p>\`
Update tasks: \`cortextos bus update-task <id> <status>\`
Complete tasks: \`cortextos bus complete-task <id> --result "<text>"\`
Log events: \`cortextos bus log-event <category> <event> <severity>\`
Update heartbeat: \`cortextos bus update-heartbeat "<status>"\`
Send Telegram: \`cortextos bus send-telegram <chat_id> "<text>"\`
React to Telegram message (single emoji ack): \`cortextos bus react-telegram <chat_id> <message_id> 👍\`
`;
}
