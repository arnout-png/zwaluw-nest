/**
 * Nmbrs SOAP API v3 client helper
 *
 * Auth: <AuthHeaderWithDomain> in every SOAP request header
 * Base URL: https://api.nmbrs.nl/soap/v3/  (prod)
 *           https://api.nmbrs-sandbox.se/soap/v3/ (sandbox)
 *
 * Docs: https://support.nmbrs.nl/hc/nl/articles/205903718
 */

export interface NmbrsCredentials {
  username: string;    // Nmbrs account email
  token: string;       // Nmbrs API token (from user settings)
  domain: string;      // Company subdomain, e.g. "veiligdouchen"
  sandbox?: boolean;   // Use sandbox endpoint
}

export interface NmbrsEmployee {
  employeeId: number;
  firstName: string;
  prefixLastName?: string;
  lastName: string;
  email?: string;
  telephone?: string;
  gender?: string;
  dateOfBirth?: string;
  hireDate?: string;
}

export interface NmbrsCompany {
  id: number;
  name: string;
  number?: string;
}

function baseUrl(sandbox = false) {
  return sandbox
    ? 'https://api.nmbrs-sandbox.se/soap/v3'
    : 'https://api.nmbrs.nl/soap/v3';
}

function buildAuthHeader(creds: NmbrsCredentials) {
  return `<AuthHeaderWithDomain xmlns="https://api.nmbrs.nl/soap/v3">
    <Username>${escapeXml(creds.username)}</Username>
    <Token>${escapeXml(creds.token)}</Token>
    <Domain>${escapeXml(creds.domain)}</Domain>
  </AuthHeaderWithDomain>`;
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSoapEnvelope(operation: string, body: string, creds: NmbrsCredentials) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    ${buildAuthHeader(creds)}
  </soap:Header>
  <soap:Body>
    <${operation} xmlns="https://api.nmbrs.nl/soap/v3">
      ${body}
    </${operation}>
  </soap:Body>
</soap:Envelope>`;
}

export async function callNmbrs(
  service: string,
  operation: string,
  body: string,
  creds: NmbrsCredentials
): Promise<string> {
  const url = `${baseUrl(creds.sandbox)}/${service}.asmx`;
  const envelope = buildSoapEnvelope(operation, body, creds);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `"https://api.nmbrs.nl/soap/v3/${operation}"`,
    },
    body: envelope,
  });

  const text = await res.text();

  if (!res.ok) {
    const faultMatch = text.match(/<faultstring>(.*?)<\/faultstring>/s);
    const fault = faultMatch ? faultMatch[1] : `HTTP ${res.status}`;
    throw new Error(`Nmbrs SOAP fout (${operation}): ${fault}`);
  }

  return text;
}

/** Extract text content of the first matching XML tag */
export function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>(.*?)</(?:[^:>]+:)?${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/** Extract all occurrences of a tag as an array of inner XML strings */
export function extractTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>(.*?)</(?:[^:>]+:)?${tag}>`, 'gs');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

// ─── High-level operations ─────────────────────────────────────────────────────

/**
 * Company_GetList — returns the companies the user has access to.
 * Used to verify credentials and get a companyId.
 */
export async function getCompanies(creds: NmbrsCredentials): Promise<NmbrsCompany[]> {
  const xml = await callNmbrs('CompanyService', 'Company_GetList', '', creds);
  const companiesXml = extractTags(xml, 'Company');
  return companiesXml.map((c) => ({
    id: parseInt(extractTag(c, 'ID') ?? '0', 10),
    name: extractTag(c, 'Name') ?? '',
    number: extractTag(c, 'Number'),
  })).filter((c) => c.id > 0);
}

/**
 * Employee_GetAll — returns all employees for a company.
 */
export async function getEmployeesFromNmbrs(
  companyId: number,
  creds: NmbrsCredentials
): Promise<NmbrsEmployee[]> {
  const body = `<CompanyId>${companyId}</CompanyId><Period>0</Period><Year>0</Year>`;
  const xml = await callNmbrs('EmployeeService', 'Employee_GetAll_AllEmployeesByCompany', body, creds);
  const employeesXml = extractTags(xml, 'Employee');

  return employeesXml.map((e) => ({
    employeeId: parseInt(extractTag(e, 'EmployeeId') ?? '0', 10),
    firstName: extractTag(e, 'FirstName') ?? '',
    prefixLastName: extractTag(e, 'Prefix'),
    lastName: extractTag(e, 'LastName') ?? '',
    email: extractTag(e, 'Email'),
    telephone: extractTag(e, 'Telephone'),
    gender: extractTag(e, 'Gender'),
    dateOfBirth: extractTag(e, 'Birthday'),
    hireDate: extractTag(e, 'DateInService'),
  })).filter((e) => e.employeeId > 0);
}

/**
 * Employee_Insert — create a new employee in Nmbrs.
 * Returns the new Nmbrs employee ID, or throws on failure.
 */
export async function insertEmployee(
  companyId: number,
  employee: {
    firstName: string;
    lastName: string;
    email?: string;
    hireDate: string; // ISO date string
  },
  creds: NmbrsCredentials
): Promise<number> {
  const body = `
    <CompanyId>${companyId}</CompanyId>
    <Employee>
      <FirstName>${escapeXml(employee.firstName)}</FirstName>
      <LastName>${escapeXml(employee.lastName)}</LastName>
      ${employee.email ? `<Email>${escapeXml(employee.email)}</Email>` : ''}
      <EmploymentDate>${employee.hireDate.split('T')[0]}</EmploymentDate>
    </Employee>`;

  const xml = await callNmbrs('EmployeeService', 'Employee_Insert', body, creds);
  const idStr = extractTag(xml, 'Employee_InsertResult') ?? extractTag(xml, 'EmployeeId');
  const id = parseInt(idStr ?? '0', 10);
  if (id <= 0) {
    throw new Error('Nmbrs gaf geen geldig medewerker-ID terug.');
  }
  return id;
}
