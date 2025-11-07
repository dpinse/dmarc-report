'use client'

import { useState, useEffect } from 'react'
import { calculateStatistics } from '../utils/dmarcParser'
import { resolveIPs } from '../utils/ipResolver'
import ReportCharts from './ReportCharts'

export default function ReportViewer({ report }) {
  const [ipHostnames, setIpHostnames] = useState({})
  const [isResolvingIPs, setIsResolvingIPs] = useState(false)
  const [filter, setFilter] = useState(null)
  const stats = calculateStatistics(report)

  useEffect(() => {
    // Resolve all IPs when report changes
    const resolveAllIPs = async () => {
      setIsResolvingIPs(true)
      const uniqueIPs = [...new Set(report.records.map(r => r.sourceIp))]
      const resolved = await resolveIPs(uniqueIPs)
      setIpHostnames(resolved)
      setIsResolvingIPs(false)
    }

    resolveAllIPs()
  }, [report])

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const passRate = stats.totalMessages > 0
    ? ((stats.passedCount / stats.totalMessages) * 100).toFixed(1)
    : 0

  const getDKIMAlignment = (adkim) => {
    return adkim === 'r' ? 'Relaxed' : adkim === 's' ? 'Strict' : adkim
  }

  const getSPFAlignment = (aspf) => {
    return aspf === 'r' ? 'Relaxed' : aspf === 's' ? 'Strict' : aspf
  }

  const getComplianceStatus = (record) => {
    const dkimPass = record.policyEvaluated.dkim === 'pass'
    const spfPass = record.policyEvaluated.spf === 'pass'

    if (dkimPass && spfPass) return 'Full Compliance'
    if (dkimPass || spfPass) return 'Partial Compliance'
    return 'Non-Compliant'
  }

  const getComplianceClass = (record) => {
    const dkimPass = record.policyEvaluated.dkim === 'pass'
    const spfPass = record.policyEvaluated.spf === 'pass'

    if (dkimPass && spfPass) return 'badge-pass'
    if (dkimPass || spfPass) return 'badge-partial'
    return 'badge-fail'
  }

  // Filter records based on active filter
  const filteredRecords = filter ? report.records.filter(record => {
    switch (filter.type) {
      case 'compliance':
        return getComplianceStatus(record) === filter.value
      case 'dkim':
        return record.policyEvaluated.dkim === filter.value
      case 'spf':
        return record.policyEvaluated.spf === filter.value
      case 'disposition':
        return record.policyEvaluated.disposition === filter.value
      case 'ip':
        return record.sourceIp === filter.value
      default:
        return true
    }
  }) : report.records

  const handleFilterClick = (type, value) => {
    // Toggle filter - if same filter is clicked, clear it
    if (filter && filter.type === type && filter.value === value) {
      setFilter(null)
    } else {
      setFilter({ type, value })
      // Scroll to the records table
      setTimeout(() => {
        document.querySelector('.records-table-container')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }, 100)
    }
  }

  const clearFilter = () => {
    setFilter(null)
  }

  return (
    <div className="report-viewer">
      <div className="report-viewer-header">
        <h2>{report.fileName}</h2>
        <span className="report-viewer-domain">{report.policy.domain}</span>
      </div>

      <div className="report-viewer-content">
        {/* Metadata Section */}
        <div className="report-section">
          <h3>Report Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Organization:</span>
              <span className="info-value">{report.metadata.orgName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Report ID:</span>
              <span className="info-value">{report.metadata.reportId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Contact Email:</span>
              <span className="info-value">{report.metadata.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Date Range:</span>
              <span className="info-value">
                {formatDate(report.metadata.dateRange.begin)} - {formatDate(report.metadata.dateRange.end)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Report Duration:</span>
              <span className="info-value">
                {Math.round((report.metadata.dateRange.end - report.metadata.dateRange.begin) / 3600)} hours
              </span>
            </div>
          </div>
        </div>

        {/* Policy Section */}
        <div className="report-section">
          <h3>Published DMARC Policy</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Domain:</span>
              <span className="info-value">{report.policy.domain}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Policy (p):</span>
              <span className={`policy-badge policy-${report.policy.p}`}>{report.policy.p}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Subdomain Policy (sp):</span>
              <span className="info-value">{report.policy.sp || 'Same as p'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Percentage (pct):</span>
              <span className="info-value">{report.policy.pct}%</span>
            </div>
            <div className="info-item">
              <span className="info-label">DKIM Alignment Mode:</span>
              <span className="info-value">{getDKIMAlignment(report.policy.adkim)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">SPF Alignment Mode:</span>
              <span className="info-value">{getSPFAlignment(report.policy.aspf)}</span>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="report-section">
          <h3>Summary Statistics <span className="filter-hint">Click any stat to filter records</span></h3>
          {filter && (
            <div className="active-filter">
              <span>Filtering: {filter.type} = {filter.value}</span>
              <button onClick={clearFilter} className="btn btn-clear-filter">Clear Filter</button>
            </div>
          )}
          <div className="stats-grid">
            <div
              className={`stat-card stat-total clickable ${filter?.type === 'compliance' && filter?.value === 'Full Compliance' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('compliance', 'Full Compliance')}
              title="Click to filter by passed records"
            >
              <div className="stat-value">{stats.passedCount}</div>
              <div className="stat-label">Passed ({passRate}%)</div>
            </div>
            <div
              className={`stat-card stat-fail clickable ${filter?.type === 'compliance' && filter?.value === 'Non-Compliant' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('compliance', 'Non-Compliant')}
              title="Click to filter by failed records"
            >
              <div className="stat-value">{stats.failedCount}</div>
              <div className="stat-label">Failed</div>
            </div>
            <div
              className={`stat-card stat-pass clickable ${filter?.type === 'compliance' && filter?.value === 'Partial Compliance' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('compliance', 'Partial Compliance')}
              title="Click to filter by partial compliance"
            >
              <div className="stat-value">{stats.partialCount}</div>
              <div className="stat-label">Partial Compliance</div>
            </div>
          </div>

          <div className="stats-grid">
            <div
              className={`stat-card clickable ${filter?.type === 'dkim' && filter?.value === 'pass' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('dkim', 'pass')}
              title="Click to filter by DKIM pass"
            >
              <div className="stat-value">{stats.dkimPass}</div>
              <div className="stat-label">DKIM Pass</div>
            </div>
            <div
              className={`stat-card clickable ${filter?.type === 'dkim' && filter?.value === 'fail' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('dkim', 'fail')}
              title="Click to filter by DKIM fail"
            >
              <div className="stat-value">{stats.dkimFail}</div>
              <div className="stat-label">DKIM Fail</div>
            </div>
            <div
              className={`stat-card clickable ${filter?.type === 'spf' && filter?.value === 'pass' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('spf', 'pass')}
              title="Click to filter by SPF pass"
            >
              <div className="stat-value">{stats.spfPass}</div>
              <div className="stat-label">SPF Pass</div>
            </div>
            <div
              className={`stat-card clickable ${filter?.type === 'spf' && filter?.value === 'fail' ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('spf', 'fail')}
              title="Click to filter by SPF fail"
            >
              <div className="stat-value">{stats.spfFail}</div>
              <div className="stat-label">SPF Fail</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <ReportCharts stats={stats} onFilterClick={handleFilterClick} activeFilter={filter} />

        {/* Detailed Records */}
        <div className="report-section">
          <h3>
            Detailed Authentication Records
            {filter ? (
              <span className="filter-hint"> - Showing {filteredRecords.length} of {report.records.length}</span>
            ) : (
              <span> ({report.records.length})</span>
            )}
          </h3>
          <div className="records-table-container">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Count</th>
                  <th>Compliance</th>
                  <th>DKIM</th>
                  <th>DKIM Selector</th>
                  <th>SPF</th>
                  <th>Disposition</th>
                  <th>Header From</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={index}>
                    <td className="hostname-cell">
                      {ipHostnames[record.sourceIp] ? (
                        <div className="hostname-with-ip">
                          <span className="hostname-primary">{ipHostnames[record.sourceIp]}</span>
                          <span className="hostname-secondary">{record.sourceIp}</span>
                        </div>
                      ) : (
                        <div className="hostname-with-ip">
                          <span className="hostname-primary">{record.sourceIp}</span>
                          <span className="hostname-secondary">
                            {isResolvingIPs ? 'Resolving...' : 'No hostname'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{record.count}</td>
                    <td>
                      <span className={`badge ${getComplianceClass(record)}`}>
                        {getComplianceStatus(record)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${record.policyEvaluated.dkim}`}>
                        {record.policyEvaluated.dkim}
                      </span>
                    </td>
                    <td>
                      {record.authResults.dkim.length > 0 ? (
                        <div className="dkim-selectors">
                          {record.authResults.dkim.map((dkim, dkimIndex) => (
                            <div key={dkimIndex} className="dkim-selector-item">
                              <code className="selector-code">{dkim.selector}</code>
                              <span className="dkim-domain">@{dkim.domain}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="no-data">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${record.policyEvaluated.spf}`}>
                        {record.policyEvaluated.spf}
                      </span>
                    </td>
                    <td>
                      <span className="disposition-badge">{record.policyEvaluated.disposition}</span>
                    </td>
                    <td>{record.identifiers.headerFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
