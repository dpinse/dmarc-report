'use client'

import React, { useState, useEffect } from 'react'
import { calculateStatistics } from '../utils/dmarcParser'
import { resolveIPs } from '../utils/ipResolver'
import { getCountriesForIPs } from '../utils/geoip'
import { identifyEmailService } from '../utils/serviceIdentifier'
import ReportCharts from './ReportCharts'

export default function ReportViewer({ report }) {
  const [ipHostnames, setIpHostnames] = useState({})
  const [ipCountries, setIpCountries] = useState({})
  const [isResolvingIPs, setIsResolvingIPs] = useState(false)
  const [filter, setFilter] = useState(null)
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [tooltipPosition, setTooltipPosition] = useState(null)
  const [tooltipContent, setTooltipContent] = useState(null)
  const stats = calculateStatistics(report)

  useEffect(() => {
    // Resolve all IPs and get countries when report changes
    const resolveAllIPs = async () => {
      setIsResolvingIPs(true)
      const uniqueIPs = [...new Set(report.records.map(r => r.sourceIp))]

      // Resolve hostnames and countries in parallel
      const [resolved, countries] = await Promise.all([
        resolveIPs(uniqueIPs),
        getCountriesForIPs(uniqueIPs)
      ])

      setIpHostnames(resolved)
      setIpCountries(countries)
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

  const isForwarded = (record) => {
    // Check if SPF domain (MAIL FROM) differs from header_from (common forwarding indicator)
    // Use SPF domain as it's more reliable than envelope_from
    const headerFrom = record.identifiers.headerFrom || ''
    const headerDomain = headerFrom.includes('@')
      ? headerFrom.split('@')[1]?.toLowerCase()?.trim()
      : headerFrom.toLowerCase()?.trim()

    // Get SPF domain from auth results - check all SPF records
    let spfDomain = null
    if (record.authResults.spf && record.authResults.spf.length > 0) {
      // Look for mfrom scope (MAIL FROM) first, otherwise take first SPF record
      const mfromSpf = record.authResults.spf.find(s => s.scope === 'mfrom')
      spfDomain = (mfromSpf?.domain || record.authResults.spf[0]?.domain)?.toLowerCase()?.trim()
    }

    // Check if forwarded - but exclude subdomains (e.g., ses.example.com is not forwarded from example.com)
    if (spfDomain && headerDomain && spfDomain !== headerDomain) {
      // Get base domains (last two parts)
      const getBaseDomain = (domain) => {
        const parts = domain.split('.')
        if (parts.length >= 2) {
          return parts.slice(-2).join('.')
        }
        return domain
      }

      const spfBase = getBaseDomain(spfDomain)
      const headerBase = getBaseDomain(headerDomain)

      // Only count as forwarded if base domains differ
      return spfBase !== headerBase
    }

    return false
  }

  const getForwardingRisk = (record) => {
    if (!isForwarded(record)) {
      return null // Not forwarded
    }

    const dkimPass = record.policyEvaluated.dkim === 'pass'
    const spfPass = record.policyEvaluated.spf === 'pass'
    const disposition = record.policyEvaluated.disposition

    // DKIM passes = legitimate forward (original signature intact)
    if (dkimPass) {
      return {
        level: 'low',
        label: 'Forwarded',
        title: 'Legitimate forward - DKIM signature verified',
        className: 'badge-warning'
      }
    }

    // Server rejected it = definite spoof attempt
    if (disposition === 'reject') {
      return {
        level: 'critical',
        label: 'Blocked',
        title: 'Spoofing attempt - Email rejected by policy',
        className: 'badge-fail'
      }
    }

    // Quarantined = suspicious, needs investigation
    if (disposition === 'quarantine') {
      return {
        level: 'high',
        label: 'Suspicious',
        title: 'Potential spoof - Quarantined for review',
        className: 'badge-fail'
      }
    }

    // SPF passes but DKIM fails = possible forward or spoof
    if (spfPass) {
      return {
        level: 'medium',
        label: 'Review',
        title: 'Forwarded without DKIM - Verify if expected',
        className: 'badge-partial'
      }
    }

    // Both fail = likely spoof
    return {
      level: 'high',
      label: 'Likely Spoof',
      title: 'Both DKIM and SPF failed - Investigate immediately',
      className: 'badge-fail'
    }
  }

  const truncateSource = (source, maxLength = 20) => {
    if (!source || source.length <= maxLength) return source
    // Remove common prefixes/suffixes and truncate
    let truncated = source
      .replace(/^mail-/, '')
      .replace(/\.mail\./, '.')
      .replace(/\.prod\./, '.')

    if (truncated.length > maxLength) {
      // Split by dots and take meaningful parts
      const parts = truncated.split('.')
      if (parts.length > 2) {
        // Take first part and last 2 parts
        truncated = `${parts[0]}...${parts.slice(-2).join('.')}`
      } else {
        truncated = truncated.substring(0, maxLength) + '...'
      }
    }
    return truncated
  }

  // Convert country code to flag emoji
  const countryCodeToFlag = (countryCode) => {
    if (!countryCode || countryCode.length !== 2) return countryCode
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  // Handle DKIM selector hover with smart positioning
  const handleDkimHover = (event, dkim) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const tooltipHeight = 200 // Approximate height
    const tooltipWidth = 320

    let top, left

    // Position horizontally: align to the left of the element
    left = rect.left

    // Position vertically: try below first, flip to above if cut off
    if (rect.bottom + tooltipHeight + 8 < viewportHeight) {
      // Show below
      top = rect.bottom + 8
    } else {
      // Show above
      top = rect.top - tooltipHeight - 8
    }

    // Ensure tooltip doesn't go off-screen horizontally
    if (left + tooltipWidth > viewportWidth) {
      left = Math.max(16, viewportWidth - tooltipWidth - 16)
    }

    setTooltipPosition({ top, left })
    setTooltipContent(dkim)
  }

  const handleDkimLeave = () => {
    setTooltipPosition(null)
    setTooltipContent(null)
  }

  // Group records by source (service/hostname/IP) and sum counts
  const groupRecordsBySource = (records) => {
    const grouped = {}

    records.forEach(record => {
      const hostname = ipHostnames[record.sourceIp]
      const service = hostname ? identifyEmailService(hostname) : 'Other'

      // Use service name as key
      const sourceKey = service

      if (!grouped[sourceKey]) {
        grouped[sourceKey] = {
          sourceKey,
          service,
          hostname: null,
          count: 0,
          records: []
        }
      }
      grouped[sourceKey].count += record.count
      grouped[sourceKey].records.push(record)
    })

    return Object.values(grouped)
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
      case 'forwarded':
        return isForwarded(record) === filter.value
      case 'ip':
        return record.sourceIp === filter.value
      default:
        return true
    }
  }) : report.records

  // Group the filtered records by source
  const groupedRecords = groupRecordsBySource(filteredRecords)

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

  const toggleRowExpansion = (sourceKey) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sourceKey)) {
        newSet.delete(sourceKey)
      } else {
        newSet.add(sourceKey)
      }
      return newSet
    })
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
            <div
              className={`stat-card stat-forward clickable ${filter?.type === 'forwarded' && filter?.value === true ? 'filtered' : ''}`}
              onClick={() => handleFilterClick('forwarded', true)}
              title="Click to filter by forwarded emails (envelope-from differs from header-from)"
            >
              <div className="stat-value">{stats.forwardedCount}</div>
              <div className="stat-label">Forwarded</div>
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
              <span className="filter-hint"> - Showing {groupedRecords.length} sources ({filteredRecords.length} total records)</span>
            ) : (
              <span> ({groupedRecords.length} sources)</span>
            )}
          </h3>
          <div className="records-table-container">
            <table className="records-table">
              <thead>
                <tr>
                  <th className="expand-col"></th>
                  <th>Source</th>
                  <th>Volume</th>
                  <th>DMARC Compliance</th>
                </tr>
              </thead>
              <tbody>
                {groupedRecords.map((grouped, index) => {
                  const isExpanded = expandedRows.has(grouped.sourceKey)

                  // Calculate overall DMARC compliance for this source
                  const passedCount = grouped.records.reduce((sum, r) => {
                    const bothPass = r.policyEvaluated.dkim === 'pass' && r.policyEvaluated.spf === 'pass'
                    return sum + (bothPass ? r.count : 0)
                  }, 0)
                  const compliancePercentage = grouped.count > 0 ? Math.round((passedCount / grouped.count) * 100) : 0

                  const allPass = grouped.records.every(r =>
                    r.policyEvaluated.dkim === 'pass' && r.policyEvaluated.spf === 'pass'
                  )
                  const anyPass = grouped.records.some(r =>
                    r.policyEvaluated.dkim === 'pass' || r.policyEvaluated.spf === 'pass'
                  )
                  const dmarcResult = allPass ? 'pass' : anyPass ? 'partial' : 'fail'

                  return (
                    <React.Fragment key={`${grouped.sourceKey}-${index}`}>
                      <tr
                        className="expandable-row"
                        onClick={() => toggleRowExpansion(grouped.sourceKey)}
                      >
                        <td className="expand-col">
                          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                            ▶
                          </span>
                        </td>
                        <td className="source-cell">
                          {grouped.service ? (
                            <div className="service-display">
                              <span className="service-name">{grouped.service}</span>
                            </div>
                          ) : grouped.hostname ? (
                            <div className="hostname-display">
                              <span className="hostname-primary">{truncateSource(grouped.hostname, 30)}</span>
                            </div>
                          ) : (
                            <span className="ip-display">{grouped.sourceKey}</span>
                          )}
                        </td>
                        <td><strong>{grouped.count}</strong></td>
                        <td>
                          <div className="compliance-cell">
                            <span className={`badge badge-${dmarcResult}`}>
                              {compliancePercentage}%
                            </span>
                            <span className="compliance-label">
                              {dmarcResult === 'pass' ? 'Full Compliance' : dmarcResult === 'partial' ? 'Partial' : 'Non-Compliant'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${index}-details`} className="detail-row">
                          <td colSpan="4">
                            <div className="detail-container">
                              <table className="detail-table">
                                <thead>
                                  <tr>
                                    <th>Hostname / IP</th>
                                    <th>Country</th>
                                    <th>Volume</th>
                                    <th>Reporter</th>
                                    <th>DKIM Result</th>
                                    <th>DKIM Selector</th>
                                    <th>SPF Result</th>
                                    <th>SPF Domain</th>
                                    <th>Envelope To</th>
                                    <th>Header From</th>
                                    <th>Forwarded</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grouped.records.map((record, recordIndex) => {
                                    const hostname = ipHostnames[record.sourceIp]
                                    const country = ipCountries[record.sourceIp]

                                    return (
                                      <tr key={recordIndex}>
                                        <td className="hostname-detail">
                                          {hostname ? (
                                            <div className="hostname-with-ip">
                                              <span className="hostname-primary">{hostname}</span>
                                              <span className="hostname-secondary">{record.sourceIp}</span>
                                            </div>
                                          ) : (
                                            <span className="hostname-primary">{record.sourceIp}</span>
                                          )}
                                        </td>
                                        <td>
                                          {country ? (
                                            <span className="country-flag" title={`${country.country} (${country.countryCode})`}>
                                              {countryCodeToFlag(country.countryCode)}
                                            </span>
                                          ) : (
                                            <span className="no-data">{isResolvingIPs ? '...' : '-'}</span>
                                          )}
                                        </td>
                                        <td><strong>{record.count}</strong></td>
                                        <td title={report.metadata.orgName}>{truncateSource(report.metadata.orgName, 20)}</td>
                                        <td>
                                          <span className={`badge badge-${record.policyEvaluated.dkim}`}>
                                            {record.policyEvaluated.dkim}
                                          </span>
                                        </td>
                                        <td>
                                          {record.authResults.dkim.length > 0 ? (
                                            <div className="dkim-selectors">
                                              {record.authResults.dkim.map((dkim, dkimIndex) => (
                                                <div
                                                  key={dkimIndex}
                                                  className="dkim-selector-item"
                                                  onMouseEnter={(e) => handleDkimHover(e, dkim)}
                                                  onMouseLeave={handleDkimLeave}
                                                >
                                                  <div className="dkim-selector-display">
                                                    <code className="selector-code">
                                                      {dkim.selector.length > 9 ? dkim.selector.substring(0, 9) + '...' : dkim.selector}
                                                    </code>
                                                    <span className="dkim-at">@</span>
                                                    <span className="dkim-domain">
                                                      {truncateSource(dkim.domain, 20)}
                                                    </span>
                                                  </div>
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
                                          {record.authResults.spf.length > 0 ? (
                                            record.authResults.spf.map((spf, spfIndex) => (
                                              <div key={spfIndex} title={spf.domain}>
                                                {truncateSource(spf.domain, 20) || '-'}
                                              </div>
                                            ))
                                          ) : (
                                            <span className="no-data">-</span>
                                          )}
                                        </td>
                                        <td title={record.identifiers.envelopeTo}>{truncateSource(record.identifiers.envelopeTo, 25) || '-'}</td>
                                        <td title={record.identifiers.headerFrom}>{truncateSource(record.identifiers.headerFrom, 25) || '-'}</td>
                                        <td>
                                          {(() => {
                                            const risk = getForwardingRisk(record)
                                            if (!risk) {
                                              return <span className="badge badge-pass">Direct</span>
                                            }
                                            return (
                                              <span className={`badge ${risk.className}`} title={risk.title}>
                                                {risk.label}
                                              </span>
                                            )
                                          })()}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fixed position tooltip for DKIM selectors */}
      {tooltipPosition && tooltipContent && (
        <div
          className="dkim-tooltip-fixed"
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="detail-row">
            <span className="detail-label">Full Selector:</span>
            <span className="detail-value">{tooltipContent.selector}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Domain:</span>
            <span className="detail-value">{tooltipContent.domain}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Full Record:</span>
            <span className="detail-value">{tooltipContent.selector}._domainkey.{tooltipContent.domain}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Result:</span>
            <span className={`detail-value badge badge-${tooltipContent.result || 'none'}`}>
              {tooltipContent.result || 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
