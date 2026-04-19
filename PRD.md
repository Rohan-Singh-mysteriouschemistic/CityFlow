# CityFlow Frontend Rebuild Plan

> **Scope:** Replace every file in `client/src/` except `api/axios.js` and `context/AuthContext.jsx`.  
> **Backend:** Untouched. All API routes, DB schema, and Node.js logic stay as-is.  
> **Stack:** React 19 + Vite + React Router DOM + Axios + Mapbox GL + React Hot Toast + Lucide React.

---

## 1. Design Direction

### Aesthetic Name
**Utilitarian Civic** — the visual language of public-service dashboards: clear hierarchy, zero decoration, everything earns its place.

### DFII Score
| Dimension | Score | Rationale |
|---|---|---|
| Aesthetic Impact | 4 | Intentionally restrained; memorability comes from precision, not spectacle |
| Context Fit | 5 | Matches a transport-ops product used under time pressure |
| Implementation Feasibility | 5 | Pure CSS variables + vanilla React, no exotic deps |
| Performance Safety | 5 | No heavy animations, no blur layers |
| Consistency Risk | 2 | Flat token system scales easily across three dashboards |
| **DFII Total** | **17 − 2 = 15** | **Execute fully** |

### Differentiation Anchor
> If this were screenshotted with the logo removed, you'd recognize it by the **tight two-column data layout with a hard left border accent on active states** — no cards, no shadows, no gradient headers.

---

## 2. Design System

### 2.1 Typography

```css
/* Google Fonts — add to index.html */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
```

| Role | Font | Weight | Size |
|---|---|---|---|
| Body / UI labels | DM Sans | 400 / 500 | 14px / 15px |
| Headings | DM Sans | 600 | 18px – 28px |
| Numbers / codes / OTP | DM Mono | 500 | 13px – 20px |

**Line-height rules (non-negotiable):**
- Body text: `1.6`
- Headings: `1.25`
- Table cells / data rows: `1.5`
- No inline `line-height` overrides in components; all via CSS custom properties.

### 2.2 Color Tokens

```css
:root {
  /* Background */
  --bg-base:        #F4F3EF;   /* warm off-white — single flat background */
  --bg-surface:     #FFFFFF;
  --bg-subtle:      #EBEBЕ6;

  /* Accent — one, used sparingly */
  --accent:         #1A56DB;   /* clear blue, no gradient, no opacity variation */
  --accent-hover:   #1448C2;
  --accent-text:    #FFFFFF;

  /* Status */
  --status-success: #16A34A;
  --status-warn:    #D97706;
  --status-danger:  #DC2626;
  --status-neutral: #6B7280;

  /* Text */
  --text-primary:   #111827;
  --text-secondary: #4B5563;
  --text-muted:     #9CA3AF;

  /* Border */
  --border:         #D1D5DB;
  --border-strong:  #9CA3AF;
}
```

> **Zero gradients.** Zero `backdrop-filter`. Zero `rgba` layering for decoration. Color is used only to communicate state.

### 2.3 Spacing Rhythm

Base unit: `4px`. All spacing values are multiples.

```css
:root {
  --sp-1:  4px;
  --sp-2:  8px;
  --sp-3:  12px;
  --sp-4:  16px;
  --sp-5:  20px;
  --sp-6:  24px;
  --sp-8:  32px;
  --sp-10: 40px;
  --sp-12: 48px;
  --sp-16: 64px;
}
```

Section vertical padding: `var(--sp-8)` top and bottom — every section, no exceptions. No cramped `padding: 8px` or uneven asymmetric values on page-level containers.

### 2.4 Motion

- **One entrance animation only:** `opacity: 0 → 1` + `translateY(6px → 0)` on page-level components, 200ms ease-out.
- **Hover states:** `background-color` transition 120ms on buttons and rows.
- **No spinners with decorative rings.** Loading state = a single `opacity: 0.4` pulse on the content area.
- **No floating, orbiting, or looping animations anywhere.**

---

## 3. File Structure

