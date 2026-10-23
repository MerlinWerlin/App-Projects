// App catalogue: popular apps (AU / US / UK + system apps) with their public URL schemes.
//
// Rules for urlScheme:
//  - Only schemes that are publicly known are listed; nothing is guessed. When unknown the
//    value is null and the app is installed with the Shortcuts method instead.
//  - verified: true only for schemes that are widely documented (by Apple, the vendor's own
//    developer docs, or long-standing public references). Community-known schemes that are
//    not officially documented are verified: false and should be tested on device.
//  - A scheme ends with ':' or '://'.
// glyph is a GENERIC glyph name: Feather (@expo/vector-icons) or one of Glaze's in-house glyphs
// (src/core/glyphnames.ts). Never a brand logo. App names are labels only; no logos ship.
// Pure TypeScript (no React Native / Expo imports) so Node can run it directly.

export type CatalogueEntry = {
  id: string;
  name: string;
  category: string;
  urlScheme: string | null;
  verified: boolean;
  glyph: string;
  aliases: string[];
};

export const CATEGORIES = [
  'System',
  'Social',
  'Messaging',
  'Music & Audio',
  'Video & TV',
  'Photo & Design',
  'Productivity',
  'Finance',
  'Shopping',
  'Food & Drink',
  'Travel & Transport',
  'Health & Fitness',
  'News & Reading',
  'Utilities',
  'Education',
  'Games',
] as const;

export type Category = (typeof CATEGORIES)[number];

// Row: [id, name, category, urlScheme, verified, glyph, aliases]
type Row = [string, string, Category, string | null, boolean, string, string[]];

