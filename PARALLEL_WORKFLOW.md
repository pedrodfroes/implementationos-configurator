# Parallel Agent Workflow

## Folders and branches

| Purpose | Folder | Branch |
| --- | --- | --- |
| Integration | `Digital Transformation Configurator` | `main` |
| Codex work | `DTC-codex` | `codex` |
| Claude work | `DTC-claude` | `claude` |

Do not ask both agents to edit the integration folder. Give each agent its own worktree folder.

## Daily workflow

1. Give Codex tasks in `DTC-codex`.
2. Give Claude tasks in `DTC-claude`.
3. Ask each agent to commit completed tasks with a focused commit message.
4. Merge finished work into `main` from the integration folder.

```powershell
cd "C:\Users\pedro\OneDrive\Documentos\Digital Transformation Configurator"
git merge codex
git merge claude
```

If a merge reports conflicts, resolve them in the integration folder, then run:

```powershell
git add .
git commit
```

## Refresh agent worktrees

After changes are merged into `main`, update both agent folders before starting new work:

```powershell
git -C "C:\Users\pedro\OneDrive\Documentos\DTC-codex" merge main
git -C "C:\Users\pedro\OneDrive\Documentos\DTC-claude" merge main
```

## Preview ports

Run each worktree on a different port so previews do not collide:

- Integration: `4173`
- Codex: `4174`
- Claude: `4175`

## Guardrails

- Commit before switching tasks or handing work to the other agent.
- Keep commits focused on one feature or fix.
- Avoid assigning both agents the same file or feature at the same time when possible.
- Merge one branch at a time and test `main` after each merge.
- Never copy whole files between worktrees; merge or cherry-pick commits instead.
