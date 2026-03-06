# Bucket Plugin

## What is Bucket?

**Bucket** is a proxy server plugin that acts as a **lightweight in-memory database with automatic CRUD**. Instead of forwarding requests to an external service, Bucket intercepts them and handles them internally — creating resources, storing them in memory, returning them on request, and deleting them. Data is persisted to a JSON file using debounced atomic writes, so it survives server restarts.

Bucket runs **before** the Mock plugin in the processing queue (`logger → cors → bucket → mock → recorder`). On a cache miss (e.g. a GET for a resource that doesn't exist), the request falls through — to Mock, and then to the upstream proxy.

---

## How it works

### Collection configuration

Bucket stores a list of **collections** — each is a configuration for one API path:

```json
{
  "path": "/api/users",
  "idPattern": "uuid",
  "idLength": null,
  "responseTemplate": { ... }
}
```

Collections are persisted in `bucket/config.json`. The file `bucket/data.json` holds the current data state (ignored by git — data is environment-specific).

### Path matching

Every incoming request is checked against configured collections:

- `POST /api/users` → matches collection `/api/users` (action depends on method)
- `GET /api/users/abc-123` → matches collection `/api/users` with `resourceId = "abc-123"`
- `GET /api/other` → no match → falls through

Paths are normalised (leading slash, no trailing slash), so `/api/users`, `api/users` and `/api/users/` all map to the same collection.

### Supported operations

| Method | Path | Action |
|--------|------|--------|
| `POST` | `/api/users` | Creates a new resource, generates an ID, returns `201` |
| `GET` | `/api/users` | Returns the list of all resources, `200` |
| `GET` | `/api/users/:id` | Returns the resource by ID or **falls through** on miss |
| `PATCH` | `/api/users/:id` | Overwrites the resource (full override), `200` or **falls through** on miss |
| `DELETE` | `/api/users/:id` | Deletes the resource, `204` or **falls through** on miss |

Every response includes the header `X-Bucket-Source: bucket`.

---

## ID generation

Each collection can use a different ID generation strategy:

| Strategy | Description | Example |
|----------|-------------|---------|
| `uuid` | Random UUID v4 | `a3f8b2c1-9d4e-4f7a-b8c5-1234567890ab` |
| `numeric` | Auto-incrementing counter | `1`, `2`, `3`… or `000001` (with `idLength`) |
| `alphanumeric` | Random A-Z/a-z/0-9 string | `X3kP9mZq` |
| `custom regexp` | Generative pattern | `P-AGR-123456` from pattern `P-AGR-\d{6}` |

### `idLength`

- For `numeric` — zero-padding width (e.g. `6` → `000001`)
- For `alphanumeric` — string length (default `8`)

### Custom regexp

When no preset matches, the `idPattern` value is treated as a regexp pattern. The generator (`generateFromPattern`) builds a string that structurally matches the pattern:

- `[A-Z]{3}-\d{4}` → `ABC-1234`
- `P-AGR-\d{6}` → `P-AGR-743452`
- `[a-z]+@\w+` → `xkbm@abc3`

Supported elements: character classes `[abc]`, ranges `[a-z]`, sequences `\d \w \s \D \W`, quantifiers `{n}` `{n,m}` `+` `*` `?`, groups with alternation `(a|b|c)`, top-level alternation `abc|xyz`, anchors `^` `$`, any-char `.`.

After generation the candidate is verified by `new RegExp(pattern)`. Max 10 attempts, then a 500 error.

---

## Response Template

An optional field defining the **shape of the POST response**. It is a JSON object with `{{ token }}` placeholders that are resolved dynamically on each request.

```json
{
  "id": "{{ :id }}",
  "email": "{{ email }}",
  "name": "{{ body.name }}",
  "createdBy": "{{ headers.X-User-Id }}",
  "score": "{{ integer:1:100 }}"
}
```

### Token resolution order

1. `{{ :id }}` → the generated resource ID
2. Built-in tokens (table below)
3. `{{ integer:min:max }}` → integer within the given range
4. `{{ headers.HeaderName }}` → request header value
5. `{{ body.fieldName }}` → field value from the JSON request body
6. Fallback → `generateFromPattern(token)` — token treated as a regexp pattern

### Built-in tokens

| Token | Return type | Description |
|-------|-------------|-------------|
| `:id` | string | The generated resource ID |
| `uuid` | string | Random UUID (independent of `:id`) |
| `email` | string | Random e-mail drawn from Polish name pools |
| `phoneNumber` | string | Polish mobile number: `48` + 9 digits |
| `firstName` | string | Random Polish first name |
| `lastName` | string | Random Polish last name |
| `date` | string | Current ISO 8601 timestamp |
| `boolean` | boolean | Random `true` or `false` |
| `integer` | number | Random number 1–1000 |
| `integer:min:max` | number | Random number within the given range |
| `location.streetName` | string | Random Polish street name |
| `location.streetNr` | string | Building number 1–150 (~15% with a letter: `42A`) |
| `location.zipCode` | string | Polish postal code `xx-xxx` |
| `location.flatNr` | number | Flat number 1–200 |
| `headers.X` | string | Value of header `X` from the request |
| `body.X` | string | Value of field `X` from the JSON request body |
| `lorem` | string | Random lorem ipsum sentence |
| *(regexp)* | string | Fallback — generated from the pattern |

**Type note:** `boolean` returns a JS boolean, `integer` and `location.flatNr` return a JS number, all others return strings.

### Merging with the request body

Bucket applies template-first merge:

1. Resolves all tokens in `responseTemplate`
2. Adds fields from the request body that **are not already in the resolved template**
3. Forces `id` to the generated ID (the client cannot override it)

---

## Persistence

### `bucket/data.json`

Data state format:

```json
{
  "/api/users": {
    "abc-123": { "id": "abc-123", "email": "jan@wp.pl" },
    "xyz-789": { "id": "xyz-789", "email": "anna@gmail.com" }
  }
}
```

Writes are **debounced** (100 ms) and **atomic** — data is first written to a `.tmp` file, then `rename()` ensures a partial file is never left on disk. The file is ignored by git (`bucket/data.json` in `.gitignore`).

### `bucket/config.json`

Collection configuration — committed as the project's default starting point.

---

## Code architecture

```
server/
├── plugins/
│   └── bucket.js           # Plugin handler — CRUD, ID generation, storage
├── plugins/
│   └── bucket-data.js      # Data pools: names, streets, email domains, lorem
├── routes/
│   └── bucket.js           # API routes for the UI (/__api/bucket/*)
└── templateResolver.js     # Shared token module (also used by Mock)
```

### `templateResolver.js` — shared module

Extracted from `bucket.js` as a standalone module imported by both plugins: **Bucket** and **Mock**. Exports:

- `applyTemplate(templateVal, context)` — recursively resolves tokens
- `BUILTIN_TOKENS` — name → generator map
- `resolveDynamicToken(token, context)` — parametric tokens (integer:min:max, headers.X, body.X)
- `generateFromPattern(pattern)` — regexp-based generator

### API routes (`/__api/bucket/*`)

Available endpoints for the UI:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/__api/bucket/collections` | List collections with resource counts |
| `POST` | `/__api/bucket/collections` | Add a collection |
| `PATCH` | `/__api/bucket/collections/:index` | Update a collection (path, idPattern, template) |
| `DELETE` | `/__api/bucket/collections/:index` | Delete a collection and its data |
| `GET` | `/__api/bucket/data` | All data from all collections |
| `GET` | `/__api/bucket/data/:index` | Data for one collection |
| `DELETE` | `/__api/bucket/data` | Clear all data |
| `DELETE` | `/__api/bucket/data/:index` | Clear data for one collection |
| `PUT` | `/__api/bucket/data/:index/:id` | Overwrite a resource manually (from UI) |
| `DELETE` | `/__api/bucket/data/:index/:id` | Delete a resource manually (from UI) |

Collections are addressed by **array index** (not by path) to avoid URL-encoding issues with paths that contain `/`.

---

## UI — BucketPlugin

Available in the panel as the **Bucket** tab. It consists of three sections:

### 1. Collections

Manage collections: add, delete, configure path, ID pattern, and response template.

The template editor (`JsonTemplateEditor`) is an Ace Editor component with:
- JSON syntax highlighting
- Auto-closing brackets (`{` → `{}`, `[` → `[]`)
- Smart Enter between brackets (`{|}` → `{\n  |\n}`)
- JSON validation on blur
- Formatting via Cmd/Ctrl+Shift+F
- Collapsible token reference panel

### 2. Bucket Contents

View of data stored in collections. Tabs per collection, resource list with JSON preview, ability to edit (modal with editor) and delete individual records.

### 3. About

Inline documentation — description of how Bucket works, token table, resolution order.

---

## Development history

### Phase 1 — Skeleton (Steps 0–8)

- Created `server/plugins/bucket.js` — handler, storage, persistence
- Created `server/routes/bucket.js` — API for the UI
- Integrated with `stateManager.js` and `pluginController.js`
- Created `BucketPlugin.svelte` — UI view
- Registered in `App.svelte` and the router

### Phase 2 — Extensions

- **`idLength`** — zero-padding for numeric, length for alphanumeric
- **Custom ID via `generateFromPattern()`** — generative regexp, not fully random
- **Log labels** — distinguishing `[BUCKET]` from `[MOCK]` in logs
- **`bucketSource: 'miss'`** — metadata fix on cache miss
- **`responseTemplate`** — collection field, `{{ token }}` placeholders in the POST response
- **16 built-in tokens** + Polish data pools in `bucket-data.js`
- **Token reference in UI** — collapsible token reference in the editor

### Phase 3 — Sharing with Mock + Smart editor

- **Extraction of `templateResolver.js`** — ~250 lines of shared logic pulled out of `bucket.js` into a standalone module
- **Mock plugin integration** — `executeAction()` in `mock.js` calls `applyTemplate()` for `RET_INLINE`
- **`JsonTemplateEditor.svelte`** — new Ace Editor component (`ace-builds` npm), replaces `<textarea>` in BucketPlugin and the inline editor in `RuleCard.svelte`
- **`lorem` token added** — uses `LOREM_SENTENCES` from `bucket-data.js`

### Phase 4 — Editor bug fixes

**Problem:** Ace Editor cleared its content after every keystroke.

**Root cause:** Reactive loop — the debounce dispatch mutated `lastDispatchedValue`, which triggered the `$:` block, which saw `value !== lastDispatchedValue` and called `editor.setValue('')`.

**Fix:** Changed the pattern to `_prevPropValue` — mutated only inside the `$:` block, never by the debounce. The `$:` block now fires only on external prop changes.

**Problem:** `{}` collapsed back to `{}` after typing.

**Root cause 1:** `saveCollection()` called `loadCollections()`, which re-fetched data from the server (server returns re-serialised JSON `"{}"`), overwriting the editor content.

**Fix:** Removed `loadCollections()` from `saveCollection()`. Added `loadData()` instead (refreshes data after save).

**Root cause 2:** `formatJson()` on blur — `JSON.stringify({}, null, 2)` returns `"{}"`, collapsing multiline content.

**Fix:** Removed auto-format on blur. Formatting is available via Cmd+Shift+F only.

**Problem:** Pressing Enter inside `[` created `[\n     ]` instead of `[\n    \n]`.

**Fix:** Custom Ace `Return` command — detects cursor between matching brackets (`{|}`, `[|]`) and inserts three lines with correct indentation.

### Phase 5 — Code review

Fixes after code review:

**Frontend:**
- `loadData()` checks `res.ok` before parsing, falls back to `{}`
- `totalResources` guarded by `Array.isArray(val)` — no crashes on malformed data
- `JSON.stringify(resource)` computed once via `{@const jsonStr}` in `{#each}`
- Editor modal has `role="dialog"`, `aria-modal="true"`, Escape key handler, `aria-label` on the close button
- Removed unused `Card` import
- Custom ID pattern initialised with example regexp `[A-Z]{3}-\d{4}` instead of an empty string
- `{#each collections}` keyed by `col.path` instead of array index
- Token docs updated with `location.flatNr` type (number)

**Backend:**
- `integer:min:max` auto-swaps min and max when min > max
- Top-level alternation `abc|xyz` correctly picks randomly between branches
- `applyTemplate` uses `Object.create(null)` and blocks `__proto__`, `constructor`, `prototype` keys
- POST and PATCH in bucket.js validate that the body is a plain object (not null, array, or primitive) — return 400
- PATCH route in bucket routes returns 400 for invalid `responseTemplate` values

**Git:**
- `.vite/` and `bucket/data.json` added to `.gitignore`
- Both files removed from the git index (`git rm --cached`)
