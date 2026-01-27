
const plonkitCountries = [
  "Alaska", "Albania", "American Samoa", "Andorra", "Antarctica", "Argentina", "Australia", "Austria", "Azores", "Bangladesh", 
  "Belarus", "Belgium", "Bermuda", "Bhutan", "Bolivia", "Botswana", "Brazil", "British Indian Ocean Territory", "Bulgaria", 
  "Cambodia", "Canada", "Chile", "China", "Christmas Island", "Cocos Islands", "Colombia", "Costa Rica", "Croatia", "Curaçao", 
  "Cyprus", "Czechia", "Denmark", "Dominican Republic", "Ecuador", "Egypt", "Estonia", "Eswatini", "Falkland Islands", "Faroe Islands", 
  "Finland", "France", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Guam", "Guatemala", "Hawaii", "Hong Kong", 
  "Hungary", "Iceland", "India", "Indonesia", "Iraq", "Ireland", "Isle of Man", "Israel & the West Bank", "Italy", "Japan", 
  "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liechtenstein", "Lithuania", 
  "Luxembourg", "Macau", "Madagascar", "Madeira", "Malaysia", "Mali", "Malta", "Martinique", "Mexico", "Monaco", "Mongolia", 
  "Montenegro", "Namibia", "Nepal", "Netherlands", "New Zealand", "Nigeria", "North Macedonia", "Northern Mariana Islands", 
  "Norway", "Oman", "Pakistan", "Panama", "Peru", "Philippines", "Pitcairn Islands", "Poland", "Portugal", "Puerto Rico", 
  "Qatar", "Reunion", "Romania", "Russia", "Rwanda", "Saint Pierre and Miquelon", "San Marino", "Senegal", "Serbia", "Singapore", 
  "Slovakia", "Slovenia", "South Africa", "South Georgia & Sandwich Islands", "South Korea", "Spain", "Sri Lanka", "Svalbard", 
  "Sweden", "Switzerland", "São Tomé and Príncipe", "Taiwan", "Tanzania", "Thailand", "Tunisia", "Turkey", "US Minor Outlying Islands", 
  "US Virgin Islands", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", 
  "Vanuatu", "Vietnam"
];

// User provided mappings (cleaned)
const userMapping = {
  "botswana": "BW", "egypt": "EG", "eswatini": "SZ", "ghana": "GH", "kenya": "KE", "madagascar": "MG", "mali": "ML", 
  "namibia": "NA", "nigeria": "NG", "reunion": "RE", "senegal": "SN", "south africa": "ZA", "sao tome and principe": "ST", 
  "tanzania": "TZ", "tunisia": "TN", "uganda": "UG", "antarctica": "AQ", "south georgia & sandwich islands": "GS", 
  "bangladesh": "BD", "bhutan": "BT", "cambodia": "KH", "china": "CN", "cyprus": "CY", "hong kong": "HK", "india": "IN", 
  "jordan": "JO", "kazakhstan": "KZ", "kyrgyzstan": "KG", "macau": "MO", "malaysia": "MY", "nepal": "NP", "oman": "OM", 
  "qatar": "QA", "singapore": "SG", "south korea": "KR", "taiwan": "TW", "thailand": "TH", "turkey": "TR", "united arab emirates": "AE", 
  "vietnam": "VN", "albania": "AL", "andorra": "AD", "austria": "AT", "portugal": "PT", "belarus": "BY", "belgium": "BE", 
  "bulgaria": "BG", "croatia": "HR", "czechia": "CZ", "denmark": "DK", "estonia": "EE", "faroe islands": "FO", "finland": "FI", 
  "france": "FR", "germany": "DE", "gibraltar": "GI", "greece": "GR", "hungary": "HU", "malta": "MT", "netherlands": "NL", 
  "north macedonia": "MK", "norway": "NO", "poland": "PL", "romania": "RO", "russia": "RU", "san marino": "SM", "serbia": "RS", 
  "slovakia": "SK", "slovenia": "SI", "spain": "ES", "svalbard": "SJ", "sweden": "SE", "switzerland": "CH", "ukraine": "UA", 
  "united kingdom": "GB", "united states of america": "US", "bermuda": "BM", "canada": "CA", "costa rica": "CR", 
  "dominican republic": "DO", "guatemala": "GT", "martinique": "MQ", "panama": "PA", "puerto rico": "PR", 
  "saint pierre and miquelon": "PM", "us minor outlying islands": "UM", "us virgin islands": "VI", "american samoa": "AS", 
  "australia": "AU", "christmas island": "CX", "cocos islands": "CC", "guam": "GU", "new zealand": "NZ", 
  "northern mariana islands": "MP", "pitcairn islands": "PN", "vanuatu": "VU", "argentina": "AR", "bolivia": "BO", 
  "brazil": "BR", "chile": "CL", "colombia": "CO", "curaçao": "CW", "ecuador": "EC", "falkland islands": "FK", "peru": "PE", 
  "uruguay": "UY"
};

// Supplement with standard codes for missing ones
const supplemental = {
  "alaska": "US", "azores": "PT", "british indian ocean territory": "IO", "greenland": "GL", "hawaii": "US", "iceland": "IS", 
  "indonesia": "ID", "iraq": "IQ", "ireland": "IE", "isle of man": "IM", "israel & the west bank": "IL", "italy": "IT", 
  "japan": "JP", "jersey": "JE", "laos": "LA", "latvia": "LV", "lebanon": "LB", "lesotho": "LS", "liechtenstein": "LI", 
  "lithuania": "LT", "luxembourg": "LU", "madeira": "PT", "mexico": "MX", "monaco": "MC", "mongolia": "MN", "montenegro": "ME", 
  "pakistan": "PK", "philippines": "PH", "rwanda": "RW", "sri lanka": "LK"
};

const fullMapping = { ...userMapping, ...supplemental };

const results = plonkitCountries.map(c => {
  const norm = c.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/é/g, 'e').replace(/ç/g, 'c');
  const code = fullMapping[norm] || fullMapping[c.toLowerCase()] || "??";
  return { name: c, code };
});

console.log(JSON.stringify(results, null, 2));

const missing = results.filter(r => r.code === "??");
if (missing.length > 0) {
  console.log("Missing:", missing);
}