const ROWS: Row[] = [
  // ---- System (iOS)
  ['camera', 'Camera', 'System', null, false, 'camera', ['photo', 'selfie']],
  ['photos', 'Photos', 'System', 'photos-redirect://', true, 'image', ['gallery', 'pictures', 'camera roll']],
  ['settings', 'Settings', 'System', 'App-prefs:', false, 'settings', ['preferences', 'prefs']],
  ['messages', 'Messages', 'System', 'sms:', true, 'message-circle', ['sms', 'imessage', 'texts']],
  ['phone', 'Phone', 'System', 'tel:', true, 'phone', ['call', 'dialer']],
  ['mail', 'Mail', 'System', 'message://', true, 'mail', ['email', 'inbox']],
  ['safari', 'Safari', 'System', 'x-web-search://', false, 'compass', ['browser', 'web', 'internet']],
  ['maps', 'Maps', 'System', 'maps://', true, 'map', ['directions', 'apple maps']],
  ['music', 'Music', 'System', 'music://', true, 'music', ['apple music', 'songs']],
  ['calendar', 'Calendar', 'System', 'calshow:', true, 'calendar', ['events', 'schedule']],
  ['notes', 'Notes', 'System', 'mobilenotes://', true, 'file-text', ['memo']],
  ['clock', 'Clock', 'System', 'clock-worldclock://', false, 'clock', ['alarm', 'timer', 'stopwatch']],
  ['weather', 'Weather', 'System', 'weather://', false, 'cloud', ['forecast']],
  ['reminders', 'Reminders', 'System', 'x-apple-reminderkit://', false, 'check-square', ['todo', 'tasks']],
  ['facetime', 'FaceTime', 'System', 'facetime://', true, 'video', ['video call']],
  ['app-store', 'App Store', 'System', 'itms-apps://', true, 'download', ['apps', 'store']],
  ['podcasts', 'Podcasts', 'System', 'podcasts://', true, 'mic', ['podcast']],
  ['books', 'Books', 'System', 'ibooks://', true, 'book-open', ['ibooks', 'ebooks', 'audiobooks']],
  ['files', 'Files', 'System', 'shareddocuments://', false, 'folder', ['documents', 'finder']],
  ['health', 'Health', 'System', 'x-apple-health://', false, 'heart', ['steps', 'medical']],
  ['wallet', 'Wallet', 'System', 'shoebox://', false, 'credit-card', ['apple pay', 'cards', 'passes']],
  ['shortcuts', 'Shortcuts', 'System', 'shortcuts://', true, 'layers', ['automation', 'workflow']],
  ['find-my', 'Find My', 'System', 'findmy://', false, 'map-pin', ['find my iphone', 'locate']],
  ['home', 'Home', 'System', 'com.apple.home://', false, 'home', ['homekit', 'smart home']],
  ['tv', 'TV', 'System', 'videos://', false, 'tv', ['apple tv', 'videos']],
  ['contacts', 'Contacts', 'System', null, false, 'users', ['address book', 'people']],
  ['calculator', 'Calculator', 'System', null, false, 'divide-square', ['calc', 'maths', 'math']],
  ['voice-memos', 'Voice Memos', 'System', 'voicememos://', false, 'mic', ['recorder', 'dictaphone']],
  ['stocks', 'Stocks', 'System', 'stocks://', false, 'trending-up', ['shares', 'market']],
  ['fitness', 'Fitness', 'System', null, false, 'activity', ['workout', 'rings']],
  ['translate', 'Translate', 'System', null, false, 'globe', ['translation', 'language']],
  ['news', 'News', 'System', 'applenews://', false, 'rss', ['apple news', 'headlines']],
  ['freeform', 'Freeform', 'System', null, false, 'edit-3', ['whiteboard']],
  ['journal', 'Journal', 'System', null, false, 'book', ['diary']],
  ['passwords', 'Passwords', 'System', null, false, 'key', ['keychain', 'logins']],
  ['compass', 'Compass', 'System', null, false, 'navigation', ['direction', 'level']],
  ['measure', 'Measure', 'System', null, false, 'maximize', ['ruler', 'level']],
  ['tips', 'Tips', 'System', null, false, 'info', ['help']],
  ['magnifier', 'Magnifier', 'System', null, false, 'search', ['zoom', 'magnifying glass']],

  // ---- Social
  ['instagram', 'Instagram', 'Social', 'instagram://', true, 'camera', ['insta', 'ig', 'reels']],
  ['facebook', 'Facebook', 'Social', 'fb://', true, 'users', ['fb', 'meta']],
  ['x', 'X', 'Social', 'twitter://', true, 'at-sign', ['twitter', 'tweet']],
  ['tiktok', 'TikTok', 'Social', 'snssdk1233://', false, 'music', ['tik tok']],
  ['snapchat', 'Snapchat', 'Social', 'snapchat://', true, 'smile', ['snap']],
  ['threads', 'Threads', 'Social', 'barcelona://', false, 'at-sign', ['meta threads']],
  ['pinterest', 'Pinterest', 'Social', 'pinterest://', true, 'bookmark', ['pins', 'boards']],
  ['reddit', 'Reddit', 'Social', 'reddit://', false, 'message-square', ['subreddit']],
  ['linkedin', 'LinkedIn', 'Social', 'linkedin://', false, 'briefcase', ['jobs', 'professional']],
  ['tumblr', 'Tumblr', 'Social', 'tumblr://', true, 'edit', ['blog']],
  ['bereal', 'BeReal', 'Social', null, false, 'camera', ['be real']],
  ['bluesky', 'Bluesky', 'Social', 'bluesky://', false, 'cloud', ['bsky']],
  ['nextdoor', 'Nextdoor', 'Social', null, false, 'home', ['neighbours', 'neighbors']],
  ['tinder', 'Tinder', 'Social', null, false, 'heart', ['dating']],
  ['bumble', 'Bumble', 'Social', null, false, 'heart', ['dating']],
  ['hinge', 'Hinge', 'Social', null, false, 'heart', ['dating']],

  // ---- Messaging
  ['whatsapp', 'WhatsApp', 'Messaging', 'whatsapp://', true, 'message-circle', ['whats app', 'wa']],
  ['messenger', 'Messenger', 'Messaging', 'fb-messenger://', true, 'message-circle', ['facebook messenger']],
  ['telegram', 'Telegram', 'Messaging', 'tg://', true, 'send', ['tg']],
  ['signal', 'Signal', 'Messaging', 'sgnl://', false, 'message-square', ['private messenger']],
  ['discord', 'Discord', 'Messaging', 'discord://', false, 'headphones', ['servers', 'gaming chat']],
  ['slack', 'Slack', 'Messaging', 'slack://', true, 'hash', ['work chat']],
  ['microsoft-teams', 'Microsoft Teams', 'Messaging', 'msteams://', false, 'users', ['teams', 'ms teams']],
  ['zoom', 'Zoom', 'Messaging', 'zoomus://', true, 'video', ['meetings', 'video call']],
  ['google-meet', 'Google Meet', 'Messaging', null, false, 'video', ['meet', 'hangouts']],
  ['skype', 'Skype', 'Messaging', 'skype:', true, 'phone-call', ['calls']],
  ['viber', 'Viber', 'Messaging', 'viber://', false, 'phone-call', ['rakuten viber']],
  ['wechat', 'WeChat', 'Messaging', 'weixin://', false, 'message-circle', ['weixin']],
  ['line', 'LINE', 'Messaging', 'line://', false, 'message-square', ['line messenger']],

  // ---- Music & Audio
  ['spotify', 'Spotify', 'Music & Audio', 'spotify:', true, 'music', ['songs', 'playlists']],
  ['youtube-music', 'YouTube Music', 'Music & Audio', 'youtubemusic://', false, 'play-circle', ['yt music']],
  ['amazon-music', 'Amazon Music', 'Music & Audio', null, false, 'music', ['prime music']],
  ['soundcloud', 'SoundCloud', 'Music & Audio', 'soundcloud://', false, 'cloud', ['sound cloud']],
  ['shazam', 'Shazam', 'Music & Audio', 'shazam://', false, 'disc', ['song finder', 'identify music']],
  ['pandora', 'Pandora', 'Music & Audio', 'pandora://', false, 'radio', ['radio']],
  ['tidal', 'TIDAL', 'Music & Audio', null, false, 'disc', ['hifi']],
  ['deezer', 'Deezer', 'Music & Audio', 'deezer://', false, 'music', []],
  ['audible', 'Audible', 'Music & Audio', 'audible://', false, 'headphones', ['audiobooks']],
  ['overcast', 'Overcast', 'Music & Audio', 'overcast://', false, 'mic', ['podcasts']],
  ['pocket-casts', 'Pocket Casts', 'Music & Audio', 'pktc://', false, 'mic', ['podcasts']],
  ['bbc-sounds', 'BBC Sounds', 'Music & Audio', null, false, 'radio', ['bbc radio', 'iplayer radio']],

  // ---- Video & TV
  ['youtube', 'YouTube', 'Video & TV', 'youtube://', true, 'play-circle', ['yt', 'videos']],
  ['netflix', 'Netflix', 'Video & TV', 'nflx://', false, 'film', ['movies', 'shows']],
  ['prime-video', 'Prime Video', 'Video & TV', 'aiv://', false, 'film', ['amazon prime', 'amazon video']],
  ['disney-plus', 'Disney+', 'Video & TV', 'disneyplus://', false, 'star', ['disney plus']],
  ['max', 'Max', 'Video & TV', null, false, 'tv', ['hbo', 'hbo max']],
  ['hulu', 'Hulu', 'Video & TV', 'hulu://', false, 'tv', []],
  ['paramount-plus', 'Paramount+', 'Video & TV', null, false, 'tv', ['paramount plus']],
  ['peacock', 'Peacock', 'Video & TV', null, false, 'tv', ['nbc']],
  ['twitch', 'Twitch', 'Video & TV', 'twitch://', true, 'cast', ['streams', 'live']],
  ['stan', 'Stan', 'Video & TV', null, false, 'tv', ['stan au']],
  ['binge', 'BINGE', 'Video & TV', null, false, 'tv', []],
  ['kayo', 'Kayo Sports', 'Video & TV', null, false, 'award', ['kayo', 'sport']],
  ['abc-iview', 'ABC iview', 'Video & TV', null, false, 'tv', ['iview', 'abc']],
  ['sbs-on-demand', 'SBS On Demand', 'Video & TV', null, false, 'tv', ['sbs']],
  ['7plus', '7plus', 'Video & TV', null, false, 'tv', ['seven', 'channel 7']],
  ['9now', '9Now', 'Video & TV', null, false, 'tv', ['nine', 'channel 9']],
  ['bbc-iplayer', 'BBC iPlayer', 'Video & TV', null, false, 'tv', ['iplayer', 'bbc']],
  ['itvx', 'ITVX', 'Video & TV', null, false, 'tv', ['itv']],
  ['channel-4', 'Channel 4', 'Video & TV', null, false, 'tv', ['all 4', 'c4']],
  ['sky-go', 'Sky Go', 'Video & TV', null, false, 'tv', ['sky']],

  // ---- Photo & Design
  ['google-photos', 'Google Photos', 'Photo & Design', 'googlephotos://', false, 'image', ['gphotos']],
  ['vsco', 'VSCO', 'Photo & Design', 'vsco://', false, 'aperture', ['filters']],
  ['snapseed', 'Snapseed', 'Photo & Design', 'snapseed://', false, 'sliders', ['photo editor']],
  ['lightroom', 'Lightroom', 'Photo & Design', null, false, 'sliders', ['adobe lightroom']],
  ['canva', 'Canva', 'Photo & Design', null, false, 'pen-tool', ['design']],
  ['capcut', 'CapCut', 'Photo & Design', null, false, 'scissors', ['video editor']],
  ['procreate-pocket', 'Procreate Pocket', 'Photo & Design', null, false, 'feather', ['drawing', 'procreate']],

  // ---- Productivity
  ['gmail', 'Gmail', 'Productivity', 'googlegmail://', true, 'mail', ['google mail', 'email']],
  ['outlook', 'Outlook', 'Productivity', 'ms-outlook://', true, 'inbox', ['microsoft outlook', 'hotmail', 'email']],
  ['google-drive', 'Google Drive', 'Productivity', 'googledrive://', false, 'folder', ['drive', 'gdrive']],
  ['google-docs', 'Google Docs', 'Productivity', 'googledocs://', false, 'file-text', ['docs']],
  ['google-sheets', 'Google Sheets', 'Productivity', 'googlesheets://', false, 'grid', ['sheets', 'spreadsheet']],
  ['google-calendar', 'Google Calendar', 'Productivity', null, false, 'calendar', ['gcal']],
  ['google-keep', 'Google Keep', 'Productivity', null, false, 'clipboard', ['keep notes']],
  ['word', 'Microsoft Word', 'Productivity', 'ms-word:', true, 'file-text', ['word', 'docx']],
  ['excel', 'Microsoft Excel', 'Productivity', 'ms-excel:', true, 'grid', ['excel', 'spreadsheet', 'xlsx']],
  ['powerpoint', 'Microsoft PowerPoint', 'Productivity', 'ms-powerpoint:', true, 'monitor', ['powerpoint', 'slides', 'pptx']],
  ['onenote', 'Microsoft OneNote', 'Productivity', 'onenote:', true, 'book', ['onenote', 'notebook']],
  ['onedrive', 'OneDrive', 'Productivity', null, false, 'cloud', ['microsoft onedrive']],
  ['dropbox', 'Dropbox', 'Productivity', 'dropbox://', false, 'box', ['files']],
  ['notion', 'Notion', 'Productivity', 'notion://', false, 'edit', ['wiki', 'notes']],
  ['evernote', 'Evernote', 'Productivity', 'evernote://', false, 'file-text', ['notes']],
  ['obsidian', 'Obsidian', 'Productivity', 'obsidian://', true, 'hexagon', ['markdown notes']],
  ['bear', 'Bear', 'Productivity', 'bear://', true, 'edit-3', ['notes']],
  ['drafts', 'Drafts', 'Productivity', 'drafts://', true, 'edit-3', ['quick notes']],
  ['todoist', 'Todoist', 'Productivity', 'todoist://', true, 'check-circle', ['todo', 'tasks']],
  ['things', 'Things 3', 'Productivity', 'things:', true, 'check-square', ['things', 'todo']],
  ['trello', 'Trello', 'Productivity', 'trello://', false, 'columns', ['boards', 'kanban']],
  ['asana', 'Asana', 'Productivity', null, false, 'target', ['projects']],
  ['chatgpt', 'ChatGPT', 'Productivity', null, false, 'cpu', ['openai', 'ai chat']],
  ['claude', 'Claude', 'Productivity', null, false, 'cpu', ['anthropic', 'ai chat']],
  ['gemini', 'Gemini', 'Productivity', null, false, 'cpu', ['google gemini', 'ai chat']],
  ['1password', '1Password', 'Productivity', 'onepassword://', false, 'lock', ['passwords', 'one password']],
  ['google-authenticator', 'Google Authenticator', 'Productivity', null, false, 'shield', ['2fa', 'authenticator']],
  ['microsoft-authenticator', 'Microsoft Authenticator', 'Productivity', null, false, 'shield', ['2fa', 'authenticator']],

  // ---- Utilities (browsers, search, tools)
  ['google', 'Google', 'Utilities', 'google://', false, 'search', ['search', 'google search']],
  ['chrome', 'Chrome', 'Utilities', 'googlechrome://', true, 'globe', ['google chrome', 'browser']],
  ['firefox', 'Firefox', 'Utilities', 'firefox://', true, 'globe', ['mozilla', 'browser']],
  ['edge', 'Microsoft Edge', 'Utilities', null, false, 'globe', ['edge', 'browser']],
  ['duckduckgo', 'DuckDuckGo', 'Utilities', null, false, 'search', ['ddg', 'private browser']],
  ['brave', 'Brave', 'Utilities', null, false, 'shield', ['brave browser']],
  ['google-translate', 'Google Translate', 'Utilities', null, false, 'globe', ['translate']],
  ['google-home', 'Google Home', 'Utilities', null, false, 'home', ['nest', 'smart home']],
  ['ring', 'Ring', 'Utilities', null, false, 'bell', ['doorbell']],
  ['life360', 'Life360', 'Utilities', null, false, 'map-pin', ['family locator']],
  ['bom-weather', 'BOM Weather', 'Utilities', null, false, 'cloud-rain', ['bureau of meteorology', 'bom']],
  ['mygov', 'myGov', 'Utilities', null, false, 'shield', ['my gov', 'centrelink', 'ato']],
  ['service-nsw', 'Service NSW', 'Utilities', null, false, 'clipboard', ['nsw', 'licence']],
  ['nhs-app', 'NHS App', 'Health & Fitness', null, false, 'plus-square', ['nhs', 'gp']],
  ['medicare', 'Express Plus Medicare', 'Health & Fitness', null, false, 'plus-square', ['medicare']],

  // ---- Finance
  ['paypal', 'PayPal', 'Finance', 'paypal://', false, 'dollar-sign', ['payments']],
  ['venmo', 'Venmo', 'Finance', 'venmo://', false, 'dollar-sign', ['payments']],
  ['cash-app', 'Cash App', 'Finance', null, false, 'dollar-sign', ['square cash']],
  ['revolut', 'Revolut', 'Finance', 'revolut://', false, 'credit-card', ['bank']],
  ['wise', 'Wise', 'Finance', null, false, 'repeat', ['transferwise', 'money transfer']],
  ['monzo', 'Monzo', 'Finance', null, false, 'credit-card', ['bank']],
  ['starling', 'Starling Bank', 'Finance', null, false, 'credit-card', ['starling', 'bank']],
  ['barclays', 'Barclays', 'Finance', null, false, 'credit-card', ['bank']],
  ['hsbc', 'HSBC', 'Finance', null, false, 'credit-card', ['bank']],
  ['commbank', 'CommBank', 'Finance', null, false, 'credit-card', ['commonwealth bank', 'cba', 'bank']],
  ['anz', 'ANZ', 'Finance', null, false, 'credit-card', ['anz plus', 'bank']],
  ['westpac', 'Westpac', 'Finance', null, false, 'credit-card', ['bank']],
  ['nab', 'NAB', 'Finance', null, false, 'credit-card', ['national australia bank', 'bank']],
  ['up-bank', 'Up', 'Finance', null, false, 'credit-card', ['up bank', 'bank']],
  ['chase', 'Chase', 'Finance', null, false, 'credit-card', ['jpmorgan', 'bank']],
  ['bank-of-america', 'Bank of America', 'Finance', null, false, 'credit-card', ['boa', 'bofa', 'bank']],
  ['wells-fargo', 'Wells Fargo', 'Finance', null, false, 'credit-card', ['bank']],
  ['robinhood', 'Robinhood', 'Finance', 'robinhood://', false, 'trending-up', ['stocks', 'investing']],
  ['coinbase', 'Coinbase', 'Finance', null, false, 'trending-up', ['crypto', 'bitcoin']],
  ['afterpay', 'Afterpay', 'Finance', null, false, 'shopping-bag', ['buy now pay later', 'bnpl']],

  // ---- Shopping
  ['amazon', 'Amazon', 'Shopping', 'com.amazon.mobile.shopping://', false, 'shopping-cart', ['amazon shopping']],
  ['ebay', 'eBay', 'Shopping', 'ebay://', false, 'tag', ['auctions']],
  ['etsy', 'Etsy', 'Shopping', 'etsy://', false, 'gift', ['handmade']],
  ['temu', 'Temu', 'Shopping', null, false, 'shopping-bag', []],
  ['shein', 'SHEIN', 'Shopping', null, false, 'shopping-bag', ['fashion']],
  ['asos', 'ASOS', 'Shopping', null, false, 'shopping-bag', ['fashion']],
  ['vinted', 'Vinted', 'Shopping', null, false, 'tag', ['second hand', 'preloved']],
  ['depop', 'Depop', 'Shopping', null, false, 'tag', ['second hand', 'preloved']],
  ['target', 'Target', 'Shopping', null, false, 'target', []],
  ['walmart', 'Walmart', 'Shopping', null, false, 'shopping-cart', []],
  ['kmart', 'Kmart', 'Shopping', null, false, 'shopping-bag', []],
  ['bunnings', 'Bunnings', 'Shopping', null, false, 'tool', ['hardware', 'diy']],
  ['ikea', 'IKEA', 'Shopping', null, false, 'package', ['furniture']],
  ['woolworths', 'Woolworths', 'Shopping', null, false, 'shopping-cart', ['woolies', 'groceries']],
  ['coles', 'Coles', 'Shopping', null, false, 'shopping-cart', ['groceries']],
  ['tesco', 'Tesco', 'Shopping', null, false, 'shopping-cart', ['groceries', 'clubcard']],
  ['sainsburys', "Sainsbury's", 'Shopping', null, false, 'shopping-cart', ['sainsburys', 'groceries']],
  ['gumtree', 'Gumtree', 'Shopping', null, false, 'tag', ['classifieds']],

  // ---- Food & Drink
  ['uber-eats', 'Uber Eats', 'Food & Drink', 'ubereats://', false, 'shopping-bag', ['food delivery']],
  ['doordash', 'DoorDash', 'Food & Drink', 'doordash://', false, 'truck', ['food delivery']],
  ['deliveroo', 'Deliveroo', 'Food & Drink', null, false, 'truck', ['food delivery']],
  ['menulog', 'Menulog', 'Food & Drink', null, false, 'truck', ['food delivery']],
  ['just-eat', 'Just Eat', 'Food & Drink', null, false, 'truck', ['food delivery']],
  ['grubhub', 'Grubhub', 'Food & Drink', null, false, 'truck', ['food delivery']],
  ['instacart', 'Instacart', 'Food & Drink', null, false, 'shopping-cart', ['groceries']],
  ['starbucks', 'Starbucks', 'Food & Drink', null, false, 'coffee', ['coffee']],
  ['mcdonalds', "McDonald's", 'Food & Drink', null, false, 'coffee', ['mcdonalds', 'maccas']],

  // ---- Travel & Transport
  ['uber', 'Uber', 'Travel & Transport', 'uber://', true, 'navigation', ['rideshare', 'taxi']],
  ['lyft', 'Lyft', 'Travel & Transport', 'lyft://', true, 'navigation', ['rideshare', 'taxi']],
  ['bolt', 'Bolt', 'Travel & Transport', null, false, 'zap', ['rideshare', 'taxi']],
  ['didi', 'DiDi', 'Travel & Transport', null, false, 'navigation', ['rideshare', 'taxi']],
  ['google-maps', 'Google Maps', 'Travel & Transport', 'comgooglemaps://', true, 'map', ['gmaps', 'directions']],
  ['waze', 'Waze', 'Travel & Transport', 'waze://', true, 'navigation-2', ['traffic', 'directions']],
  ['citymapper', 'Citymapper', 'Travel & Transport', 'citymapper://', true, 'map-pin', ['transit', 'public transport']],
  ['google-earth', 'Google Earth', 'Travel & Transport', 'comgoogleearth://', false, 'globe', ['earth']],
  ['airbnb', 'Airbnb', 'Travel & Transport', 'airbnb://', false, 'home', ['stays', 'holiday rental']],
  ['booking', 'Booking.com', 'Travel & Transport', 'booking://', false, 'briefcase', ['booking', 'hotels']],
  ['expedia', 'Expedia', 'Travel & Transport', null, false, 'briefcase', ['hotels', 'flights']],
  ['skyscanner', 'Skyscanner', 'Travel & Transport', null, false, 'send', ['flights']],
  ['tripadvisor', 'Tripadvisor', 'Travel & Transport', null, false, 'eye', ['reviews', 'travel']],
  ['qantas', 'Qantas', 'Travel & Transport', null, false, 'send', ['airline', 'flights']],
  ['trainline', 'Trainline', 'Travel & Transport', null, false, 'navigation', ['trains', 'rail']],
  ['opal-travel', 'Opal Travel', 'Travel & Transport', null, false, 'credit-card', ['opal', 'sydney transport']],
  ['tripview', 'TripView', 'Travel & Transport', null, false, 'clock', ['timetables', 'transit']],

  // ---- Health & Fitness
  ['strava', 'Strava', 'Health & Fitness', 'strava://', false, 'activity', ['running', 'cycling']],
  ['fitbit', 'Fitbit', 'Health & Fitness', 'fitbit://', false, 'watch', ['steps']],
  ['myfitnesspal', 'MyFitnessPal', 'Health & Fitness', 'mfp://', false, 'pie-chart', ['calories', 'diet']],
  ['headspace', 'Headspace', 'Health & Fitness', 'headspace://', false, 'smile', ['meditation', 'mindfulness']],
  ['calm', 'Calm', 'Health & Fitness', 'calm://', false, 'moon', ['meditation', 'sleep']],
  ['nike-run-club', 'Nike Run Club', 'Health & Fitness', null, false, 'activity', ['nrc', 'running']],
  ['peloton', 'Peloton', 'Health & Fitness', null, false, 'activity', ['workouts', 'cycling']],
  ['alltrails', 'AllTrails', 'Health & Fitness', null, false, 'map', ['hiking', 'trails']],
  ['garmin-connect', 'Garmin Connect', 'Health & Fitness', null, false, 'watch', ['garmin']],
  ['sleep-cycle', 'Sleep Cycle', 'Health & Fitness', null, false, 'moon', ['sleep', 'alarm']],
  ['flo', 'Flo', 'Health & Fitness', null, false, 'droplet', ['period tracker', 'cycle']],
  ['oura', 'Oura', 'Health & Fitness', null, false, 'circle', ['ring', 'sleep']],

  // ---- News & Reading
  ['kindle', 'Kindle', 'News & Reading', 'kindle://', false, 'book-open', ['ebooks', 'amazon kindle']],
  ['goodreads', 'Goodreads', 'News & Reading', null, false, 'book', ['books', 'reading list']],
  ['libby', 'Libby', 'News & Reading', null, false, 'book', ['library']],
  ['medium', 'Medium', 'News & Reading', 'medium://', false, 'file-text', ['articles', 'blogs']],
  ['bbc-news', 'BBC News', 'News & Reading', null, false, 'rss', ['bbc']],
  ['abc-news', 'ABC News', 'News & Reading', null, false, 'rss', ['abc']],
  ['the-guardian', 'The Guardian', 'News & Reading', null, false, 'rss', ['guardian']],
  ['nytimes', 'The New York Times', 'News & Reading', 'nytimes://', false, 'rss', ['nyt', 'new york times']],
  ['espn', 'ESPN', 'News & Reading', 'sportscenter://', false, 'award', ['sports', 'scores']],
  ['realestate', 'realestate.com.au', 'Utilities', null, false, 'home', ['rea', 'property', 'real estate']],
  ['domain', 'Domain', 'Utilities', null, false, 'home', ['property', 'real estate']],
  ['rightmove', 'Rightmove', 'Utilities', null, false, 'home', ['property', 'real estate']],
  ['zillow', 'Zillow', 'Utilities', 'zillow://', false, 'home', ['property', 'real estate']],
  ['seek', 'SEEK', 'Utilities', null, false, 'briefcase', ['jobs']],
  ['yelp', 'Yelp', 'Utilities', 'yelp://', false, 'star', ['reviews', 'restaurants']],

  // ---- Education
  ['duolingo', 'Duolingo', 'Education', 'duolingo://', false, 'globe', ['languages', 'learn']],
  ['khan-academy', 'Khan Academy', 'Education', null, false, 'book-open', ['learn', 'school']],
  ['google-classroom', 'Google Classroom', 'Education', null, false, 'users', ['classroom', 'school']],
  ['photomath', 'Photomath', 'Education', null, false, 'divide-square', ['maths', 'homework']],
  ['quizlet', 'Quizlet', 'Education', null, false, 'layers', ['flashcards', 'study']],

  // ---- Games
  ['roblox', 'Roblox', 'Games', 'roblox://', false, 'box', ['games']],
  ['minecraft', 'Minecraft', 'Games', 'minecraft://', false, 'box', ['games', 'mc']],
  ['pokemon-go', 'Pokémon GO', 'Games', null, false, 'target', ['pokemon go', 'pogo']],
  ['candy-crush', 'Candy Crush Saga', 'Games', null, false, 'grid', ['candy crush']],
  ['clash-royale', 'Clash Royale', 'Games', null, false, 'award', ['clash']],
  ['chess', 'Chess.com', 'Games', null, false, 'grid', ['chess']],
  ['wordscapes', 'Wordscapes', 'Games', null, false, 'type', ['word game']],

  // ---- Added in T28 (owner review §6). URL schemes are left null unless publicly documented:
  //      these apps install with the Shortcuts method until a scheme is confirmed on a device.
  // Games
  ['among-us', 'Among Us', 'Games', null, false, 'users', ['impostor', 'crewmate']],
  ['call-of-duty-mobile', 'Call of Duty: Mobile', 'Games', null, false, 'crosshair', ['cod', 'cod mobile']],
  ['pubg-mobile', 'PUBG Mobile', 'Games', null, false, 'crosshair', ['pubg', 'battle royale']],
  ['free-fire', 'Free Fire', 'Games', null, false, 'crosshair', ['garena', 'battle royale']],
  ['genshin-impact', 'Genshin Impact', 'Games', null, false, 'wind', ['genshin', 'rpg']],
  ['honkai-star-rail', 'Honkai: Star Rail', 'Games', null, false, 'star', ['hsr', 'honkai']],
  ['clash-of-clans', 'Clash of Clans', 'Games', null, false, 'shield', ['coc', 'clash']],
  ['brawl-stars', 'Brawl Stars', 'Games', null, false, 'star', ['brawl']],
  ['subway-surfers', 'Subway Surfers', 'Games', null, false, 'zap', ['endless runner']],
  ['temple-run-2', 'Temple Run 2', 'Games', null, false, 'navigation', ['temple run']],
  ['angry-birds-2', 'Angry Birds 2', 'Games', null, false, 'target', ['angry birds']],
  ['monopoly-go', 'Monopoly GO!', 'Games', null, false, 'home', ['monopoly', 'board game']],
  ['royal-match', 'Royal Match', 'Games', null, false, 'award', ['match 3', 'puzzle']],
  ['coin-master', 'Coin Master', 'Games', null, false, 'dollar-sign', ['spin']],
  ['gardenscapes', 'Gardenscapes', 'Games', null, false, 'leaf', ['match 3']],
  ['township', 'Township', 'Games', null, false, 'home', ['farm', 'city builder']],
  ['hay-day', 'Hay Day', 'Games', null, false, 'sun', ['farm']],
  ['stumble-guys', 'Stumble Guys', 'Games', null, false, 'smile', ['party game']],
  ['8-ball-pool', '8 Ball Pool', 'Games', null, false, 'circle', ['pool', 'billiards']],
  ['words-with-friends', 'Words With Friends 2', 'Games', null, false, 'type', ['words with friends', 'wwf']],
  ['nyt-games', 'NYT Games', 'Games', null, false, 'grid', ['wordle', 'crossword', 'connections', 'spelling bee']],
  ['sudoku-com', 'Sudoku.com', 'Games', null, false, 'grid', ['sudoku', 'puzzle']],
  ['block-blast', 'Block Blast!', 'Games', null, false, 'grid', ['block puzzle']],
  ['toca-boca-world', 'Toca Boca World', 'Games', null, false, 'home', ['toca world', 'toca life', 'kids']],
  ['my-talking-tom-2', 'My Talking Tom 2', 'Games', null, false, 'smile', ['talking tom', 'virtual pet']],
  ['geometry-dash', 'Geometry Dash', 'Games', null, false, 'triangle', ['rhythm']],
  ['hill-climb-racing', 'Hill Climb Racing', 'Games', null, false, 'car', ['racing']],
  ['ea-sports-fc-mobile', 'EA SPORTS FC Mobile', 'Games', null, false, 'award', ['fifa mobile', 'football', 'soccer']],
  ['pokemon-tcg-pocket', 'Pokémon TCG Pocket', 'Games', null, false, 'layers', ['pokemon cards', 'tcg']],
  ['marvel-snap', 'Marvel Snap', 'Games', null, false, 'layers', ['card game']],
  ['mario-kart-tour', 'Mario Kart Tour', 'Games', null, false, 'car', ['mario kart', 'racing']],
  ['stardew-valley', 'Stardew Valley', 'Games', null, false, 'sun', ['farming']],
  ['plants-vs-zombies', 'Plants vs. Zombies', 'Games', null, false, 'leaf', ['pvz']],
  ['fruit-ninja', 'Fruit Ninja', 'Games', null, false, 'scissors', ['arcade']],
  ['monument-valley', 'Monument Valley', 'Games', null, false, 'triangle', ['puzzle']],
  ['candy-crush-soda', 'Candy Crush Soda Saga', 'Games', null, false, 'droplet', ['candy crush soda']],
  ['mobile-legends', 'Mobile Legends: Bang Bang', 'Games', null, false, 'shield', ['mlbb', 'moba']],
  ['the-sims-freeplay', 'The Sims FreePlay', 'Games', null, false, 'home', ['sims']],
  ['golf-clash', 'Golf Clash', 'Games', null, false, 'flag', ['golf']],
  ['uno', 'UNO!', 'Games', null, false, 'layers', ['uno cards', 'card game']],
  ['trivia-crack', 'Trivia Crack', 'Games', null, false, 'help-circle', ['trivia', 'quiz']],
  ['heads-up', 'Heads Up!', 'Games', null, false, 'smile', ['charades', 'party game']],
  ['ludo-king', 'Ludo King', 'Games', null, false, 'grid', ['ludo', 'board game']],
  ['bitlife', 'BitLife', 'Games', null, false, 'user', ['life simulator']],
  ['solitaire-collection', 'Microsoft Solitaire Collection', 'Games', null, false, 'layers', ['solitaire', 'cards']],
  ['xbox', 'Xbox', 'Games', null, false, 'game-controller', ['xbox app', 'game pass']],
  ['playstation', 'PlayStation App', 'Games', null, false, 'game-controller', ['ps5', 'psn', 'playstation']],
  ['nintendo-switch', 'Nintendo Switch App', 'Games', null, false, 'game-controller', ['nintendo', 'switch online']],

  // Social & messaging
  ['lemon8', 'Lemon8', 'Social', null, false, 'image', ['lemon 8', 'lifestyle']],
  ['mastodon', 'Mastodon', 'Social', null, false, 'at-sign', ['fediverse']],
  ['quora', 'Quora', 'Social', null, false, 'help-circle', ['questions', 'answers']],
  ['meetup', 'Meetup', 'Social', null, false, 'users', ['events', 'groups']],
  ['kakaotalk', 'KakaoTalk', 'Messaging', null, false, 'message-circle', ['kakao']],
  ['threema', 'Threema', 'Messaging', null, false, 'lock', ['private messenger']],
  ['google-chat', 'Google Chat', 'Messaging', null, false, 'message-square', ['gchat']],
  ['webex', 'Webex', 'Messaging', null, false, 'video', ['cisco webex', 'meetings']],
  ['groupme', 'GroupMe', 'Messaging', null, false, 'users', ['group chat']],

  // Entertainment & streaming
  ['crunchyroll', 'Crunchyroll', 'Video & TV', null, false, 'play-circle', ['anime']],
  ['plex', 'Plex', 'Video & TV', null, false, 'play', ['media server']],
  ['youtube-kids', 'YouTube Kids', 'Video & TV', null, false, 'play-circle', ['yt kids', 'kids videos']],
  ['tubi', 'Tubi', 'Video & TV', null, false, 'tv', ['free movies']],
  ['pluto-tv', 'Pluto TV', 'Video & TV', null, false, 'tv', ['pluto', 'free tv']],
  ['foxtel-go', 'Foxtel GO', 'Video & TV', null, false, 'tv', ['foxtel']],
  ['britbox', 'BritBox', 'Video & TV', null, false, 'tv', ['brit box']],
  ['now', 'NOW', 'Video & TV', null, false, 'tv', ['now tv', 'sky now']],
  ['vimeo', 'Vimeo', 'Video & TV', null, false, 'video', ['videos']],
  ['letterboxd', 'Letterboxd', 'Video & TV', null, false, 'film', ['film diary', 'movie reviews']],
  ['imdb', 'IMDb', 'Video & TV', null, false, 'film', ['movie database', 'cast']],
  ['formula-1', 'F1 TV', 'Video & TV', null, false, 'flag', ['formula 1', 'f1', 'formula one']],
  ['iheartradio', 'iHeartRadio', 'Music & Audio', null, false, 'radio', ['iheart', 'radio']],
  ['tunein', 'TuneIn Radio', 'Music & Audio', null, false, 'radio', ['tunein', 'radio']],
  ['bandcamp', 'Bandcamp', 'Music & Audio', null, false, 'disc', ['indie music']],
  ['listnr', 'LiSTNR', 'Music & Audio', null, false, 'radio', ['listnr', 'australian radio']],
  ['garageband', 'GarageBand', 'Music & Audio', null, false, 'speaker', ['garage band', 'make music']],

  // Productivity & education
  ['microsoft-copilot', 'Microsoft Copilot', 'Productivity', null, false, 'cpu', ['copilot', 'ai chat']],
  ['perplexity', 'Perplexity', 'Productivity', null, false, 'cpu', ['ai search']],
  ['microsoft-to-do', 'Microsoft To Do', 'Productivity', null, false, 'check-square', ['ms todo', 'to do', 'tasks']],
  ['google-tasks', 'Google Tasks', 'Productivity', null, false, 'check-circle', ['tasks', 'todo']],
  ['ticktick', 'TickTick', 'Productivity', null, false, 'check-square', ['tasks', 'todo']],
  ['fantastical', 'Fantastical', 'Productivity', null, false, 'calendar', ['calendar app']],
  ['adobe-acrobat', 'Adobe Acrobat Reader', 'Productivity', null, false, 'file', ['pdf', 'acrobat']],
  ['google-slides', 'Google Slides', 'Productivity', null, false, 'monitor', ['slides', 'presentations']],
  ['pages', 'Pages', 'Productivity', null, false, 'file-text', ['apple pages', 'documents']],
  ['numbers', 'Numbers', 'Productivity', null, false, 'bar-chart', ['apple numbers', 'spreadsheet']],
  ['keynote', 'Keynote', 'Productivity', null, false, 'monitor', ['apple keynote', 'presentations']],
  ['goodnotes', 'Goodnotes', 'Productivity', null, false, 'edit-3', ['handwriting', 'notes']],
  ['forest-focus', 'Forest', 'Productivity', null, false, 'leaf', ['focus timer', 'pomodoro']],
  ['canvas-student', 'Canvas Student', 'Education', null, false, 'book-open', ['canvas', 'uni', 'school']],
  ['brainly', 'Brainly', 'Education', null, false, 'help-circle', ['homework help']],
  ['simply-piano', 'Simply Piano', 'Education', null, false, 'music', ['piano lessons']],
  ['babbel', 'Babbel', 'Education', null, false, 'globe', ['languages']],
  ['coursera', 'Coursera', 'Education', null, false, 'award', ['online courses']],
  ['kahoot', 'Kahoot!', 'Education', null, false, 'help-circle', ['kahoot', 'quiz']],
  ['classdojo', 'ClassDojo', 'Education', null, false, 'users', ['class dojo', 'school']],
  ['mathletics', 'Mathletics', 'Education', null, false, 'divide-square', ['maths practice']],

  // Everyday utilities
  ['speedtest', 'Speedtest', 'Utilities', null, false, 'activity', ['internet speed', 'wifi test']],
  ['authy', 'Authy', 'Utilities', null, false, 'shield', ['2fa', 'authenticator']],
  ['google-one', 'Google One', 'Utilities', null, false, 'cloud', ['storage', 'backup']],
  ['opera', 'Opera', 'Utilities', null, false, 'globe', ['opera browser', 'browser']],
  ['microsoft-bing', 'Microsoft Bing', 'Utilities', null, false, 'search', ['bing', 'search']],
  ['tile', 'Tile', 'Utilities', null, false, 'map-pin', ['tracker', 'lost keys']],
  ['accuweather', 'AccuWeather', 'Utilities', null, false, 'sun', ['forecast']],
  ['windy', 'Windy.com', 'Utilities', null, false, 'wind', ['windy', 'wind map']],
  ['amazon-alexa', 'Amazon Alexa', 'Utilities', null, false, 'speaker', ['alexa', 'echo', 'smart home']],
  ['nordvpn', 'NordVPN', 'Utilities', null, false, 'shield', ['vpn']],

  // Other popular categories
  ['picsart', 'Picsart', 'Photo & Design', null, false, 'image', ['photo editor', 'stickers']],
  ['inshot', 'InShot', 'Photo & Design', null, false, 'film', ['video editor']],
  ['adobe-express', 'Adobe Express', 'Photo & Design', null, false, 'pen-tool', ['graphics', 'design']],
  ['imovie', 'iMovie', 'Photo & Design', null, false, 'film', ['video editor']],
  ['clue', 'Clue', 'Health & Fitness', null, false, 'droplet', ['period tracker', 'cycle']],
  ['nike-training-club', 'Nike Training Club', 'Health & Fitness', null, false, 'dumbbell', ['ntc', 'workouts']],
  ['finch', 'Finch', 'Health & Fitness', null, false, 'smile', ['self care', 'habit']],
  ['klarna', 'Klarna', 'Finance', null, false, 'shopping-bag', ['buy now pay later', 'bnpl']],
  ['zip-pay', 'Zip', 'Finance', null, false, 'shopping-bag', ['zip pay', 'zip money', 'bnpl']],
  ['splitwise', 'Splitwise', 'Finance', null, false, 'divide', ['split bills']],
  ['aliexpress', 'AliExpress', 'Shopping', null, false, 'package', ['ali express']],
  ['jb-hi-fi', 'JB Hi-Fi', 'Shopping', null, false, 'speaker', ['jb hifi', 'electronics']],
  ['dominos', "Domino's", 'Food & Drink', null, false, 'pizza', ['dominos', 'pizza']],
  ['kfc', 'KFC', 'Food & Drink', null, false, 'utensils', ['kentucky fried chicken']],
  ['too-good-to-go', 'Too Good To Go', 'Food & Drink', null, false, 'leaf', ['food waste', 'surprise bag']],
  ['jetstar', 'Jetstar', 'Travel & Transport', null, false, 'plane', ['airline', 'flights']],
  ['transit', 'Transit', 'Travel & Transport', null, false, 'map-pin', ['public transport', 'bus times']],
  ['tfl-go', 'TfL Go', 'Travel & Transport', null, false, 'navigation', ['tfl', 'london transport', 'tube']],
  ['flipboard', 'Flipboard', 'News & Reading', null, false, 'book-open', ['magazine']],
  ['substack', 'Substack', 'News & Reading', null, false, 'file-text', ['newsletters']],
  ['webtoon', 'WEBTOON', 'News & Reading', null, false, 'book-open', ['comics', 'manhwa']],
];

