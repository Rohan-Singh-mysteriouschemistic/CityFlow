/**
 * StatCard — single metric tile.
 * Props: label (string), value (string|number), sub (optional string)
 * No icons. No sparklines. No trend arrows. Just the number.
 */
export default function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value ?? '—'}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  )
}
