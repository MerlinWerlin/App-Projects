// T77: a small bundled table of major airports (IATA code | city or airport name | IANA zone), used by "Paste a
// booking" to turn "SYD → HND" into places and zones offline. The repo had no airport data before T77. Not a full
// list: a code missing here is kept as typed and its zone is left for the traveller to choose. Cities without a
// listed airport (rail and ferry towns) sit in CITY_ZONES so a hotel or train in Kyoto still gets Asia/Tokyo.
// Codes, cities and zones are public facts; no airline or airport branding.

export type Airport = { code: string; city: string; tz: string };

const AIRPORT_TABLE = `
SYD|Sydney|Australia/Sydney
MEL|Melbourne|Australia/Melbourne
AVV|Melbourne Avalon|Australia/Melbourne
BNE|Brisbane|Australia/Brisbane
OOL|Gold Coast|Australia/Brisbane
CNS|Cairns|Australia/Brisbane
ADL|Adelaide|Australia/Adelaide
PER|Perth|Australia/Perth
HBA|Hobart|Australia/Hobart
CBR|Canberra|Australia/Sydney
DRW|Darwin|Australia/Darwin
AKL|Auckland|Pacific/Auckland
WLG|Wellington|Pacific/Auckland
CHC|Christchurch|Pacific/Auckland
ZQN|Queenstown|Pacific/Auckland
NAN|Nadi|Pacific/Fiji
HND|Tokyo Haneda|Asia/Tokyo
NRT|Tokyo Narita|Asia/Tokyo
KIX|Osaka Kansai|Asia/Tokyo
ITM|Osaka Itami|Asia/Tokyo
NGO|Nagoya|Asia/Tokyo
CTS|Sapporo|Asia/Tokyo
FUK|Fukuoka|Asia/Tokyo
OKA|Okinawa Naha|Asia/Tokyo
HIJ|Hiroshima|Asia/Tokyo
ICN|Seoul Incheon|Asia/Seoul
GMP|Seoul Gimpo|Asia/Seoul
PUS|Busan|Asia/Seoul
PEK|Beijing Capital|Asia/Shanghai
PKX|Beijing Daxing|Asia/Shanghai
PVG|Shanghai Pudong|Asia/Shanghai
SHA|Shanghai Hongqiao|Asia/Shanghai
CAN|Guangzhou|Asia/Shanghai
SZX|Shenzhen|Asia/Shanghai
CTU|Chengdu|Asia/Shanghai
HKG|Hong Kong|Asia/Hong_Kong
MFM|Macau|Asia/Macau
TPE|Taipei Taoyuan|Asia/Taipei
TSA|Taipei Songshan|Asia/Taipei
MNL|Manila|Asia/Manila
CEB|Cebu|Asia/Manila
SGN|Ho Chi Minh City|Asia/Ho_Chi_Minh
HAN|Hanoi|Asia/Ho_Chi_Minh
DAD|Da Nang|Asia/Ho_Chi_Minh
BKK|Bangkok Suvarnabhumi|Asia/Bangkok
DMK|Bangkok Don Mueang|Asia/Bangkok
HKT|Phuket|Asia/Bangkok
CNX|Chiang Mai|Asia/Bangkok
KUL|Kuala Lumpur|Asia/Kuala_Lumpur
PEN|Penang|Asia/Kuala_Lumpur
SIN|Singapore|Asia/Singapore
CGK|Jakarta|Asia/Jakarta
DPS|Bali Denpasar|Asia/Makassar
REP|Siem Reap|Asia/Phnom_Penh
PNH|Phnom Penh|Asia/Phnom_Penh
DEL|Delhi|Asia/Kolkata
BOM|Mumbai|Asia/Kolkata
BLR|Bengaluru|Asia/Kolkata
MAA|Chennai|Asia/Kolkata
CMB|Colombo|Asia/Colombo
KTM|Kathmandu|Asia/Kathmandu
MLE|Male|Indian/Maldives
DXB|Dubai|Asia/Dubai
AUH|Abu Dhabi|Asia/Dubai
DOH|Doha|Asia/Qatar
IST|Istanbul|Europe/Istanbul
SAW|Istanbul Sabiha Gokcen|Europe/Istanbul
TLV|Tel Aviv|Asia/Jerusalem
AMM|Amman|Asia/Amman
CAI|Cairo|Africa/Cairo
JNB|Johannesburg|Africa/Johannesburg
CPT|Cape Town|Africa/Johannesburg
NBO|Nairobi|Africa/Nairobi
CMN|Casablanca|Africa/Casablanca
RAK|Marrakesh|Africa/Casablanca
LHR|London Heathrow|Europe/London
LGW|London Gatwick|Europe/London
STN|London Stansted|Europe/London
LTN|London Luton|Europe/London
LCY|London City|Europe/London
MAN|Manchester|Europe/London
EDI|Edinburgh|Europe/London
GLA|Glasgow|Europe/London
DUB|Dublin|Europe/Dublin
CDG|Paris Charles de Gaulle|Europe/Paris
ORY|Paris Orly|Europe/Paris
NCE|Nice|Europe/Paris
LYS|Lyon|Europe/Paris
AMS|Amsterdam|Europe/Amsterdam
BRU|Brussels|Europe/Brussels
FRA|Frankfurt|Europe/Berlin
MUC|Munich|Europe/Berlin
BER|Berlin|Europe/Berlin
HAM|Hamburg|Europe/Berlin
ZRH|Zurich|Europe/Zurich
GVA|Geneva|Europe/Zurich
VIE|Vienna|Europe/Vienna
PRG|Prague|Europe/Prague
BUD|Budapest|Europe/Budapest
WAW|Warsaw|Europe/Warsaw
KRK|Krakow|Europe/Warsaw
CPH|Copenhagen|Europe/Copenhagen
ARN|Stockholm|Europe/Stockholm
OSL|Oslo|Europe/Oslo
HEL|Helsinki|Europe/Helsinki
KEF|Reykjavik|Atlantic/Reykjavik
MAD|Madrid|Europe/Madrid
BCN|Barcelona|Europe/Madrid
PMI|Palma de Mallorca|Europe/Madrid
LIS|Lisbon|Europe/Lisbon
OPO|Porto|Europe/Lisbon
FCO|Rome Fiumicino|Europe/Rome
MXP|Milan Malpensa|Europe/Rome
LIN|Milan Linate|Europe/Rome
VCE|Venice|Europe/Rome
NAP|Naples|Europe/Rome
ATH|Athens|Europe/Athens
JTR|Santorini|Europe/Athens
SPU|Split|Europe/Zagreb
DBV|Dubrovnik|Europe/Zagreb
JFK|New York JFK|America/New_York
EWR|Newark|America/New_York
LGA|New York LaGuardia|America/New_York
BOS|Boston|America/New_York
IAD|Washington Dulles|America/New_York
DCA|Washington National|America/New_York
PHL|Philadelphia|America/New_York
ATL|Atlanta|America/New_York
MIA|Miami|America/New_York
MCO|Orlando|America/New_York
ORD|Chicago O'Hare|America/Chicago
DFW|Dallas Fort Worth|America/Chicago
IAH|Houston|America/Chicago
MSY|New Orleans|America/Chicago
DEN|Denver|America/Denver
PHX|Phoenix|America/Phoenix
LAS|Las Vegas|America/Los_Angeles
LAX|Los Angeles|America/Los_Angeles
SFO|San Francisco|America/Los_Angeles
SAN|San Diego|America/Los_Angeles
SEA|Seattle|America/Los_Angeles
PDX|Portland|America/Los_Angeles
HNL|Honolulu|Pacific/Honolulu
OGG|Maui Kahului|Pacific/Honolulu
ANC|Anchorage|America/Anchorage
YYZ|Toronto|America/Toronto
YUL|Montreal|America/Toronto
YVR|Vancouver|America/Vancouver
YYC|Calgary|America/Edmonton
MEX|Mexico City|America/Mexico_City
CUN|Cancun|America/Cancun
GRU|Sao Paulo|America/Sao_Paulo
GIG|Rio de Janeiro|America/Sao_Paulo
EZE|Buenos Aires|America/Argentina/Buenos_Aires
SCL|Santiago|America/Santiago
LIM|Lima|America/Lima
BOG|Bogota|America/Bogota
PTY|Panama City|America/Panama
SJO|San Jose Costa Rica|America/Costa_Rica
`;

