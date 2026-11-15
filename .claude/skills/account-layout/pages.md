# Pages to redesign in the Settings → Account layout

Run one at a time: `/account-layout <route>`. Mark each `done` with the date
when its redesign lands. The order is best fit first: people and records, then
settings, then detail pages.

| # | Route | Component | Why it fits | Status |
|---|---|---|---|---|
| 1 | `/my-hr` | `MyHrWorkspace` | Your own HR profile — the closest cousin of Account | done 2026-11-13 |
| 2 | `/staff/[userId]` | `EmployeeRecordRoute` | A person's record: identity, facts, editable details | done 2026-11-13 |
| 3 | `/settings/workspaces` | `WorkspaceTab` | The business's identity and details | done 2026-11-13 |
| 4 | `/settings/trading` | `TradingAndPaymentsSettings` | Configuration rows | done 2026-11-13 |
| 5 | `/settings/qr-ordering` | `QrOrderingSettings` | Configuration rows | done 2026-11-13 |
| 6 | `/settings/assistant` | `AgentModelSettings` | Configuration rows | done 2026-11-13 |
| 7 | `/settings/developers` | `DevelopersPanel` | Keys and webhooks as rows with Change | done 2026-11-13 |
| 8 | `/settings/roles` | `RoleManager` | Roles as a list with editable rows | done 2026-11-13 |
| 9 | `/settings/configuration` (+ `/dashboard`, `/kitchen`, `/orders`, `/pos`) | `ConfigurationHome` and its tabs | Configuration rows | done 2026-11-13 |
| 10 | `/settings/connectors` | `ConnectorsRoute` | Accounts connected, as rows | done 2026-11-13 |
| 11 | `/settings/modules` | `ModulesTab` | Module list with states | done 2026-11-13 |
| 12 | `/inventory/items/[id]` | `InventoryItemDetailPage` | A stock item's record | todo |
| 13 | `/inventory/units/[id]` | `StockUnitDetailPage` | A stock unit's record | todo |
| 14 | `/menu/modifiers/[id]` | `ModifierDetail` | A modifier's record | todo |
| 15 | `/promotions/referrals` | `ReferralsWorkspace` | Programme settings + summary | todo |
| 16 | `/admin/system` | `AdminSystem` | Platform settings rows | todo |
| 17 | `/scheduling` | `MyRota` | Your own rota: clock + week facts as the identity card; the week stays a calendar (`RecordGroup` over one hairline grid) | done 2026-11-15 |
| 18 | `/compliance` (+ customer record → Privacy requests drawer, staff record) | `ComplianceWorkspace` → `PrivacyRequestsPanel` | A deadline queue as one list of rows that open in place | done 2026-11-15 |

## Left out, on purpose

- **The reference itself:** `/settings/account`, `/settings/profile`, `/settings/security`.
- **Redesigned in other styles on 2026-11-13:** `/menu/*` workspaces and item
  editor, `/customers`, `/customers/[id]`, `/customers/loyalty`, `/marketing`.
- **Operational screens the layout doesn't suit:** `/pos`, `/kds`, `/orders`,
  `/reservations`, `/staff/rota`, `/staff/shifts`, `/inventory`
  (lists), `/reports/*`, `/dashboard`, `/audit-log`, `/notes/graph`,
  `/cash-up`, `/content`, `/communications`, `/automation`.
- **Redirects:** `/settings/advanced`, `/settings`.
