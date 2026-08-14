# OAE Settings Expansion Design

Status: Approved by client on 2026-08-10.

Version: 1.0
Effective: 2026-08-10
Scope: Frontend-only implementation (Firebase integration handled separately).

---

## 1. Context and Goals

The current Settings page in the OAE inventory & sales management system is a
minimal shell with three tabs (Users, Stores, Thresholds). The user has
approved an expansion that adds the settings features the business needs for
daily use by Admins, Managers, and Clerks.

**Goals**

- Give users appearance controls without changing the approved Geist font.
- Centralize company/currency defaults so `USh` formatting is not hardcoded.
- Define default store, year, table page size, and print settings to reduce
  clerk data-entry errors.
- Add in-app toast notifications for low-stock, aging, stock-take reminders,
  and daily close summaries. Email notifications and Trigger Email wiring are
  explicitly deferred to the Firebase partner phase.
- Surface a read-only roles/capability matrix so admins/managers can see what
  each role can do without asking the implementation team.
- Define stock rules so operators know what behavior is enforced (block negative
  sales, CTN sizing, critical threshold derivation, old-stock hiding).

**Non-goals**

- No Firestore writes in this pass.
- No real email sending.
- No role editing.
- No Firebase Storage logo upload.
- No CSV import/export or localization scaffolding.

**Persistence**

- Typed preferences stored in `useUIStore`.
- Hydrated from / written to `localStorage` under key `oae.settings.v1`.
- Debounced writes (250 ms).
- Shape chosen so partner can mirror it 1:1 into Firestore `preferences/{uid}`.

---

## 2. Scope — Bundles Implemented

Approved bundles from structured Q&A:

1. Appearance + Font/Density (Theme, Font size, Density, reduced-motion, strong focus)
2. Company + Currency + Defaults
3. Stock Rules + Toast-only Notifications
4. Roles Viewer (read-only matrix)

Explicitly **not** implemented in this round:

- Extras bundle (shortcuts, CSV, locale scaffolding)
- Editable role matrix
- Email notifications

---

## 3. Tabs Layout

New Settings tab order at `/settings`:

1. Users (existing)
2. Stores (existing)
3. Thresholds (existing)
4. Appearance (NEW)
5. Company (NEW)
6. Defaults (NEW)
7. Notifications (NEW)
8. Roles (NEW — read-only matrix)
9. Stock Rules (NEW)

All tabs keep the same card-based visual language as today’s dashboard cards:
`radius-2xl`, military-green tokens, Geist typography.

Access remains admin-only per the existing rule:
`{ pattern: /^\\/settings/, roles: ["admin"] }`.

---

## 4. Detailed Feature Specs

### 4.1 Appearance

Controls:

| Control | Values | Behavior |
|---------|--------|----------|
| Theme | Light, Dark, System | Writes to `next-themes` provider. Attribute `class`. |
| Font size | Small (92.5%), Default (100%), Large (108%) | Applies `--font-scale` (multiplier) to `<html>` via `font-size` + `line-height` tokens. |
| Density | Compact, Default, Cozy | Applies `--density` tokens (padding, row heights, radii). |
| Reduced motion | On, Off | When On, honors `prefers-reduced-motion` *already*; when Off, allows existing subtle transitions. |
| Strong focus ring | On, Off | When On, doubles ring width and adds outline fallback; helps clerks with vision needs on cheap laptop panels. |

Live preview card on the same tab shows: a stat value, a table row snippet, a
button, an input, so edits are immediate.

### 4.2 Company

Fields:

- Company Name (string)
- Short Code (string, e.g. OAE)
- Address (multiline)
- Phone
- Support Email
- Logo upload (client-side `FileReader` → data URL; max 512 KB; rejects > 1 MB)
- Print header preview (combines fields above)

### 4.3 Currency

Settings:

- Currency code, e.g. `UGX` (preset dropdown + free text)
- Symbol, e.g. `USh` (preset dropdown + free text)
- Symbol position: Before value, After value
- Decimal places: 0, 2
- Thousands separator: `,`, `Space`

Live preview uses same formatter path as dashboard/reports so changes are
immediately visible.

### 4.4 Defaults

