// T77: a small bundled table of major airports (IATA code | city or airport name | IANA zone), used by "Paste a
// booking" to turn "SYD → HND" into places and zones offline. The repo had no airport data before T77. Not a full
// list: a code missing here is kept as typed and its zone is left for the traveller to choose. Cities without a
// listed airport (rail and ferry towns) sit in CITY_ZONES so a hotel or train in Kyoto still gets Asia/Tokyo.
// Codes, cities and zones are public facts; no airline or airport branding.
// T80: grown to ~540 airports worldwide (hubs, capitals and well-known holiday airports). Codes that are also ISO
// currency codes or everyday capitalised words (EXT, LED, ACE...) are left out, because known codes are spotted
// anywhere in the text; see the tests in src/core/followups89.test.ts.

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
TSV|Townsville|Australia/Brisbane
MCY|Sunshine Coast|Australia/Brisbane
HTI|Hamilton Island|Australia/Brisbane
ASP|Alice Springs|Australia/Darwin
AYQ|Uluru|Australia/Darwin
LST|Launceston|Australia/Hobart
BME|Broome|Australia/Perth
DUD|Dunedin|Pacific/Auckland
PPT|Papeete Tahiti|Pacific/Tahiti
NOU|Noumea|Pacific/Noumea
APW|Apia|Pacific/Apia
TBU|Nuku'alofa|Pacific/Tongatapu
RAR|Rarotonga|Pacific/Rarotonga
VLI|Port Vila|Pacific/Efate
POM|Port Moresby|Pacific/Port_Moresby
GUM|Guam|Pacific/Guam
SPN|Saipan|Pacific/Saipan
SDJ|Sendai|Asia/Tokyo
KOJ|Kagoshima|Asia/Tokyo
KMJ|Kumamoto|Asia/Tokyo
NGS|Nagasaki|Asia/Tokyo
OKJ|Okayama|Asia/Tokyo
KMQ|Komatsu|Asia/Tokyo
UKB|Kobe|Asia/Tokyo
ISG|Ishigaki|Asia/Tokyo
AOJ|Aomori|Asia/Tokyo
KIJ|Niigata|Asia/Tokyo
MYJ|Matsuyama|Asia/Tokyo
TAK|Takamatsu|Asia/Tokyo
OIT|Oita|Asia/Tokyo
CJU|Jeju|Asia/Seoul
TAE|Daegu|Asia/Seoul
XIY|Xi'an|Asia/Shanghai
KMG|Kunming|Asia/Shanghai
CKG|Chongqing|Asia/Shanghai
HGH|Hangzhou|Asia/Shanghai
NKG|Nanjing|Asia/Shanghai
WUH|Wuhan|Asia/Shanghai
XMN|Xiamen|Asia/Shanghai
TAO|Qingdao|Asia/Shanghai
DLC|Dalian|Asia/Shanghai
HRB|Harbin|Asia/Shanghai
TSN|Tianjin|Asia/Shanghai
CSX|Changsha|Asia/Shanghai
SYX|Sanya|Asia/Shanghai
KWL|Guilin|Asia/Shanghai
HAK|Haikou|Asia/Shanghai
FOC|Fuzhou|Asia/Shanghai
CGO|Zhengzhou|Asia/Shanghai
TFU|Chengdu Tianfu|Asia/Shanghai
KHH|Kaohsiung|Asia/Taipei
RMQ|Taichung|Asia/Taipei
UBN|Ulaanbaatar|Asia/Ulaanbaatar
CRK|Clark Angeles|Asia/Manila
DVO|Davao|Asia/Manila
MPH|Boracay Caticlan|Asia/Manila
KLO|Kalibo|Asia/Manila
PPS|Puerto Princesa|Asia/Manila
CXR|Nha Trang Cam Ranh|Asia/Ho_Chi_Minh
PQC|Phu Quoc|Asia/Ho_Chi_Minh
HPH|Hai Phong|Asia/Ho_Chi_Minh
HUI|Hue|Asia/Ho_Chi_Minh
DLI|Da Lat|Asia/Ho_Chi_Minh
USM|Koh Samui|Asia/Bangkok
KBV|Krabi|Asia/Bangkok
CEI|Chiang Rai|Asia/Bangkok
HDY|Hat Yai|Asia/Bangkok
UTP|Pattaya U-Tapao|Asia/Bangkok
BKI|Kota Kinabalu|Asia/Kuching
KCH|Kuching|Asia/Kuching
LGK|Langkawi|Asia/Kuala_Lumpur
JHB|Johor Bahru|Asia/Kuala_Lumpur
YIA|Yogyakarta|Asia/Jakarta
LOP|Lombok|Asia/Makassar
KNO|Medan|Asia/Jakarta
UPG|Makassar|Asia/Makassar
BTH|Batam|Asia/Jakarta
LBJ|Labuan Bajo|Asia/Makassar
SAI|Siem Reap Angkor|Asia/Phnom_Penh
VTE|Vientiane|Asia/Vientiane
LPQ|Luang Prabang|Asia/Vientiane
RGN|Yangon|Asia/Yangon
BWN|Bandar Seri Begawan|Asia/Brunei
HYD|Hyderabad|Asia/Kolkata
CCU|Kolkata|Asia/Kolkata
GOI|Goa Dabolim|Asia/Kolkata
GOX|Goa Mopa|Asia/Kolkata
COK|Kochi Cochin|Asia/Kolkata
JAI|Jaipur|Asia/Kolkata
TRV|Thiruvananthapuram|Asia/Kolkata
PNQ|Pune|Asia/Kolkata
ATQ|Amritsar|Asia/Kolkata
VNS|Varanasi|Asia/Kolkata
IXC|Chandigarh|Asia/Kolkata
LKO|Lucknow|Asia/Kolkata
GAU|Guwahati|Asia/Kolkata
SXR|Srinagar|Asia/Kolkata
BBI|Bhubaneswar|Asia/Kolkata
KHI|Karachi|Asia/Karachi
LHE|Lahore|Asia/Karachi
ISB|Islamabad|Asia/Karachi
DAC|Dhaka|Asia/Dhaka
PBH|Paro|Asia/Thimphu
ALA|Almaty|Asia/Almaty
NQZ|Astana|Asia/Almaty
TAS|Tashkent|Asia/Tashkent
SKD|Samarkand|Asia/Samarkand
TBS|Tbilisi|Asia/Tbilisi
EVN|Yerevan|Asia/Yerevan
FRU|Bishkek|Asia/Bishkek
RUH|Riyadh|Asia/Riyadh
JED|Jeddah|Asia/Riyadh
DMM|Dammam|Asia/Riyadh
BAH|Bahrain|Asia/Bahrain
KWI|Kuwait City|Asia/Kuwait
MCT|Muscat|Asia/Muscat
SHJ|Sharjah|Asia/Dubai
DWC|Dubai World Central|Asia/Dubai
BEY|Beirut|Asia/Beirut
IKA|Tehran Imam Khomeini|Asia/Tehran
AQJ|Aqaba|Asia/Amman
ESB|Ankara|Europe/Istanbul
AYT|Antalya|Europe/Istanbul
ADB|Izmir|Europe/Istanbul
DLM|Dalaman|Europe/Istanbul
BJV|Bodrum|Europe/Istanbul
ASR|Kayseri|Europe/Istanbul
ADD|Addis Ababa|Africa/Addis_Ababa
ABV|Abuja|Africa/Lagos
ACC|Accra|Africa/Accra
DSS|Dakar|Africa/Dakar
DAR|Dar es Salaam|Africa/Dar_es_Salaam
JRO|Kilimanjaro|Africa/Dar_es_Salaam
ZNZ|Zanzibar|Africa/Dar_es_Salaam
EBB|Entebbe|Africa/Kampala
KGL|Kigali|Africa/Kigali
MBA|Mombasa|Africa/Nairobi
DUR|Durban|Africa/Johannesburg
VFA|Victoria Falls|Africa/Harare
WDH|Windhoek|Africa/Windhoek
GBE|Gaborone|Africa/Gaborone
SEZ|Mahe Seychelles|Indian/Mahe
TNR|Antananarivo|Indian/Antananarivo
TUN|Tunis|Africa/Tunis
ALG|Algiers|Africa/Algiers
FEZ|Fes|Africa/Casablanca
TNG|Tangier|Africa/Casablanca
AGA|Agadir|Africa/Casablanca
HRG|Hurghada|Africa/Cairo
SSH|Sharm el-Sheikh|Africa/Cairo
LXR|Luxor|Africa/Cairo
LUN|Lusaka|Africa/Lusaka
HRE|Harare|Africa/Harare
MPM|Maputo|Africa/Maputo
LAD|Luanda|Africa/Luanda
ABJ|Abidjan|Africa/Abidjan
BHX|Birmingham|Europe/London
BRS|Bristol|Europe/London
LPL|Liverpool|Europe/London
NCL|Newcastle upon Tyne|Europe/London
EMA|East Midlands|Europe/London
LBA|Leeds Bradford|Europe/London
ABZ|Aberdeen|Europe/London
INV|Inverness|Europe/London
BFS|Belfast|Europe/London
SOU|Southampton|Europe/London
CWL|Cardiff|Europe/London
SEN|London Southend|Europe/London
ORK|Cork|Europe/Dublin
MRS|Marseille|Europe/Paris
TLS|Toulouse|Europe/Paris
BOD|Bordeaux|Europe/Paris
NTE|Nantes|Europe/Paris
BSL|Basel|Europe/Zurich
MPL|Montpellier|Europe/Paris
SXB|Strasbourg|Europe/Paris
BIQ|Biarritz|Europe/Paris
AJA|Ajaccio|Europe/Paris
BIA|Bastia|Europe/Paris
LIL|Lille|Europe/Paris
BVA|Paris Beauvais|Europe/Paris
EIN|Eindhoven|Europe/Amsterdam
RTM|Rotterdam|Europe/Amsterdam
CRL|Brussels Charleroi|Europe/Brussels
LUX|Luxembourg|Europe/Luxembourg
DUS|Dusseldorf|Europe/Berlin
CGN|Cologne Bonn|Europe/Berlin
STR|Stuttgart|Europe/Berlin
HAJ|Hanover|Europe/Berlin
NUE|Nuremberg|Europe/Berlin
LEJ|Leipzig|Europe/Berlin
DRS|Dresden|Europe/Berlin
BRE|Bremen|Europe/Berlin
SZG|Salzburg|Europe/Vienna
GRZ|Graz|Europe/Vienna
BGY|Milan Bergamo|Europe/Rome
CIA|Rome Ciampino|Europe/Rome
BLQ|Bologna|Europe/Rome
FLR|Florence|Europe/Rome
PSA|Pisa|Europe/Rome
TRN|Turin|Europe/Rome
CTA|Catania|Europe/Rome
PMO|Palermo|Europe/Rome
BRI|Bari|Europe/Rome
CAG|Cagliari|Europe/Rome
OLB|Olbia|Europe/Rome
VRN|Verona|Europe/Rome
TSF|Venice Treviso|Europe/Rome
AGP|Malaga|Europe/Madrid
ALC|Alicante|Europe/Madrid
VLC|Valencia|Europe/Madrid
SVQ|Seville|Europe/Madrid
BIO|Bilbao|Europe/Madrid
IBZ|Ibiza|Europe/Madrid
MAH|Menorca|Europe/Madrid
GRX|Granada|Europe/Madrid
SCQ|Santiago de Compostela|Europe/Madrid
TFS|Tenerife South|Atlantic/Canary
TFN|Tenerife North|Atlantic/Canary
LPA|Gran Canaria|Atlantic/Canary
FUE|Fuerteventura|Atlantic/Canary
FAO|Faro|Europe/Lisbon
FNC|Funchal Madeira|Atlantic/Madeira
PDL|Ponta Delgada|Atlantic/Azores
SKG|Thessaloniki|Europe/Athens
CHQ|Chania|Europe/Athens
RHO|Rhodes|Europe/Athens
CFU|Corfu|Europe/Athens
JMK|Mykonos|Europe/Athens
ZTH|Zakynthos|Europe/Athens
LCA|Larnaca|Asia/Nicosia
PFO|Paphos|Asia/Nicosia
MLA|Malta|Europe/Malta
ZAG|Zagreb|Europe/Zagreb
PUY|Pula|Europe/Zagreb
LJU|Ljubljana|Europe/Ljubljana
BEG|Belgrade|Europe/Belgrade
SJJ|Sarajevo|Europe/Sarajevo
TGD|Podgorica|Europe/Podgorica
TIV|Tivat|Europe/Podgorica
TIA|Tirana|Europe/Tirane
SKP|Skopje|Europe/Skopje
SOF|Sofia Bulgaria|Europe/Sofia
VAR|Varna|Europe/Sofia
BOJ|Burgas|Europe/Sofia
OTP|Bucharest|Europe/Bucharest
CLJ|Cluj-Napoca|Europe/Bucharest
BTS|Bratislava|Europe/Bratislava
GDN|Gdansk|Europe/Warsaw
WRO|Wroclaw|Europe/Warsaw
KTW|Katowice|Europe/Warsaw
POZ|Poznan|Europe/Warsaw
WMI|Warsaw Modlin|Europe/Warsaw
RIX|Riga|Europe/Riga
TLL|Tallinn|Europe/Tallinn
VNO|Vilnius|Europe/Vilnius
BGO|Bergen|Europe/Oslo
TRD|Trondheim|Europe/Oslo
TOS|Tromso|Europe/Oslo
SVG|Stavanger|Europe/Oslo
BLL|Billund|Europe/Copenhagen
AAL|Aalborg|Europe/Copenhagen
RVN|Rovaniemi|Europe/Helsinki
KIV|Chisinau|Europe/Chisinau
SVO|Moscow Sheremetyevo|Europe/Moscow
DME|Moscow Domodedovo|Europe/Moscow
MDW|Chicago Midway|America/Chicago
HOU|Houston Hobby|America/Chicago
DAL|Dallas Love Field|America/Chicago
MSP|Minneapolis|America/Chicago
DTW|Detroit|America/Detroit
CLT|Charlotte North Carolina|America/New_York
BWI|Baltimore|America/New_York
FLL|Fort Lauderdale|America/New_York
TPA|Tampa|America/New_York
RSW|Fort Myers|America/New_York
PBI|West Palm Beach|America/New_York
JAX|Jacksonville|America/New_York
RDU|Raleigh Durham|America/New_York
BNA|Nashville|America/Chicago
MEM|Memphis|America/Chicago
STL|St Louis|America/Chicago
MCI|Kansas City|America/Chicago
CLE|Cleveland|America/New_York
CMH|Columbus|America/New_York
PIT|Pittsburgh|America/New_York
CVG|Cincinnati|America/New_York
MKE|Milwaukee|America/Chicago
SLC|Salt Lake City|America/Denver
ABQ|Albuquerque|America/Denver
TUS|Tucson|America/Phoenix
SJC|San Jose California|America/Los_Angeles
OAK|Oakland|America/Los_Angeles
SMF|Sacramento|America/Los_Angeles
BUR|Burbank|America/Los_Angeles
SNA|Orange County Santa Ana|America/Los_Angeles
LGB|Long Beach|America/Los_Angeles
PSP|Palm Springs|America/Los_Angeles
RNO|Reno|America/Los_Angeles
BOI|Boise|America/Boise
JAC|Jackson Hole|America/Denver
ASE|Aspen|America/Denver
KOA|Kona|Pacific/Honolulu
LIH|Lihue Kauai|Pacific/Honolulu
ITO|Hilo|Pacific/Honolulu
FAI|Fairbanks|America/Anchorage
JNU|Juneau|America/Juneau
SAV|Savannah|America/New_York
CHS|Charleston|America/New_York
BDL|Hartford|America/New_York
PVD|Providence|America/New_York
BUF|Buffalo|America/New_York
OMA|Omaha|America/Chicago
OKC|Oklahoma City|America/Chicago
SDF|Louisville|America/Kentucky/Louisville
SJU|San Juan|America/Puerto_Rico
STT|St Thomas|America/St_Thomas
YOW|Ottawa|America/Toronto
YEG|Edmonton|America/Edmonton
YWG|Winnipeg|America/Winnipeg
YHZ|Halifax|America/Halifax
YQB|Quebec City|America/Toronto
YLW|Kelowna|America/Vancouver
YXE|Saskatoon|America/Regina
YYT|St John's|America/St_Johns
YTZ|Toronto Billy Bishop|America/Toronto
GDL|Guadalajara|America/Mexico_City
MTY|Monterrey|America/Monterrey
SJD|Los Cabos|America/Mazatlan
PVR|Puerto Vallarta|America/Mexico_City
OAX|Oaxaca|America/Mexico_City
NLU|Mexico City Felipe Angeles|America/Mexico_City
TIJ|Tijuana|America/Tijuana
GUA|Guatemala City|America/Guatemala
SAL|San Salvador|America/El_Salvador
SAP|San Pedro Sula|America/Tegucigalpa
LIR|Liberia Costa Rica|America/Costa_Rica
BZE|Belize City|America/Belize
HAV|Havana|America/Havana
PUJ|Punta Cana|America/Santo_Domingo
SDQ|Santo Domingo|America/Santo_Domingo
MBJ|Montego Bay|America/Jamaica
KIN|Kingston Jamaica|America/Jamaica
NAS|Nassau|America/Nassau
BGI|Barbados|America/Barbados
AUA|Aruba|America/Aruba
CUR|Curacao|America/Curacao
SXM|St Maarten|America/Lower_Princes
ANU|Antigua|America/Antigua
UVF|St Lucia|America/St_Lucia
GCM|Grand Cayman|America/Cayman
BDA|Bermuda|Atlantic/Bermuda
PTP|Guadeloupe|America/Guadeloupe
FDF|Martinique|America/Martinique
BSB|Brasilia|America/Sao_Paulo
CNF|Belo Horizonte|America/Sao_Paulo
SDU|Rio de Janeiro Santos Dumont|America/Sao_Paulo
VCP|Campinas|America/Sao_Paulo
CGH|Sao Paulo Congonhas|America/Sao_Paulo
SSA|Salvador|America/Bahia
REC|Recife|America/Recife
POA|Porto Alegre|America/Sao_Paulo
CWB|Curitiba|America/Sao_Paulo
FLN|Florianopolis|America/Sao_Paulo
MAO|Manaus|America/Manaus
IGU|Foz do Iguacu|America/Sao_Paulo
NAT|Natal|America/Fortaleza
BEL|Belem|America/Belem
AEP|Buenos Aires Aeroparque|America/Argentina/Buenos_Aires
COR|Cordoba Argentina|America/Argentina/Cordoba
MDZ|Mendoza|America/Argentina/Mendoza
USH|Ushuaia|America/Argentina/Ushuaia
FTE|El Calafate|America/Argentina/Rio_Gallegos
MVD|Montevideo|America/Montevideo
ASU|Asuncion|America/Asuncion
VVI|Santa Cruz Bolivia|America/La_Paz
LPB|La Paz Bolivia|America/La_Paz
UIO|Quito|America/Guayaquil
GYE|Guayaquil|America/Guayaquil
CUZ|Cusco|America/Lima
MDE|Medellin|America/Bogota
CTG|Cartagena|America/Bogota
CLO|Cali|America/Bogota
CCS|Caracas|America/Caracas
PUQ|Punta Arenas|America/Punta_Arenas
IPC|Easter Island|Pacific/Easter
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
Nha Trang|Asia/Ho_Chi_Minh
Hoi An|Asia/Ho_Chi_Minh
Luang Prabang|Asia/Vientiane
Cappadocia|Europe/Istanbul
Goreme|Europe/Istanbul
Ubud|Asia/Makassar
Tahiti|Pacific/Tahiti
Bora Bora|Pacific/Tahiti
`;

function rows(table: string): string[][] {
  return table
    .trim()
    .split('\n')
    .map((l) => l.split('|'));
}

export const AIRPORTS: ReadonlyMap<string, Airport> = new Map(rows(AIRPORT_TABLE).map(([code, city, tz]) => [code, { code, city, tz }]));

/**
 * T80: airport cities whose name is also an everyday word, a first name or surname, or a street or hotel name in
 * other cities ("Hotel Bristol", "Liverpool Street"). Their codes still work; they are just not used to guess a
 * hotel's or a station's zone from its address.
 */
const NOT_CITY = new Set(
  'Hue Providence Buffalo Salvador Savannah Mendoza Aspen Natal Columbus Paro Reno Kos Cali Faro Bristol Luxembourg Liverpool Hanover Valencia Cleveland Antigua Rhodes Kona Burbank'.split(' '),
);

/** Cities (airport cities first word plus CITY_TABLE), longest name first so "New York" wins over "York". */
const CITIES: readonly { name: string; tz: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const [name, tz] of rows(CITY_TABLE)) seen.set(name, tz);
  for (const a of AIRPORTS.values()) {
    // "Tokyo Haneda" -> "Tokyo"; multi-word cities that are the whole name stay whole ("Hong Kong", "Gold Coast").
    const words = a.city.split(' ');
    const base = words.length > 1 && /^(Haneda|Narita|Kansai|Itami|Incheon|Gimpo|Capital|Daxing|Pudong|Hongqiao|Taoyuan|Songshan|Suvarnabhumi|Don|Heathrow|Gatwick|Stansted|Luton|City|Charles|Orly|Fiumicino|Malpensa|Linate|JFK|LaGuardia|Dulles|National|O'Hare|Avalon|Sabiha|Denpasar|Kahului|Naha|Tianfu|Dabolim|Mopa|World|Imam|Southend|Beauvais|Charleroi|Bonn|Bergamo|Ciampino|Treviso|Modlin|Sheremetyevo|Domodedovo|Midway|Hobby|Love|Billy|Felipe|Congonhas|U-Tapao|Caticlan|South|North)$/.test(words[1]) ? words[0] : a.city;
    if (!seen.has(base) && !NOT_CITY.has(base)) seen.set(base, a.tz);
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
