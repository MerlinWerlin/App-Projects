// T72 strings: Settings > Licences and credits (data sources, fonts and icons, libraries, services, Satchel's own
// content). The rows themselves are src/core/licences.ts. Keys prefixed "licences.".
export const licences = {
  'licences.title': 'Licences and credits',
  'licences.open': 'Licences and credits',
  'licences.openHint': 'Map data, weather data, fonts and the open-source libraries Satchel uses, with their licences.',
  'licences.intro': 'Satchel is built on other people’s work. Here is what it uses, and the licence each one comes with.',

  'licences.sectionData': 'Map and weather data',
  'licences.sectionFonts': 'Fonts and icons',
  'licences.sectionLibraries': 'Open-source libraries',
  'licences.sectionPlatform': 'Services the app calls',
  'licences.sectionContent': 'Satchel’s own content',

  'licences.osm.what': 'Offline city maps, points of interest, the Toilets tab and Nearest help.',
  'licences.osm.credit': '© OpenStreetMap contributors. The data is available under the Open Database Licence.',
  'licences.protomaps.what': 'The offline city map pictures are drawn from Protomaps’ OpenStreetMap build.',
  'licences.met.what': 'The weather forecast on the trip screen, fetched only while you have signal.',
  'licences.met.credit': 'Weather data: MET Norway (the Norwegian Meteorological Institute), licensed under CC BY 4.0.',
  'licences.noaa.what': 'Sunrise, sunset and twilight are worked out on your phone with these equations. Nothing is fetched.',
  'licences.inter.what': 'The body text.',
  'licences.spaceGrotesk.what': 'The headings.',
  'licences.ionicons.what': 'The icons, including the weather icons.',
  'licences.expo.what': 'The app’s building blocks: files, photos, location, battery, sharing, updates and more.',
  'licences.systemMap.what': 'The map underneath is your phone’s own map, under Apple’s terms. It never receives your trips.',
  'licences.updates.what': 'App updates come from Expo’s update service. It never receives your trips.',
  'licences.content.emergency': 'Written for Satchel and not yet checked against official sources. Always check numbers locally.',
  'licences.content.samples': 'The sample trip and its map points are invented, not real bookings or places.',
  'licences.content.art': 'Original art made for Satchel. No logos or brand marks.',

  'licences.licence': 'Licence: {licence}',
  'licences.read': 'Read the {name} licence',
  'licences.linkHint': 'Opens the web page in your browser.',
  'licences.linkFailed': 'Couldn’t open the page. The address is {url}',
  'licences.footnote': 'Licences as each project publishes them. Full licence texts come with the app’s source code.',
} as const;
