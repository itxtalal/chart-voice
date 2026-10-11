import type { Table } from '../api/types'
import { fmt } from '../format'

function toCsv(table: Table) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [table.columns, ...table.rows].map((r) => r.map(esc).join(',')).join('\n')
}

export default function DataTable({ title, table }: { title: string; table: Table }) {
  const [labelCol, ...valueCols] = table.columns

  function download() {
    const blob = new Blob([toCsv(table)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^\w]+/g, '-').toLowerCase() || 'chart'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="table-wrap" tabIndex={0} role="group" aria-label={`Data table, ${table.rows.length} rows. Scrolls sideways on small screens.`}>
        <table>
          <caption>
            {title}. {table.rows.length} rows, {valueCols.length} {valueCols.length === 1 ? 'value column' : 'value columns'}.
          </caption>
          <thead>
            <tr>
              <th scope="col">{labelCol}</th>
              {valueCols.map((c) => (
                <th scope="col" key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                <th scope="row">{String(row[0])}</th>
                {row.slice(1).map((v, j) => (
                  <td key={j} className={v === null ? 'missing' : ''}>
                    {typeof v === 'number' ? fmt(v) : v === null ? 'Missing' : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={download}>
          Download as CSV
        </button>
      </div>
    </>
  )
}