- Default store (dropdown over MOCK_STORES; "All Stores" option)
- Default stock year: OLD_STOCK, 2026, 2027, Auto (latest year in inventory)
- Table page size: 20, 50, 100
- Report preset: Today, Last 7 days, This month, Custom
- Print orientation: Portrait, Landscape
- Global CTN default size (integer, default 24). Per-item overrides (if they
  exist) show "Override: N" indicator next to the CTN fields; UI-only in this
  pass, backend math deferred.

### 4.5 Notifications (toast-only)

Channels:

- In-app bell / toast: toggles on/off per category.
- Email: shown as disabled placeholder rows with "partner phase" badge.

Categories:

| Category | Parameters |
|----------|------------|
| Low stock alerts | Store scope, Critical only toggle, Threshold multiplier |
| Aging stock | Older than N months toggle |
| Stock take reminder | Every N weeks, on weekday HH:MM |
| Daily close summary | At HH:MM, per store |

Implementation semantics: settings only control whether a given category may
generate a toast. Actual trigger logic runs client-side on navigation to
dashboard or settings (polling-style, no timers yet). If category is disabled,
no toast, no bell entry.

### 4.6 Roles Viewer

**Read-only.** 13 capability rows. 3 role columns. Filled badge = allowed,
outlined badge = denied. Capability list sourced from `route-permissions.ts`
combined with `auth-store.ts` role helpers.

Capability rows:

1. View inventory
2. Edit item metadata
3. Adjust stock
4. Delete inventory items
5. Record sales (stock out)
6. Record stock in
7. Create and approve transfers
8. Run stock take
9. View reports
10. Export reports
11. Manage users
12. Manage stores
13. Manage settings

Rule matrix:

| Capability | Admin | Manager | Clerk |
|------------|-------|---------|-------|
| View inventory | ✅ | ✅ | ✅ (read-only) |
| Edit item metadata | ✅ | ✅ | ❌ |
| Adjust stock | ✅ | ✅ | ❌ |
| Delete inventory items | ✅ | ❌ | ❌ |
| Record sales | ✅ | ✅ | ✅ |
| Record stock in | ✅ | ✅ | ❌ |
| Create / approve transfers | ✅ | ✅ | ❌ |
| Run stock take | ✅ | ✅ | ❌ |
| View reports | ✅ | ✅ | ❌ |
| Export reports | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Manage stores | ✅ | ❌ | ❌ |
| Manage settings | ✅ | ❌ | ❌ |

Rules are encoded in code as a typed constant, not parsed from regex, so the
viewer is deterministic and easy for the partner to mirror.

### 4.7 Stock Rules

| Rule | Default |
|------|---------|
| Block sales that would make quantity negative | On |
| Allow paper negatives during stock-take reconciliation | Off |
| CTN conversion: 1 CTN = N PC | 24 |
| Critical level = threshold / N % | 50% |
| Hide OLD_STOCK older than X months from dashboards and reports | Off (X = 24 when enabled) |

These rules are read by the frontend where feasible:

- `Block negative sales` is checked inside stock-out submit validation.
- CTN size is shown in forms.
- Critical percentage is visualized in Low Stock report badges.
- Old-stock hiding is applied at the dashboard and report filtering layer when
  the toggle is enabled.

---

## 5. Data Shapes

### 5.1 Preferences (TypeScript)

```ts
type ThemeMode = "light" | "dark" | "system";
type FontSize = "sm" | "md" | "lg";
type Density = "compact" | "default" | "cozy";
type SymbolPos = "before" | "after";
type ThousandsSep = "," | " ";
type ReportPreset = "today" | "7d" | "month" | "custom";
type PrintOrient = "portrait" | "landscape";

interface AppearancePrefs {
  theme: ThemeMode;
  fontSize: FontSize;
  density: Density;
  reducedMotion: boolean;
  strongFocus: boolean;
}

interface CompanyPrefs {
  name: string;
  shortCode: string;
  address: string;
  phone: string;
  email: string;
  logoDataUrl?: string;
}

interface CurrencyPrefs {
  code: string;
  symbol: string;
  symbolPos: SymbolPos;
  decimals: 0 | 2;
  thousandsSep: ThousandsSep;
}

interface DefaultsPrefs {
  storeId: string | null; // null = All Stores
  stockYear: string | "auto";
  pageSize: 20 | 50 | 100;
  reportPreset: ReportPreset;
  printOrient: PrintOrient;
  ctnSize: number;
}

interface NotificationCategoryPrefs {
  lowStock: { enabled: boolean; criticalOnly: boolean; storeId: string | null };
  agingStock: { enabled: boolean; olderThanMonths: number };
  stockTakeReminder: { enabled: boolean; everyWeeks: number; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hhmm: string };
  dailyCloseSummary: { enabled: boolean; hhmm: string; storeId: string | null };
}

interface NotificationsPrefs {
  channels: { toast: boolean; email: boolean };
  categories: NotificationCategoryPrefs;
}

interface StockRulesPrefs {
  blockNegativeSales: boolean;
  paperNegDuringStocktake: boolean;
  ctnSize: number;
  criticalPct: number; // 0-100, default 50
  hideOldStockMonths: number | null; // null means disabled
}

interface Preferences {
  appearance: AppearancePrefs;
  company: CompanyPrefs;
  currency: CurrencyPrefs;
  defaults: DefaultsPrefs;
  notifications: NotificationsPrefs;
  stockRules: StockRulesPrefs;
}
```