/** Places without a listed airport, for guessing a hotel's or a station's zone from its city: name|zone. */
const CITY_TABLE = `
Kyoto|Asia/Tokyo
Nara|Asia/Tokyo
Hakone|Asia/Tokyo
Kanazawa|Asia/Tokyo
Nikko|Asia/Tokyo
Yokohama|Asia/Tokyo
Kobe|Asia/Tokyo
Tokyo|Asia/Tokyo
Osaka|Asia/Tokyo
Seoul|Asia/Seoul
Beijing|Asia/Shanghai
Shanghai|Asia/Shanghai
Taipei|Asia/Taipei
Bangkok|Asia/Bangkok
London|Europe/London
Oxford|Europe/London
York|Europe/London
Paris|Europe/Paris
Rome|Europe/Rome
Milan|Europe/Rome
Florence|Europe/Rome
Venice|Europe/Rome
Salzburg|Europe/Vienna
Cologne|Europe/Berlin
Seville|Europe/Madrid
Granada|Europe/Madrid
New York|America/New_York
Washington|America/New_York
Chicago|America/Chicago
Byron Bay|Australia/Sydney
Blue Mountains|Australia/Sydney
Katoomba|Australia/Sydney
Rotorua|Pacific/Auckland
`;

function rows(table: string): string[][] {
  return table
    .trim()
    .split('\n')
    .map((l) => l.split('|'));
}

