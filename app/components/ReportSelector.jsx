'use client'

export default function ReportSelector({ reports, selectedIndex, onSelectReport, onRemoveReport, onClearAll }) {
  return (
    <div className="report-selector">
      <div className="report-selector-header">
        <h2>Reports ({reports.length})</h2>
        <button onClick={onClearAll} className="btn btn-secondary">
          Clear All
        </button>
      </div>

      <div className="report-selector-list">
        {reports.map((report, index) => (
          <div
            key={index}
            className={`report-selector-item ${selectedIndex === index ? 'selected' : ''}`}
            onClick={() => onSelectReport(index)}
          >
            <div className="report-selector-info">
              <div className="report-selector-title">{report.fileName}</div>
              <div className="report-selector-meta">
                <span className="report-selector-domain">{report.policy.domain}</span>
                <span className="report-selector-count">{report.totalMessages} messages</span>
              </div>
              <div className="report-selector-date">
                {new Date(report.metadata.dateRange.begin * 1000).toLocaleDateString()} - {new Date(report.metadata.dateRange.end * 1000).toLocaleDateString()}
              </div>
            </div>
            <button
              className="btn btn-icon btn-danger report-selector-remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveReport(index)
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
