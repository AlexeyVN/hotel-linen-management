import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  CURRENCIES,
  LOCALE_LABELS,
  LOCALES,
  type Currency,
  type Locale,
} from "../src/i18n/config";
import { formatMoney, parseRublesToKopecks } from "../src/lib/money";
import { PERMISSIONS, ROLE_CODES } from "../src/lib/rbac";

/**
 * Reusable path: `npm test` runs with cwd = app/, but resolving from the repo
 * root keeps the tests runnable from either location.
 */
function resolveAppPath(...segments: string[]): string {
  const direct = path.resolve(process.cwd(), ...segments);
  if (existsSync(direct)) return direct;
  return path.resolve(process.cwd(), "app", ...segments);
}

const MESSAGES_DIR = resolveAppPath("src", "i18n", "messages");
const SOURCE_DIR = resolveAppPath("src");

type MessageTree = { [key: string]: string | MessageTree };
type FlatCatalog = Map<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadTree(locale: Locale): MessageTree {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  assert.ok(isRecord(parsed), `${file}: root must be a JSON object`);
  return parsed as MessageTree;
}

function flatten(tree: MessageTree, prefix = "", out: FlatCatalog = new Map()): FlatCatalog {
  for (const [key, value] of Object.entries(tree)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.set(fullKey, value);
    } else if (isRecord(value)) {
      flatten(value as MessageTree, fullKey, out);
    } else {
      throw new Error(`${fullKey}: message leaf must be a string`);
    }
  }
  return out;
}

const trees = Object.fromEntries(LOCALES.map((locale) => [locale, loadTree(locale)])) as Record<
  Locale,
  MessageTree
>;
const catalogs = Object.fromEntries(
  LOCALES.map((locale) => [locale, flatten(trees[locale])]),
) as Record<Locale, FlatCatalog>;

function message(locale: Locale, key: string): string {
  const value = catalogs[locale].get(key);
  if (value === undefined) throw new Error(`${locale}.json is missing key ${key}`);
  return value;
}

function namespaceKeys(locale: Locale, namespace: string): string[] {
  const value = trees[locale][namespace];
  if (!isRecord(value)) throw new Error(`${locale}.json: namespace ${namespace} must be an object`);
  return Object.keys(value);
}

/** Namespaces that the current UI consumes. `users` has no own namespace: its
 * strings live under `nav.users` / `permissions.users.manage` (asserted below). */
const REQUIRED_NAMESPACES = [
  "meta",
  "common",
  "nav",
  "login",
  "settings",
  "currency",
  "locale",
  "roles",
  "statuses",
  "permissions",
  "reports",
  "errors",
  "dashboard",
  "rooms",
  "branding",
  "catalog",
  "warehouse",
  "operations",
  "warehouseAdd",
  "audit",
  "cleaning",
  "maids",
  "checklists",
  "qr",
  "auditSession",
  "qrPrint",
] as const;

type Namespace = (typeof REQUIRED_NAMESPACES)[number];

const REQUIRED_KEYS: Record<Namespace, readonly string[]> = {
  meta: ["title", "description", "housekeeping"],
  common: ["save", "cancel", "delete", "loading", "error", "saved", "logout"],
  nav: [
    "overview",
    "warehouse",
    "catalog",
    "audit",
    "cleaning",
    "reports",
    "settings",
    "rooms",
    "users",
    "roles",
    "integration",
  ],
  login: ["title", "login", "password", "submit", "invalid"],
  settings: ["title", "language", "currency", "showDates", "integrationCurrencyGuard"],
  currency: ["RUB", "USD", "EUR"],
  locale: ["ru", "en", "es", "it", "de"],
  roles: ["ADMIN", "MANAGER", "MAID"],
  statuses: ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"],
  permissions: ["rooms.read", "warehouse.receive", "reports.view", "users.manage", "roles.manage"],
  reports: ["stock", "movements", "low", "export", "total"],
  errors: ["currencyLocked", "unsupportedLocale", "unsupportedCurrency"],
  dashboard: ["title", "items", "operations", "roomNumber", "empty"],
  rooms: ["title", "addRoom", "roomDeleted", "deleteConfirm"],
  branding: ["title", "hotelName", "logoUploaded", "accentSaved"],
  catalog: ["title", "addItem", "name", "category", "unit", "price", "deleteConfirm"],
  warehouse: ["title", "stock", "value", "category"],
  operations: ["receiveTitle", "writeoffTitle", "distributeTitle", "returnTitle", "submit"],
  warehouseAdd: ["title", "add", "qty", "price", "errorItem"],
  audit: ["title", "newAudit", "sessions", "start", "empty"],
  cleaning: ["title", "tasks", "createTask", "statuses", "downloadExcel"],
  maids: ["title", "inWork", "total", "roomsDone", "downloadExcel"],
  checklists: ["title", "templates", "createTemplate", "itemsCount", "photoRequired"],
  qr: ["title", "generate", "download", "payloadFormat", "payloadJson", "printRooms"],
  auditSession: ["apply", "saveDraft", "discrepancies", "appliedSummary", "invalidQty"],
  qrPrint: ["title", "rooms", "items", "payloadFormat", "print"],
};

