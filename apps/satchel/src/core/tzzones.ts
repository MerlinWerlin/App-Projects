// Time-zone search data (T24). Each line: IANA zone | country or territory | other places that use it (searchable).
// The zones listed here are also the fallback list when the engine has no Intl.supportedValuesOf (older Hermes).
// English names only for now; the search matches without accents and case. Not a full tz database: zones missing
// here are still found by city (the last part of the IANA name) when the engine lists them.
export const ZONE_TABLE = `
Pacific/Pago_Pago|American Samoa|Samoa Midway
Pacific/Honolulu|United States|Hawaii Waikiki Maui
America/Anchorage|United States|Alaska
America/Los_Angeles|United States|California Pacific San Francisco Seattle Las Vegas San Diego Portland
America/Vancouver|Canada|British Columbia Victoria Whistler
America/Tijuana|Mexico|Baja California
America/Denver|United States|Mountain Colorado Salt Lake City Albuquerque
America/Phoenix|United States|Arizona
America/Edmonton|Canada|Alberta Calgary Banff
America/Chicago|United States|Central Texas Dallas Houston Austin New Orleans Minneapolis
America/Winnipeg|Canada|Manitoba
America/Mexico_City|Mexico|Guadalajara Monterrey Oaxaca
America/Cancun|Mexico|Quintana Roo Tulum Playa del Carmen
America/Guatemala|Guatemala|
America/Costa_Rica|Costa Rica|San Jose
America/Panama|Panama|
America/New_York|United States|Eastern Washington Boston Miami Atlanta Philadelphia Orlando
America/Toronto|Canada|Ontario Ottawa Montreal Quebec
America/Havana|Cuba|
America/Jamaica|Jamaica|Kingston
America/Bogota|Colombia|Medellin Cartagena
America/Lima|Peru|Cusco
America/Guayaquil|Ecuador|Quito
America/Caracas|Venezuela|
America/La_Paz|Bolivia|
America/Santo_Domingo|Dominican Republic|Punta Cana
America/Puerto_Rico|Puerto Rico|San Juan
America/Barbados|Barbados|
America/Halifax|Canada|Nova Scotia Atlantic
America/St_Johns|Canada|Newfoundland
America/Santiago|Chile|
America/Argentina/Buenos_Aires|Argentina|Buenos Aires Mendoza Cordoba
America/Montevideo|Uruguay|
America/Asuncion|Paraguay|
America/Sao_Paulo|Brazil|Rio de Janeiro Brasilia Salvador
America/Manaus|Brazil|Amazonas
America/Nuuk|Greenland|Godthab
Atlantic/Azores|Portugal|Azores
Atlantic/Cape_Verde|Cape Verde|
Atlantic/Reykjavik|Iceland|
Atlantic/Canary|Spain|Canary Islands Tenerife Gran Canaria
Atlantic/Madeira|Portugal|Funchal
UTC|Coordinated Universal Time|GMT Zulu
Europe/London|United Kingdom|England Scotland Wales Britain UK Edinburgh Manchester
Europe/Dublin|Ireland|
Europe/Lisbon|Portugal|Porto
Africa/Casablanca|Morocco|Marrakesh Fez
Africa/Abidjan|Ivory Coast|Cote d'Ivoire
Africa/Accra|Ghana|
Africa/Dakar|Senegal|
Africa/Lagos|Nigeria|Abuja
Africa/Algiers|Algeria|
Africa/Tunis|Tunisia|
Europe/Paris|France|Nice Lyon Marseille Monaco
Europe/Madrid|Spain|Barcelona Seville Valencia Ibiza Mallorca
Europe/Berlin|Germany|Munich Hamburg Frankfurt Cologne
Europe/Amsterdam|Netherlands|Holland Rotterdam
Europe/Brussels|Belgium|Bruges Antwerp
Europe/Luxembourg|Luxembourg|
Europe/Zurich|Switzerland|Geneva Bern Basel
Europe/Vienna|Austria|Salzburg Innsbruck
Europe/Rome|Italy|Milan Venice Florence Naples Vatican San Marino
Europe/Malta|Malta|Valletta
Europe/Prague|Czechia|Czech Republic
Europe/Warsaw|Poland|Krakow
Europe/Budapest|Hungary|
Europe/Copenhagen|Denmark|
Europe/Oslo|Norway|Bergen Svalbard
Europe/Stockholm|Sweden|Gothenburg
Europe/Belgrade|Serbia|
Europe/Zagreb|Croatia|Dubrovnik Split
Europe/Ljubljana|Slovenia|
Europe/Sarajevo|Bosnia and Herzegovina|
Europe/Tirane|Albania|
Europe/Skopje|North Macedonia|
Africa/Cairo|Egypt|Luxor Giza Sharm el Sheikh
Africa/Johannesburg|South Africa|Cape Town Durban Pretoria
Africa/Maputo|Mozambique|
Africa/Harare|Zimbabwe|Victoria Falls
Africa/Lusaka|Zambia|
Africa/Windhoek|Namibia|
Africa/Kigali|Rwanda|
Africa/Tripoli|Libya|
Europe/Athens|Greece|Santorini Crete Mykonos
Europe/Bucharest|Romania|
Europe/Sofia|Bulgaria|
Europe/Helsinki|Finland|
Europe/Tallinn|Estonia|
Europe/Riga|Latvia|
Europe/Vilnius|Lithuania|
Europe/Kyiv|Ukraine|Kiev
Europe/Chisinau|Moldova|
Asia/Nicosia|Cyprus|
Asia/Beirut|Lebanon|
Asia/Jerusalem|Israel|Tel Aviv
Asia/Amman|Jordan|Petra
Europe/Istanbul|Turkey|Turkiye Ankara Antalya Cappadocia
Europe/Moscow|Russia|Saint Petersburg
Europe/Minsk|Belarus|
Africa/Nairobi|Kenya|Mombasa
Africa/Addis_Ababa|Ethiopia|
Africa/Dar_es_Salaam|Tanzania|Zanzibar
Africa/Kampala|Uganda|
Asia/Riyadh|Saudi Arabia|Jeddah Mecca
Asia/Qatar|Qatar|Doha
Asia/Kuwait|Kuwait|
Asia/Bahrain|Bahrain|
Asia/Baghdad|Iraq|
Indian/Antananarivo|Madagascar|
Asia/Tehran|Iran|
Asia/Dubai|United Arab Emirates|UAE Abu Dhabi Sharjah
Asia/Muscat|Oman|
Asia/Baku|Azerbaijan|
Asia/Tbilisi|Georgia|
Asia/Yerevan|Armenia|
Indian/Mauritius|Mauritius|
Indian/Reunion|Reunion|
Indian/Mahe|Seychelles|
Asia/Kabul|Afghanistan|
Asia/Karachi|Pakistan|Lahore Islamabad
Asia/Tashkent|Uzbekistan|Samarkand
Indian/Maldives|Maldives|Male
Asia/Kolkata|India|Calcutta Mumbai Delhi Bangalore Chennai Goa
Asia/Colombo|Sri Lanka|
Asia/Kathmandu|Nepal|Katmandu
Asia/Thimphu|Bhutan|
Asia/Dhaka|Bangladesh|
Asia/Almaty|Kazakhstan|
Asia/Yangon|Myanmar|Burma Rangoon
Asia/Bangkok|Thailand|Phuket Chiang Mai
Asia/Ho_Chi_Minh|Vietnam|Saigon Hanoi Da Nang
Asia/Phnom_Penh|Cambodia|Siem Reap
Asia/Vientiane|Laos|
Asia/Jakarta|Indonesia|Java
Asia/Makassar|Indonesia|Bali Denpasar Lombok
Asia/Kuala_Lumpur|Malaysia|Penang Langkawi
Asia/Singapore|Singapore|
Asia/Manila|Philippines|Cebu
Asia/Hong_Kong|Hong Kong|
Asia/Macau|Macau|Macao
Asia/Shanghai|China|Beijing Shenzhen Guangzhou Chengdu Xi'an
Asia/Taipei|Taiwan|
Australia/Perth|Australia|Western Australia
Asia/Seoul|South Korea|Korea Busan Jeju
Asia/Pyongyang|North Korea|
Asia/Tokyo|Japan|Osaka Kyoto Sapporo Okinawa Hiroshima Nara Fukuoka
Asia/Ulaanbaatar|Mongolia|Ulan Bator
Australia/Darwin|Australia|Northern Territory Uluru
Australia/Adelaide|Australia|South Australia
Australia/Brisbane|Australia|Queensland Gold Coast Cairns
Australia/Sydney|Australia|New South Wales Canberra
Australia/Melbourne|Australia|Victoria
Australia/Hobart|Australia|Tasmania
Pacific/Guam|Guam|
Pacific/Port_Moresby|Papua New Guinea|
Pacific/Noumea|New Caledonia|
Pacific/Fiji|Fiji|Nadi Suva
Pacific/Auckland|New Zealand|Wellington Christchurch Queenstown
Pacific/Chatham|New Zealand|Chatham Islands
Pacific/Tongatapu|Tonga|
Pacific/Apia|Samoa|
Pacific/Tahiti|French Polynesia|Bora Bora Papeete
Pacific/Rarotonga|Cook Islands|
Pacific/Kiritimati|Kiribati|Christmas Island Line Islands
`;

/** Old names some engines (and older tickets) still use, mapped to today's name. */
export const LEGACY_ZONES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Godthab': 'America/Nuuk',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
  GMT: 'UTC',
};