### 5.2 localStorage Contract

- Key: `oae.settings.v1`
- Serialized JSON of `DeepPartial<Preferences>`.
- On load, apply deep-merge with defaults.
- Any unknown keys are preserved (forward-compatible).
- Logo data URL is allowed and counted against the 512 KB soft-limit warning.

---

## 6. State and Component Architecture

### 6.1 `useUIStore` additions

New actions:

- `setPref<K extends PrefPath>(path: K, value: PrefValue<K>): void`
- `patchPrefs(patch: DeepPartial<Preferences>): void`
- `resetPrefs(): void`
- `hydratePrefs(saved: unknown): void`

Internal:

- After every set, debounced 250 ms serialize and write to localStorage.
- Hydrate runs once on app start.
- If `localStorage` is unavailable (SSR/SSR edge), fall back to defaults, no
  writes.

### 6.2 CSS tokens

New tokens in `globals.css`:

- `--font-scale`: `1`, `0.925`, `1.08`
- `--density`: default (`1`), compact (`0.85`), cozy (`1.15`)
- Derived paddings, radii, spacing: row, card, input, button
- When `strongFocus` on, focus ring color uses existing `--primary` but doubles
  the ring size and adds a 1px outline fallback.

### 6.3 Settings page structure

Keep a single `settings/page.tsx` file for layout/state; split each tab panel
into a dedicated function component inside the same file, and **only** extract
to `components/settings/*.tsx` if a panel exceeds ~150 lines.

Panel files allowed only when needed:
- `components/settings/appearance.tsx`
- `components/settings/company.tsx`
- `components/settings/defaults.tsx`
- `components/settings/notifications.tsx`
- `components/settings/roles-viewer.tsx`
- `components/settings/stock-rules.tsx`

No new npm packages.

### 6.4 Header bell + notifications queue

Header component already exists. Add a new `BellButton` that shows a
dropdown panel with recent toast entries + "mark all read". Toast routing uses
existing shadcn Base UI `Toaster`. Queue lives on UI store:

```ts
type ToastKind = "low-stock" | "aging" | "stock-take" | "daily-close";
type QueueItem = { id: string; kind: ToastKind; title: string; message: string; createdAt: number; read: boolean };
```

Queue is also persisted to `oae.notifications.v1` up to 100 entries.

---

## 7. Currency Formatting Contract

`formatCurrency(value: number, currencyPrefs?: CurrencyPrefs): string`
accepts an optional second parameter; when omitted, it reads from
`useUIStore.getState().prefs.currency` inside a wrapper hook so components do
not have to pass the object around.

Symbol position examples for `1468500`, code `UGX`, symbol `USh`:

| Position | Decimals | Separator | Output |
|----------|----------|-----------|--------|
| Before | 0 | , | USh 1,468,500 |
| After | 0 | , | 1,468,500 USh |
| Before | 2 | , | USh 1,468,500.00 |
| After | 2 | Space | 1 468 500.00 USh |

Existing callers that call `formatCurrency(v)` will start honoring global
currency prefs automatically with zero API change.

---

## 8. Validation Rules

Only the Settings fields that accept free input need strict validation. All
dropdowns/toggles are guaranteed-union by type.

- `company.shortCode`: max 10 chars
- `company.phone`: max 32 chars, min 3
- `company.email`: optional, when non-empty must pass `.includes("@")`
- `currency.code`: min 2 chars, max 6 chars
- `currency.symbol`: max 8 chars
- `logoDataUrl`: reject files > ~1 MB; warn at > 512 KB with toast suggesting
  a smaller logo