test("all five locale catalogs have identical nested key sets", () => {
  const reference = [...catalogs.ru.keys()].sort();
  assert.ok(reference.length > 400, `unexpectedly small ru.json catalog: ${reference.length} keys`);

  for (const locale of LOCALES) {
    const actual = [...catalogs[locale].keys()].sort();
    assert.deepEqual(actual, reference, `${locale}.json key set differs from ru.json`);
  }
});

test("no locale contains empty message values", () => {
  for (const locale of LOCALES) {
    for (const [key, value] of catalogs[locale]) {
      assert.ok(value.trim().length > 0, `${locale}.json: ${key} is an empty string`);
    }
  }
});

test("required namespaces and current-UI keys exist in every locale", () => {
  const expectedNamespaces = [...REQUIRED_NAMESPACES].sort();

  for (const locale of LOCALES) {
    assert.deepEqual(
      Object.keys(trees[locale]).sort(),
      expectedNamespaces,
      `${locale}.json namespaces differ from the list required by the UI`,
    );

    for (const namespace of REQUIRED_NAMESPACES) {
      assert.ok(namespaceKeys(locale, namespace).length > 0, `${locale}.json: ${namespace} is empty`);
      for (const key of REQUIRED_KEYS[namespace]) {
        assert.ok(
          catalogs[locale].has(`${namespace}.${key}`),
          `${locale}.json is missing ${namespace}.${key}`,
        );
      }
    }

    // Code-driven namespaces must stay in sync with the application constants.
    assert.deepEqual(namespaceKeys(locale, "currency").sort(), [...CURRENCIES].sort());
    assert.deepEqual(namespaceKeys(locale, "locale").sort(), [...LOCALES].sort());
    assert.deepEqual(namespaceKeys(locale, "roles").sort(), [...ROLE_CODES].sort());
    assert.deepEqual(namespaceKeys(locale, "permissions").sort(), [...PERMISSIONS].sort());
    assert.deepEqual(namespaceKeys(locale, "statuses").sort(), [
      "CLEAN",
      "DIRTY",
      "INSPECTED",
      "OUT_OF_ORDER",
    ]);

    for (const code of LOCALES) {
      assert.equal(
        message(locale, `locale.${code}`),
        LOCALE_LABELS[code],
        `${locale}.json: locale.${code} must match LOCALE_LABELS`,
      );
    }

    if (!Object.prototype.hasOwnProperty.call(trees[locale], "users")) {
      assert.ok(catalogs[locale].has("nav.users"), `${locale}.json is missing nav.users`);
      assert.ok(
        catalogs[locale].has("permissions.users.manage"),
        `${locale}.json is missing permissions.users.manage`,
      );
    }
  }
});

const PLACEHOLDER_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const BRACE_GROUP_PATTERN = /\{([^{}]*)\}/g;

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort();
}

/** Static brace groups (e.g. the QR payload sample `{v,type,code,id}`) are data,
 * not ICU plural/format syntax; the catalogs currently use none of the latter. */