/** How an app can be installed. */
export type SupportStatus = 'verified' | 'unverified' | 'shortcuts';

/**
 * Install support for a catalogue entry or a user-added app:
 *  - 'verified': a widely documented URL scheme (one-tap profile install).
 *  - 'unverified': a known but undocumented scheme (profile install; test on device).
 *  - 'shortcuts': no URL scheme, so the icon is installed with the Shortcuts method.
 * User-added apps never count as verified.
 */
export function support(entry: { urlScheme: string | null; verified?: boolean }): SupportStatus {
  const scheme = typeof entry.urlScheme === 'string' ? entry.urlScheme.trim() : '';
  if (!scheme) return 'shortcuts';
  return entry.verified === true ? 'verified' : 'unverified';
}

/** Short badge text for a support status (picker rows). */
export const SUPPORT_LABELS: Readonly<Record<SupportStatus, string>> = Object.freeze({
  verified: 'One-tap install',
  unverified: 'Scheme not yet checked',
  shortcuts: 'Shortcuts only',
});

/** The owner's catalogue groups (review §6), each a set of catalogue categories. Every category is in exactly one. */
export const CATEGORY_GROUPS: readonly { id: string; name: string; categories: readonly Category[] }[] = Object.freeze([
  { id: 'social', name: 'Social & messaging', categories: ['Social', 'Messaging'] },
  { id: 'entertainment', name: 'Entertainment & streaming', categories: ['Video & TV', 'Music & Audio'] },
  { id: 'games', name: 'Games', categories: ['Games'] },
  { id: 'productivity', name: 'Productivity & education', categories: ['Productivity', 'Education'] },
  { id: 'utilities', name: 'Everyday utilities', categories: ['System', 'Utilities'] },
  {
    id: 'other',
    name: 'Other popular apps',
    categories: ['Photo & Design', 'Finance', 'Shopping', 'Food & Drink', 'Travel & Transport', 'Health & Fitness', 'News & Reading'],
  },
] as { id: string; name: string; categories: Category[] }[]);

