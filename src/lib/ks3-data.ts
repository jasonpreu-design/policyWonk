export const KS3_DISTRICT = {
  name: "Kansas's 3rd Congressional District",
  shortName: "KS-3",

  geography: {
    counties: [
      { name: "Johnson County", description: "Most populous county in Kansas, affluent suburban, county seat Olathe" },
      { name: "Wyandotte County", description: "Unified with Kansas City, KS (Wyandotte County/KCK), most diverse county in KS" },
      { name: "Douglas County", description: "Partial — includes Lawrence, home of University of Kansas" },
      { name: "Miami County", description: "Partial — rural/suburban southern portion of district" },
    ],
    majorCities: ["Overland Park", "Olathe", "Kansas City (KS)", "Shawnee", "Lenexa", "Lawrence (partial)", "Leawood", "Prairie Village"],
  },

  demographics: {
    population: "approximately 727,000 (2020 Census)",
    medianHouseholdIncome: "$78,000 (Johnson County significantly higher at ~$96,000)",
    raceEthnicity: "Approximately 72% White, 10% Hispanic/Latino, 8% Black, 5% Asian, growing diversity especially in Wyandotte County and southern Johnson County",
    educationAttainment: "45%+ with bachelor's degree or higher (one of the most educated districts in Kansas)",
    veteranPopulation: "Significant veteran community tied to Fort Leavenworth",
  },

  economy: {
    majorEmployers: [
      "T-Mobile US (headquarters in Overland Park)",
      "Cerner/Oracle Health (major campus in Kansas City, KS)",
      "University of Kansas Medical Center & Health System",
      "Sprint Center/T-Mobile Center (downtown KCMO adjacent economy)",
      "Garmin (headquarters in Olathe)",
      "Black & Veatch (headquarters in Overland Park)",
      "Waddell & Reed / Ivy Investments",
      "Johnson County Community College",
      "Kansas City Kansas Community College",
    ],
    keyIndustries: [
      "Technology and telecommunications",
      "Healthcare and biosciences",
      "Financial services",
      "Engineering and construction",
      "Higher education",
      "Logistics and distribution",
      "Agriculture (southern/western portions)",
    ],
    economicProfile: "Mix of affluent suburban (Johnson County), working-class urban (Wyandotte/KCK), and rural. Strong tech corridor along I-435/I-35. Growing biotech sector near KU Med.",
  },

  military: {
    installations: [
      {
        name: "Fort Leavenworth",
        description: "Home to U.S. Army Command and General Staff College (CGSC), Combined Arms Center, and the United States Disciplinary Barracks (military prison). One of the oldest active Army posts west of the Mississippi.",
        economicImpact: "Major employer in Leavenworth area, significant veteran transition community",
      },
    ],
  },

  tribalNations: [
    { name: "Prairie Band Potawatomi Nation", description: "Reservation in Jackson County (adjacent to KS-3), Prairie Band Casino & Resort, significant government services" },
    { name: "Kickapoo Tribe in Kansas", description: "Reservation in Brown County, Golden Eagle Casino, tribal government services" },
    { name: "Iowa Tribe of Kansas and Nebraska", description: "Reservation in Brown/Doniphan counties, Casino White Cloud" },
    { name: "Sac and Fox Nation of Missouri in Kansas and Nebraska", description: "Reservation in Brown/Doniphan counties, smallest federally recognized tribe in Kansas" },
  ],

  education: {
    majorInstitutions: [
      "University of Kansas (Lawrence) — flagship state university, KU Medical Center in KC",
      "Johnson County Community College — one of largest community colleges in the region",
      "Kansas City Kansas Community College",
      "MidAmerica Nazarene University (Olathe)",
      "University of Saint Mary (Leavenworth)",
    ],
    k12: "Multiple high-performing school districts in Johnson County (Blue Valley, Shawnee Mission, Olathe, DeSoto). Kansas City KS USD 500 faces urban education challenges. School funding has been a major state issue (Gannon v. State).",
  },

  currentRepresentative: {
    name: "Sharice Davids",
    party: "Democratic",
    since: 2019,
    committees: ["Transportation and Infrastructure", "Small Business (former ranking member)"],
    notable: "First openly LGBTQ+ member of Congress from Kansas, first of two Native American women in Congress (Ho-Chunk Nation member)",
  },

  keyLocalIssues: [
    "Housing affordability — Johnson County home prices rising rapidly, KCK gentrification concerns",
    "Transportation — I-35/I-435 corridor congestion, KC metro transit gaps, KCI airport access",
    "Healthcare access — urban/suburban disparity, Medicaid expansion debate, KU Med capacity",
    "Education funding — Kansas school finance litigation history, teacher retention",
    "Immigration — large immigrant communities in KCK and south Johnson County, meatpacking workforce",
    "Economic development — tech corridor growth, Panasonic battery plant in DeSoto",
    "Wind energy — Kansas produces 52% of electricity from wind (3rd nationally)",
    "Water — Ogallala Aquifer concerns affect western KS agriculture that feeds the district economy",
  ],
};