export const AIRPORTS: ReadonlyMap<string, Airport> = new Map(rows(AIRPORT_TABLE).map(([code, city, tz]) => [code, { code, city, tz }]));

/** Cities (airport cities first word plus CITY_TABLE), longest name first so "New York" wins over "York". */
const CITIES: readonly { name: string; tz: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const [name, tz] of rows(CITY_TABLE)) seen.set(name, tz);
  for (const a of AIRPORTS.values()) {
    // "Tokyo Haneda" -> "Tokyo"; multi-word cities that are the whole name stay whole ("Hong Kong", "Gold Coast").
    const words = a.city.split(' ');
    const base = words.length > 1 && /^(Haneda|Narita|Kansai|Itami|Incheon|Gimpo|Capital|Daxing|Pudong|Hongqiao|Taoyuan|Songshan|Suvarnabhumi|Don|Heathrow|Gatwick|Stansted|Luton|City|Charles|Orly|Fiumicino|Malpensa|Linate|JFK|LaGuardia|Dulles|National|O'Hare|Avalon|Sabiha|Denpasar|Kahului|Naha)$/.test(words[1]) ? words[0] : a.city;
    if (!seen.has(base)) seen.set(base, a.tz);
  }
  return [...seen].map(([name, tz]) => ({ name, tz })).sort((a, b) => b.name.length - a.name.length);
})();

/** The airport for a three-letter code (any case), or undefined when it is not in the bundled table. */
export function airportByCode(code: string): Airport | undefined {
  return AIRPORTS.get(code.trim().toUpperCase());
}

/** The zone of the first known city named in `text` (whole words, any case), or undefined. */
export function zoneFromCity(text: string): { city: string; tz: string } | undefined {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ')} `;
  let best: { city: string; tz: string; at: number } | undefined;
  for (const c of CITIES) {
    const at = lower.indexOf(` ${c.name.toLowerCase()} `);
    if (at >= 0 && (!best || at < best.at)) best = { city: c.name, tz: c.tz, at };
  }
  return best ? { city: best.city, tz: best.tz } : undefined;
}
