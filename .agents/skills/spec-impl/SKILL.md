---
name: spec-impl
description: Implements an approved spec. Validates that the state means "Approved" (in any language), creates a git branch named after the spec, switches to it, and then implements the plan either step by step (pausing after each numbered step for review) or in a single pass, depending on the mode argument. Use it after /spec, once the human has approved the spec.
disable-model-invocation: true
argument-hint: '<NN-spec-name> [step|auto]'
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(*)
---

# /spec-impl — Implementer of approved specs

> Local fork of `klerith/fernando-skills` → `skills/engineering/spec-impl`.
> The only extension is the execution mode, chosen by argument. Everything else
> (state validation, branch creation, the "never commit automatically" rule)
> follows the upstream skill so the two stay easy to diff.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Execution mode

The mode is **only** set by argument. It is not read from any config file, on purpose: the mode is a decision about this particular run, not a property of the repository.

| Mode       | Accepted tokens (case-insensitive)          | Behaviour                                                                                              |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `step`     | `step`, `paso`, `paso-a-paso`, `steps`      | Implement one numbered step of the plan, run the verification that step defines, show the diff, wait.    |
| `auto`     | `auto`, `todo`, `oneshot`, `de-una-vez`     | Implement the whole plan in a single pass, without pausing between steps. Report once at the end.        |

**How to parse `$ARGUMENTS`:**

- The mode is a standalone token, and it may come before or after the spec reference. `/spec-impl 02 step`, `/spec-impl step 02` and `/spec-impl 02-powerups auto` are all valid.
- Any token that is not one of the mode tokens above is part of the spec reference.
- If **two** mode tokens appear, or a token is ambiguous (e.g. `stepping`), do not guess. Ask.

**If no mode token is present, do not assume one.** Ask the user with exactly these two options and wait:

```
Which mode should I use?

  1. step  (recommended) — I implement one step of the plan, run its verification,
                           show you the diff, and wait for your OK before the next one.
  2. auto               — I implement the whole plan in one pass and report at the end.
```

Recommend `step` by default. In `auto` mode a wrong assumption is expensive to unwind; in `step` mode it costs one message.

**In both modes** the following stay exactly the same: the state validation (Phase 2), the branch handling (Phase 3), the rule that you never commit automatically, and the rule about a spec whose rule does not work (Phase 4). The mode only changes **whether you pause between steps**, not what counts as a finished step.

---

## Instructions

Follow these four phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

Strip the mode token first (see **Execution mode** above). What remains is the spec reference.

If the spec reference is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If the spec reference has a value:

- Look for the file in `specs/`. The user may have written the full name (`01-mvp-arkanoid`), only the number (`01`), or only the slug (`mvp-arkanoid`). Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The header label is typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match by position (status line near the top of the spec) and by the surrounding state machine, not by the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, or any unrecognized value) means **stop** and show the error message below.

| State category                            | Examples (any language)                           | Action                                     |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

0. **Check the working tree first.** Look at the `git status --short` output in the session context above. If it is **not empty**, stop and show the pending changes, then ask:

   ```
   ⚠️ There are uncommitted changes in the working tree.
   Switching branches would carry them over. What do you want to do?
     1. Commit or stash them yourself, then re-run this command  (recommended)
     2. Continue anyway — the changes travel to the new branch
   ```

   Wait for the answer. **Do not stash or commit on the user's behalf** unless they explicitly ask for it. If the working tree is clean, skip straight to step 1 without mentioning it.

1. Derive the branch name from the spec file's full name, without the extension. Format: `spec-NN-slug`. Examples:

   - `01-mvp-arkanoid.md` → branch `spec-01-mvp-arkanoid`
   - `02-powerups.md` → branch `spec-02-powerups`

2. Read the `AutoCreateBranch` flag from the **Branch-creation config** shown in the session context above.

   - If the config file does not exist, the value is missing, or the value is unrecognized → treat it as `true` (the default).
   - Only an explicit `false` (in any capitalization) disables automatic branch creation.

   **If `AutoCreateBranch` is `true` (default):** proceed without asking.

   - If the branch **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: this means previous work is being resumed. Switch to it, read `git log --oneline` on the branch, and tell the user which steps of the plan already look done and which step you propose to resume from. Wait for confirmation on the resume point before implementing anything.
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change was successful before continuing.

   **If `AutoCreateBranch` is `false`:** ask before touching git. Show:

   ```
   AutoCreateBranch is set to false.
   Create and switch to the branch spec-NN-slug? [y/N]
   ```

   - If the user answers **yes**: create/switch to the branch exactly as in the `true` case above.
   - If the user answers **no** or leaves it empty: **do not create any branch.** Tell the user you will implement on the current branch (the one shown in the session context above) and ask for explicit confirmation to continue there. Do not improvise — wait for the answer.

3. Visually confirm to the user the spec is ready, which branch is active, and which mode you will run:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)   (← or the current branch, if no new branch was created)
   State:  Approved   (← echo back the actual value found in the spec)
   Mode:   step|auto  (← echo back the mode you parsed, or the one the user just chose)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be authored in any language.

