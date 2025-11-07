'use client'

import { useState } from 'react'
import { calculateStatistics } from '../utils/dmarcParser'
import ReportCharts from './ReportCharts'

export default function ReportCard({ report, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const stats = calculateStatistics(report)

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const passRate = stats.totalMessages > 0
    ? ((stats.passedCount / stats.totalMessages) * 100).toFixed(1)
    : 0

  return (
    <div className="report-card">
      <div className="report-header">
        <div className="report-title-section">
          <h2 className="report-title">{report.fileName}</h2>
          <span className="report-domain">{report.policy.domain}</span>
        </div>
        <div className="report-actions">
          <button
            className="btn btn-icon"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
          <button
            className="btn btn-icon btn-danger"
            onClick={onRemove}
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="report-content">
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
                <span className="info-label">Email:</span>
                <span className="info-value">{report.metadata.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Date Range:</span>
                <span className="info-value">
                  {formatDate(report.metadata.dateRange.begin)} - {formatDate(report.metadata.dateRange.end)}
                </span>
              </div>
            </div>
          </div>

          {/* Policy Section */}
          <div className="report-section">
            <h3>Published Policy</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Domain:</span>
                <span className="info-value">{report.policy.domain}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Policy:</span>
                <span className="info-value policy-badge">{report.policy.p}</span>
              </div>
              <div className="info-item">
                <span className="info-label">DKIM Alignment:</span>
                <span className="info-value">{report.policy.adkim === 'r' ? 'Relaxed' : 'Strict'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">SPF Alignment:</span>
                <span className="info-value">{report.policy.aspf === 'r' ? 'Relaxed' : 'Strict'}</span>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="report-section">
            <h3>Summary Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card stat-total">
                <div className="stat-value">{stats.totalMessages}</div>
                <div className="stat-label">Total Messages</div>
              </div>
              <div className="stat-card stat-pass">
                <div className="stat-value">{stats.passedCount}</div>
                <div className="stat-label">Passed ({passRate}%)</div>
              </div>
              <div className="stat-card stat-fail">
                <div className="stat-value">{stats.failedCount}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.dkimPass}</div>
                <div className="stat-label">DKIM Pass</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.dkimFail}</div>
                <div className="stat-label">DKIM Fail</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.spfPass}</div>
                <div className="stat-label">SPF Pass</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.spfFail}</div>
                <div className="stat-label">SPF Fail</div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <ReportCharts stats={stats} />

          {/* Top IPs Section */}
          <div className="report-section">
            <h3>Top Source IPs</h3>
            <div className="ip-list">
              {stats.topIPs.map((item, index) => (
                <div key={index} className="ip-item">
                  <span className="ip-address">{item.ip}</span>
                  <div className="ip-bar-container">
                    <div
                      className="ip-bar"
                      style={{ width: `${(item.count / stats.totalMessages) * 100}%` }}
                    ></div>
                    <span className="ip-count">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Records */}
          <div className="report-section">
            <h3>Detailed Records ({report.records.length})</h3>
            <div className="records-table-container">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Source IP</th>
                    <th>Count</th>
                    <th>DKIM</th>
                    <th>SPF</th>
                    <th>Disposition</th>
                    <th>Header From</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records.map((record, index) => (
                    <tr key={index}>
                      <td>{record.sourceIp}</td>
                      <td>{record.count}</td>
                      <td>
                        <span className={`badge badge-${record.policyEvaluated.dkim}`}>
                          {record.policyEvaluated.dkim}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${record.policyEvaluated.spf}`}>
                          {record.policyEvaluated.spf}
                        </span>
                      </td>
                      <td>{record.policyEvaluated.disposition}</td>
                      <td>{record.identifiers.headerFrom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
