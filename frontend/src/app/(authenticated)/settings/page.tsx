"use client";

import { useId, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  Pencil,
  Trash2,
  Plus,
  Users,
  Store,
  Palette,
  Building2,
  Coins,
  SlidersHorizontal,
  BellRing,
  Shield,
  ClipboardList,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { MOCK_STORES, MOCK_ITEMS, formatCurrency } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";
import {
  CAPABILITY_MATRIX,
  DEFAULT_PREFERENCES,
  Role,
  ThemeMode,
  FontSize,
  Density,
  SymbolPos,
  ThousandsSep,
  ReportPreset,
  PrintOrient,
  CurrencyPrefs,
} from "@/lib/preferences";

const MOCK_USERS = [
  { name: "Preview User", email: "preview@oae.dev", role: "admin", store: "Main Stores" },
  { name: "Store Manager", email: "manager@oae.dev", role: "manager", store: "Store B" },
  { name: "Sales Clerk", email: "clerk@oae.dev", role: "clerk", store: "Main Stores" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-ink text-paper",
  manager: "bg-canvas text-ink",
  clerk: "border border-hairline bg-transparent text-ink",
};

const ROLE_ORDER: Role[] = ["admin", "manager", "clerk"];
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  clerk: "Clerk",
};
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access to every feature including user and store management.",
  manager: "Runs day-to-day operations: sales, stock-in, transfers, reports.",
  clerk: "Records sales and views inventory at their assigned store.",
};