5. Then ask for the go-ahead, phrased for the mode:

   **`step` mode:**
   ```
   I will implement the plan one step at a time and pause after each step so you
   can review the diff.

   Shall we start with Step 1?
   ```

   **`auto` mode:**
   ```
   I will implement the whole plan in one pass and report when I am done. I will
   only stop early if a rule in the spec turns out not to work, or if I hit
   something the spec does not resolve.

   Shall I go ahead?
   ```

   Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent) in both modes. Do not start without it.

---

### Phase 4 — Implement

Rules that apply in **both** modes:

**Never commit automatically.** Not per step, not at the end. You write the code and show the diff; committing is the user's decision and the user's command. Only commit if they explicitly ask you to.

**Implement what the spec says.** If something in the spec looks suboptimal but works, mention it as an observation and implement what was agreed. Changes to the spec go into the spec, not into the code by surprise. (If it does *not* work, that is a different case — see below.)

**Run the verification each step defines.** Every step of the plan carries its own verification. Run it. If it cannot be run (no test runner, needs a human, environment not available), **say so explicitly** and mark it as not verified — never report an unrun verification as passed.

**Keep the working tree on the spec's branch.** Do not create extra branches, do not push, do not open a pull request unless the user asks.

#### If a rule in the spec does not work

This is **not** the same as an ambiguity. An ambiguity is something the spec does not say. A broken rule is something the spec *does* say, and which does not produce the result the spec claims it produces.

When you measure that a rule of the spec does not work:

1. **Stop.** Do not implement the broken rule. Do not fix it on your own.
2. **Show the evidence.** What you ran, the numbers you measured, and what the spec said would happen instead. Measured values, not an opinion. "The spec says the ghost reaches (1,1); it oscillates between (5,1) and (6,1)" beats "this rule seems wrong".
3. **Explain the mechanism.** Why the rule fails, in one or two sentences.
4. **Propose one concrete alternative**, and say exactly what it would change in the spec (which sections, which acceptance criteria).
5. **Wait for the user's decision.**

Only after the user approves may you touch the spec or the code. When they do, record the change in the spec's **Decisions** section, with the reason and the measurement that motivated it.

Do not implement a broken rule "literally anyway". A rule that cannot meet its own acceptance criteria is a defect of the spec, and the spec is what gets fixed.

#### If you find an ambiguity the spec does not resolve

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

#### If the user asks for something that is out of the spec's scope

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

---

#### Mode `step` — the work rhythm

- Implement **one** numbered step of the plan.
- Run that step's verification and show the result.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- **Wait for confirmation before continuing.** Do not chain two steps because they look small.

When finishing the last step, go to **Closing** below.

---

#### Mode `auto` — the work rhythm

- Implement the numbered steps in order, without pausing between them.
- After each step, run its verification. If a verification fails, stop there and report it — do not keep going on a broken base.
- Do not ask for confirmation between steps. The user asked for a single pass.

When finishing the last step, go to **Closing** below.

---

### Closing (both modes)

Report, in this order:

1. **Steps:** one line per numbered step of the plan, with its verification result.
2. **Files:** every file created or modified, and what changed in each.
3. **Acceptance criteria:** walk the checklist and state, for each item, whether you verified it and how — or that you did not verify it and why. **Never tick an item you did not verify.** This is the part the user will read most carefully.
4. **Deviations:** anything you did differently from the plan, and anything you left undone.

Then hand over:

```
✅ All steps of the plan are implemented.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" (or the equivalent
in your repo's language) and make the final commit before merging this branch.
```

Do not update the spec's state yourself, and do not commit. Both are the human's call.

---

## Summary of expected behavior

```
/spec-impl 01-mvp-arkanoid step

  Mode     →  Parsed from the argument → "step"
  Phase 1  →  Finds specs/01-mvp-arkanoid.md
  Phase 2  →  Reads the state → "Approved" (or "Aprobado", etc.) → ✅ continues
  Phase 3  →  git checkout -b spec-01-mvp-arkanoid
              Shows objective, scope, plan and criteria
              Asks "Shall we start with Step 1?"
  Phase 4  →  One step → verification → diff → wait for OK → next step
              Ends with the closing report + the reminder to verify criteria

/spec-impl 02-powerups auto

  Mode     →  Parsed from the argument → "auto"
  Phase 1  →  Finds specs/02-powerups.md
  Phase 2  →  Reads the state → "Approved" → ✅ continues
  Phase 3  →  Branch handling as usual, asks for a single go-ahead
  Phase 4  →  Runs the whole plan in one pass
              Stops early only on a broken rule or an unresolved ambiguity
              Ends with the closing report

/spec-impl 03-levels

  Mode     →  No mode token → asks which mode, waits. Does not assume.

/spec-impl 02-powerups step   (state: Draft / Borrador)

  Mode     →  "step"
  Phase 1  →  Finds specs/02-powerups.md
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code
```

**Branch creation is controlled by the `AutoCreateBranch` flag** in `specs/.spec-config.yml`. It defaults to `true` (create the branch automatically, as shown above). Set it to `false` to make Phase 3 ask `[y/N]` before creating the branch.

**The execution mode is controlled only by the argument.** There is deliberately no config key for it: `AutoCreateBranch` is a repository property, while the mode is a per-run decision.
