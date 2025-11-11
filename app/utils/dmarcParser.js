// Parse DMARC XML report into structured data
export function parseDMARCReport(xmlText, fileName) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid XML format')
  }

  // Extract metadata
  const metadata = {
    orgName: getTextContent(xmlDoc, 'org_name'),
    email: getTextContent(xmlDoc, 'email'),
    reportId: getTextContent(xmlDoc, 'report_id'),
    dateRange: {
      begin: parseInt(getTextContent(xmlDoc, 'date_range begin')) || 0,
      end: parseInt(getTextContent(xmlDoc, 'date_range end')) || 0,
    },
  }

  // Extract policy
  const policy = {
    domain: getTextContent(xmlDoc, 'policy_published domain'),
    adkim: getTextContent(xmlDoc, 'policy_published adkim') || 'r',
    aspf: getTextContent(xmlDoc, 'policy_published aspf') || 'r',
    p: getTextContent(xmlDoc, 'policy_published p'),
    sp: getTextContent(xmlDoc, 'policy_published sp'),
    pct: getTextContent(xmlDoc, 'policy_published pct') || '100',
  }

  // Extract records
  const recordElements = xmlDoc.querySelectorAll('record')
  const records = Array.from(recordElements).map(record => {
    const sourceIp = getTextContent(record, 'source_ip')
    const count = parseInt(getTextContent(record, 'count')) || 0

    const policyEvaluated = {
      disposition: getTextContent(record, 'policy_evaluated disposition'),
      dkim: getTextContent(record, 'policy_evaluated dkim'),
      spf: getTextContent(record, 'policy_evaluated spf'),
    }

    const authResults = {
      dkim: extractDKIMResults(record),
      spf: extractSPFResults(record),
    }

    const identifiers = {
      headerFrom: getTextContent(record, 'identifiers header_from'),
      envelopeFrom: getTextContent(record, 'identifiers envelope_from'),
      envelopeTo: getTextContent(record, 'identifiers envelope_to'),
    }

    return {
      sourceIp,
      count,
      policyEvaluated,
      authResults,
      identifiers,
    }
  })

  return {
    fileName,
    metadata,
    policy,
    records,
    totalMessages: records.reduce((sum, record) => sum + record.count, 0),
  }
}

function getTextContent(element, selector) {
  const parts = selector.split(' ')
  let current = element

  for (const part of parts) {
    if (!current) return ''
    current = current.querySelector(part)
  }

  return current ? current.textContent.trim() : ''
}

function extractDKIMResults(record) {
  const dkimElements = record.querySelectorAll('auth_results dkim')
  return Array.from(dkimElements).map(dkim => ({
    domain: getTextContent(dkim, 'domain'),
    result: getTextContent(dkim, 'result'),
    selector: getTextContent(dkim, 'selector'),
  }))
}

function extractSPFResults(record) {
  const spfElements = record.querySelectorAll('auth_results spf')
  return Array.from(spfElements).map(spf => ({
    domain: getTextContent(spf, 'domain'),
    result: getTextContent(spf, 'result'),
    scope: getTextContent(spf, 'scope'),
  }))
}

// Calculate statistics from parsed report
export function calculateStatistics(report) {
  const { records } = report

  let passedCount = 0
  let partialCount = 0
  let failedCount = 0
  let dkimPass = 0
  let dkimFail = 0
  let spfPass = 0
  let spfFail = 0
  let forwardedCount = 0

  const ipSources = {}
  const dispositions = {}

  records.forEach(record => {
    const { count, policyEvaluated, sourceIp, identifiers, authResults } = record

    // Count by disposition
    const disp = policyEvaluated.disposition || 'none'
    dispositions[disp] = (dispositions[disp] || 0) + count

    // Check if forwarded (SPF domain differs from header_from domain)
    // Use SPF domain (MAIL FROM) as it's more reliable than envelope_from
    const headerFrom = identifiers.headerFrom || ''
    const headerDomain = headerFrom.includes('@')
      ? headerFrom.split('@')[1]?.toLowerCase()?.trim()
      : headerFrom.toLowerCase()?.trim()

    // Get SPF domain from auth results - check all SPF records
    let spfDomain = null
    if (authResults.spf && authResults.spf.length > 0) {
      // Look for mfrom scope (MAIL FROM) first, otherwise take first SPF record
      const mfromSpf = authResults.spf.find(s => s.scope === 'mfrom')
      spfDomain = (mfromSpf?.domain || authResults.spf[0]?.domain)?.toLowerCase()?.trim()
    }

    // Check if forwarded - but exclude subdomains (e.g., ses.example.com is not forwarded from example.com)
    let isForwarded = false
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
      isForwarded = spfBase !== headerBase
    }

    if (isForwarded) {
      forwardedCount += count
    }

    // Count pass/fail/partial
    const dkimResult = policyEvaluated.dkim
    const spfResult = policyEvaluated.spf
    const isDkimPass = dkimResult === 'pass'
    const isSpfPass = spfResult === 'pass'

    if (isDkimPass && isSpfPass) {
      passedCount += count
    } else if (isDkimPass || isSpfPass) {
      partialCount += count
    } else {
      failedCount += count
    }

    if (isDkimPass) {
      dkimPass += count
    } else {
      dkimFail += count
    }

    if (isSpfPass) {
      spfPass += count
    } else {
      spfFail += count
    }

    // Count by IP
    ipSources[sourceIp] = (ipSources[sourceIp] || 0) + count
  })

  // Sort IPs by count
  const topIPs = Object.entries(ipSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }))

  return {
    totalMessages: report.totalMessages,
    passedCount,
    partialCount,
    failedCount,
    dkimPass,
    dkimFail,
    spfPass,
    spfFail,
    forwardedCount,
    dispositions,
    topIPs,
  }
}