export const CATALOGUE: readonly CatalogueEntry[] = Object.freeze(
  ROWS.map(([id, name, category, urlScheme, verified, glyph, aliases]) =>
    Object.freeze({ id, name, category, urlScheme, verified: urlScheme !== null && verified, glyph, aliases }),
  ),
);

/** Every Feather glyph name used by the catalogue (sorted, unique). */
export const GLYPHS: readonly string[] = Object.freeze([...new Set(CATALOGUE.map((e) => e.glyph))].sort());

const byId = new Map<string, CatalogueEntry>(CATALOGUE.map((e) => [e.id, e]));

export function getById(id: string): CatalogueEntry | undefined {
  return byId.get(id);
}

const byName = (a: CatalogueEntry, b: CatalogueEntry) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

export function byCategory(category: string): CatalogueEntry[] {
  return CATALOGUE.filter((e) => e.category === category).sort(byName);
}

// ---------------------------------------------------------------- search

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** normalize() then drop everything that is not a letter or digit. */
function compact(s: string): string {
  return normalize(s).replace(/[^a-z0-9]/g, '');
}

function words(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
    }
  }
  return d[m][n];
}

/** Returns the number of gaps if `q` is a subsequence of `s`, else -1. */
function subsequenceGaps(q: string, s: string): number {
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) {
      if (last >= 0 && j !== last + 1) gaps++;
      last = j;
      i++;
    }
  }
  return i === q.length ? gaps : -1;
}

