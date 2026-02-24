# Copilot Guardrails & Token Optimization Guide

## Model Selection Strategy

### Based on Your Available Models (from screenshot)

| Task Type | Recommended Model | Cost Ratio | Rationale |
|-----------|------------------|------------|-----------|
| **Code Review/Analysis** | Claude Haiku 4.5 | 0.33x | Fast, cheap, good for reading/explaining |
| **Documentation** | Claude Haiku 4.5 | 0.33x | Sufficient for doc generation |
| **Simple Bug Fixes** | Gemini 3 Flash | 0.33x | Quick, cost-effective |
| **Complex Development** | Claude Sonnet 4.5 | 1x | Best balance of quality/cost |
| **Architecture Decisions** | Claude Opus 4.5 | 3x | Only for critical decisions |

### Cost Optimization Rules
1. **Start with Haiku** - Switch to Sonnet only if insufficient
2. **Avoid Opus** for routine tasks - Reserve for architecture/complex refactoring
3. **GPT-5 variants with warnings (⚠)** may have reliability issues

---

## Mandatory Workflow (Token Guard)

### STOP-THINK-PROPOSE-ACT Protocol

```
1. ANALYZE  → Read and understand (no code changes)
2. CLARIFY  → Ask questions if ambiguous
3. PROPOSE  → Pseudo-code or bullet plan
4. CONFIRM  → Wait for user approval
5. EXECUTE  → Make minimal, targeted changes
```

### Before ANY Code Change, You MUST:
- [ ] Summarize what you understand in 2-3 sentences
- [ ] List affected files (max 3 per change)
- [ ] Provide pseudo-code or change outline
- [ ] Wait for explicit "proceed" or "go ahead"

---

## Token-Saving Instructions

### DO NOT:
- ❌ Read entire files when searching for specific patterns
- ❌ Make changes without explicit user confirmation
- ❌ Generate lengthy explanations (keep under 200 words)
- ❌ Create new documentation files unless requested
- ❌ Auto-fix linting/formatting issues
- ❌ Explore unrelated code paths
- ❌ Use semantic_search in parallel (sequential only)

### DO:
- ✅ Use grep_search with specific patterns first
- ✅ Read only relevant line ranges (50-100 lines max initially)
- ✅ Ask clarifying questions before deep exploration
- ✅ Provide brief, actionable responses
- ✅ Batch independent read operations in parallel
- ✅ Stop and ask when scope expands

---

## Project-Specific Guardrails

### Architecture Layers (This Project)

```
src/                → All application source code
  App.tsx           → Main application entry (Layer 1: UI)
  features/         → Feature modules (Layer 2: Business Logic)
    editor/         → Markdown editor feature
    file-explorer/  → File navigation feature
  shared/           → Reusable components, utils
    components/ui/  → shadcn/ui components
  core/             → Config, stores, adapters (Layer 3: Infrastructure)
    file-manager/   → File system abstraction
    store/          → Global state (Zustand)
  pages/            → Page components
  hooks/            → Custom React hooks
  styles/           → Global styles
```

### Before Modifying Code, Identify:
1. **Which layer?** (UI / Feature / Core)
2. **Which feature?** (editor / file-explorer / shared)
3. **Dependencies?** (stores, hooks, utils)

---

## Design Principles (Enforce These)

### KISS (Keep It Simple, Stupid)
- Prefer simple solutions over clever ones
- One function = one responsibility
- Avoid premature abstraction

### DRY (Don't Repeat Yourself)
- Check for existing utilities in `src/shared/utils/`
- Check for existing hooks in feature `hooks/` folders
- Reuse shadcn/ui components from `src/shared/components/ui/`

### YAGNI (You Aren't Gonna Need It)
- Don't add features "just in case"
- Don't create abstractions until 3+ use cases
- Don't over-engineer for hypothetical futures

### SOLID (For Complex Changes)
- **S**: Single file change when possible
- **O**: Extend behavior, don't modify existing code unnecessarily
- **L**: Keep component contracts consistent
- **I**: Small, focused interfaces/types
- **D**: Depend on abstractions (stores, adapters)

---

## Response Templates

### For Code Review Request:
```
**Summary**: [1-2 sentences]
**Files Affected**: [list max 5]
**Key Findings**:
1. [finding]
2. [finding]
**Recommendation**: [action]
```

### For Feature Request:
```
**Understanding**: [what you think user wants]
**Clarifying Questions**: (if any)
---
**Proposed Approach**:
1. [step]
2. [step]
**Files to Modify**: [list]
---
Proceed? [waiting for confirmation]
```

### For Bug Fix:
```
**Bug Location**: [file:line]
**Root Cause**: [1 sentence]
**Fix Outline**:
```pseudo
[pseudo-code]
```
Proceed? [waiting for confirmation]
```

---

## Quick Reference

### Existing Patterns to Follow

**Component Pattern:**
```typescript
"use client";
export function ComponentName() {
  const store = useStore();
  return <div className={cn("base", conditional && "extra")}>{content}</div>;
}
```

**Store Pattern (Zustand):**
```typescript
export const useStore = create<State>()((set) => ({
  value: "",
  setValue: (val) => set({ value: val }),
}));
```

**Hook Pattern:**
```typescript
export function useFeatureName() {
  const [state, setState] = useState();
  // Logic here
  return { state, actions };
}
```

### File Naming
- Components: `kebab-case.tsx`
- Hooks: `use-feature-name.ts`
- Stores: `feature-store.ts`

---

## Session Management

### Start of Session Checklist:
1. State your task in one sentence
2. Specify scope (files/features involved)
3. Set expectation: "analyze only" | "propose changes" | "implement"

### When Token Limit Approaches:
1. **STOP** expanding scope
2. **SUMMARIZE** what was done
3. **LIST** remaining tasks for next session
4. **DO NOT** attempt partial implementations

---

## Emergency Stop Phrases

Use these to immediately halt Copilot from making changes:
- "STOP - analyze only"
- "No changes - just explain"
- "Wait - need to clarify first"
- "Hold - outline first"

---

*Last Updated: 2026-02-08*
