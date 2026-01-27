
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

// Replicate the logic from the user script
function getCountryCode(countryName) {
    if (!countryName) return '??';
    const name = countryName.trim().toLowerCase();
    
    const mapping = {
        'alaska': 'US', 'albania': 'AL', 'american samoa': 'AS', 'andorra': 'AD', 'antarctica': 'AQ',
        'argentina': 'AR', 'australia': 'AU', 'austria': 'AT', 'azores': 'PT', 'bangladesh': 'BD',
        'belarus': 'BY', 'belgium': 'BE', 'bermuda': 'BM', 'bhutan': 'BT', 'bolivia': 'BO',
        'botswana': 'BW', 'brazil': 'BR', 'british indian ocean territory': 'IO', 'bulgaria': 'BG',
        'cambodia': 'KH', 'canada': 'CA', 'chile': 'CL', 'china': 'CN', 'christmas island': 'CX',
        'cocos islands': 'CC', 'colombia': 'CO', 'costa rica': 'CR', 'croatia': 'HR', 'curaçao': 'CW',
        'cyprus': 'CY', 'czechia': 'CZ', 'denmark': 'DK', 'dominican republic': 'DO', 'ecuador': 'EC',
        'egypt': 'EG', 'estonia': 'EE', 'eswatini': 'SZ', 'falkland islands': 'FK', 'faroe islands': 'FO',
        'finland': 'FI', 'france': 'FR', 'germany': 'DE', 'ghana': 'GH', 'gibraltar': 'GI',
        'greece': 'GR', 'greenland': 'GL', 'guam': 'GU', 'guatemala': 'GT', 'hawaii': 'US',
        'hong kong': 'HK', 'hungary': 'HU', 'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID',
        'iraq': 'IQ', 'ireland': 'IE', 'isle of man': 'IM', 'israel & the west bank': 'IL', 'italy': 'IT',
        'japan': 'JP', 'jersey': 'JE', 'jordan': 'JO', 'kazakhstan': 'KZ', 'kenya': 'KE',
        'kyrgyzstan': 'KG', 'laos': 'LA', 'latvia': 'LV', 'lebanon': 'LB', 'lesotho': 'LS',
        'liechtenstein': 'LI', 'lithuania': 'LT', 'luxembourg': 'LU', 'macau': 'MO', 'madagascar': 'MG',
        'madeira': 'PT', 'malaysia': 'MY', 'mali': 'ML', 'malta': 'MT', 'martinique': 'MQ',
        'mexico': 'MX', 'monaco': 'MC', 'mongolia': 'MN', 'montenegro': 'ME', 'namibia': 'NA',
        'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ', 'nigeria': 'NG', 'north macedonia': 'MK',
        'northern mariana islands': 'MP', 'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK', 'panama': 'PA',
        'peru': 'PE', 'philippines': 'PH', 'pitcairn islands': 'PN', 'poland': 'PL', 'portugal': 'PT',
        'puerto rico': 'PR', 'qatar': 'QA', 'reunion': 'RE', 'romania': 'RO', 'russia': 'RU',
        'rwanda': 'RW', 'saint pierre and miquelon': 'PM', 'san marino': 'SM', 'senegal': 'SN',
        'serbia': 'RS', 'singapore': 'SG', 'slovakia': 'SK', 'slovenia': 'SI', 'south africa': 'ZA',
        'south georgia & sandwich islands': 'GS', 'south korea': 'KR', 'spain': 'ES', 'sri lanka': 'LK',
        'svalbard': 'SJ', 'sweden': 'SE', 'switzerland': 'CH', 'são tomé and príncipe': 'ST',
        'taiwan': 'TW', 'tanzania': 'TZ', 'thailand': 'TH', 'tunisia': 'TN', 'turkey': 'TR',
        'us minor outlying islands': 'UM', 'us virgin islands': 'VI', 'uganda': 'UG', 'ukraine': 'UA',
        'united arab emirates': 'AE', 'united kingdom': 'GB', 'united states of america': 'US',
        'uruguay': 'UY', 'vanuatu': 'VU', 'vietnam': 'VN'
    };

    const normalizedName = name.replace(/á/g, 'a').replace(/ó/g, 'o').replace(/é/g, 'e').replace(/ç/g, 'c');
    if (mapping[name]) return mapping[name];
    if (mapping[normalizedName]) return mapping[normalizedName];
    
    if (name.includes('sao tome') || name.includes('sdo tome')) return 'ST';

    const words = name.split(' ');
    if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

const errors = [];
plonkitCountries.forEach(c => {
    const code = getCountryCode(c);
    if (code === '??' || code.length !== 2) {
        errors.push({ country: c, code });
    }
});

if (errors.length > 0) {
    console.log("Errors:", errors);
} else {
    console.log("All countries mapped correctly.");
}