const WEEKDAY_OPTIONS: { value: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-body-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-4">
      <div className="flex flex-col justify-start pt-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </Label>
        ) : (
          <span className="text-sm font-medium">{label}</span>
        )}
        {description ? (
          <span className="mt-1 text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

function SegmentedGroup<T extends string | number>({
  options,
  value,
  onChange,
  name,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex flex-wrap items-center rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant={active ? "default" : "ghost"}
            size="sm"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="h-8"
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

function BooleanToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const generatedId = useId();
  const id = useMemo(
    () => `toggle-${label.replace(/\s+/g, "-").toLowerCase()}-${generatedId.replace(/[:]/g, "")}`,
    [label, generatedId]
  );
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <div className="flex flex-col">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("appearance");
  const { prefs, setPref, patchPrefs, resetPrefs } = useUIStore();

  const currencyPreview = useMemo(
    () => formatCurrency(1_234_567, prefs.currency),
    [prefs.currency]
  );

  const handleResetAll = () => {
    resetPrefs();
    toast.add({
      title: "Settings reset",
      description: "All preferences reverted to defaults.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">Settings</h1>
          <p className="mt-1 text-body text-mid-gray">
            Appearance, company details, currency, defaults, users, stores, notifications, roles, and stock rules.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetAll}
          className="sm:w-auto"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="appearance">
              <Palette className="mr-1 h-4 w-4" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building2 className="mr-1 h-4 w-4" /> Company
            </TabsTrigger>
            <TabsTrigger value="currency">
              <Coins className="mr-1 h-4 w-4" /> Currency
            </TabsTrigger>
            <TabsTrigger value="defaults">
              <SlidersHorizontal className="mr-1 h-4 w-4" /> Defaults
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-1 h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="stores">
              <Store className="mr-1 h-4 w-4" /> Stores
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <BellRing className="mr-1 h-4 w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="mr-1 h-4 w-4" /> Roles
            </TabsTrigger>
            <TabsTrigger value="stock-rules">
              <ClipboardList className="mr-1 h-4 w-4" /> Stock Rules
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* ───────── Appearance ───────── */}
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Theme, typography scale, density and accessibility tweaks. Saved locally.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionHeader title="Theme" description="Matches system by default; can be forced to light or dark." />
              <FieldRow label="Mode">
                <SegmentedGroup<ThemeMode>
                  name="theme-mode"
                  value={prefs.appearance.theme}
                  onChange={(v) => setPref("appearance.theme", v)}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                />
              </FieldRow>
              <Separator />
              <SectionHeader title="Typography & density" description="Affects the whole interface across all pages." />
              <FieldRow label="Font size" description="Global scale applied to every text token.">
                <SegmentedGroup<FontSize>
                  name="font-size"
                  value={prefs.appearance.fontSize}
                  onChange={(v) => setPref("appearance.fontSize", v)}
                  options={[
                    { value: "sm", label: "Small" },
                    { value: "md", label: "Default" },
                    { value: "lg", label: "Large" },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Density" description="Controls padding, row heights and internal spacing.">
                <SegmentedGroup<Density>
                  name="density"
                  value={prefs.appearance.density}
                  onChange={(v) => setPref("appearance.density", v)}
                  options={[
                    { value: "compact", label: "Compact" },
                    { value: "default", label: "Default" },
                    { value: "cozy", label: "Cozy" },
                  ]}
                />
              </FieldRow>
              <Separator />
              <SectionHeader title="Accessibility" />
              <FieldRow label="">
                <div className="flex flex-col gap-5">
                  <BooleanToggle
                    label="Reduced motion"
                    description="Disable hover transitions, hover shadow fades and decorative animations."
                    checked={prefs.appearance.reducedMotion}
                    onChange={(v) => setPref("appearance.reducedMotion", v)}
                  />
                  <BooleanToggle
                    label="Strong focus rings"
                    description="Thicker outline + glow around the focused element for better visibility."
                    checked={prefs.appearance.strongFocus}
                    onChange={(v) => setPref("appearance.strongFocus", v)}
                  />
                </div>
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Company ───────── */}
        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
              <CardDescription>
                Printed on receipts, reports and stock take sheets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldRow label="Company name" htmlFor="company-name">
                <Input
                  id="company-name"
                  value={prefs.company.name}
                  onChange={(e) => setPref("company.name", e.target.value)}
                  placeholder="Office Automation & Equipment Limited"
                />
              </FieldRow>
              <FieldRow label="Short code" description="2-5 letter identifier used on reports." htmlFor="company-short">
                <Input
                  id="company-short"
                  value={prefs.company.shortCode}
                  onChange={(e) => setPref("company.shortCode", e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="OAE"
                  className="uppercase tracking-wider"
                />
              </FieldRow>
              <Separator />
              <FieldRow label="Address" description="Printed address line." htmlFor="company-addr">
                <Input
                  id="company-addr"
                  value={prefs.company.address}
                  onChange={(e) => setPref("company.address", e.target.value)}
                  placeholder="Plot 12, Main Street, Kampala"
                />
              </FieldRow>
              <FieldRow label="Phone" htmlFor="company-phone">
                <Input
                  id="company-phone"
                  value={prefs.company.phone}
                  onChange={(e) => setPref("company.phone", e.target.value)}
                  placeholder="+256 414 000 000"
                  inputMode="tel"
                />
              </FieldRow>
              <FieldRow label="Email" htmlFor="company-email">
                <Input
                  id="company-email"
                  type="email"
                  value={prefs.company.email}
                  onChange={(e) => setPref("company.email", e.target.value)}
                  placeholder="sales@oae.co.ug"
                />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Currency ───────── */}
        <TabsContent value="currency" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Currency</CardTitle>
                <CardDescription>
                  Controls how every monetary value is displayed across the app.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 tabular-nums bg-muted/60 px-3 py-1 text-sm">
                {currencyPreview}
              </Badge>
            </CardHeader>
            <CardContent>
              <FieldRow label="Currency code" description="ISO 4217 code, e.g. UGX, KES, USD." htmlFor="cur-code">
                <Input
                  id="cur-code"
                  value={prefs.currency.code}
                  onChange={(e) => setPref("currency.code", e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="UGX"
                  className="uppercase tracking-wider"
                />
              </FieldRow>
              <FieldRow label="Symbol" description="Display symbol such as USh, $, KSh." htmlFor="cur-sym">
                <Input
                  id="cur-sym"
                  value={prefs.currency.symbol}
                  onChange={(e) => setPref("currency.symbol", e.target.value.slice(0, 6))}
                  placeholder="USh"
                />
              </FieldRow>
              <FieldRow label="Symbol position">
                <SegmentedGroup<SymbolPos>
                  name="symbol-pos"
                  value={prefs.currency.symbolPos}
                  onChange={(v) => setPref("currency.symbolPos", v)}
                  options={[
                    { value: "before", label: "Before (USh 1,234)" },
                    { value: "after", label: "After (1,234 USh)" },
                  ]}
                />
              </FieldRow>
              <Separator />
              <SectionHeader title="Formatting" />
              <FieldRow label="Decimal places" description="How many digits after the separator.">
                <SegmentedGroup<0 | 2>
                  name="decimals"
                  value={prefs.currency.decimals}
                  onChange={(v) => setPref("currency.decimals", v)}
                  options={[
                    { value: 0 as const, label: "0 (whole)" },
                    { value: 2 as const, label: "2 (cents)" },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Thousands separator">
                <SegmentedGroup<ThousandsSep>
                  name="thousands-sep"
                  value={prefs.currency.thousandsSep}
                  onChange={(v) => setPref("currency.thousandsSep", v)}
                  options={[
                    { value: ",", label: "Comma 1,234" },
                    { value: " ", label: "Space 1 234" },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Quick presets" description="Restore typical East-African formats.">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patchPrefs({
                        currency: {
                          code: "UGX",
                          symbol: "USh",
                          symbolPos: "before",
                          decimals: 0,
                          thousandsSep: ",",
                        } as CurrencyPrefs,
                      })
                    }
                  >
                    Uganda (UGX)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patchPrefs({
                        currency: {
                          code: "KES",
                          symbol: "KSh",
                          symbolPos: "before",
                          decimals: 2,
                          thousandsSep: ",",
                        } as CurrencyPrefs,
                      })
                    }
                  >
                    Kenya (KES)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patchPrefs({
                        currency: {
                          code: "TZS",
                          symbol: "TSh",
                          symbolPos: "before",
                          decimals: 0,
                          thousandsSep: " ",
                        } as CurrencyPrefs,
                      })
                    }
                  >
                    Tanzania (TZS)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patchPrefs({
                        currency: {
                          code: "USD",
                          symbol: "$",
                          symbolPos: "before",
                          decimals: 2,
                          thousandsSep: ",",
                        } as CurrencyPrefs,
                      })
                    }
                  >
                    US Dollar (USD)
                  </Button>
                </div>
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Defaults ───────── */}
        <TabsContent value="defaults" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
              <CardDescription>
                Applied when you first open a page. Can be overridden per session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldRow label="Default store" description="Selected store when you log in." htmlFor="def-store">
                <Select
                  value={prefs.defaults.storeId ?? "__all__"}
                  onValueChange={(v) =>
                    setPref("defaults.storeId", v === "__all__" ? null : (v as string))
                  }
                >
                  <SelectTrigger id="def-store">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All stores</SelectItem>
                    {MOCK_STORES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow
                label="Stock year"
                description="'auto' uses the current calendar year. Override for financial years."
                htmlFor="def-year"
              >
                <div className="flex w-full items-center gap-2">
                  <Input
                    id="def-year"
                    value={prefs.defaults.stockYear === "auto" ? "" : prefs.defaults.stockYear}
                    onChange={(e) =>
                      setPref(
                        "defaults.stockYear",
                        e.target.value.trim() === "" ? "auto" : e.target.value
                      )
                    }
                    placeholder={new Date().getFullYear().toString()}
                    className="w-40"
                  />
                  <span className="text-xs text-muted-foreground">
                    Leave blank for auto ({new Date().getFullYear()})
                  </span>
                </div>
              </FieldRow>
              <Separator />
              <FieldRow label="Page size" description="Rows shown per table page by default.">
                <SegmentedGroup<20 | 50 | 100>
                  name="page-size"
                  value={prefs.defaults.pageSize}
                  onChange={(v) => setPref("defaults.pageSize", v)}
                  options={[
                    { value: 20 as const, label: "20 rows" },
                    { value: 50 as const, label: "50 rows" },
                    { value: 100 as const, label: "100 rows" },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Report preset" description="Default range when opening Reports.">
                <SegmentedGroup<ReportPreset>
                  name="report-preset"
                  value={prefs.defaults.reportPreset}
                  onChange={(v) => setPref("defaults.reportPreset", v)}
                  options={[
                    { value: "today", label: "Today" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "month", label: "This month" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Print orientation" description="Orientation used when printing.">
                <SegmentedGroup<PrintOrient>
                  name="print-orient"
                  value={prefs.defaults.printOrient}
                  onChange={(v) => setPref("defaults.printOrient", v)}
                  options={[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ]}
                />
              </FieldRow>
              <Separator />
              <FieldRow
                label="Default carton size"
                description="Pieces per carton, pre-filled when receiving stock."
                htmlFor="def-ctn"
              >
                <Input
                  id="def-ctn"
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(prefs.defaults.ctnSize) ? prefs.defaults.ctnSize : ""}
                  onChange={(e) =>
                    setPref(
                      "defaults.ctnSize",
                      Math.max(1, Math.floor(Number(e.target.value) || DEFAULT_PREFERENCES.defaults.ctnSize))
                    )
                  }
                  className="w-40"
                />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Users ───────── */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Frontend-only preview. Your partner will wire Firebase Auth next phase.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => alert("Add user dialog would open (dev mode)")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add User
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Store</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_USERS.map((user) => (
                      <TableRow key={user.email} className="hover:bg-surface-alt">
                        <TableCell className="text-sm font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[user.role]}`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{user.store}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit user">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Remove user">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Stores ───────── */}
        <TabsContent value="stores" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Store Management</CardTitle>
                <CardDescription>
                  Stores tracked by the system; transfer routes connect these together.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => alert("Add store dialog would open (dev mode)")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Store
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Name</TableHead>
                      <TableHead className="text-right">Items Count</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_STORES.map((store) => {
                      const itemCount = MOCK_ITEMS.length;
                      return (
                        <TableRow key={store.id} className="hover:bg-surface-alt">
                          <TableCell className="text-sm font-medium">{store.name}</TableCell>
                          <TableCell className="text-right text-sm">{itemCount} items</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit store">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Notifications ───────── */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                In-app toasts previewed in this pass. Email will be added by your partner in the Firebase phase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionHeader title="Channels" />
              <FieldRow label="">
                <div className="flex flex-col gap-5">
                  <BooleanToggle
                    label="In-app toast notifications"
                    description="Pop-up toasts in the corner for new events."
                    checked={prefs.notifications.channels.toast}
                    onChange={(v) => setPref("notifications.channels.toast", v)}
                  />
                  <BooleanToggle
                    label="Email notifications"
                    description="Email summaries and alerts (offline send by your partner later — disabled in preview)."
                    checked={prefs.notifications.channels.email}
                    onChange={(v) => setPref("notifications.channels.email", v)}
                  />
                </div>
              </FieldRow>
              <Separator />
              <SectionHeader title="Categories" description="Toggle each category and configure its thresholds." />

              <Card className="mb-4 border-border/70 bg-muted/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-body">Low stock</CardTitle>
                  <CardDescription>
                    Alerts when on-hand quantity drops at or below each item&apos;s threshold.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <BooleanToggle
                    label="Enable low stock alerts"
                    checked={prefs.notifications.categories.lowStock.enabled}
                    onChange={(v) => setPref("notifications.categories.lowStock.enabled", v)}
                  />
                  <BooleanToggle
                    label="Critical only"
                    description="Only alert when stock is at or below the critical % configured in Stock Rules (ignores normal threshold)."
                    checked={prefs.notifications.categories.lowStock.criticalOnly}
                    onChange={(v) => setPref("notifications.categories.lowStock.criticalOnly", v)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                    <div className="pt-1">
                      <Label className="text-sm font-medium">Scope</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Limit alerts to a specific store or keep them for all stores.
                      </p>
                    </div>
                    <div>
                      <Select
                        value={prefs.notifications.categories.lowStock.storeId ?? "__all__"}
                        onValueChange={(v) =>
                          setPref(
                            "notifications.categories.lowStock.storeId",
                            v === "__all__" ? null : v
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All stores</SelectItem>
                          {MOCK_STORES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4 border-border/70 bg-muted/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-body">Aging stock</CardTitle>
                  <CardDescription>
                    Highlights inventory that has been sitting on shelves for a long time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <BooleanToggle
                    label="Enable aging stock alerts"
                    checked={prefs.notifications.categories.agingStock.enabled}
                    onChange={(v) => setPref("notifications.categories.agingStock.enabled", v)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                    <div className="pt-1">
                      <Label htmlFor="age-months" className="text-sm font-medium">
                        Older than (months)
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Batches older than this window are flagged.
                      </p>
                    </div>
                    <div>
                      <Input
                        id="age-months"
                        type="number"
                        min={1}
                        max={120}
                        step={1}
                        value={
                          Number.isFinite(prefs.notifications.categories.agingStock.olderThanMonths)
                            ? prefs.notifications.categories.agingStock.olderThanMonths
                            : ""
                        }
                        onChange={(e) =>
                          setPref(
                            "notifications.categories.agingStock.olderThanMonths",
                            Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 12)))
                          )
                        }
                        className="w-40"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4 border-border/70 bg-muted/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-body">Stock take reminder</CardTitle>
                  <CardDescription>
                    Regular prompt reminding staff that a stock count is due.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <BooleanToggle
                    label="Enable stock take reminder"
                    checked={prefs.notifications.categories.stockTakeReminder.enabled}
                    onChange={(v) => setPref("notifications.categories.stockTakeReminder.enabled", v)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-1">
                    <div className="pt-1">
                      <Label className="text-sm font-medium">Every</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Recurrence interval in weeks.
                      </p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min={1}
                        max={26}
                        step={1}
                        value={
                          Number.isFinite(prefs.notifications.categories.stockTakeReminder.everyWeeks)
                            ? prefs.notifications.categories.stockTakeReminder.everyWeeks
                            : ""
                        }
                        onChange={(e) =>
                          setPref(
                            "notifications.categories.stockTakeReminder.everyWeeks",
                            Math.max(1, Math.min(26, Math.floor(Number(e.target.value) || 4)))
                          )
                        }
                        className="w-40"
                      />
                      <span className="ml-3 text-xs text-muted-foreground">weeks</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-1">
                    <div className="pt-1">
                      <Label className="text-sm font-medium">Weekday</Label>
                    </div>
                    <div>
                      <Select
                        value={String(prefs.notifications.categories.stockTakeReminder.weekday)}
                        onValueChange={(v) =>
                          setPref(
                            "notifications.categories.stockTakeReminder.weekday",
                            Number(v) as 0 | 1 | 2 | 3 | 4 | 5 | 6
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAY_OPTIONS.map((w) => (
                            <SelectItem key={w.value} value={String(w.value)}>
                              {w.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-1">
                    <div className="pt-1">
                      <Label htmlFor="str-hhmm" className="text-sm font-medium">
                        Time
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Local time when the reminder surfaces.
                      </p>
                    </div>
                    <div>
                      <Input
                        id="str-hhmm"
                        type="time"
                        value={prefs.notifications.categories.stockTakeReminder.hhmm}
                        onChange={(e) =>
                          setPref("notifications.categories.stockTakeReminder.hhmm", e.target.value)
                        }
                        className="w-40"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-muted/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-body">Daily close summary</CardTitle>
                  <CardDescription>
                    End-of-day recap of sales and stock movements.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <BooleanToggle
                    label="Enable daily close summary"
                    checked={prefs.notifications.categories.dailyCloseSummary.enabled}
                    onChange={(v) => setPref("notifications.categories.dailyCloseSummary.enabled", v)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-1">
                    <div className="pt-1">
                      <Label htmlFor="dcs-hhmm" className="text-sm font-medium">
                        Time
                      </Label>
                    </div>
                    <div>
                      <Input
                        id="dcs-hhmm"
                        type="time"
                        value={prefs.notifications.categories.dailyCloseSummary.hhmm}
                        onChange={(e) =>
                          setPref("notifications.categories.dailyCloseSummary.hhmm", e.target.value)
                        }
                        className="w-40"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6 sm:py-1">
                    <div className="pt-1">
                      <Label className="text-sm font-medium">Scope</Label>
                    </div>
                    <div>
                      <Select
                        value={prefs.notifications.categories.dailyCloseSummary.storeId ?? "__all__"}
                        onValueChange={(v) =>
                          setPref(
                            "notifications.categories.dailyCloseSummary.storeId",
                            v === "__all__" ? null : v
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All stores</SelectItem>
                          {MOCK_STORES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Roles ───────── */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Roles &amp; capabilities</CardTitle>
              <CardDescription>
                Read-only reference matrix. Role editing will be unlocked once Firebase Auth
                permissions are wired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {ROLE_ORDER.map((r) => (
                  <div
                    key={r}
                    className="rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={ROLE_COLORS[r]}>
                        {ROLE_LABELS[r]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-4 text-muted-foreground">
                      {ROLE_DESCRIPTIONS[r]}
                    </p>
                  </div>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32%]">Capability</TableHead>
                      {ROLE_ORDER.map((r) => (
                        <TableHead key={r} className="text-center">
                          {ROLE_LABELS[r]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CAPABILITY_MATRIX.map((row) => (
                      <TableRow key={row.key} className="hover:bg-surface-alt">
                        <TableCell>
                          <div className="font-medium text-foreground">{row.label}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {row.description}
                          </div>
                        </TableCell>
                        {ROLE_ORDER.map((r) => (
                          <TableCell key={r} className="text-center">
                            {row.matrix[r] ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-military/15 text-military">
                                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </span>
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 text-mid-gray">
                                <X className="h-3.5 w-3.5" strokeWidth={2} />
                              </span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              <CardFooter className="mt-4 justify-end border-t px-0 pb-0 pt-4">
                <p className="text-xs text-muted-foreground">
                  {CAPABILITY_MATRIX.length} capabilities × {ROLE_ORDER.length} roles — read-only in this pass.
                </p>
              </CardFooter>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── Stock Rules (incl. Thresholds section) ───────── */}
        <TabsContent value="stock-rules" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock rules</CardTitle>
              <CardDescription>
                Business rules enforced when recording sales, transfers or stock counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldRow label="">
                <div className="flex flex-col gap-5">
                  <BooleanToggle
                    label="Block negative sales"
                    description="Prevent a sale from being saved when its quantity exceeds on-hand stock."
                    checked={prefs.stockRules.blockNegativeSales}
                    onChange={(v) => setPref("stockRules.blockNegativeSales", v)}
                  />
                  <BooleanToggle
                    label="Allow paper negatives during stock take"
                    description="Temporarily permit stock to go negative while a count session is in progress; finalize reconciles to zero."
                    checked={prefs.stockRules.paperNegDuringStocktake}
                    onChange={(v) => setPref("stockRules.paperNegDuringStocktake", v)}
                  />
                </div>
              </FieldRow>
              <Separator />
              <SectionHeader title="Thresholds" />
              <FieldRow
                label="Default carton size"
                description="Pieces per carton used in quick stock-in and formulas."
                htmlFor="sr-ctn"
              >
                <Input
                  id="sr-ctn"
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(prefs.stockRules.ctnSize) ? prefs.stockRules.ctnSize : ""}
                  onChange={(e) =>
                    setPref(
                      "stockRules.ctnSize",
                      Math.max(1, Math.floor(Number(e.target.value) || 24))
                    )
                  }
                  className="w-40"
                />
              </FieldRow>
              <FieldRow
                label="Critical stock %"
                description="Items at or below this percentage of their threshold are flagged as CRITICAL instead of Low."
                htmlFor="sr-crit"
              >
                <div className="flex w-full items-center gap-3">
                  <Input
                    id="sr-crit"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Number.isFinite(prefs.stockRules.criticalPct) ? prefs.stockRules.criticalPct : ""}
                    onChange={(e) =>
                      setPref(
                        "stockRules.criticalPct",
                        Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 50)))
                      )
                    }
                    className="w-40"
                  />
                  <span className="text-xs text-muted-foreground">% of threshold</span>
                </div>
              </FieldRow>
              <FieldRow
                label="Hide old stock after"
                description="Hide inventory rows older than this many months from the default view. Leave blank to show everything."
                htmlFor="sr-hide"
              >
                <div className="flex items-center gap-3">
                  <Input
                    id="sr-hide"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={prefs.stockRules.hideOldStockMonths ?? ""}
                    onChange={(e) =>
                      setPref(
                        "stockRules.hideOldStockMonths",
                        e.target.value.trim() === ""
                          ? null
                          : Math.max(1, Math.min(120, Math.floor(Number(e.target.value))))
                      )
                    }
                    className="w-40"
                    placeholder="Show all"
                  />
                  <span className="text-xs text-muted-foreground">
                    months (blank = show all)
                  </span>
                </div>
              </FieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock thresholds</CardTitle>
              <CardDescription>
                Per-item low-stock triggers. Configured per SKU and overridden at store level later.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Threshold PC</TableHead>
                      <TableHead className="text-right">Threshold CTN</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_ITEMS.map((item) => (
                      <TableRow key={item.id} className="hover:bg-surface-alt">
                        <TableCell className="text-sm font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.type}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {item.lowStockThresholdPc}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {item.lowStockThresholdCtn}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit threshold">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
