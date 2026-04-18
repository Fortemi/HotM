---
name: "commit-and-push"
description: "Create a well-formatted git commit and push to remote repository"
platforms: [codex]
---

# Commit and Push

You are a Git Version Control Specialist. Create clear, well-structured commits following project conventions.

## Task

When invoked with `/commit-and-push [commit-message-summary]`:

1. **Review** changes using `git status` and `git diff --stat`
2. **Stage** appropriate files (exclude generated files, secrets)
3. **Craft** commit message following conventions below
4. **Commit** with proper formatting (HEREDOC for multi-line)
5. **Push** to remote repository

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (Required)

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes bug nor adds feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `chore`: Build process or auxiliary tools
- `ci`: CI/CD configuration
- `build`: Build system or dependencies
- `revert`: Reverts a previous commit

### Scope (Optional)

Component or area affected. Project-specific scopes for AIWG:
- `agents`, `commands`, `templates`, `tools`, `docs`, `intake`, `flows`
- `cli`, `config`, `tests`, `api`, `ui`

### Subject (Required)

- Imperative mood ("add feature" not "added feature")
- Lowercase first letter, no period at end
- Maximum 50 characters
- Be specific and concise

### Body (Optional but Recommended for Multi-Area Changes)

- Separate from subject with blank line
- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Use bullet points for multiple changes
- Reference issues if applicable

### Footer (Optional)

- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Closes #123`, `Fixes #456`, `Refs #789`

## CRITICAL: No AI Attribution

**DO NOT include** in commit messages:
- `Generated with Claude Code` or any AI tool name
- `Co-Authored-By: Claude` or any AI co-author
- Any AI tool attribution or signatures

## Workflow

### Step 1: Review Changes (stat-first approach)

```bash
git status
git diff --stat                 # file-level summary, not full content
git diff --cached --stat        # staged changes summary
git log --oneline -5            # recent commit style reference
```

Only read full diff for specific files when the stat is insufficient to understand the change:
```bash
git diff -- <specific-file>     # targeted full diff when needed
```

**Rule**: For files you already modified in this session, the stat is sufficient. Only read full diffs for unfamiliar files or when the filename alone doesn't clarify the change.

### Step 2: Stage Files

Stage specific files by name. Exclude: `.env`, secrets, `dist/`, `build/`, `node_modules/`, `*.log`, IDE files.

```bash
git add path/to/file1 path/to/file2
```

If files are unrelated (e.g., bug fix + docs), make separate commits.

### Step 3: Commit

**Standard**:
```bash
git commit -m "type(scope): subject"
```

**HEREDOC** (for messages with body/footer):
```bash
git commit -m "$(cat <<'EOF'
type(scope): subject

Body paragraph explaining the change.

- Bullet point 1
- Bullet point 2

Closes #123
EOF
)"
```

**DO NOT use**: `--no-verify`, `--allow-empty-message`, `--amend` (unless explicitly correcting last commit).

### Step 4: Push

```bash
git push
```

**NEVER** force push to shared branches unless explicitly required and safe.

## References

- @$AIWG_ROOT/agentic/code/addons/aiwg-utils/README.md — aiwg-utils addon overview
- @$AIWG_ROOT/agentic/code/addons/aiwg-utils/rules/human-authorization.md — Confirmation before destructive git operations
- @$AIWG_ROOT/agentic/code/addons/aiwg-utils/rules/instruction-comprehension.md — Correct interpretation of commit message intent
- @$AIWG_ROOT/docs/cli-reference.md — CLI reference for AIWG versioning and release workflow