function staticBraceGroups(value: string): string[] {
  return [...value.matchAll(BRACE_GROUP_PATTERN)]
    .map((match) => match[1])
    .filter((group) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(group))
    .sort();
}

test("interpolation placeholders match across locales for every key", () => {
  let keysWithPlaceholders = 0;

  for (const [key, ruValue] of catalogs.ru) {
    const expected = placeholders(ruValue);
    if (expected.length > 0) keysWithPlaceholders += 1;

    for (const locale of LOCALES) {
      const value = message(locale, key);
      assert.deepEqual(placeholders(value), expected, `${locale}.json: ${key} placeholder mismatch`);
      assert.deepEqual(
        staticBraceGroups(value),
        staticBraceGroups(ruValue),
        `${locale}.json: ${key} static brace group mismatch`,
      );
    }
  }

  assert.ok(
    keysWithPlaceholders >= 40,
    `expected at least 40 interpolated keys, found ${keysWithPlaceholders}`,
  );
});

const MONEY_EXPECTED: Record<Locale, Record<Currency, readonly [small: string, large: string]>> = {
  ru: {
    RUB: ["1 850,00 ₽", "1 234 567,89 ₽"],
    USD: ["1 850,00 $", "1 234 567,89 $"],
    EUR: ["1 850,00 €", "1 234 567,89 €"],
  },
  en: {
    RUB: ["₽1,850.00", "₽1,234,567.89"],
    USD: ["$1,850.00", "$1,234,567.89"],
    EUR: ["€1,850.00", "€1,234,567.89"],
  },
  es: {
    RUB: ["1850,00 ₽", "1.234.567,89 ₽"],
    USD: ["1850,00 $", "1.234.567,89 $"],
    EUR: ["1850,00 €", "1.234.567,89 €"],
  },
  it: {
    RUB: ["1850,00 ₽", "1.234.567,89 ₽"],
    USD: ["1850,00 $", "1.234.567,89 $"],
    EUR: ["1850,00 €", "1.234.567,89 €"],
  },
  de: {
    RUB: ["1.850,00 ₽", "1.234.567,89 ₽"],
    USD: ["1.850,00 $", "1.234.567,89 $"],
    EUR: ["1.850,00 €", "1.234.567,89 €"],
  },
};

function normalizedMoney(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

test("all five locales format money for RUB, USD and EUR", () => {
  for (const locale of LOCALES) {
    for (const currency of CURRENCIES) {
      const [small, large] = MONEY_EXPECTED[locale][currency];
      assert.equal(
        normalizedMoney(formatMoney(185000, locale, currency)),
        small,
        `${locale}/${currency}: 1850.00 formatting`,
      );
      assert.equal(
        normalizedMoney(formatMoney(123456789, locale, currency)),
        large,
        `${locale}/${currency}: 1234567.89 formatting`,
      );
    }
  }
});

const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  ru: { group: " ", decimal: "," },
  en: { group: ",", decimal: "." },
  es: { group: ".", decimal: "," },
  it: { group: ".", decimal: "," },
  de: { group: ".", decimal: "," },
};

test("money output uses locale-specific grouping and decimal separators", () => {
  for (const locale of LOCALES) {
    const { group, decimal } = SEPARATORS[locale];
    const formatted = normalizedMoney(formatMoney(123456789, locale, "EUR"));
    assert.ok(
      formatted.includes(group),
      `${locale}: expected grouping separator ${JSON.stringify(group)} in ${formatted}`,
    );
    assert.ok(
      formatted.includes(`${decimal}89`),
      `${locale}: expected decimal separator ${JSON.stringify(decimal)} in ${formatted}`,
    );
  }
});

