'use client'

import ReportCard from './ReportCard'

export default function ReportList({ reports, onRemoveReport }) {
  if (reports.length === 0) {
    return null
  }

  return (
    <div className="report-list">
      {reports.map((report, index) => (
        <ReportCard
          key={index}
          report={report}
          onRemove={() => onRemoveReport(index)}
        />
      ))}
    </div>
  )
}