```
client/src/
├── api/
│   └── axios.js              ← KEEP AS-IS
├── context/
│   └── AuthContext.jsx       ← KEEP AS-IS
├── styles/
│   ├── tokens.css            ← NEW: all CSS custom properties
│   ├── base.css              ← NEW: reset + body defaults
│   └── components.css        ← NEW: shared utility classes
├── components/
│   ├── AppShell.jsx          ← NEW: sidebar + main layout wrapper
│   ├── Sidebar.jsx           ← NEW: role-aware nav
│   ├── StatusBadge.jsx       ← NEW: pill for ride/user status
│   ├── DataTable.jsx         ← NEW: consistent table component
│   ├── StatCard.jsx          ← NEW: single metric tile
│   ├── MapRoute.jsx          ← REWRITE (keep Mapbox logic, strip styles)
│   ├── LocationSearch.jsx    ← REWRITE (keep Mapbox logic, strip styles)
│   └── LoadingScreen.jsx     ← NEW: replaces inline loading div
├── pages/
│   ├── Login.jsx             ← REWRITE
│   ├── Register.jsx          ← REWRITE
│   ├── rider/
│   │   └── Rider_Dashboard.jsx  ← REWRITE
│   ├── driver/
│   │   └── Driver_Dashboard.jsx ← REWRITE
│   └── admin/
│       └── Admin_Dashboard.jsx  ← REWRITE
├── App.jsx                   ← MINOR UPDATE (update LoadingScreen import)
└── main.jsx                  ← KEEP AS-IS
```

---

## 4. Shared Components

### 4.1 `AppShell.jsx`

**Purpose:** Wraps every authenticated page. Renders `<Sidebar>` on the left and a `<main>` content area on the right.

**Layout:**
```
┌──────────────┬──────────────────────────────────┐
│  Sidebar     │  <main> — page content            │
│  220px fixed │  flex-grow, overflow-y: auto      │
└──────────────┴──────────────────────────────────┘
```

**Props:** `children`, `role` (passed to Sidebar for nav items)

**CSS:**
```css
.app-shell        { display: flex; height: 100vh; background: var(--bg-base); }
.app-shell__main  { flex: 1; overflow-y: auto; padding: var(--sp-8); }
```

---

### 4.2 `Sidebar.jsx`

**Purpose:** Left navigation. Shows CityFlow wordmark, nav links, and a logout button at the bottom.

**Copy rules:** Link labels are plain nouns. "Dashboard", "Ride History", "Zones", "Users", "Drivers". No icons used as the *only* label — every icon has an adjacent text label.

**Nav items by role:**

| Role | Links |
|---|---|
| `rider` | Dashboard, Ride History |
| `driver` | Dashboard, Ride History |
| `admin` | Dashboard, All Rides, Drivers, Riders, Zones |

**API:** No API calls. Reads `role` from `useAuth()`. Calls `logout()` from `useAuth()` on button click.

**Active state:** `border-left: 3px solid var(--accent)` + `background: var(--bg-subtle)` — no color fill on the text.

---

### 4.3 `StatusBadge.jsx`

Displays ride or user status as a small pill.

**Props:** `status` (string)

**Status → color mapping (CSS classes, no inline styles):**

| Status | Text color | Background |
|---|---|---|
| `pending` | `--status-warn` | `#FEF3C7` |
| `otp_pending` | `--status-warn` | `#FEF3C7` |
| `active` | `--status-success` | `#DCFCE7` |
| `completed` | `--text-secondary` | `--bg-subtle` |
| `cancelled` | `--status-danger` | `#FEE2E2` |
| `suspended` | `--status-danger` | `#FEE2E2` |
| `active` (user) | `--status-success` | `#DCFCE7` |

---

### 4.4 `DataTable.jsx`

**Purpose:** One table component used everywhere — ride history, user lists, zone tables.

**Props:** `columns` (array of `{ key, label, render? }`), `rows` (array of objects), `loading` (bool), `emptyMessage` (string)

**Rules:**
- Header row: `font-weight: 500`, `text-transform: uppercase`, `font-size: 11px`, `letter-spacing: 0.05em`, `color: var(--text-muted)`
- Data rows: `line-height: 1.5`, `border-bottom: 1px solid var(--border)`
- Hover: `background: var(--bg-subtle)` on `<tr>`, 120ms transition
- Loading: full-width row with a single "Loading..." text at `opacity: 0.4`
- Empty: full-width row with the `emptyMessage` string in `--text-muted`

