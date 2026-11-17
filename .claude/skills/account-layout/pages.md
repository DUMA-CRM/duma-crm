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
| 14 | `/menu/modifiers/[id]` | `ModifierDetail` | Editor layout: What it uses (ingredients) in the main column; a sidebar Modifier card of `ChangeRow`s (Name, Price change, Group via `GroupPicker`, Size and Available as switch rows, ⓘ) over What it adds, first when stacked; draft + recipe saved through one SaveBar; the New modifier and group drawers lose their boxed cards | done 2026-11-16 |
| 15 | `/promotions/referrals` | `ReferralsWorkspace` | Counts as `Fact surface="page"` figures (three filter the list) over Rewards \| Programme `ChangeRow` sections (draft + SaveBar, Cancel restores the row), then Referrals as a `RecordGroup` of `ListRow`s with a status `Select` | done 2026-11-16 |
| 16 | `/admin/system` | `AdminSystem` | Platform settings rows | todo |
| 17 | `/scheduling` | `MyRota` | Your own rota: clock + week facts as the identity card; the week stays a calendar (`RecordGroup` over one hairline grid) | done 2026-11-15 |
| 18 | `/compliance` (+ customer record → Privacy requests drawer, staff record) | `ComplianceWorkspace` → `PrivacyRequestsPanel` | A deadline queue as one list of rows that open in place | done 2026-11-15 |
| 19 | `/content?tab=configure` | `ContentConfiguration` | Content's settings landing: one `ListRowGroup` of editors, each meta line a live fact | done 2026-11-16 |
| 20 | `/content?tab=configure&section=locales` | `LocalesPanel` | Languages as a `RecordGroup` list (coverage per row) beside Missing translations · Prices `ChangeRow` sections | done 2026-11-16 |
| 21 | `/content?tab=configure&section=settings` | `ContentSettingsPanel` | File privacy and Backup beside Storage: a bento of `ChangeRow` sections, no rail | done 2026-11-16 |
| 22 | `/content?model=<id\|new>` | `ModelEditor` | Details · Display \| Ask DUMA · Who can edit as a bento of `ChangeRow` sections; Fields a `RecordGroup` of `ListRow`s that open their settings in place; the entry form as a live preview in the rail | done 2026-11-16 |
| 23 | `/forms?form=<id>&tab=settings` | `FormSettingsPanel` | Taking responses · Look \| After someone submits · Customers as a bento of `ChangeRow` sections (draft + the editor's SaveBar, Cancel restores the row); the thank-you screen as a live preview in the rail | done 2026-11-16 |
| 24 | `/forms?form=<id>&tab=share` | `SharePanel` | Link · QR code \| On your website · With your own code as a bento of `RecordGroup card`s, no rail | done 2026-11-16 |
| 25 | `/promotions?promotion=<id\|new>` | `PromotionEditor` | Offer · How often \| Who qualifies · When as a bento of `ChangeRow` sections (draft + SaveBar, Cancel restores the row); Codes and Usage as `RecordGroup` lists of `ListRow`s; the receipt's discount line as a live preview in the rail; Pause / Make live / Archive in the header | done 2026-11-16 |
| 26 | `/menu/items/[id]` (+ `/menu/items/new`) | `MenuItemDetail` → `MenuItemForm` | Editor layout: Details (Name, Section, Price, VAT rate, Description, Web address, On the menu switch) and Modifiers (a `ChangeRow` per group that opens in place, Done since ticks save at once) in the main column; Photo (stacked `ItemImageField`, ⓘ) or a product's At a glance in the sidebar; one SaveBar; header = Delete only; the till preview rail removed | done 2026-11-16 |
| 27 | `/menu/items/[id]?tab=recipe` | `RecipeEditor` | Cost and margin (`RecordGroup card`, size switch in the title row) · Ingredients · Modifier add-ons in the main column; Try a combination · Nutrition & allergens in a sticky sidebar after the work; one SaveBar | done 2026-11-16 |
| 28 | `/menu/items/[id]?tab=sizes\|languages\|photos` | `VariantsEditor`, `ProductLanguages`, `ProductPhotos` | Sizes: variants table titled above in the main column, Options · Stock sidebar cards; Languages: Languages and Prices titled above with visible footnotes, the "What shoppers see" rail removed; Photos unchanged but for borders and full-width pickers | done 2026-11-16 |
| 29 | `/reservations?tab=rules` | `BookingRules` (+ `GuestEmails`) | Online booking · Guest emails \| Booking page · Between bookings as a bento of `RecordGroup card`s of `ChangeRow`s (draft + SaveBar, Cancel restores the row); the booking page's link row + QR moved out of the rail into its own card (Live/Off badge and *New link* in the title row); Guest emails a `ChangeRow` per moment with *Open*; turn-time hint as the footnote | done 2026-11-16 |

## Left out, on purpose

- **The reference itself:** `/settings/account`, `/settings/profile`, `/settings/security`.
- **Redesigned in other styles on 2026-11-13:** `/menu/*` workspaces (the item
  and modifier editors have since moved to this layout, 14 and 26–28), `/customers`, `/customers/[id]`, `/customers/loyalty`, `/marketing`.
- **Operational screens the layout doesn't suit:** `/pos`, `/kds`, `/orders`,
  `/reservations` (except Booking rules, 29), `/staff/rota`, `/staff/shifts`, `/inventory`
  (lists), `/reports/*`, `/dashboard`, `/audit-log`, `/notes/graph`,
  `/cash-up`, `/content` (except its Configure pages and model editor, 19–22), `/communications`, `/automation`.
- **Content → Configure → Models** (`ModelsPanel`) is a list, so it follows the list
  conventions (Staff → Team) instead: search, count, `RecordGroup` + `ListRowGroup` (2026-11-16).
- **Forms list and a form's Responses** (`FormsList`, `ResponsesPanel`) are lists, so they follow the
  list conventions: `Fact surface="page"` figures (list only), a search with inline `Select`s and the
  count, one `ListRowGroup` (2026-11-16). **Forms → Summary** is a report: figures, Per day, and a
  `RecordGroup card` per question in two stacked columns. **Forms → Build** belongs to the builder.
- **Promotions list** (`PromotionsList`) is a list, so it follows the list conventions: four `Fact surface="page"`
  figures (Live, Paused, Ended filter the list; Discount given), a search with Show and Type `Select`s and the count,
  one `ListRowGroup` (2026-11-16).
- **Reservations → Bookings and Waitlist** (`BookingsDay`, `WaitlistPanel`) are lists, so they follow the list
  conventions: four `Fact surface="page"` figures (some filter), a `NeedsAttention` strip (late arrivals and unconfirmed
  bookings; parties past their quote), a search with a Show `Select` and the count, `ListRowGroup`s (bookings under
  `RecordGroup` time-of-day titles). The **booking drawer** uses plain titled groups of `ChangeRow touch` rows and
  44px status keys (2026-11-16). The Floor and Floor plan tabs belong to the floor rebuild.
- **Redirects:** `/settings/advanced`, `/settings`.
