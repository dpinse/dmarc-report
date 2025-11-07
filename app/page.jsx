'use client'

import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ReportSelector from './components/ReportSelector'
import ReportViewer from './components/ReportViewer'
import ThemeToggle from './components/ThemeToggle'

export default function Home() {
  const [reports, setReports] = useState([])
  const [selectedReportIndex, setSelectedReportIndex] = useState(null)

  const handleFilesUpload = (newReports) => {
    setReports(prev => {
      const updated = [...prev, ...newReports]
      // Auto-select first report if none selected
      if (selectedReportIndex === null && updated.length > 0) {
        setSelectedReportIndex(0)
      }
      return updated
    })
  }

  const handleClearReports = () => {
    setReports([])
    setSelectedReportIndex(null)
  }

  const handleRemoveReport = (index) => {
    setReports(prev => {
      const updated = prev.filter((_, i) => i !== index)
      // Adjust selected index after removal
      if (selectedReportIndex === index) {
        setSelectedReportIndex(updated.length > 0 ? 0 : null)
      } else if (selectedReportIndex > index) {
        setSelectedReportIndex(selectedReportIndex - 1)
      }
      return updated
    })
  }

  const selectedReport = selectedReportIndex !== null ? reports[selectedReportIndex] : null

  return (
    <div className="app">
      <ThemeToggle />
      <header className="app-header">
        <h1>DMARC Report Visualizer</h1>
        <p className="subtitle">
          Analyze your DMARC XML reports client-side - no data uploaded to servers
        </p>
      </header>

      <main className="app-main">
        <FileUpload onFilesUpload={handleFilesUpload} />

        {reports.length > 0 && (
          <>
            <ReportSelector
              reports={reports}
              selectedIndex={selectedReportIndex}
              onSelectReport={setSelectedReportIndex}
              onRemoveReport={handleRemoveReport}
              onClearAll={handleClearReports}
            />

            {selectedReport && (
              <ReportViewer report={selectedReport} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