---

### 4.5 `StatCard.jsx`

**Purpose:** Shows a single metric — total rides, earnings, active drivers, etc.

**Props:** `label` (string), `value` (string | number), `sub` (optional secondary line)

**Layout:** Two lines. Label in `--text-muted` at 12px. Value in `DM Mono` at 28px `--text-primary`. Optional sub-label at 12px below.

**No icons. No sparklines. No trend arrows.** Just the number.

---

### 4.6 `LoadingScreen.jsx`

Replaces the inline `<div style={{...}}>Loading...</div>` in `App.jsx`.

```jsx
export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span>Loading</span>
    </div>
  )
}
```

```css
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: var(--font-body);
  color: var(--text-muted);
  font-size: 14px;
  background: var(--bg-base);
}
```

---

## 5. Pages

### 5.1 `Login.jsx`

**Route:** `/login`

**Layout:** Single centered column, max-width 400px, vertically centered on the viewport.

**Content (in order):**
1. `CityFlow` wordmark — DM Sans 600, 24px, `--text-primary`
2. `Sign in to continue` — DM Sans 400, 15px, `--text-secondary`
3. Email field + Password field
4. "Sign in" button — full width, `--accent` background
5. Link to `/register`

**No hero image. No background pattern. No tagline. No logo mark.**

**API call:**
```js
// POST /api/auth/login
// Body: { email, password }
// On success: calls login() from useAuth(), then Navigate to /${user.role}
const { login } = useAuth()
await login(email, password)
```

**Error handling:** Show the server's `message` field as a plain text error above the submit button. No toast for auth errors — inline is clearer.

---

### 5.2 `Register.jsx`

**Route:** `/register`

**Layout:** Same centered column as Login. Slightly taller — one scrollable form.

**Fields:**
- Full name, Email, Password
- Role selector: three radio buttons labeled "I want to book rides", "I want to drive", "I'm an admin" — maps to values `rider`, `driver`, `admin`
- **If `driver`:** Show additional fields: License number, Vehicle type (select: auto / sedan / suv / xl / bike), Make, Model, Color, Year, Registration number

**API call:**
```js
// POST /api/auth/register
// Body: { name, email, password, role, ...driverFields }
// On success: Navigate to /login with a success message
```

**Copy:** "Create your account". No "Join the revolution", no "Get started for free". Just the label.

---

### 5.3 Rider Dashboard — `Rider_Dashboard.jsx`

**Route:** `/rider/*`

**Outer wrapper:** `<AppShell role="rider">`

The dashboard has two modes: **idle** (no active ride) and **in-ride** (active ride exists). A `useEffect` on mount polls `GET /api/rides/active/rider` to determine mode.

#### Mode A — Idle (Book a Ride)

**Section 1 — Book a Ride form**

Fields:
- Pickup location (`LocationSearch` component) — stores `{ address, lat, lng }`
- Dropoff location (`LocationSearch` component) — stores `{ address, lat, lng }`
- Vehicle type: five plain radio buttons (Auto · Sedan · SUV · XL · Bike) with the base rate shown beside each label, pulled from a static config object matching the DB rates
- Payment method: four plain radio buttons (Cash · Card · Wallet · UPI)
- Optional promo code text field

**Map:** `MapRoute` component renders below the form once both locations are set, showing the route line and distance estimate. The map is functional — it shows the actual Mapbox route and distance in km.

**Estimated fare:** Shown as a calculated number below the map. Formula displayed as: `base + (km × rate) × zone_surge`. Pull zone list from `GET /api/rides/zones` on page load. If no zone is matched, surge = 1.0.

**"Request Ride" button:**
```js
// POST /api/rides/request
// Body: {
//   pickup_address, pickup_lat, pickup_lng,
//   dropoff_address, dropoff_lat, dropoff_lng,
//   vehicle_type, payment_method, promo_code (optional),
//   zone_id (from nearest zone match)
// }
```

