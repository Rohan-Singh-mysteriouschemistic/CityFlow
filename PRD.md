# CityFlow Frontend Rebuild Plan (Stitch-Enhanced)

> **Scope:** Replace every file in `client/src/` except `api/axios.js` and `context/AuthContext.jsx`.  
> **Backend:** Untouched. All API routes, DB schema, and Node.js logic stay as-is.  
> **Blueprint Source:** Google Stitch Project `11884568304818490142`.
> **Stack:** React 19 + Vite + React Router DOM + Axios + Mapbox GL + React Hot Toast + Lucide React.

---

## 1. Design Direction

### Aesthetic Name
**Utilitarian Civic** — the visual language of public-service dashboards: clear hierarchy, zero decoration, everything earns its place.

### Differentiation Anchor
Recognizable by a **tight two-column data layout with a hard left border accent on active states** — no cards, no shadows, no gradient headers.

---

## 2. Design System (The "Single Truth")

### 2.1 Color Tokens
**Zero hex codes are allowed in components. Use these tokens only.**

```css
:root {
  /* Background */
  --bg-base:        #F4F3EF;   /* warm off-white */
  --bg-surface:     #FFFFFF;
  --bg-subtle:      #EBEBE6;

  /* Accent */
  --accent:         #1A56DB;   
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
}