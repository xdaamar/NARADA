---
description: NARADA project build rules for AI agents. ALWAYS read before coding any module.
globs: ["**/*.ts", "**/*.tsx", "**/*.css"]
---

# NARADA Build Rules

## Before ANY Code Change
1. **READ** the relevant PRD in `docs/` before coding a module
2. **READ** `docs/BLUEPRINT.md` for file locations and architecture
3. **READ** `docs/RULES.md` for coding standards and testing protocol

## PRD Reference Map
| Working on | Read first |
|-----------|-----------|
| Analyzer (URL/OCR/Text) | `docs/PRD_01_analyzer.md` |
| AI/ML Engine | `docs/PRD_02_ai_engine.md` |
| Fact-Check | `docs/PRD_03_fact_checker.md` |
| Dashboard | `docs/PRD_04_dashboard.md` |
| Nexus Graph | `docs/PRD_05_nexus_graph.md` |
| Intel Report | `docs/PRD_06_intel_report.md` |

## Coding Standards
- TypeScript strict: no `any`, type all params and returns
- 1 component per file, PascalCase for components, camelCase for utils
- Handle all errors gracefully with try/catch
- Include loading states and empty states for every page
- Follow existing design system in `src/index.css`

## Commit Rules
- Format: `[SCOPE] description` (FEAT/FIX/UI/REFACTOR/DOCS/POLISH)
- NEVER commit code that fails `npm run build`
- Push to GitHub after every commit

## Before Declaring Done
- [ ] `npm run build` passes with 0 errors
- [ ] Manual test: happy path + edge case + error case
- [ ] No console errors/warnings
- [ ] Loading states work
- [ ] Empty states display correctly
- [ ] Layout consistent with design system

## Token Efficiency
- Read PRD before coding to avoid rewrites
- Write complete files in 1 call
- Use targeted edits, never overwrite entire files
- Fix ALL errors in 1 edit, not one-by-one
