import { KS3_DISTRICT } from "./ks3-data";

/**
 * Returns a comprehensive system prompt block with KS-3 context for Claude.
 * This gets injected into prompts so every response is grounded in district specifics.
 */
export function getKs3SystemPrompt(): string {
  const d = KS3_DISTRICT;

  const counties = d.geography.counties
    .map((c) => `  - ${c.name}: ${c.description}`)
    .join("\n");

  const cities = d.geography.majorCities.join(", ");

  const employers = d.economy.majorEmployers
    .map((e) => `  - ${e}`)
    .join("\n");

  const industries = d.economy.keyIndustries
    .map((i) => `  - ${i}`)
    .join("\n");

  const militaryInstallations = d.military.installations
    .map((m) => `  - ${m.name}: ${m.description} Economic impact: ${m.economicImpact}`)
    .join("\n");

  const tribalNations = d.tribalNations
    .map((t) => `  - ${t.name}: ${t.description}`)
    .join("\n");

  const educationInstitutions = d.education.majorInstitutions
    .map((e) => `  - ${e}`)
    .join("\n");

  const issues = d.keyLocalIssues
    .map((i) => `  - ${i}`)
    .join("\n");

  return `# ${d.name} (${d.shortName}) — District Reference

## Geography
Counties:
${counties}

Major cities: ${cities}

## Demographics
- Population: ${d.demographics.population}
- Median household income: ${d.demographics.medianHouseholdIncome}
- Race/ethnicity: ${d.demographics.raceEthnicity}
- Education: ${d.demographics.educationAttainment}
- Veterans: ${d.demographics.veteranPopulation}

## Economy
${d.economy.economicProfile}

Major employers:
${employers}

Key industries:
${industries}

## Military
${militaryInstallations}

## Tribal Nations (adjacent/connected)
${tribalNations}

## Education
${educationInstitutions}

K-12: ${d.education.k12}

## Current Representative
${d.currentRepresentative.name} (${d.currentRepresentative.party}, since ${d.currentRepresentative.since})
Committees: ${d.currentRepresentative.committees.join(", ")}
Notable: ${d.currentRepresentative.notable}

## Key Local Issues
${issues}

Use this district context to ground all responses in KS-3 specifics. Reference real places, employers, demographics, and issues when relevant.`;
}

/**
 * Returns a shorter context snippet for lighter-weight prompt injection.
 */
export function getKs3ContextSnippet(): string {
  return `KS-3 covers Johnson County (affluent suburban), Wyandotte County/KCK (diverse, working-class), and parts of Douglas and Miami counties. Major employers: T-Mobile, Cerner/Oracle, KU Med, Garmin. Key issues: housing affordability, transit, healthcare access, immigration.`;
}