**Section 2 — Ride History**

Rendered below the booking form when idle. Uses `DataTable` component.

```js
// GET /api/rides/history/rider
// Returns: array of past rides
```

Columns: Date, From → To (abbreviated), Vehicle, Fare, Status (`StatusBadge`)

No pagination on first version — show last 20.

---

#### Mode B — Active Ride

When `GET /api/rides/active/rider` returns a ride:

**Displayed data:**
- Ride ID (DM Mono, `--text-muted`)
- Status badge
- Driver name + vehicle details + registration number
- OTP (DM Mono, large, `--accent`) — shown only when status is `otp_pending`
- Pickup address → Dropoff address

**Map:** Full route shown via `MapRoute` with pickup and dropoff markers.

**Cancel button:** Shown only when status is `pending`.
```js
// DELETE /api/rides/request/:request_id/cancel
```

**Poll interval:** Re-fetch `GET /api/rides/active/rider` every 6 seconds using `setInterval` inside a `useEffect`. Clear interval on unmount.

---

#### Mode C — Rate Ride (post-completion)

After a ride completes, `GET /api/rides/unrated/rider` returns a ride pending a rating. Show a simple rating panel (1–5 star row) + optional comment field above the booking form.

```js
// PATCH /api/rides/:ride_id/rate
// Body: { rating: 1-5, comment }
```

Stars: plain unicode `★` characters, no SVG icon library. Selected stars are `--accent`, unselected are `--border-strong`.

---

### 5.4 Driver Dashboard — `Driver_Dashboard.jsx`

**Route:** `/driver/*`

**Outer wrapper:** `<AppShell role="driver">`

#### Section 1 — Driver Header

- Name, vehicle type, registration number, average rating (from `GET /api/drivers/me`)
- Online/Offline toggle — calls `PATCH /api/drivers/availability` with `{ is_available: true/false }`
- When toggling **online**: also calls `PATCH /api/drivers/location` with browser geolocation coordinates (use `navigator.geolocation.getCurrentPosition`)

```js
// GET /api/drivers/me
// Returns: driver profile + vehicle details
```

The toggle is a plain `<button>` that reads "Go Online" or "Go Offline" — no animated switch widget.

#### Section 2 — Stats Row

Four `StatCard` components:

| Label | Value source |
|---|---|
| Total Rides | `driver.total_rides` from `/api/drivers/me` |
| Total Earned | `driver.total_earned` formatted as ₹ |
| Avg Rating | `driver.avg_rating` to 1 decimal |
| Current Zone | `nearest_zone.zone_name` from last location update |

#### Section 3 — Available Requests

Shown only when driver is online (`is_available = true`). Fetches `GET /api/rides/available` every 8 seconds.

Displays as a list (not a table). Each item shows:
- Pickup area → Dropoff area
- Vehicle type required
- Estimated fare (₹)
- "Accept" button

```js
// POST /api/rides/accept/:request_id
```

On accept, the available list is hidden and the active ride view takes over.

#### Section 4 — Active Ride Panel

Shown when `GET /api/rides/active/driver` returns a ride.

States and their UI:

| Ride status | Shown controls |
|---|---|
| `otp_pending` | OTP input field + "Start Ride" button |
| `active` | "Complete Ride" button |
| `completed` | "Confirm Payment" button |

```js
// PATCH /api/rides/:ride_id/start      — Body: { otp }
// PATCH /api/rides/:ride_id/complete
// PATCH /api/rides/:ride_id/confirm-payment
```

Map shown via `MapRoute` for all active states.

#### Section 5 — Ride History

`DataTable` at the bottom. Columns: Date, From → To, Fare, Rating received, Status.

```js
// GET /api/rides/history/driver
```

---

### 5.5 Admin Dashboard — `Admin_Dashboard.jsx`

**Route:** `/admin/*`

**Outer wrapper:** `<AppShell role="admin">`

The admin dashboard is tab-based: **Overview**, **Rides**, **Drivers**, **Riders**, **Zones**.

Tab switching is client-side only (no sub-routing). Active tab: `border-bottom: 2px solid var(--accent)`.

---

#### Tab 1 — Overview

