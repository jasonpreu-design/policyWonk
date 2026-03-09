export const KS3_DISTRICT = {
  name: "Kansas's 3rd Congressional District",
  shortName: "KS-3",

  geography: {
    counties: [
      { name: "Johnson County", description: "Most populous county in Kansas, affluent suburban, county seat Olathe" },
      { name: "Wyandotte County", description: "Partial — southern portion (split at I-70), unified government with Kansas City, KS, most diverse county in KS" },
      { name: "Miami County", description: "Fully included — rural/suburban, county seat Paola" },
      { name: "Franklin County", description: "Fully included — added in 2022 redistricting, county seat Ottawa" },
      { name: "Anderson County", description: "Fully included — added in 2022 redistricting, rural, county seat Garnett" },
    ],
    redistrictingNote: "2022 redistricting removed Douglas County (Lawrence) from KS-3 to KS-1 and added Franklin and Anderson counties. Wyandotte County was split at I-70 with northern portion moved to KS-2. Republican effort to further redraw KS-3 in 2025-2026 legislative session lacks votes to override governor's veto.",
    majorCities: ["Overland Park", "Olathe", "Kansas City (KS, partial)", "Shawnee", "Lenexa", "Leawood", "Prairie Village", "Ottawa", "Paola"],
  },

  demographics: {
    population: "approximately 727,000 (2020 Census)",
    medianHouseholdIncome: "$78,000 (Johnson County significantly higher at ~$96,000)",
    raceEthnicity: "Approximately 72% White, 10% Hispanic/Latino, 8% Black, 5% Asian, growing diversity especially in Wyandotte County and southern Johnson County",
    educationAttainment: "45%+ with bachelor's degree or higher (one of the most educated districts in Kansas)",
    veteranPopulation: "Significant veteran community in Johnson County suburbs (Fort Leavenworth is in adjacent KS-2)",
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
    economicProfile: "Mix of affluent suburban (Johnson County), working-class urban (southern Wyandotte/KCK), and rural (Miami, Franklin, Anderson counties). Strong tech corridor along I-435/I-35. Growing biotech sector near KU Med. The 2022 redistricting added more rural agricultural territory.",
  },

  military: {
    installations: [],
    veteranNote: "Fort Leavenworth is in KS-2 (not KS-3), but the district has a significant veteran population, particularly in Johnson County suburbs.",
  },

  tribalNations: [
    { name: "Prairie Band Potawatomi Nation", description: "Reservation in Jackson County (adjacent to KS-3), Prairie Band Casino & Resort, significant government services" },
    { name: "Kickapoo Tribe in Kansas", description: "Reservation in Brown County, Golden Eagle Casino, tribal government services" },
    { name: "Iowa Tribe of Kansas and Nebraska", description: "Reservation in Brown/Doniphan counties, Casino White Cloud" },
    { name: "Sac and Fox Nation of Missouri in Kansas and Nebraska", description: "Reservation in Brown/Doniphan counties, smallest federally recognized tribe in Kansas" },
  ],

  education: {
    majorInstitutions: [
      "University of Kansas Medical Center — major healthcare and research institution in KCK (KU main campus in Lawrence is now in KS-1)",
      "Johnson County Community College — one of largest community colleges in the region",
      "Kansas City Kansas Community College",
      "MidAmerica Nazarene University (Olathe)",
      "Ottawa University (Ottawa, Franklin County)",
    ],
    k12: "Multiple high-performing school districts in Johnson County (Blue Valley, Shawnee Mission, Olathe, DeSoto). Kansas City KS USD 500 faces urban education challenges. School funding has been a major state issue (Gannon v. State). Franklin and Anderson county school districts are smaller and rural.",
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
    "Healthcare access — urban/suburban/rural disparity, Medicaid expansion debate, KU Med capacity, rural hospital access in Franklin/Anderson counties",
    "Education funding — Kansas school finance litigation history, teacher retention, rural school consolidation pressures",
    "Immigration — large immigrant communities in KCK and south Johnson County, meatpacking workforce",
    "Economic development — tech corridor growth, Panasonic battery plant in DeSoto, rural economic development in Franklin/Anderson counties",
    "Wind energy — Kansas produces 52% of electricity from wind (3rd nationally)",
    "Rural-suburban divide — 2022 redistricting added rural Franklin and Anderson counties, creating a district that spans affluent suburbs to farming communities",
    "Redistricting — ongoing Republican effort to further redraw KS-3 boundaries; district shape itself is a political issue",
  ],
};