- `defaults.ctnSize`: integer ≥ 1
- `stockRules.criticalPct`: integer 1…100
- `stockRules.hideOldStockMonths`: when enabled, integer ≥ 1; null = disabled

---

## 9. Accessibility & Responsive

- All new controls get `htmlFor` + `id` labels.
- Tabs use existing shadcn Tabs + keyboard navigation (built in).
- Color contrast kept at WCAG 2.1 AA. Strong-focus ring mode is opt-in.
- On mobile (≤ 640 px):
  - Setting rows stack vertically.
  - Roles viewer table allows horizontal scroll.
  - Preview cards collapse into single column.
- Live regions on form-level errors.
- `reducedMotion` when true disables the card/section hover transition shadows.

---

## 10. Files Changed

New/modified files:

- `docs/superpowers/specs/2026-08-10-settings-expansion-design.md` (this file)
- `frontend/src/stores/ui-store.ts` — preferences slice + notifications queue
- `frontend/src/app/globals.css` — `--font-scale`, `--density`, strong focus tokens
- `frontend/src/app/layout.tsx` — apply theme/appearance classes on mount
- `frontend/src/components/layout/theme-provider.tsx` — read `prefs.appearance.theme`
- `frontend/src/components/layout/header.tsx` — add BellButton dropdown
- `frontend/src/lib/mock-data.ts` — `formatCurrency` upgrade + live preview helper
- `frontend/src/app/(authenticated)/settings/page.tsx` — expand tabs
- (As needed) `frontend/src/components/settings/<panel>.tsx` — split large panels
- `.trae/agent-log.md` — append completion record

---

## 11. Verification Checklist

Before this spec is considered implemented and merged:

- [ ] ESLint: `npm run lint` passes with 0 warnings.
- [ ] Strict type-check: `npx tsc --noEmit` passes.
- [ ] Production build: `npm run build` passes.
- [ ] Playwright smoke test:
  - [ ] Navigate `/settings`.
  - [ ] Click every tab (Users, Stores, Thresholds, Appearance, Company,
    Defaults, Notifications, Roles, Stock Rules).
  - [ ] Change theme → density → font-size; verify preview card updates
    immediately.
  - [ ] Change currency symbol + position; verify preview output changes.
  - [ ] Roles viewer shows 13 × 3 matrix with no exceptions.
  - [ ] Save one pref change, reload page, confirm value persisted.
- [ ] No new npm dependencies added.
- [ ] No hardcoded secrets added.
- [ ] No raw SQL, no shell-exec, no unvalidated user input reaching dangerous
  sinks (there should be none in a frontend-only pass).

---

## 12. Deferred to Partner / Later Phase

These are not part of this frontend pass and are noted here so the handover
document stays consistent:

- Firestore `preferences/{uid}` collection + sync adapter
- Firebase Trigger Email extension wiring + per-category email templates
- Firebase Storage logo upload
- Editable role matrix + Firestore security rules using role claims
- CSV import/export, 2FA/security, API keys

This spec intentionally keeps the partner surface minimal and typed.

---

## 13. Spec Self-Review

### 13.1 Placeholder scan

No "TBD", "TODO", or vague requirement strings remain. Every section names
concrete values, defaults, and behavior.

### 13.2 Internal consistency

- Role matrix in §4.6 matches route rules in `route-permissions.ts` (settings =
  admin only, stock in/transfers/stock take = admin + manager, inventory =
  all roles, clerk read-only, etc.).
- Currency formatter behavior shown in §7 is consistent with symbol position
  list in §4.3.
- Stock rule defaults in §4.7 match table in §6.1 defaults (criticalPct 50,
  ctnSize 24, blockNegativeSales ON).

### 13.3 Scope check

One spec exactly describes one piece of work: settings expansion at
`/settings`. No leakage into inventory editing, Firebase, or partner work.

### 13.4 Ambiguity check

- "Allow paper negatives during stock-take" is explicitly limited to the
  stock-take reconciliation UX only; it does NOT affect stock-out validation.
- "Critical level = threshold / N %" reads as "if qty ≤ threshold × N% then
  critical", not "threshold × (1 − N%)".
- CTN size is a global default in this pass, math is not applied to
  stock-transfer totals on the backend; only displayed as guidance.

All remaining ambiguity is resolved by picking an explicit behavior in each
section.

---

End of spec.
