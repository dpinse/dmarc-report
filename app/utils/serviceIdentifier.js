// Identify email service provider from hostname/IP
const SERVICE_PATTERNS = {
  'Microsoft 365': [
    /outlook\.com$/i,
    /office365\.com$/i,
    /microsoft\.com$/i,
    /protection\.outlook\.com$/i,
    /mail\.protection\.outlook\.com$/i,
    /prod\.outlook\.com$/i,
    /prod\.protection\.outlook\.com$/i,
    /o365\.com$/i,
  ],
  'Google Workspace': [
    /google\.com$/i,
    /googlemail\.com$/i,
    /gmail\.com$/i,
    /mail-.*\.google\.com$/i,
  ],
  'SendGrid': [
    /sendgrid\.net$/i,
    /sendgrid\.com$/i,
  ],
  'Mailgun': [
    /mailgun\.org$/i,
    /mailgun\.net$/i,
    /mailgun\.com$/i,
  ],
  'Amazon SES': [
    /amazonses\.com$/i,
    /amazon-smtp\.com$/i,
    /ses\.amazonaws\.com$/i,
    /email\..*\.amazonaws\.com$/i,
  ],
  'Postmark': [
    /postmarkapp\.com$/i,
    /pmta\..*\.com$/i,
  ],
  'Mandrill': [
    /mandrillapp\.com$/i,
    /mandrill\.com$/i,
  ],
  'SparkPost': [
    /sparkpost\.com$/i,
    /sparkpostmail\.com$/i,
  ],
  'Mailchimp': [
    /mailchimp\.com$/i,
    /mcsv\.net$/i,
  ],
  'Constant Contact': [
    /constantcontact\.com$/i,
    /roving\.com$/i,
  ],
  'Proofpoint': [
    /proofpoint\.com$/i,
    /pphosted\.com$/i,
  ],
  'Mimecast': [
    /mimecast\.com$/i,
    /mimecast-offshore\.com$/i,
  ],
  'Zoho Mail': [
    /zoho\.com$/i,
    /zohomail\.com$/i,
  ],
  'iCloud': [
    /icloud\.com$/i,
    /mail\.me\.com$/i,
    /apple\.com$/i,
  ],
  'Yahoo': [
    /yahoo\.com$/i,
    /yahoodns\.net$/i,
    /yahoo\./i,
  ],
  'AOL': [
    /aol\.com$/i,
    /aol\./i,
  ],
  'Rackspace': [
    /emailsrvr\.com$/i,
    /rackspace\.com$/i,
  ],
  'GoDaddy': [
    /secureserver\.net$/i,
    /godaddy\.com$/i,
  ],
  'Cloudflare': [
    /cloudflare\.com$/i,
    /cloudflare\.net$/i,
  ],
  'Fastmail': [
    /fastmail\.com$/i,
    /messagingengine\.com$/i,
  ],
  'MailerSend': [
    /mailersend\.net$/i,
    /mailersend\.com$/i,
  ],
  'Sendinblue': [
    /sendinblue\.com$/i,
    /brevo\.com$/i,
  ],
  'Elastic Email': [
    /elasticemail\.com$/i,
  ],
  'Salesforce': [
    /salesforce\.com$/i,
    /exacttarget\.com$/i,
    /marketingcloud\.com$/i,
    /mc\.s.*\.exacttarget\.com$/i,
  ],
  'HubSpot': [
    /hubspot\.com$/i,
    /hubspotemail\.net$/i,
  ],
  'ActiveCampaign': [
    /activecampaign\.com$/i,
  ],
  'Campaign Monitor': [
    /createsend\.com$/i,
    /campaignmonitor\.com$/i,
  ],
  'GetResponse': [
    /getresponse\.com$/i,
  ],
  'AWeber': [
    /aweber\.com$/i,
  ],
  'Klaviyo': [
    /klaviyo\.com$/i,
  ],
  'Omnisend': [
    /omnisend\.com$/i,
  ],
  'Postmark': [
    /postmarkapp\.com$/i,
  ],
  'SendPulse': [
    /sendpulse\.com$/i,
  ],
  'Mailjet': [
    /mailjet\.com$/i,
  ],
  'Pepipost': [
    /pepipost\.com$/i,
  ],
  'SocketLabs': [
    /socketlabs\.com$/i,
  ],
  'Twilio SendGrid': [
    /sendgrid\.net$/i,
    /sendgrid\.com$/i,
  ],
  'Mailgun': [
    /mailgun\.org$/i,
    /mailgun\.net$/i,
    /mailgun\.com$/i,
  ],
  'Postfix': [
    /postfix/i,
  ],
  'Exim': [
    /exim/i,
  ],
}

export function identifyEmailService(hostname) {
  if (!hostname) return 'Other'

  // Check against all service patterns
  for (const [service, patterns] of Object.entries(SERVICE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(hostname)) {
        return service
      }
    }
  }

  // Return 'Other' if no match
  return 'Other'
}

export function getServiceInfo(hostname) {
  const service = identifyEmailService(hostname)

  if (!service) {
    return null
  }

  return {
    name: service,
    shortName: getShortServiceName(service)
  }
}

function getShortServiceName(service) {
  const shortNames = {
    'Microsoft 365': 'M365',
    'Google Workspace': 'Google',
    'Amazon SES': 'AWS SES',
    'Constant Contact': 'CC',
  }

  return shortNames[service] || service
}
