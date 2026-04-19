/**
 * DataTable — generic table component used for ride history, user lists, zone tables.
 *
 * Props:
 *   columns      — array of { key: string, label: string, render?: (value, row) => ReactNode }
 *   rows         — array of plain objects
 *   loading      — bool
 *   emptyMessage — string shown when rows.length === 0 and not loading
 */
export default function DataTable({ columns = [], rows = [], loading = false, emptyMessage = 'No data.' }) {
  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="data-table__th">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="data-table__cell data-table__cell--loading">
                Loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__cell data-table__cell--empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIdx) => (
              <tr key={row.id ?? rowIdx} className="data-table__row">
                {columns.map((col) => (
                  <td key={col.key} className="data-table__cell">
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