Four `StatCard` tiles in a 2×2 grid:

```js
// GET /api/admin/stats
// Returns: { total_rides, active_rides, total_revenue, total_drivers }
```

| Label | Field |
|---|---|
| Total Rides | `total_rides` |
| Active Now | `active_rides` |
| Total Revenue | `total_revenue` — formatted ₹ |
| Registered Drivers | `total_drivers` |

Below stats: a zone revenue breakdown table from `GET /api/admin/revenue/zones`.

Columns: Zone Name, Area, Rides, Revenue (₹), Surge Multiplier, Admin Surge.

**No pie charts. No bar graphs. Real numbers in a real table.**

---

#### Tab 2 — All Rides

`DataTable` with:
```js
// GET /api/admin/rides
```
Columns: Ride ID (DM Mono), Rider, Driver, Vehicle, Status (`StatusBadge`), Fare, Date.

---

#### Tab 3 — Drivers

`DataTable` with:
```js
// GET /api/admin/drivers
```
Columns: Name, Email, Vehicle, Zone, Avg Rating, Status, Verified, Actions.

Actions per row:
- "Verify" button → `PATCH /api/admin/drivers/:driver_id/verify`
- "Suspend" button → opens an inline dropdown to pick duration (`1_day` / `3_days` / `1_week` / `permanent`) then calls `PATCH /api/admin/users/:user_id/suspend` with `{ duration }`
- "Activate" button (shown if suspended) → `PATCH /api/admin/users/:user_id/activate`

---

#### Tab 4 — Riders

`DataTable` with:
```js
// GET /api/admin/riders
```
Columns: Name, Email, Total Rides, Total Spent (₹), Status, Actions.

Actions: same Suspend / Activate pattern as Drivers tab.

---

#### Tab 5 — Zones

`DataTable` with:
```js
// GET /api/admin/zones
```
Columns: Zone Name, Area, Center Coords, Surge Multiplier, Admin Surge, Actions.

Each row has two inline number inputs (current values pre-filled):
- **Surge Multiplier** → `PATCH /api/admin/zones/:zone_id/multiplier` — Body: `{ surge_multiplier }`
- **Admin Surge** → `PATCH /api/admin/zones/:zone_id/surge_admin` — Body: `{ admin_surge_multiplier }`

Save button per input, not per row. Label: "Save" — no icon.

---

## 6. Rewritten Components

### 6.1 `MapRoute.jsx` (rewrite, keep logic)

Keep all existing Mapbox GL logic intact. Strip out:
- Inline `style` props with hardcoded dark background colors
- Any `glassmorphism` or `blur` overlay on map controls

Apply:
```css
.map-container { border: 1px solid var(--border); border-radius: 4px; }
```

Map style: use `mapbox://styles/mapbox/light-v11` (light, not dark).

### 6.2 `LocationSearch.jsx` (rewrite, keep logic)

Keep Mapbox Geocoding logic. Strip decorative styles. Apply `--bg-surface` input background, `--border` border, `--text-primary` text.

Dropdown suggestion items: plain `<li>` elements, `hover: background: var(--bg-subtle)`.

---

## 7. Copy Rules (Enforced)

These rules apply to every string rendered in the UI:

| ❌ Remove | ✅ Replace with |
|---|---|
| "Empower your journey" | "Book a ride" |
| "Supercharge your earnings" | "See your earnings" |
| "Revolutionize urban mobility" | *(delete entirely)* |
| "Unleash real-time insights" | "Live zone data" |
| Any emoji in UI text | Nothing |
| "Get started" on auth CTA | "Create account" |
| "Trusted by thousands" | *(delete — no fake social proof)* |

Write every label as if explaining the feature to someone in person. Short, direct, honest.

---

## 8. Removed Elements (Explicit List)

These must not appear anywhere in the new frontend:

- Any CSS `background: linear-gradient(...)` on page backgrounds or section headers
- `backdrop-filter: blur(...)` on any element
- Floating decorative `div` elements (orbs, blobs, circles)
- Fake metric animations that count up on load
- `@keyframes` animations that serve no state-communication purpose
- Fake testimonial cards or "what our users say" sections
- Dashboard screenshot mockups embedded as decoration
- Any `box-shadow` with spread > 4px used decoratively
- Purple, violet, or indigo in any color token

