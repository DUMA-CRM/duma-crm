---
version: 1
slug: "app-crm-updates-page-tsx"
primary_target: "app/(crm)/updates/page.tsx"
related_targets: ["components/updates/UpdatesAdmin.tsx","components/updates/UpdatesFeed.tsx","components/updates/UpdateNotifier.tsx","components/updates/UpdateArticle.tsx"]
---

# DUMA Updates

An ordinary extension of the existing DUMA interface. Preserve the incumbent EditorShell, Modal and MarkdownEditor patterns and design tokens.

Superadmins manage global updates through Content → DUMA Updates using the existing CMS editor. Publication and scheduling, with staff role/module targeting, support an explicit cross-workspace audience. Keep draft edits separate from published snapshots; reuse CMS media through the audience-checked route.

Use a ruled post list and a focused, readable article column for the permanent feed and articles. On mobile, place editor actions on a separate row beneath the header. The once-only announcement popup is delayed and limited to the dashboard, with suppression while an existing dialog is open to avoid interrupting operational work.

Desktop and mobile editor/article layouts and the actual dashboard popup were accepted by the finish reviewer after the popup footer spacing fix. Review screenshots: `/tmp/duma-updates-review/*.png` (temporary evidence). Dark mode and quantitative contrast were not independently reviewed.
