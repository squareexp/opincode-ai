import { homeDir } from "@tauri-apps/api/path";
import { native } from "@/modules/ai/lib/native";
import { quoteShellArg } from "@/lib/shellQuote";
import { invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";

export type ResolvedSkill = {
  /** Absolute path to the skill file (SKILL.md for dir-based, or the file itself). */
  path: string;
  /** Human-friendly name (directory name or filename without extension). */
  name: string;
  /** File extension if file-based, empty if directory-based. */
  ext: string;
  /** Whether this skill is a directory-based skill (contains SKILL.md). */
  isDirSkill?: boolean;
};

async function getGlobalSkillsDirs(): Promise<string[]> {
  const raw = await homeDir();
  const clean = raw.replace(/\\/g, "/").replace(/\/$/, "");
  return [
    `${clean}/.agents/skills`,
    `${clean}/.codex/skills`,
    `${clean}/.claude/skills`,
  ];
}

async function getLocalSkillsDirs(workspaceRoot: string | null): Promise<string[]> {
  if (!workspaceRoot) return [];
  const clean = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  return [
    `${clean}/.agents/skills`,
    `${clean}/.codex/skills`,
    `${clean}/.claude/skills`,
  ];
}

type DirEntryRaw = { name: string; kind: string; size: number; mtime: number };

/**
 * Read a skills directory with showHidden:true so dot-prefixed parent dirs
 * (.agents, .codex, .claude) are accessible. This bypasses native.readDir
 * which hardcodes showHidden:false.
 */
async function safeReadDir(path: string): Promise<DirEntryRaw[]> {
  try {
    return await invoke<DirEntryRaw[]>(
      "fs_read_dir",
      { path, showHidden: true, workspace: currentWorkspaceEnv() },
    );
  } catch {
    return [];
  }
}

/**
 * Resolve skills from a single directory. Supports two conventions:
 *
 * 1. **Directory-based** (e.g. `.codex/skills/homekit/SKILL.md`):
 *    A subdirectory whose name is the skill name, containing a SKILL.md.
 *    These are the standard format used by codex/agents/claude skill packs.
 *
 * 2. **File-based** (e.g. `.agents/skills/refactor.md`):
 *    A single file whose name (minus extension) is the skill name.
 */
async function resolveSkillsFromDir(skillsDir: string): Promise<ResolvedSkill[]> {
  const entries = await safeReadDir(skillsDir);
  const skills: ResolvedSkill[] = [];

  for (const entry of entries) {
    // Skip hidden entries like .DS_Store, .system, etc.
    if (entry.name.startsWith(".")) continue;

    if (entry.kind === "dir") {
      // Directory-based skill — must contain SKILL.md
      const skillFile = `${skillsDir}/${entry.name}/SKILL.md`;
      // We trust it exists if the folder is present (lazy-check on run)
      skills.push({
        path: skillFile,
        name: entry.name,
        ext: "",
        isDirSkill: true,
      });
    } else if (entry.kind === "file") {
      // File-based skill — the file itself is the skill
      const nameWithoutExt = entry.name.replace(/\.[a-zA-Z0-9]+$/, "");
      const ext = entry.name.includes(".")
        ? entry.name.slice(entry.name.lastIndexOf(".") + 1)
        : "";
      skills.push({
        path: `${skillsDir}/${entry.name}`,
        name: nameWithoutExt,
        ext,
        isDirSkill: false,
      });
    }
  }

  return skills;
}

export async function findSkill(
  skillName: string,
  workspaceRoot: string | null,
): Promise<ResolvedSkill | null> {
  const target = skillName.toLowerCase();

  // 1. Local workspace skills (override global)
  const localDirs = await getLocalSkillsDirs(workspaceRoot);
  for (const localDir of localDirs) {
    const skills = await resolveSkillsFromDir(localDir);
    const found = skills.find((s) => s.name.toLowerCase() === target);
    if (found) return found;
  }

  // 2. Global skills
  const globalDirs = await getGlobalSkillsDirs();
  for (const globalDir of globalDirs) {
    const skills = await resolveSkillsFromDir(globalDir);
    const found = skills.find((s) => s.name.toLowerCase() === target);
    if (found) return found;
  }

  return null;
}

export async function runSkill(
  skill: ResolvedSkill,
  remainingText: string,
  workspaceRoot: string | null,
): Promise<string> {
  const ext = skill.ext.toLowerCase();

  // Directory-based skill → read ALL files in the skill directory
  if (skill.isDirSkill) {
    const skillDir = skill.path.replace(/\/SKILL\.md$/i, "");
    // Read every non-hidden file in the skill directory
    const entries = await safeReadDir(skillDir);
    const textFiles = entries.filter(
      (e) => e.kind === "file" && !e.name.startsWith("."),
    );

    // Sort: SKILL.md first, then alphabetically
    textFiles.sort((a, b) => {
      if (a.name.toLowerCase() === "skill.md") return -1;
      if (b.name.toLowerCase() === "skill.md") return 1;
      return a.name.localeCompare(b.name);
    });

    const parts: string[] = [];
    let mainTemplate: string | null = null;

    for (const entry of textFiles) {
      const filePath = `${skillDir}/${entry.name}`;
      const read = await native.readFile(filePath);
      if (read.kind !== "text") continue;
      const content = read.content;

      if (entry.name.toLowerCase() === "skill.md") {
        // This is the main prompt template — strip frontmatter and handle {{input}}
        mainTemplate = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
      } else {
        // All other files: attach as context blocks
        parts.push(`<file name="${entry.name}">\n${content}\n</file>`);
      }
    }

    // If no SKILL.md found, fall back to reading the path we were given
    if (mainTemplate === null) {
      const fallback = await native.readFile(skill.path);
      if (fallback.kind === "text") {
        mainTemplate = fallback.content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
      } else {
        throw new Error(`Skill "${skill.name}" (${skill.path}) is not readable as text.`);
      }
    }

    // Replace {{input}} / {{prompt}} in the main template
    let body = mainTemplate;
    if (body.includes("{{input}}")) {
      body = body.replace(/\{\{input\}\}/g, remainingText);
    } else if (body.includes("{{prompt}}")) {
      body = body.replace(/\{\{prompt\}\}/g, remainingText);
    } else {
      body = body + (remainingText ? `\n\n${remainingText}` : "");
    }

    // Prepend any extra context files before the main prompt
    return parts.length > 0 ? `${parts.join("\n\n")}\n\n${body}` : body;
  }

  // File-based markdown/text skill → treat as prompt template
  if (ext === "md" || ext === "txt" || ext === "") {
    const read = await native.readFile(skill.path);
    if (read.kind !== "text") {
      throw new Error(`Skill "${skill.name}" (${skill.path}) is not readable as text.`);
    }
    const template = read.content;

    // Strip YAML frontmatter if present
    const body = template.replace(/^---\n[\s\S]*?\n---\n?/, "");

    if (body.includes("{{input}}")) {
      return body.replace(/\{\{input\}\}/g, remainingText);
    }
    if (body.includes("{{prompt}}")) {
      return body.replace(/\{\{prompt\}\}/g, remainingText);
    }
    return body + (remainingText ? `\n\n${remainingText}` : "");
  }

  // Script-based skills
  let interpreter = "";
  if (ext === "sh" || ext === "bash" || ext === "zsh") {
    interpreter = "/bin/sh";
  } else if (ext === "py") {
    interpreter = "python3";
  } else if (ext === "js") {
    interpreter = "node";
  }

  const escapedArg = quoteShellArg(remainingText);
  const command = interpreter
    ? `${interpreter} "${skill.path}" ${escapedArg}`
    : `"${skill.path}" ${escapedArg}`;

  const runCwd = workspaceRoot || undefined;
  const out = await native.runCommand(command, runCwd);

  if (out.exit_code !== 0) {
    const errMsg = out.stderr.trim() || out.stdout.trim() || `exit code ${out.exit_code}`;
    throw new Error(`Script error: ${errMsg}`);
  }

  return out.stdout.trim();
}

export async function listAllSkills(workspaceRoot: string | null): Promise<ResolvedSkill[]> {
  // Map keyed by lowercase skill name so local overrides global and later
  // dirs override earlier ones.
  const map = new Map<string, ResolvedSkill>();

  // 1. Global skills (loaded first, lowest priority)
  const globalDirs = await getGlobalSkillsDirs();
  for (const globalDir of globalDirs) {
    const skills = await resolveSkillsFromDir(globalDir);
    for (const skill of skills) {
      // Don't overwrite — first-found wins (local later overrides)
      if (!map.has(skill.name.toLowerCase())) {
        map.set(skill.name.toLowerCase(), skill);
      }
    }
  }

  // 2. Local workspace skills (higher priority, override global)
  const localDirs = await getLocalSkillsDirs(workspaceRoot);
  for (const localDir of localDirs) {
    const skills = await resolveSkillsFromDir(localDir);
    for (const skill of skills) {
      map.set(skill.name.toLowerCase(), skill); // Override
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
