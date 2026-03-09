import type Database from "better-sqlite3";

const DOMAINS = [
  {
    domain: "Healthcare",
    name: "Healthcare",
    description: "Health policy, insurance systems, and public health",
    subtopics: [
      { name: "Affordable Care Act (ACA)", description: "Health insurance marketplace, individual mandate history, current status and reform proposals" },
      { name: "Medicare", description: "Federal health insurance for 65+, Parts A-D, funding mechanisms, solvency projections" },
      { name: "Medicaid & KanCare", description: "Federal-state health coverage, Kansas KanCare managed care, expansion debate" },
      { name: "Drug Pricing", description: "Pharmaceutical costs, Medicare negotiation authority, insulin caps, PBM reform" },
      { name: "Mental Health & Substance Abuse", description: "Parity laws, opioid crisis response, SAMHSA funding, community health centers" },
      { name: "Maternal & Child Health", description: "Maternal mortality crisis, CHIP program, prenatal coverage, postpartum Medicaid extension" },
      { name: "Public Health Infrastructure", description: "CDC funding, pandemic preparedness, vaccine policy, health workforce shortages" },
    ],
  },
  {
    domain: "Immigration",
    name: "Immigration",
    description: "Immigration law, enforcement, and reform",
    subtopics: [
      { name: "ICE & CBP", description: "Immigration enforcement agencies, detention policies, deportation procedures" },
      { name: "Asylum & Refugee Policy", description: "Asylum law, refugee admissions, credible fear process, safe third country agreements" },
      { name: "DACA & Dreamers", description: "Deferred Action for Childhood Arrivals, legislative proposals, court challenges" },
      { name: "Visa Systems", description: "H-1B, family-based, diversity visa, employment-based immigration pathways" },
      { name: "Border Security", description: "Border wall, technology solutions, port of entry staffing, fentanyl interdiction" },
      { name: "Immigration Courts", description: "Backlog crisis, immigration judge appointments, due process concerns" },
      { name: "Local Immigration Impact", description: "KS-3 immigrant communities, meatpacking industry workforce, sanctuary policies, ICE enforcement in KC metro" },
    ],
  },
  {
    domain: "Education",
    name: "Education",
    description: "K-12, higher education, and workforce development",
    subtopics: [
      { name: "K-12 Federal Funding", description: "Title I, IDEA, ESEA/ESSA, school choice debates" },
      { name: "Higher Education Access", description: "Pell Grants, student loan programs, college affordability, FAFSA" },
      { name: "Student Debt", description: "Federal student loan portfolio, forgiveness programs, income-driven repayment, SAVE plan" },
      { name: "Title IX", description: "Gender equity in education, sexual harassment rules, transgender student protections" },
      { name: "Early Childhood Education", description: "Head Start, Pre-K funding, childcare costs and accessibility" },
      { name: "Workforce Development", description: "Career and technical education, apprenticeships, WIOA, skills gap" },
      { name: "Kansas Education", description: "KS school finance history (Gannon), Johnson County school districts, KU and K-State" },
    ],
  },
  {
    domain: "Economy & Labor",
    name: "Economy & Labor",
    description: "Economic policy, trade, employment, and workers' rights",
    subtopics: [
      { name: "Federal Reserve & Monetary Policy", description: "Interest rates, inflation targeting, Fed independence, quantitative tightening" },
      { name: "Trade & Tariffs", description: "USMCA, China trade relations, tariff impacts, supply chain policy" },
      { name: "Labor Rights & Unions", description: "NLRA, PRO Act, right-to-work laws, gig economy classification" },
      { name: "Minimum Wage", description: "Federal minimum wage debate, state/local minimums, tipped worker wages" },
      { name: "Small Business", description: "SBA programs, tax policy for small business, access to capital, regulatory burden" },
      { name: "Tax Policy", description: "Income tax brackets, corporate tax, TCJA provisions and expiration, capital gains" },
      { name: "KS-3 Economy", description: "Johnson County business corridor, Sprint/T-Mobile HQ, healthcare industry, suburban economy" },
    ],
  },
  {
    domain: "Defense & Foreign Affairs",
    name: "Defense & Foreign Affairs",
    description: "Military, diplomacy, and international relations",
    subtopics: [
      { name: "Defense Budget & Spending", description: "NDAA, Pentagon budget, military readiness, procurement reform" },
      { name: "NATO & Alliances", description: "NATO commitments, burden sharing, alliance structure, Article 5" },
      { name: "China Policy", description: "Strategic competition, Taiwan, technology controls, economic decoupling" },
      { name: "Middle East Policy", description: "Israel-Palestine, Iran nuclear deal, Gulf relations, AUMF reform" },
      { name: "Ukraine & Russia", description: "Ukraine aid, sanctions, NATO eastern flank, energy security" },
      { name: "Arms Control", description: "Nuclear treaties, arms sales, nonproliferation, emerging weapons tech" },
      { name: "Fort Leavenworth", description: "Command and General Staff College, military prison, economic impact on KS-3, BRAC history" },
    ],
  },
  {
    domain: "Judiciary & Civil Rights",
    name: "Judiciary & Civil Rights",
    description: "Courts, constitutional rights, and civil liberties",
    subtopics: [
      { name: "Federal Courts", description: "Judicial appointments, court expansion debate, circuit court structure" },
      { name: "Voting Rights", description: "VRA reauthorization, voter ID laws, gerrymandering, election security" },
      { name: "Criminal Justice Reform", description: "First Step Act, sentencing reform, policing standards, prison conditions" },
      { name: "Reproductive Rights", description: "Post-Dobbs landscape, federal legislation attempts, state ballot measures" },
      { name: "Gun Policy", description: "Background checks, assault weapons, red flag laws, Second Amendment jurisprudence" },
      { name: "LGBTQ+ Rights", description: "Equality Act, marriage protections, anti-discrimination law, transgender rights" },
      { name: "Kansas Constitutional Amendments", description: "2022 abortion amendment vote, state-level rights protections, Kansas Supreme Court rulings" },
    ],
  },
  {
    domain: "Environment & Energy",
    name: "Environment & Energy",
    description: "Climate, energy policy, and environmental protection",
    subtopics: [
      { name: "Climate Policy", description: "Paris Agreement, emissions targets, IRA climate provisions, carbon pricing" },
      { name: "Renewable Energy", description: "Solar, wind, storage, grid modernization, clean energy tax credits" },
      { name: "Fossil Fuels", description: "Oil and gas leasing, coal transition, methane regulations, energy independence" },
      { name: "EPA & Regulation", description: "Clean Air Act, Clean Water Act, PFAS regulation, environmental justice" },
      { name: "Kansas Wind Energy", description: "Kansas 52% wind generation (3rd nationally), wind farm development, transmission infrastructure" },
      { name: "Water & Agriculture", description: "Ogallala Aquifer depletion, water rights, agricultural runoff, conservation programs" },
      { name: "Electric Vehicles", description: "EV tax credits, charging infrastructure, auto industry transition, Panasonic Kansas battery plant" },
    ],
  },
  {
    domain: "Budget & Appropriations",
    name: "Budget & Appropriations",
    description: "Federal budget process, spending, and fiscal policy",
    subtopics: [
      { name: "Federal Budget Process", description: "Budget resolution, appropriations bills, reconciliation, continuing resolutions" },
      { name: "National Debt & Deficit", description: "Debt ceiling, deficit trajectory, interest costs, CBO projections" },
      { name: "Discretionary Spending", description: "Defense vs. non-defense caps, sequestration history, spending priorities" },
      { name: "Mandatory Spending", description: "Social Security, Medicare, Medicaid solvency, trust fund projections" },
      { name: "Government Shutdowns", description: "Shutdown mechanics, impact on federal workers, CR politics, historical shutdowns" },
      { name: "Earmarks & Local Funding", description: "Community project funding, KS-3 federal investments, grant programs" },
    ],
  },
  {
    domain: "Housing & Infrastructure",
    name: "Housing & Infrastructure",
    description: "Housing affordability, transportation, and public works",
    subtopics: [
      { name: "Housing Affordability", description: "Federal housing programs, Section 8, LIHTC, first-time buyer assistance" },
      { name: "Homelessness", description: "HUD programs, Housing First policy, veteran homelessness, McKinney-Vento Act" },
      { name: "Transportation", description: "IIJA implementation, highway funding, transit, rail, aviation" },
      { name: "Broadband", description: "BEAD program, digital equity, rural broadband, affordability" },
      { name: "Water Infrastructure", description: "Lead pipe replacement, wastewater, drinking water standards, WIFIA" },
      { name: "KS-3 Infrastructure", description: "Johnson County growth and development, KC metro transit, I-35/I-435 corridor, Wyandotte County revitalization" },
    ],
  },
  {
    domain: "Agriculture",
    name: "Agriculture",
    description: "Farm policy, food systems, and rural development",
    subtopics: [
      { name: "Farm Bill", description: "Five-year omnibus legislation, commodity programs, crop insurance, nutrition title (SNAP)" },
      { name: "SNAP & Nutrition", description: "Supplemental nutrition assistance, WIC, school meals, food insecurity" },
      { name: "Crop Insurance", description: "Federal crop insurance program, subsidy structure, climate risk" },
      { name: "Rural Development", description: "USDA rural programs, broadband, healthcare access, economic diversification" },
      { name: "Agricultural Trade", description: "Export markets, trade disputes, Country of Origin Labeling, ag tariffs" },
      { name: "Kansas Agriculture", description: "Wheat, cattle, sorghum production, Kansas Farm Bureau positions, ag workforce, meatpacking industry" },
    ],
  },
  {
    domain: "Science & Technology",
    name: "Science & Technology",
    description: "Technology policy, research funding, and digital governance",
    subtopics: [
      { name: "AI Policy", description: "AI regulation frameworks, executive orders, algorithmic accountability, workforce impact" },
      { name: "Cybersecurity", description: "CISA, critical infrastructure protection, data breach legislation, nation-state threats" },
      { name: "Data Privacy", description: "Federal privacy law proposals, COPPA, state privacy laws, Section 230" },
      { name: "Research Funding", description: "NSF, NIH, DOE, CHIPS and Science Act implementation, R&D tax credit" },
      { name: "Space Policy", description: "NASA authorization, commercial space, space debris, Artemis program" },
      { name: "Telecom & Spectrum", description: "FCC authority, spectrum allocation, net neutrality, 5G deployment" },
    ],
  },
  {
    domain: "Native Affairs",
    name: "Native Affairs",
    description: "Tribal sovereignty, federal trust responsibilities, and Indigenous rights",
    subtopics: [
      { name: "Tribal Sovereignty", description: "Government-to-government relationship, tribal self-governance, consultation requirements" },
      { name: "Indian Health Service", description: "IHS funding, healthcare access, urban Indian health, facility conditions" },
      { name: "Tribal Land & Resources", description: "Land into trust, NEPA and tribal consultation, sacred sites protection, water rights" },
      { name: "Native Education", description: "BIE schools, tribal colleges, Native language preservation, educational attainment gaps" },
      { name: "Economic Development", description: "Tribal gaming, opportunity zones, Buy Indian Act, small business support" },
      { name: "Kansas Tribal Nations", description: "Prairie Band Potawatomi, Kickapoo, Iowa, Sac and Fox — sovereignty, casino operations, land rights, cultural preservation" },
    ],
  },
  {
    domain: "Veterans Affairs",
    name: "Veterans Affairs",
    description: "Veteran healthcare, benefits, and services",
    subtopics: [
      { name: "VA Healthcare", description: "VA hospital system, community care, PACT Act toxic exposure, wait times" },
      { name: "Veterans Benefits", description: "Disability compensation, education benefits (GI Bill), home loans, pension" },
      { name: "Veteran Homelessness", description: "HUD-VASH program, transitional housing, SSVF grants" },
      { name: "Veteran Employment", description: "Transition assistance, hiring preferences, veteran-owned business support" },
      { name: "Mental Health & Suicide Prevention", description: "988 Veterans Crisis Line, PTSD treatment, TBI research, suicide prevention funding" },
      { name: "Fort Leavenworth Veterans", description: "Military-to-civilian transition in KC metro, VA Eastern Kansas, local veteran organizations" },
    ],
  },
  {
    domain: "Congressional Operations",
    name: "Congressional Operations",
    description: "How the House of Representatives works",
    subtopics: [
      { name: "House Rules & Procedures", description: "Floor procedures, amendment process, suspension calendar, discharge petitions" },
      { name: "Committee System", description: "Standing committees, subcommittees, committee assignments, markup process" },
      { name: "Leadership & Caucuses", description: "Speaker, party leadership, caucus structure, Congressional Progressive Caucus, Blue Dogs" },
      { name: "Legislative Process", description: "How a bill becomes law, conference committees, reconciliation, filibuster context" },
      { name: "Congressional Budget Process", description: "Budget resolution, 302(b) allocations, CBO scoring, pay-as-you-go rules" },
      { name: "Ethics & Accountability", description: "House Ethics Committee, financial disclosure, STOCK Act, campaign finance" },
      { name: "Constituent Services", description: "Casework, federal agency liaison, district offices, town halls, communication strategy" },
    ],
  },
];

export function seedTopics(db: Database.Database): { domains: number; subtopics: number } {
  // Check if already seeded
  const count = db.prepare("SELECT COUNT(*) as count FROM topics").get() as { count: number };
  if (count.count > 0) return { domains: 0, subtopics: 0 };

  let domainCount = 0;
  let subtopicCount = 0;

  const insertDomain = db.prepare(
    "INSERT INTO topics (domain, name, description, sort_order) VALUES (?, ?, ?, ?)"
  );
  const insertSubtopic = db.prepare(
    "INSERT INTO topics (parent_id, domain, name, description, sort_order) VALUES (?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    for (let i = 0; i < DOMAINS.length; i++) {
      const d = DOMAINS[i];
      insertDomain.run(d.domain, d.name, d.description, i);
      const domainId = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
      domainCount++;

      for (let j = 0; j < d.subtopics.length; j++) {
        const st = d.subtopics[j];
        insertSubtopic.run(domainId.id, d.domain, st.name, st.description, j);
        subtopicCount++;
      }
    }
  })();

  return { domains: domainCount, subtopics: subtopicCount };
}