type Indexed = { entry: CatalogueEntry; name: string; nameC: string; nameWords: string[]; aliases: string[]; aliasesC: string[] };

const INDEX: Indexed[] = CATALOGUE.map((entry) => ({
  entry,
  name: normalize(entry.name),
  nameC: compact(entry.name),
  nameWords: words(entry.name),
  aliases: entry.aliases.map(normalize),
  aliasesC: entry.aliases.map(compact),
}));

// Tiers (lower is better). Within a tier a sub-score orders results.
const T_EXACT = 0;
const T_PREFIX = 1;
const T_WORD = 2;
const T_ALIAS = 3;
const T_SUBSTRING = 4;
const T_FUZZY = 5;

function scoreEntry(x: Indexed, q: string, qc: string): [number, number] | null {
  if (x.name === q || (qc && x.nameC === qc)) return [T_EXACT, 0];
  if (x.name.startsWith(q) || (qc && x.nameC.startsWith(qc))) return [T_PREFIX, 0];
  if (x.nameWords.some((w) => w.startsWith(q) || (qc && w.startsWith(qc)))) return [T_WORD, 0];
  for (let i = 0; i < x.aliases.length; i++) {
    const a = x.aliases[i];
    if (a === q || (qc && x.aliasesC[i] === qc)) return [T_ALIAS, 0];
  }
  for (let i = 0; i < x.aliases.length; i++) {
    const a = x.aliases[i];
    if (a.startsWith(q) || (qc && x.aliasesC[i].startsWith(qc)) || words(a).some((w) => w.startsWith(q)))
      return [T_ALIAS, 1];
  }
  if (x.name.includes(q) || (qc && x.nameC.includes(qc))) return [T_SUBSTRING, 0];
  if (x.aliases.some((a, i) => a.includes(q) || (qc && x.aliasesC[i].includes(qc)))) return [T_SUBSTRING, 1];

  if (qc.length < 2) return null;
  // Fuzzy: small edit distance against the whole name, its words, a same-length prefix, or aliases.
  const maxD = qc.length <= 4 ? 1 : 2;
  let best = Infinity;
  const targets = [x.nameC, ...x.nameWords, ...x.aliasesC];
  for (const t of targets) {
    if (!t) continue;
    best = Math.min(best, editDistance(qc, t));
    if (t.length > qc.length) best = Math.min(best, editDistance(qc, t.slice(0, qc.length)));
  }
  if (best <= maxD) return [T_FUZZY, best];
  // Subsequence of the compact name (e.g. "ytm" -> "youtubemusic").
  const gaps = subsequenceGaps(qc, x.nameC);
  if (gaps >= 0 && qc.length >= 2 && qc[0] === x.nameC[0]) return [T_FUZZY, 3 + gaps / 10];
  return null;
}

/**
 * Search the catalogue. Case- and diacritic-insensitive. Ranking:
 * exact name > name prefix > word prefix > alias > substring > fuzzy (edit distance / subsequence).
 * Ties break on shorter name, then alphabetical. An empty query returns everything by name.
 */
export function search(query: string, limit?: number): CatalogueEntry[] {
  const q = normalize(query ?? '');
  const max = limit === undefined ? Infinity : Math.max(0, Math.floor(limit));
  if (!q) return [...CATALOGUE].sort(byName).slice(0, max);
  const qc = compact(q);
  const hits: Array<{ e: CatalogueEntry; tier: number; sub: number; len: number }> = [];
  for (const x of INDEX) {
    const s = scoreEntry(x, q, qc);
    if (s) hits.push({ e: x.entry, tier: s[0], sub: s[1], len: x.name.length });
  }
  hits.sort((a, b) => a.tier - b.tier || a.sub - b.sub || a.len - b.len || byName(a.e, b.e));
  return hits.slice(0, max).map((h) => h.e);
}
