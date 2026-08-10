# DUMA interface language

Use plain, direct en-GB copy. Name the outcome, keep operational terms stable, and do not promise a cause or recovery the system cannot verify.

## Product terms

- **Workspace** — the business account. Use “tenant” only in technical logs or API-facing diagnostics.
- **Location** — one physical site. Use “site” only in explanatory prose, not as a competing control label.
- **Location picker** — the control that changes the active location. Do not call it the header or top bar because it can move into the sidebar.
- **Purchase order** — always spell out in the interface. Reserve “PO” for identifiers such as `PO-1042`.
- **Container** — one physical stock unit. “Stock item” is the product or ingredient tracked across containers.
- **Automation** — a saved email automation. “Workflow” describes the ordered steps inside it.

## State patterns

- Actions use a verb and object: “Create purchase order”, “Delete menu item”, “Update password”.
- Failures say what did not happen and give a safe next step: “The counts weren’t saved. Check the quantities and try again.”
- Empty states distinguish first use, filters, permissions, and missing selection. Do not refer to clicking a control or assume its screen position.
- Destructive confirmations name the object, consequence, and irreversible result. The confirm button repeats the action.
- Routine success is brief. Mention the next consequence only when it changes what the user should do.