---

## 9. API Contract Summary

| Component | Method | Endpoint | Auth |
|---|---|---|---|
| Login | POST | `/api/auth/login` | No |
| Register | POST | `/api/auth/register` | No |
| Get current user | GET | `/api/auth/me` | JWT |
| Get zones | GET | `/api/rides/zones` | No |
| Request ride | POST | `/api/rides/request` | Rider |
| Cancel pending request | DELETE | `/api/rides/request/:id/cancel` | Rider |
| Active ride (rider) | GET | `/api/rides/active/rider` | Rider |
| Unrated ride | GET | `/api/rides/unrated/rider` | Rider |
| Rate ride | PATCH | `/api/rides/:id/rate` | Rider |
| Rider history | GET | `/api/rides/history/rider` | Rider |
| Available requests | GET | `/api/rides/available` | Driver |
| Accept request | POST | `/api/rides/accept/:id` | Driver |
| Active ride (driver) | GET | `/api/rides/active/driver` | Driver |
| Start ride | PATCH | `/api/rides/:id/start` | Driver |
| Complete ride | PATCH | `/api/rides/:id/complete` | Driver |
| Confirm payment | PATCH | `/api/rides/:id/confirm-payment` | Driver |
| Cancel ride | PATCH | `/api/rides/:id/cancel` | JWT |
| Driver history | GET | `/api/rides/history/driver` | Driver |
| Driver profile | GET | `/api/drivers/me` | Driver |
| Toggle availability | PATCH | `/api/drivers/availability` | Driver |
| Update location | PATCH | `/api/drivers/location` | Driver |
| Admin stats | GET | `/api/admin/stats` | Admin |
| All rides | GET | `/api/admin/rides` | Admin |
| All drivers | GET | `/api/admin/drivers` | Admin |
| All riders | GET | `/api/admin/riders` | Admin |
| Revenue by zone | GET | `/api/admin/revenue/zones` | Admin |
| Admin zones | GET | `/api/admin/zones` | Admin |
| Verify driver | PATCH | `/api/admin/drivers/:id/verify` | Admin |
| Suspend user | PATCH | `/api/admin/users/:id/suspend` | Admin |
| Activate user | PATCH | `/api/admin/users/:id/activate` | Admin |
| Update surge | PATCH | `/api/admin/zones/:id/multiplier` | Admin |
| Update admin surge | PATCH | `/api/admin/zones/:id/surge_admin` | Admin |

---

## 10. Implementation Order

Execute in this sequence to avoid broken imports:

1. `styles/tokens.css` → `styles/base.css` → `styles/components.css`
2. `components/LoadingScreen.jsx`
3. `components/StatusBadge.jsx`
4. `components/StatCard.jsx`
5. `components/DataTable.jsx`
6. `components/LocationSearch.jsx` (rewrite)
7. `components/MapRoute.jsx` (rewrite)
8. `components/Sidebar.jsx`
9. `components/AppShell.jsx`
10. `pages/Login.jsx`
11. `pages/Register.jsx`
12. `pages/rider/Rider_Dashboard.jsx`
13. `pages/driver/Driver_Dashboard.jsx`
14. `pages/admin/Admin_Dashboard.jsx`
15. `App.jsx` — swap inline loading div for `<LoadingScreen />`

---

## 11. Operator Checklist

Before marking any component done:

- [ ] Uses only CSS custom properties from `tokens.css` — no hardcoded hex values
- [ ] No `linear-gradient` or `backdrop-filter` anywhere
- [ ] Body text has `line-height: 1.6` applied via CSS class, not inline
- [ ] All API calls match the endpoint table above exactly
- [ ] Loading state is present for every async fetch
- [ ] Error state shows the server's `message` string, not a generic fallback
- [ ] No placeholder text like "Coming soon" or "Loading data..."
- [ ] All interactive elements have visible `:focus` styles (outline, not box-shadow)
- [ ] No unused `@keyframes` definitions remain in CSS files