test("locale-specific decimal and thousand separators are parsed", () => {
  const cases: ReadonlyArray<readonly [input: string, expected: number | null]> = [
    ["1 850,50", 185050],
    ["1\u00a0850,50", 185050],
    ["1\u202f850,50", 185050],
    ["1,850.50", 185050],
    ["1.850,50", 185050],
    ["$1,850.50", 185050],
    ["€ 1.850,50", 185050],
    ["2 500,00 ₽", 250000],
    ["1850.5", 185050],
    ["1850,5", 185050],
    ["1 850", 185000],
    ["1.850", 185000],
    ["1,850", 185000],
    ["0,00", 0],
    ["0", 0],
    ["", null],
    ["abc", null],
    ["-5", null],
  ];

  for (const [input, expected] of cases) {
    assert.equal(parseRublesToKopecks(input), expected, `parse ${JSON.stringify(input)}`);
  }
});

test("formatted money round-trips through the parser for every locale and currency", () => {
  for (const locale of LOCALES) {
    for (const currency of CURRENCIES) {
      const formatted = formatMoney(185050, locale, currency);
      assert.equal(
        parseRublesToKopecks(formatted),
        185050,
        `${locale}/${currency}: ${JSON.stringify(formatted)} did not round-trip`,
      );
    }
  }
});

const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

/** Intentional native labels only; keep this list minimal. */
const CYRILLIC_ALLOWLIST: Readonly<Record<string, string>> = {
  "locale.ru": "Русский",
};

test("non-ru locales contain no unexpected Cyrillic values", () => {
  for (const locale of LOCALES) {
    if (locale === "ru") continue;
    for (const [key, value] of catalogs[locale]) {
      if (!CYRILLIC_PATTERN.test(value)) continue;
      assert.ok(
        Object.prototype.hasOwnProperty.call(CYRILLIC_ALLOWLIST, key),
        `${locale}.json: ${key} contains unexpected Cyrillic: ${JSON.stringify(value)}`,
      );
      assert.equal(
        value,
        CYRILLIC_ALLOWLIST[key],
        `${locale}.json: ${key} allowlisted native label changed`,
      );
    }
  }

  assert.deepEqual(Object.keys(CYRILLIC_ALLOWLIST).sort(), ["locale.ru"]);
  for (const locale of LOCALES) {
    assert.equal(message(locale, "locale.ru"), "Русский", `${locale}.json: locale.ru changed`);
  }
});

const TRANSLATOR_DECLARATION =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:\{\s*[^}]*?namespace\s*:\s*)?["'`]([^"'`]+)["'`]/g;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTranslators(source: string): Map<string, string> {
  const translators = new Map<string, string>();
  TRANSLATOR_DECLARATION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRANSLATOR_DECLARATION.exec(source))) {
    translators.set(match[1], match[2]);
  }
  return translators;
}

test("every namespace used by src exists in every locale", () => {
  const namespaces = new Set<string>();

  for (const file of collectSourceFiles(SOURCE_DIR)) {
    for (const namespace of collectTranslators(readFileSync(file, "utf8")).values()) {
      namespaces.add(namespace);
    }
  }

  assert.ok(namespaces.size >= 15, `expected at least 15 source namespaces, found ${namespaces.size}`);
  for (const namespace of namespaces) {
    for (const locale of LOCALES) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(trees[locale], namespace),
        `${locale}.json is missing namespace ${namespace} used by src`,
      );
    }
  }
});

test("every literal translation key used by src exists in every locale", () => {
  const unresolved: string[] = [];
  let references = 0;

  for (const file of collectSourceFiles(SOURCE_DIR)) {
    const source = readFileSync(file, "utf8");
    const relativeFile = path.relative(SOURCE_DIR, file).split(path.sep).join("/");

    for (const [translator, namespace] of collectTranslators(source)) {
      const callPattern = new RegExp(
        "\\b" +
          escapeRegExp(translator) +
          "\\s*\\(\\s*[\"'`]([A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*)[\"'`]",
        "g",
      );
      let call: RegExpExecArray | null;
      while ((call = callPattern.exec(source))) {
        references += 1;
        const key = `${namespace}.${call[1]}`;
        if (LOCALES.every((locale) => catalogs[locale].has(key))) continue;
        unresolved.push(`${relativeFile}: ${key}`);
      }
    }
  }

  assert.deepEqual(unresolved.sort(), [], `missing translation keys: ${unresolved.join(", ")}`);
  assert.ok(references > 400, `expected more than 400 literal t() references, found ${references}`);
});
