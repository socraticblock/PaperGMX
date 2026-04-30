---
name: coding-memory
description: "Persistent cross-session memory for coding. Automatically logs mistakes, user preferences, successful patterns, and library gotchas. READ this skill FIRST at the start of every coding session to load accumulated wisdom. WRITE to it when you learn something new, make a mistake, or discover a pattern."
---

# Coding Memory — Persistent Learning System

## Purpose

You forget things between conversations. This skill solves that by maintaining a persistent memory file that survives across sessions. Every time you learn something — a bug fix, a user preference, a library gotcha, a successful pattern — you log it here so future-you can benefit.

## Memory File Location

**`/home/z/my-project/.coding-memory.md`**

This file persists across conversations. Read it at the START of every coding session. Write to it whenever you learn something worth remembering.

## Memory Protocol

### At Session Start (MANDATORY)

1. Read `/home/z/my-project/.coding-memory.md`
2. If it doesn't exist, create it with the template below
3. Review the "Recent Learnings" section
4. Apply any relevant preferences or patterns to your current work

### When to Log (AUTOMATIC)

Log an entry whenever:
- **You made a mistake** that could recur (wrong import, wrong API, wrong assumption)
- **A user corrects you** on something (especially if you were confidently wrong)
- **You discover a gotcha** in a library/framework (Next.js, React, Tailwind, shadcn, etc.)
- **A user states a preference** ("I prefer dark mode", "Always use Dutch", "Never use purple")
- **You find a pattern that works really well** (a component structure, a state pattern, an animation)
- **You debug something non-obvious** (the fix wasn't what you expected)
- **You learn a new API or feature** (a new shadcn component, a new Next.js pattern)

### When NOT to Log

- Things that are in the official documentation and unlikely to change
- One-off preferences that only apply to a specific project
- Information that's already in other skills (ultra-dev, honest-responses)
- Trivial observations ("user said thanks")

## Memory File Template

Create the file with this structure if it doesn't exist:

```markdown
# Coding Memory — Persistent Learning Log

## Active Preferences
<!-- User preferences that affect how you code -->

## Mistakes & Corrections
<!-- Things you got wrong and learned from -->

## Library Gotchas
<!-- Non-obvious behavior in libraries/frameworks -->

## Successful Patterns
<!-- Patterns that worked well and should be reused -->

## Bug Encyclopedia
<!-- Bugs encountered, root cause, and how to fix -->

## Performance Notes
<!-- Performance-related learnings -->

## Session Log
<!-- Brief log of what was worked on each session -->
```

## Memory Entry Format

Each entry should be concise and actionable:

```markdown
### [Date] [Category]: Brief Title
- **Context**: What was happening
- **Learning**: What you learned
- **Action**: What to do differently next time
```

Example entries:

```markdown
### 2026-04-02 [Mistake]: Referenced non-existent service.id
- **Context**: service-overview.tsx used service.id for keys, but the Service type has .slug not .id
- **Learning**: Always check the actual type definition before referencing properties
- **Action**: When creating data types, use consistent naming (id vs slug). When consuming, verify against the type.

### 2026-04-01 [Gotcha]: next-themes imported by shadcn sonner
- **Context**: sonner.tsx from shadcn imports next-themes but it wasn't in package.json
- **Learning**: shadcn components can have transitive dependencies not visible in the component itself
- **Action**: When using ANY shadcn component, check its imports for transitive deps. Trace every import chain.

### 2026-04-02 [Preference]: Client prefers Dutch for Belgian websites
- **Context**: Building thelaserstudio.be
- **Learning**: Always use Dutch (Flemish Belgian Dutch) for Belgium-based clients unless told otherwise
- **Action**: When the domain is .be, default to Dutch content
```

## Memory Categories

### 1. Active Preferences
Things the user has explicitly stated they want or don't want. These override defaults.

Format:
```markdown
- **Language**: Dutch for .be domains, English otherwise
- **Styling**: No default blue/purple, prefers warm/earthy tones
- **Framework**: Always Next.js App Router, never Pages Router
- **Communication**: Prefers concise updates, not verbose explanations
```

### 2. Mistakes & Corrections
The most valuable category. These are things you got WRONG and were corrected on.

### 3. Library Gotchas
Non-obvious behavior that isn't documented prominently:
- shadcn components importing packages not in the user's package.json
- Next.js version-specific behavior changes
- Tailwind v4 vs v3 differences
- Framer Motion SSR issues
- React 19 breaking changes

### 4. Successful Patterns
Component structures, state patterns, or architectural decisions that worked well:
- "Slide-over panel with Cal.com embed worked perfectly for booking"
- "Tabbed pricing using shadcn Tabs is cleaner than custom implementation"
- "Discriminated union for async state > separate boolean flags"

### 5. Bug Encyclopedia
Specific bugs encountered, their root cause, and the fix:
- "Hydration mismatch from using window.innerWidth in Server Component"
- "Infinite re-render from setting state in useEffect without dependency"
- "CSS specificity issue from mixing Tailwind utilities with custom CSS"

### 6. Performance Notes
- "next/image with fill prop is better than width/height for responsive images"
- "Framer Motion layout animations cause performance issues on long lists"
- "Dynamic imports for heavy components (Cal.com embed) save 200KB initial bundle"

### 7. Session Log
Brief entries:
```markdown
- 2026-04-02: Built The Laser Studio website (11 pages, Next.js, Cal.com booking)
- 2026-04-01: Created honest-responses, ultra-dev, elite-agent skills
```

## Memory Maintenance

### Keep It Lean
- Maximum 200 entries per category
- Delete entries older than 6 months (unless still relevant)
- Merge similar entries
- Remove entries that are now in other skills

### Keep It Actionable
Every entry should answer: "What should I DO differently next time?"
If you can't turn it into an action, it's not worth logging.

### Keep It Honest
Log your mistakes without sugarcoating. The purpose is to IMPROVE, not to look good.
Example of bad entry: "Minor issue with import paths" 
Example of good entry: "Used service.id when the type only has service.slug — caused key prop warning and runtime crash"

## Integration with Other Skills

This skill works alongside:
- **`honest-responses`** — when you're corrected, log it here
- **`ultra-dev`** — library gotchas feed into the Pre-Flight Checks
- **`elite-agent`** — successful patterns feed into proactive intelligence
- **`coding-elite`** — bugs feed into the debugging protocol

## The Memory Loop

```
Session Start:
  → Read memory file
  → Apply preferences
  → Note relevant gotchas

During Session:
  → Encounter mistake/learning
  → Log it in memory file

Session End:
  → Review what was learned
  → Log session summary
  → Clean up stale entries
```

This creates a **compounding advantage**: every session makes you slightly better than the last one.
