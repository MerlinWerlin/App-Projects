// App catalogue: popular apps (AU / US / UK + system apps) with their public URL schemes.
//
// Rules for urlScheme:
//  - Only schemes that are publicly known are listed; nothing is guessed. When unknown the
//    value is null and the app is installed with the Shortcuts method instead.
//  - verified: true only for schemes that are widely documented (by Apple, the vendor's own
//    developer docs, or long-standing public references). Community-known schemes that are
//    not officially documented are verified: false and should be tested on device.
//  - A scheme ends with ':' or '://'.
//  - T183 (owner 1 Nov): schemes only matter for the optional Bulk profile, whose web clips open
//    through Safari ("Open in <app>?"). A scheme Safari rejects ("address is invalid") is null.
// bundleId: the public bundle identifier, null when not known for certain (see CatalogueEntry).
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
  /**
   * T183: the app's public iOS bundle identifier (Apple's own apps are com.apple.*), or null when
   * it is not known for certain (never guessed). Informational: the default install method is the
   * Shortcuts "Open App" action, where the person picks the app from the list by name.
   */
  bundleId: string | null;
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

// Row: [id, name, category, urlScheme, verified, glyph, aliases, bundleId]
// Exported so other catalogue data files (e.g. src/core/catalogueExtra.ts, T189) use the same shape.
export type Row = [string, string, Category, string | null, boolean, string, string[], string | null];

/** Reverse-DNS shape of an iOS bundle identifier (letters, digits, '-' and '.', at least two parts). */
export const BUNDLE_ID_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
/** A URL scheme as stored here: `name:` or `name://` (RFC 3986 scheme characters). */
export const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:(\/\/)?$/i;

/** Row tuple -> frozen entry (verified only with a scheme). Shared with other catalogue data files. */
export function entryFromRow([id, name, category, urlScheme, verified, glyph, aliases, bundleId]: Row): CatalogueEntry {
  return Object.freeze({ id, name, category, urlScheme, verified: urlScheme !== null && verified, glyph, aliases, bundleId });
}

const ROWS: Row[] = [
  // ---- System (iOS)
  ['camera', 'Camera', 'System', null, false, 'camera', ['photo', 'selfie'], 'com.apple.camera'],
  ['photos', 'Photos', 'System', 'photos-redirect://', true, 'image', ['gallery', 'pictures', 'camera roll'], 'com.apple.mobileslideshow'],
  // T183: 'App-prefs:' is not a public scheme; a web clip with it fails ("address is invalid"). Open App only.
  ['settings', 'Settings', 'System', null, false, 'settings', ['preferences', 'prefs'], 'com.apple.Preferences'],
  ['messages', 'Messages', 'System', 'sms:', true, 'message-circle', ['sms', 'imessage', 'texts'], 'com.apple.MobileSMS'],
  ['phone', 'Phone', 'System', 'tel:', true, 'phone', ['call', 'dialer'], 'com.apple.mobilephone'],
  ['mail', 'Mail', 'System', 'message://', true, 'mail', ['email', 'inbox'], 'com.apple.mobilemail'],
  ['safari', 'Safari', 'System', 'x-web-search://', false, 'compass', ['browser', 'web', 'internet'], 'com.apple.mobilesafari'],
  ['maps', 'Maps', 'System', 'maps://', true, 'map', ['directions', 'apple maps'], 'com.apple.Maps'],
  ['music', 'Music', 'System', 'music://', true, 'music', ['apple music', 'songs'], 'com.apple.Music'],
  ['calendar', 'Calendar', 'System', 'calshow:', true, 'calendar', ['events', 'schedule'], 'com.apple.mobilecal'],
  ['notes', 'Notes', 'System', 'mobilenotes://', true, 'file-text', ['memo'], 'com.apple.mobilenotes'],
  ['clock', 'Clock', 'System', 'clock-worldclock://', false, 'clock', ['alarm', 'timer', 'stopwatch'], 'com.apple.mobiletimer'],
  ['weather', 'Weather', 'System', 'weather://', false, 'cloud', ['forecast'], 'com.apple.weather'],
  ['reminders', 'Reminders', 'System', 'x-apple-reminderkit://', false, 'check-square', ['todo', 'tasks'], 'com.apple.reminders'],
  ['facetime', 'FaceTime', 'System', 'facetime://', true, 'video', ['video call'], 'com.apple.facetime'],
  ['app-store', 'App Store', 'System', 'itms-apps://', true, 'download', ['apps', 'store'], 'com.apple.AppStore'],
  ['podcasts', 'Podcasts', 'System', 'podcasts://', true, 'mic', ['podcast'], 'com.apple.podcasts'],
  ['books', 'Books', 'System', 'ibooks://', true, 'book-open', ['ibooks', 'ebooks', 'audiobooks'], 'com.apple.iBooks'],
  ['files', 'Files', 'System', 'shareddocuments://', false, 'folder', ['documents', 'finder'], 'com.apple.DocumentsApp'],
  ['health', 'Health', 'System', 'x-apple-health://', false, 'heart', ['steps', 'medical'], 'com.apple.Health'],
  ['wallet', 'Wallet', 'System', 'shoebox://', false, 'credit-card', ['apple pay', 'cards', 'passes'], 'com.apple.Passbook'],
  ['shortcuts', 'Shortcuts', 'System', 'shortcuts://', true, 'layers', ['automation', 'workflow'], 'com.apple.shortcuts'],
  ['find-my', 'Find My', 'System', 'findmy://', false, 'map-pin', ['find my iphone', 'locate'], 'com.apple.findmy'],
  ['home', 'Home', 'System', 'com.apple.home://', false, 'home', ['homekit', 'smart home'], 'com.apple.Home'],
  ['tv', 'TV', 'System', 'videos://', false, 'tv', ['apple tv', 'videos'], 'com.apple.tv'],
  ['contacts', 'Contacts', 'System', null, false, 'users', ['address book', 'people'], 'com.apple.MobileAddressBook'],
  ['calculator', 'Calculator', 'System', null, false, 'divide-square', ['calc', 'maths', 'math'], 'com.apple.calculator'],
  ['voice-memos', 'Voice Memos', 'System', 'voicememos://', false, 'mic', ['recorder', 'dictaphone'], 'com.apple.VoiceMemos'],
  ['stocks', 'Stocks', 'System', 'stocks://', false, 'trending-up', ['shares', 'market'], 'com.apple.stocks'],
  ['fitness', 'Fitness', 'System', null, false, 'activity', ['workout', 'rings'], 'com.apple.Fitness'],
  ['translate', 'Translate', 'System', null, false, 'globe', ['translation', 'language'], 'com.apple.Translate'],
  ['news', 'News', 'System', 'applenews://', false, 'rss', ['apple news', 'headlines'], 'com.apple.news'],
  ['freeform', 'Freeform', 'System', null, false, 'edit-3', ['whiteboard'], 'com.apple.freeform'],
  ['journal', 'Journal', 'System', null, false, 'book', ['diary'], 'com.apple.journal'],
  ['passwords', 'Passwords', 'System', null, false, 'key', ['keychain', 'logins'], 'com.apple.Passwords'],
  ['compass', 'Compass', 'System', null, false, 'navigation', ['direction', 'level'], 'com.apple.compass'],
  ['measure', 'Measure', 'System', null, false, 'maximize', ['ruler', 'level'], 'com.apple.measure'],
  ['tips', 'Tips', 'System', null, false, 'info', ['help'], 'com.apple.tips'],
  ['magnifier', 'Magnifier', 'System', null, false, 'search', ['zoom', 'magnifying glass'], 'com.apple.Magnifier'],

  // ---- Social
  ['instagram', 'Instagram', 'Social', 'instagram://', true, 'camera', ['insta', 'ig', 'reels'], 'com.burbn.instagram'],
  ['facebook', 'Facebook', 'Social', 'fb://', true, 'users', ['fb', 'meta'], 'com.facebook.Facebook'],
  ['x', 'X', 'Social', 'twitter://', true, 'at-sign', ['twitter', 'tweet'], 'com.atebits.Tweetie2'],
  ['tiktok', 'TikTok', 'Social', 'snssdk1233://', false, 'music', ['tik tok'], 'com.zhiliaoapp.musically'],
  ['snapchat', 'Snapchat', 'Social', 'snapchat://', true, 'smile', ['snap'], 'com.toyopagroup.picaboo'],
  ['threads', 'Threads', 'Social', 'barcelona://', false, 'at-sign', ['meta threads'], 'com.burbn.barcelona'],
  ['pinterest', 'Pinterest', 'Social', 'pinterest://', true, 'bookmark', ['pins', 'boards'], null],
  ['reddit', 'Reddit', 'Social', 'reddit://', false, 'message-square', ['subreddit'], 'com.reddit.Reddit'],
  ['linkedin', 'LinkedIn', 'Social', 'linkedin://', false, 'briefcase', ['jobs', 'professional'], 'com.linkedin.LinkedIn'],
  ['tumblr', 'Tumblr', 'Social', 'tumblr://', true, 'edit', ['blog'], 'com.tumblr.tumblr'],
  ['bereal', 'BeReal', 'Social', null, false, 'camera', ['be real'], 'AlexisBarreyat.BeReal'],
  ['bluesky', 'Bluesky', 'Social', 'bluesky://', false, 'cloud', ['bsky'], 'xyz.blueskyweb.app'],
  ['nextdoor', 'Nextdoor', 'Social', null, false, 'home', ['neighbours', 'neighbors'], null],
  ['tinder', 'Tinder', 'Social', null, false, 'heart', ['dating'], 'com.cardify.tinder'],
  ['bumble', 'Bumble', 'Social', null, false, 'heart', ['dating'], 'com.moxco.bumble'],
  ['hinge', 'Hinge', 'Social', null, false, 'heart', ['dating'], null],

  // ---- Messaging
  ['whatsapp', 'WhatsApp', 'Messaging', 'whatsapp://', true, 'message-circle', ['whats app', 'wa'], 'net.whatsapp.WhatsApp'],
  ['messenger', 'Messenger', 'Messaging', 'fb-messenger://', true, 'message-circle', ['facebook messenger'], 'com.facebook.Messenger'],
  ['telegram', 'Telegram', 'Messaging', 'tg://', true, 'send', ['tg'], 'ph.telegra.Telegraph'],
  ['signal', 'Signal', 'Messaging', 'sgnl://', false, 'message-square', ['private messenger'], 'org.whispersystems.signal'],
  ['discord', 'Discord', 'Messaging', 'discord://', false, 'headphones', ['servers', 'gaming chat'], 'com.hammerandchisel.discord'],
  ['slack', 'Slack', 'Messaging', 'slack://', true, 'hash', ['work chat'], 'com.tinyspeck.chatlyio'],
  ['microsoft-teams', 'Microsoft Teams', 'Messaging', 'msteams://', false, 'users', ['teams', 'ms teams'], 'com.microsoft.skype.teams'],
  ['zoom', 'Zoom', 'Messaging', 'zoomus://', true, 'video', ['meetings', 'video call'], 'us.zoom.videomeetings'],
  ['google-meet', 'Google Meet', 'Messaging', null, false, 'video', ['meet', 'hangouts'], null],
  ['skype', 'Skype', 'Messaging', 'skype:', true, 'phone-call', ['calls'], 'com.skype.skype'],
  ['viber', 'Viber', 'Messaging', 'viber://', false, 'phone-call', ['rakuten viber'], 'com.viber'],
  ['wechat', 'WeChat', 'Messaging', 'weixin://', false, 'message-circle', ['weixin'], 'com.tencent.xin'],
  ['line', 'LINE', 'Messaging', 'line://', false, 'message-square', ['line messenger'], 'jp.naver.line'],

  // ---- Music & Audio
  ['spotify', 'Spotify', 'Music & Audio', 'spotify:', true, 'music', ['songs', 'playlists'], 'com.spotify.client'],
  ['youtube-music', 'YouTube Music', 'Music & Audio', 'youtubemusic://', false, 'play-circle', ['yt music'], 'com.google.ios.youtubemusic'],
  ['amazon-music', 'Amazon Music', 'Music & Audio', null, false, 'music', ['prime music'], 'com.amazon.mp3.AmazonCloudPlayer'],
  ['soundcloud', 'SoundCloud', 'Music & Audio', 'soundcloud://', false, 'cloud', ['sound cloud'], 'com.soundcloud.TouchApp'],
  ['shazam', 'Shazam', 'Music & Audio', 'shazam://', false, 'disc', ['song finder', 'identify music'], 'com.shazam.Shazam'],
  ['pandora', 'Pandora', 'Music & Audio', 'pandora://', false, 'radio', ['radio'], 'com.pandora'],
  ['tidal', 'TIDAL', 'Music & Audio', null, false, 'disc', ['hifi'], 'com.aspiro.TIDAL'],
  ['deezer', 'Deezer', 'Music & Audio', 'deezer://', false, 'music', [], 'com.deezer.Deezer'],
  ['audible', 'Audible', 'Music & Audio', 'audible://', false, 'headphones', ['audiobooks'], 'com.audible.iphone'],
  ['overcast', 'Overcast', 'Music & Audio', 'overcast://', false, 'mic', ['podcasts'], 'fm.overcast.overcast'],
  ['pocket-casts', 'Pocket Casts', 'Music & Audio', 'pktc://', false, 'mic', ['podcasts'], 'au.com.shiftyjelly.podcasts'],
  ['bbc-sounds', 'BBC Sounds', 'Music & Audio', null, false, 'radio', ['bbc radio', 'iplayer radio'], null],

  // ---- Video & TV
  // T183: owner 1 Nov, a web clip with youtube:// fails in Safari ("address is invalid"). Open App only.
  ['youtube', 'YouTube', 'Video & TV', null, false, 'play-circle', ['yt', 'videos'], 'com.google.ios.youtube'],
  ['netflix', 'Netflix', 'Video & TV', 'nflx://', false, 'film', ['movies', 'shows'], 'com.netflix.Netflix'],
  ['prime-video', 'Prime Video', 'Video & TV', 'aiv://', false, 'film', ['amazon prime', 'amazon video'], 'com.amazon.aiv.AIVApp'],
  ['disney-plus', 'Disney+', 'Video & TV', 'disneyplus://', false, 'star', ['disney plus'], 'com.disney.disneyplus'],
  ['max', 'Max', 'Video & TV', null, false, 'tv', ['hbo', 'hbo max'], null],
  ['hulu', 'Hulu', 'Video & TV', 'hulu://', false, 'tv', [], 'com.hulu.plus'],
  ['paramount-plus', 'Paramount+', 'Video & TV', null, false, 'tv', ['paramount plus'], null],
  ['peacock', 'Peacock', 'Video & TV', null, false, 'tv', ['nbc'], null],
  ['twitch', 'Twitch', 'Video & TV', 'twitch://', true, 'cast', ['streams', 'live'], 'tv.twitch'],
  ['stan', 'Stan', 'Video & TV', null, false, 'tv', ['stan au'], null],
  ['binge', 'BINGE', 'Video & TV', null, false, 'tv', [], null],
  ['kayo', 'Kayo Sports', 'Video & TV', null, false, 'award', ['kayo', 'sport'], null],
  ['abc-iview', 'ABC iview', 'Video & TV', null, false, 'tv', ['iview', 'abc'], null],
  ['sbs-on-demand', 'SBS On Demand', 'Video & TV', null, false, 'tv', ['sbs'], null],
  ['7plus', '7plus', 'Video & TV', null, false, 'tv', ['seven', 'channel 7'], null],
  ['9now', '9Now', 'Video & TV', null, false, 'tv', ['nine', 'channel 9'], null],
  ['bbc-iplayer', 'BBC iPlayer', 'Video & TV', null, false, 'tv', ['iplayer', 'bbc'], null],
  ['itvx', 'ITVX', 'Video & TV', null, false, 'tv', ['itv'], null],
  ['channel-4', 'Channel 4', 'Video & TV', null, false, 'tv', ['all 4', 'c4'], null],
  ['sky-go', 'Sky Go', 'Video & TV', null, false, 'tv', ['sky'], null],

  // ---- Photo & Design
  ['google-photos', 'Google Photos', 'Photo & Design', 'googlephotos://', false, 'image', ['gphotos'], 'com.google.photos'],
  ['vsco', 'VSCO', 'Photo & Design', 'vsco://', false, 'aperture', ['filters'], null],
  ['snapseed', 'Snapseed', 'Photo & Design', 'snapseed://', false, 'sliders', ['photo editor'], 'com.niksoftware.snapseed'],
  ['lightroom', 'Lightroom', 'Photo & Design', null, false, 'sliders', ['adobe lightroom'], 'com.adobe.lrmobile'],
  ['canva', 'Canva', 'Photo & Design', null, false, 'pen-tool', ['design'], 'com.canva.canvaeditor'],
  ['capcut', 'CapCut', 'Photo & Design', null, false, 'scissors', ['video editor'], 'com.lemon.lvoverseas'],
  ['procreate-pocket', 'Procreate Pocket', 'Photo & Design', null, false, 'feather', ['drawing', 'procreate'], null],

  // ---- Productivity
  ['gmail', 'Gmail', 'Productivity', 'googlegmail://', true, 'mail', ['google mail', 'email'], 'com.google.Gmail'],
  ['outlook', 'Outlook', 'Productivity', 'ms-outlook://', true, 'inbox', ['microsoft outlook', 'hotmail', 'email'], 'com.microsoft.Office.Outlook'],
  ['google-drive', 'Google Drive', 'Productivity', 'googledrive://', false, 'folder', ['drive', 'gdrive'], 'com.google.Drive'],
  ['google-docs', 'Google Docs', 'Productivity', 'googledocs://', false, 'file-text', ['docs'], 'com.google.Docs'],
  ['google-sheets', 'Google Sheets', 'Productivity', 'googlesheets://', false, 'grid', ['sheets', 'spreadsheet'], 'com.google.Sheets'],
  ['google-calendar', 'Google Calendar', 'Productivity', null, false, 'calendar', ['gcal'], 'com.google.calendar'],
  ['google-keep', 'Google Keep', 'Productivity', null, false, 'clipboard', ['keep notes'], 'com.google.Keep'],
  ['word', 'Microsoft Word', 'Productivity', 'ms-word:', true, 'file-text', ['word', 'docx'], 'com.microsoft.Office.Word'],
  ['excel', 'Microsoft Excel', 'Productivity', 'ms-excel:', true, 'grid', ['excel', 'spreadsheet', 'xlsx'], 'com.microsoft.Office.Excel'],
  ['powerpoint', 'Microsoft PowerPoint', 'Productivity', 'ms-powerpoint:', true, 'monitor', ['powerpoint', 'slides', 'pptx'], 'com.microsoft.Office.Powerpoint'],
  ['onenote', 'Microsoft OneNote', 'Productivity', 'onenote:', true, 'book', ['onenote', 'notebook'], 'com.microsoft.onenote'],
  ['onedrive', 'OneDrive', 'Productivity', null, false, 'cloud', ['microsoft onedrive'], 'com.microsoft.skydrive'],
  ['dropbox', 'Dropbox', 'Productivity', 'dropbox://', false, 'box', ['files'], 'com.getdropbox.Dropbox'],
  ['notion', 'Notion', 'Productivity', 'notion://', false, 'edit', ['wiki', 'notes'], 'notion.id'],
  ['evernote', 'Evernote', 'Productivity', 'evernote://', false, 'file-text', ['notes'], 'com.evernote.iPhone.Evernote'],
  ['obsidian', 'Obsidian', 'Productivity', 'obsidian://', true, 'hexagon', ['markdown notes'], 'md.obsidian'],
  ['bear', 'Bear', 'Productivity', 'bear://', true, 'edit-3', ['notes'], 'net.shinyfrog.bear-iOS'],
  ['drafts', 'Drafts', 'Productivity', 'drafts://', true, 'edit-3', ['quick notes'], 'com.agiletortoise.Drafts5'],
  ['todoist', 'Todoist', 'Productivity', 'todoist://', true, 'check-circle', ['todo', 'tasks'], null],
  ['things', 'Things 3', 'Productivity', 'things:', true, 'check-square', ['things', 'todo'], 'com.culturedcode.ThingsiPhone'],
  ['trello', 'Trello', 'Productivity', 'trello://', false, 'columns', ['boards', 'kanban'], 'com.fogcreek.trello'],
  ['asana', 'Asana', 'Productivity', null, false, 'target', ['projects'], null],
  ['chatgpt', 'ChatGPT', 'Productivity', null, false, 'cpu', ['openai', 'ai chat'], 'com.openai.chat'],
  ['claude', 'Claude', 'Productivity', null, false, 'cpu', ['anthropic', 'ai chat'], 'com.anthropic.claude'],
  ['gemini', 'Gemini', 'Productivity', null, false, 'cpu', ['google gemini', 'ai chat'], 'com.google.gemini'],
  ['1password', '1Password', 'Productivity', 'onepassword://', false, 'lock', ['passwords', 'one password'], null],
  ['google-authenticator', 'Google Authenticator', 'Productivity', null, false, 'shield', ['2fa', 'authenticator'], 'com.google.Authenticator'],
  ['microsoft-authenticator', 'Microsoft Authenticator', 'Productivity', null, false, 'shield', ['2fa', 'authenticator'], 'com.microsoft.azureauthenticator'],

  // ---- Utilities (browsers, search, tools)
  ['google', 'Google', 'Utilities', 'google://', false, 'search', ['search', 'google search'], 'com.google.GoogleMobile'],
  ['chrome', 'Chrome', 'Utilities', 'googlechrome://', true, 'globe', ['google chrome', 'browser'], 'com.google.chrome.ios'],
  ['firefox', 'Firefox', 'Utilities', 'firefox://', true, 'globe', ['mozilla', 'browser'], 'org.mozilla.ios.Firefox'],
  ['edge', 'Microsoft Edge', 'Utilities', null, false, 'globe', ['edge', 'browser'], 'com.microsoft.msedge'],
  ['duckduckgo', 'DuckDuckGo', 'Utilities', null, false, 'search', ['ddg', 'private browser'], 'com.duckduckgo.mobile.ios'],
  ['brave', 'Brave', 'Utilities', null, false, 'shield', ['brave browser'], 'com.brave.ios.browser'],
  ['google-translate', 'Google Translate', 'Utilities', null, false, 'globe', ['translate'], 'com.google.Translate'],
  ['google-home', 'Google Home', 'Utilities', null, false, 'home', ['nest', 'smart home'], 'com.google.Chromecast'],
  ['ring', 'Ring', 'Utilities', null, false, 'bell', ['doorbell'], null],
  ['life360', 'Life360', 'Utilities', null, false, 'map-pin', ['family locator'], null],
  ['bom-weather', 'BOM Weather', 'Utilities', null, false, 'cloud-rain', ['bureau of meteorology', 'bom'], null],
  ['mygov', 'myGov', 'Utilities', null, false, 'shield', ['my gov', 'centrelink', 'ato'], null],
  ['service-nsw', 'Service NSW', 'Utilities', null, false, 'clipboard', ['nsw', 'licence'], null],
  ['nhs-app', 'NHS App', 'Health & Fitness', null, false, 'plus-square', ['nhs', 'gp'], null],
  ['medicare', 'Express Plus Medicare', 'Health & Fitness', null, false, 'plus-square', ['medicare'], null],

  // ---- Finance
  ['paypal', 'PayPal', 'Finance', 'paypal://', false, 'dollar-sign', ['payments'], 'com.yourcompany.PPClient'],
  ['venmo', 'Venmo', 'Finance', 'venmo://', false, 'dollar-sign', ['payments'], 'net.kortina.labs.Venmo'],
  ['cash-app', 'Cash App', 'Finance', null, false, 'dollar-sign', ['square cash'], 'com.squareup.cash'],
  ['revolut', 'Revolut', 'Finance', 'revolut://', false, 'credit-card', ['bank'], 'com.revolut.revolut'],
  ['wise', 'Wise', 'Finance', null, false, 'repeat', ['transferwise', 'money transfer'], null],
  ['monzo', 'Monzo', 'Finance', null, false, 'credit-card', ['bank'], 'co.uk.getmondo'],
  ['starling', 'Starling Bank', 'Finance', null, false, 'credit-card', ['starling', 'bank'], null],
  ['barclays', 'Barclays', 'Finance', null, false, 'credit-card', ['bank'], null],
  ['hsbc', 'HSBC', 'Finance', null, false, 'credit-card', ['bank'], null],
  ['commbank', 'CommBank', 'Finance', null, false, 'credit-card', ['commonwealth bank', 'cba', 'bank'], null],
  ['anz', 'ANZ', 'Finance', null, false, 'credit-card', ['anz plus', 'bank'], null],
  ['westpac', 'Westpac', 'Finance', null, false, 'credit-card', ['bank'], null],
  ['nab', 'NAB', 'Finance', null, false, 'credit-card', ['national australia bank', 'bank'], null],
  ['up-bank', 'Up', 'Finance', null, false, 'credit-card', ['up bank', 'bank'], null],
  ['chase', 'Chase', 'Finance', null, false, 'credit-card', ['jpmorgan', 'bank'], 'com.chase'],
  ['bank-of-america', 'Bank of America', 'Finance', null, false, 'credit-card', ['boa', 'bofa', 'bank'], null],
  ['wells-fargo', 'Wells Fargo', 'Finance', null, false, 'credit-card', ['bank'], null],
  ['robinhood', 'Robinhood', 'Finance', 'robinhood://', false, 'trending-up', ['stocks', 'investing'], 'com.robinhood.release.Robinhood'],
  ['coinbase', 'Coinbase', 'Finance', null, false, 'trending-up', ['crypto', 'bitcoin'], 'com.vilcsak.bitcoin2'],
  ['afterpay', 'Afterpay', 'Finance', null, false, 'shopping-bag', ['buy now pay later', 'bnpl'], null],

  // ---- Shopping
  ['amazon', 'Amazon', 'Shopping', 'com.amazon.mobile.shopping://', false, 'shopping-cart', ['amazon shopping'], 'com.amazon.Amazon'],
  ['ebay', 'eBay', 'Shopping', 'ebay://', false, 'tag', ['auctions'], 'com.ebay.iphone'],
  ['etsy', 'Etsy', 'Shopping', 'etsy://', false, 'gift', ['handmade'], 'com.etsy.etsyforios'],
  ['temu', 'Temu', 'Shopping', null, false, 'shopping-bag', [], 'com.einnovation.temu'],
  ['shein', 'SHEIN', 'Shopping', null, false, 'shopping-bag', ['fashion'], null],
  ['asos', 'ASOS', 'Shopping', null, false, 'shopping-bag', ['fashion'], null],
  ['vinted', 'Vinted', 'Shopping', null, false, 'tag', ['second hand', 'preloved'], null],
  ['depop', 'Depop', 'Shopping', null, false, 'tag', ['second hand', 'preloved'], null],
  ['target', 'Target', 'Shopping', null, false, 'target', [], null],
  ['walmart', 'Walmart', 'Shopping', null, false, 'shopping-cart', [], null],
  ['kmart', 'Kmart', 'Shopping', null, false, 'shopping-bag', [], null],
  ['bunnings', 'Bunnings', 'Shopping', null, false, 'tool', ['hardware', 'diy'], null],
  ['ikea', 'IKEA', 'Shopping', null, false, 'package', ['furniture'], null],
  ['woolworths', 'Woolworths', 'Shopping', null, false, 'shopping-cart', ['woolies', 'groceries'], null],
  ['coles', 'Coles', 'Shopping', null, false, 'shopping-cart', ['groceries'], null],
  ['tesco', 'Tesco', 'Shopping', null, false, 'shopping-cart', ['groceries', 'clubcard'], null],
  ['sainsburys', "Sainsbury's", 'Shopping', null, false, 'shopping-cart', ['sainsburys', 'groceries'], null],
  ['gumtree', 'Gumtree', 'Shopping', null, false, 'tag', ['classifieds'], null],

  // ---- Food & Drink
  ['uber-eats', 'Uber Eats', 'Food & Drink', 'ubereats://', false, 'shopping-bag', ['food delivery'], 'com.ubercab.UberEats'],
  ['doordash', 'DoorDash', 'Food & Drink', 'doordash://', false, 'truck', ['food delivery'], 'doordash.DoorDashConsumer'],
  ['deliveroo', 'Deliveroo', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  ['menulog', 'Menulog', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  ['just-eat', 'Just Eat', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  ['grubhub', 'Grubhub', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  ['instacart', 'Instacart', 'Food & Drink', null, false, 'shopping-cart', ['groceries'], null],
  ['starbucks', 'Starbucks', 'Food & Drink', null, false, 'coffee', ['coffee'], 'com.starbucks.mystarbucks'],
  ['mcdonalds', "McDonald's", 'Food & Drink', null, false, 'coffee', ['mcdonalds', 'maccas'], null],

  // ---- Travel & Transport
  ['uber', 'Uber', 'Travel & Transport', 'uber://', true, 'navigation', ['rideshare', 'taxi'], 'com.ubercab.UberClient'],
  ['lyft', 'Lyft', 'Travel & Transport', 'lyft://', true, 'navigation', ['rideshare', 'taxi'], 'com.zimride.instant'],
  ['bolt', 'Bolt', 'Travel & Transport', null, false, 'zap', ['rideshare', 'taxi'], null],
  ['didi', 'DiDi', 'Travel & Transport', null, false, 'navigation', ['rideshare', 'taxi'], null],
  ['google-maps', 'Google Maps', 'Travel & Transport', 'comgooglemaps://', true, 'map', ['gmaps', 'directions'], 'com.google.Maps'],
  ['waze', 'Waze', 'Travel & Transport', 'waze://', true, 'navigation-2', ['traffic', 'directions'], 'com.waze.iphone'],
  ['citymapper', 'Citymapper', 'Travel & Transport', 'citymapper://', true, 'map-pin', ['transit', 'public transport'], null],
  ['google-earth', 'Google Earth', 'Travel & Transport', 'comgoogleearth://', false, 'globe', ['earth'], 'com.google.b612'],
  ['airbnb', 'Airbnb', 'Travel & Transport', 'airbnb://', false, 'home', ['stays', 'holiday rental'], 'com.airbnb.app'],
  ['booking', 'Booking.com', 'Travel & Transport', 'booking://', false, 'briefcase', ['booking', 'hotels'], 'com.booking.BookingApp'],
  ['expedia', 'Expedia', 'Travel & Transport', null, false, 'briefcase', ['hotels', 'flights'], 'com.expedia.booking'],
  ['skyscanner', 'Skyscanner', 'Travel & Transport', null, false, 'send', ['flights'], null],
  ['tripadvisor', 'Tripadvisor', 'Travel & Transport', null, false, 'eye', ['reviews', 'travel'], 'com.tripadvisor.LocalPicks'],
  ['qantas', 'Qantas', 'Travel & Transport', null, false, 'send', ['airline', 'flights'], null],
  ['trainline', 'Trainline', 'Travel & Transport', null, false, 'navigation', ['trains', 'rail'], null],
  ['opal-travel', 'Opal Travel', 'Travel & Transport', null, false, 'credit-card', ['opal', 'sydney transport'], null],
  ['tripview', 'TripView', 'Travel & Transport', null, false, 'clock', ['timetables', 'transit'], null],

  // ---- Health & Fitness
  ['strava', 'Strava', 'Health & Fitness', 'strava://', false, 'activity', ['running', 'cycling'], 'com.strava.stravaride'],
  ['fitbit', 'Fitbit', 'Health & Fitness', 'fitbit://', false, 'watch', ['steps'], 'com.fitbit.FitbitMobile'],
  ['myfitnesspal', 'MyFitnessPal', 'Health & Fitness', 'mfp://', false, 'pie-chart', ['calories', 'diet'], 'com.myfitnesspal.mfp'],
  ['headspace', 'Headspace', 'Health & Fitness', 'headspace://', false, 'smile', ['meditation', 'mindfulness'], 'com.getsomeheadspace.headspace'],
  ['calm', 'Calm', 'Health & Fitness', 'calm://', false, 'moon', ['meditation', 'sleep'], 'com.calm.calmapp'],
  ['nike-run-club', 'Nike Run Club', 'Health & Fitness', null, false, 'activity', ['nrc', 'running'], 'com.nike.nikeplus-gps'],
  ['peloton', 'Peloton', 'Health & Fitness', null, false, 'activity', ['workouts', 'cycling'], null],
  ['alltrails', 'AllTrails', 'Health & Fitness', null, false, 'map', ['hiking', 'trails'], 'com.alltrails.alltrails'],
  ['garmin-connect', 'Garmin Connect', 'Health & Fitness', null, false, 'watch', ['garmin'], 'com.garmin.connect.mobile'],
  ['sleep-cycle', 'Sleep Cycle', 'Health & Fitness', null, false, 'moon', ['sleep', 'alarm'], 'com.lexwarelabs.goodmorning'],
  ['flo', 'Flo', 'Health & Fitness', null, false, 'droplet', ['period tracker', 'cycle'], null],
  ['oura', 'Oura', 'Health & Fitness', null, false, 'circle', ['ring', 'sleep'], 'com.ouraring.oura'],

  // ---- News & Reading
  ['kindle', 'Kindle', 'News & Reading', 'kindle://', false, 'book-open', ['ebooks', 'amazon kindle'], 'com.amazon.Lassen'],
  ['goodreads', 'Goodreads', 'News & Reading', null, false, 'book', ['books', 'reading list'], null],
  ['libby', 'Libby', 'News & Reading', null, false, 'book', ['library'], null],
  ['medium', 'Medium', 'News & Reading', 'medium://', false, 'file-text', ['articles', 'blogs'], 'com.medium.reader'],
  ['bbc-news', 'BBC News', 'News & Reading', null, false, 'rss', ['bbc'], null],
  ['abc-news', 'ABC News', 'News & Reading', null, false, 'rss', ['abc'], null],
  ['the-guardian', 'The Guardian', 'News & Reading', null, false, 'rss', ['guardian'], null],
  ['nytimes', 'The New York Times', 'News & Reading', 'nytimes://', false, 'rss', ['nyt', 'new york times'], 'com.nytimes.NYTimes'],
  ['espn', 'ESPN', 'News & Reading', 'sportscenter://', false, 'award', ['sports', 'scores'], 'com.espn.ScoreCenter'],
  ['realestate', 'realestate.com.au', 'Utilities', null, false, 'home', ['rea', 'property', 'real estate'], null],
  ['domain', 'Domain', 'Utilities', null, false, 'home', ['property', 'real estate'], null],
  ['rightmove', 'Rightmove', 'Utilities', null, false, 'home', ['property', 'real estate'], null],
  ['zillow', 'Zillow', 'Utilities', 'zillow://', false, 'home', ['property', 'real estate'], 'com.zillow.ZillowMap'],
  ['seek', 'SEEK', 'Utilities', null, false, 'briefcase', ['jobs'], null],
  ['yelp', 'Yelp', 'Utilities', 'yelp://', false, 'star', ['reviews', 'restaurants'], 'com.yelp.yelpiphone'],

  // ---- Education
  ['duolingo', 'Duolingo', 'Education', 'duolingo://', false, 'globe', ['languages', 'learn'], 'com.duolingo.DuolingoMobile'],
  ['khan-academy', 'Khan Academy', 'Education', null, false, 'book-open', ['learn', 'school'], null],
  ['google-classroom', 'Google Classroom', 'Education', null, false, 'users', ['classroom', 'school'], null],
  ['photomath', 'Photomath', 'Education', null, false, 'divide-square', ['maths', 'homework'], null],
  ['quizlet', 'Quizlet', 'Education', null, false, 'layers', ['flashcards', 'study'], null],

  // ---- Games
  ['roblox', 'Roblox', 'Games', 'roblox://', false, 'box', ['games'], 'com.roblox.robloxmobile'],
  ['minecraft', 'Minecraft', 'Games', 'minecraft://', false, 'box', ['games', 'mc'], 'com.mojang.minecraftpe'],
  ['pokemon-go', 'Pokémon GO', 'Games', null, false, 'target', ['pokemon go', 'pogo'], 'com.nianticlabs.pokemongo'],
  ['candy-crush', 'Candy Crush Saga', 'Games', null, false, 'grid', ['candy crush'], 'com.midasplayer.apps.candycrushsaga'],
  ['clash-royale', 'Clash Royale', 'Games', null, false, 'award', ['clash'], 'com.supercell.scroll'],
  ['chess', 'Chess.com', 'Games', null, false, 'grid', ['chess'], 'com.chess.iphone'],
  ['wordscapes', 'Wordscapes', 'Games', null, false, 'type', ['word game'], null],

  // ---- Added in T28 (owner review §6). URL schemes are left null unless publicly documented:
  //      these apps install with the Shortcuts method until a scheme is confirmed on a device.
  // Games
  ['among-us', 'Among Us', 'Games', null, false, 'users', ['impostor', 'crewmate'], 'com.innersloth.amongus'],
  ['call-of-duty-mobile', 'Call of Duty: Mobile', 'Games', null, false, 'crosshair', ['cod', 'cod mobile'], 'com.activision.callofduty.shooter'],
  ['pubg-mobile', 'PUBG Mobile', 'Games', null, false, 'crosshair', ['pubg', 'battle royale'], 'com.tencent.ig'],
  ['free-fire', 'Free Fire', 'Games', null, false, 'crosshair', ['garena', 'battle royale'], 'com.dts.freefireth'],
  ['genshin-impact', 'Genshin Impact', 'Games', null, false, 'wind', ['genshin', 'rpg'], 'com.miHoYo.GenshinImpact'],
  ['honkai-star-rail', 'Honkai: Star Rail', 'Games', null, false, 'star', ['hsr', 'honkai'], 'com.HoYoverse.hkrpgoversea'],
  ['clash-of-clans', 'Clash of Clans', 'Games', null, false, 'shield', ['coc', 'clash'], 'com.supercell.magic'],
  ['brawl-stars', 'Brawl Stars', 'Games', null, false, 'star', ['brawl'], 'com.supercell.laser'],
  ['subway-surfers', 'Subway Surfers', 'Games', null, false, 'zap', ['endless runner'], 'com.kiloo.subwaysurfers'],
  ['temple-run-2', 'Temple Run 2', 'Games', null, false, 'navigation', ['temple run'], 'com.imangi.templerun2'],
  ['angry-birds-2', 'Angry Birds 2', 'Games', null, false, 'target', ['angry birds'], 'com.rovio.baba'],
  ['monopoly-go', 'Monopoly GO!', 'Games', null, false, 'home', ['monopoly', 'board game'], null],
  ['royal-match', 'Royal Match', 'Games', null, false, 'award', ['match 3', 'puzzle'], null],
  ['coin-master', 'Coin Master', 'Games', null, false, 'dollar-sign', ['spin'], 'com.moonactive.coinmaster'],
  ['gardenscapes', 'Gardenscapes', 'Games', null, false, 'leaf', ['match 3'], 'com.playrix.gardenscapes-m3-ios'],
  ['township', 'Township', 'Games', null, false, 'home', ['farm', 'city builder'], 'com.playrix.township-ios'],
  ['hay-day', 'Hay Day', 'Games', null, false, 'sun', ['farm'], 'com.supercell.soil'],
  ['stumble-guys', 'Stumble Guys', 'Games', null, false, 'smile', ['party game'], null],
  ['8-ball-pool', '8 Ball Pool', 'Games', null, false, 'circle', ['pool', 'billiards'], 'com.miniclip.8ballpoolmult'],
  ['words-with-friends', 'Words With Friends 2', 'Games', null, false, 'type', ['words with friends', 'wwf'], 'com.zynga.WordsWithFriends3'],
  ['nyt-games', 'NYT Games', 'Games', null, false, 'grid', ['wordle', 'crossword', 'connections', 'spelling bee'], null],
  ['sudoku-com', 'Sudoku.com', 'Games', null, false, 'grid', ['sudoku', 'puzzle'], null],
  ['block-blast', 'Block Blast!', 'Games', null, false, 'grid', ['block puzzle'], null],
  ['toca-boca-world', 'Toca Boca World', 'Games', null, false, 'home', ['toca world', 'toca life', 'kids'], null],
  ['my-talking-tom-2', 'My Talking Tom 2', 'Games', null, false, 'smile', ['talking tom', 'virtual pet'], 'com.outfit7.mytalkingtom2'],
  ['geometry-dash', 'Geometry Dash', 'Games', null, false, 'triangle', ['rhythm'], 'com.robtop.geometryjump'],
  ['hill-climb-racing', 'Hill Climb Racing', 'Games', null, false, 'car', ['racing'], 'com.fingersoft.hillclimbracing'],
  ['ea-sports-fc-mobile', 'EA SPORTS FC Mobile', 'Games', null, false, 'award', ['fifa mobile', 'football', 'soccer'], 'com.ea.ios.fifamobile'],
  ['pokemon-tcg-pocket', 'Pokémon TCG Pocket', 'Games', null, false, 'layers', ['pokemon cards', 'tcg'], null],
  ['marvel-snap', 'Marvel Snap', 'Games', null, false, 'layers', ['card game'], null],
  ['mario-kart-tour', 'Mario Kart Tour', 'Games', null, false, 'car', ['mario kart', 'racing'], 'com.nintendo.zaka'],
  ['stardew-valley', 'Stardew Valley', 'Games', null, false, 'sun', ['farming'], null],
  ['plants-vs-zombies', 'Plants vs. Zombies', 'Games', null, false, 'leaf', ['pvz'], 'com.ea.pvzfree.bv'],
  ['fruit-ninja', 'Fruit Ninja', 'Games', null, false, 'scissors', ['arcade'], 'com.halfbrick.FruitNinjaLite'],
  ['monument-valley', 'Monument Valley', 'Games', null, false, 'triangle', ['puzzle'], null],
  ['candy-crush-soda', 'Candy Crush Soda Saga', 'Games', null, false, 'droplet', ['candy crush soda'], 'com.midasplayer.apps.candycrushsodasaga'],
  ['mobile-legends', 'Mobile Legends: Bang Bang', 'Games', null, false, 'shield', ['mlbb', 'moba'], null],
  ['the-sims-freeplay', 'The Sims FreePlay', 'Games', null, false, 'home', ['sims'], 'com.ea.sims3deluxe.ipad.bv'],
  ['golf-clash', 'Golf Clash', 'Games', null, false, 'flag', ['golf'], 'com.playdemic.golf'],
  ['uno', 'UNO!', 'Games', null, false, 'layers', ['uno cards', 'card game'], null],
  ['trivia-crack', 'Trivia Crack', 'Games', null, false, 'help-circle', ['trivia', 'quiz'], null],
  ['heads-up', 'Heads Up!', 'Games', null, false, 'smile', ['charades', 'party game'], null],
  ['ludo-king', 'Ludo King', 'Games', null, false, 'grid', ['ludo', 'board game'], 'com.gametion.ludo'],
  ['bitlife', 'BitLife', 'Games', null, false, 'user', ['life simulator'], null],
  ['solitaire-collection', 'Microsoft Solitaire Collection', 'Games', null, false, 'layers', ['solitaire', 'cards'], null],
  ['xbox', 'Xbox', 'Games', null, false, 'game-controller', ['xbox app', 'game pass'], 'com.microsoft.xboxone.smartglass'],
  ['playstation', 'PlayStation App', 'Games', null, false, 'game-controller', ['ps5', 'psn', 'playstation'], null],
  ['nintendo-switch', 'Nintendo Switch App', 'Games', null, false, 'game-controller', ['nintendo', 'switch online'], 'com.nintendo.znca'],

  // Social & messaging
  ['lemon8', 'Lemon8', 'Social', null, false, 'image', ['lemon 8', 'lifestyle'], 'com.bd.nproject'],
  ['mastodon', 'Mastodon', 'Social', null, false, 'at-sign', ['fediverse'], 'org.joinmastodon.app'],
  ['quora', 'Quora', 'Social', null, false, 'help-circle', ['questions', 'answers'], null],
  ['meetup', 'Meetup', 'Social', null, false, 'users', ['events', 'groups'], null],
  ['kakaotalk', 'KakaoTalk', 'Messaging', null, false, 'message-circle', ['kakao'], 'com.iwilab.KakaoTalk'],
  ['threema', 'Threema', 'Messaging', null, false, 'lock', ['private messenger'], 'ch.threema.iapp'],
  ['google-chat', 'Google Chat', 'Messaging', null, false, 'message-square', ['gchat'], 'com.google.Dynamite'],
  ['webex', 'Webex', 'Messaging', null, false, 'video', ['cisco webex', 'meetings'], null],
  ['groupme', 'GroupMe', 'Messaging', null, false, 'users', ['group chat'], null],

  // Entertainment & streaming
  ['crunchyroll', 'Crunchyroll', 'Video & TV', null, false, 'play-circle', ['anime'], 'com.crunchyroll.iphone'],
  ['plex', 'Plex', 'Video & TV', null, false, 'play', ['media server'], 'com.plexapp.plex'],
  ['youtube-kids', 'YouTube Kids', 'Video & TV', null, false, 'play-circle', ['yt kids', 'kids videos'], 'com.google.ios.youtubekids'],
  ['tubi', 'Tubi', 'Video & TV', null, false, 'tv', ['free movies'], null],
  ['pluto-tv', 'Pluto TV', 'Video & TV', null, false, 'tv', ['pluto', 'free tv'], null],
  ['foxtel-go', 'Foxtel GO', 'Video & TV', null, false, 'tv', ['foxtel'], null],
  ['britbox', 'BritBox', 'Video & TV', null, false, 'tv', ['brit box'], null],
  ['now', 'NOW', 'Video & TV', null, false, 'tv', ['now tv', 'sky now'], null],
  ['vimeo', 'Vimeo', 'Video & TV', null, false, 'video', ['videos'], null],
  ['letterboxd', 'Letterboxd', 'Video & TV', null, false, 'film', ['film diary', 'movie reviews'], null],
  ['imdb', 'IMDb', 'Video & TV', null, false, 'film', ['movie database', 'cast'], 'com.imdb.imdb'],
  ['formula-1', 'F1 TV', 'Video & TV', null, false, 'flag', ['formula 1', 'f1', 'formula one'], null],
  ['iheartradio', 'iHeartRadio', 'Music & Audio', null, false, 'radio', ['iheart', 'radio'], 'com.clearchannel.iheartradio'],
  ['tunein', 'TuneIn Radio', 'Music & Audio', null, false, 'radio', ['tunein', 'radio'], null],
  ['bandcamp', 'Bandcamp', 'Music & Audio', null, false, 'disc', ['indie music'], null],
  ['listnr', 'LiSTNR', 'Music & Audio', null, false, 'radio', ['listnr', 'australian radio'], null],
  ['garageband', 'GarageBand', 'Music & Audio', null, false, 'speaker', ['garage band', 'make music'], 'com.apple.mobilegarageband'],

  // Productivity & education
  ['microsoft-copilot', 'Microsoft Copilot', 'Productivity', null, false, 'cpu', ['copilot', 'ai chat'], null],
  ['perplexity', 'Perplexity', 'Productivity', null, false, 'cpu', ['ai search'], null],
  ['microsoft-to-do', 'Microsoft To Do', 'Productivity', null, false, 'check-square', ['ms todo', 'to do', 'tasks'], 'com.microsoft.to-do'],
  ['google-tasks', 'Google Tasks', 'Productivity', null, false, 'check-circle', ['tasks', 'todo'], null],
  ['ticktick', 'TickTick', 'Productivity', null, false, 'check-square', ['tasks', 'todo'], null],
  ['fantastical', 'Fantastical', 'Productivity', null, false, 'calendar', ['calendar app'], 'com.flexibits.fantastical2.iphone'],
  ['adobe-acrobat', 'Adobe Acrobat Reader', 'Productivity', null, false, 'file', ['pdf', 'acrobat'], 'com.adobe.Adobe-Reader'],
  ['google-slides', 'Google Slides', 'Productivity', null, false, 'monitor', ['slides', 'presentations'], 'com.google.Slides'],
  ['pages', 'Pages', 'Productivity', null, false, 'file-text', ['apple pages', 'documents'], 'com.apple.Pages'],
  ['numbers', 'Numbers', 'Productivity', null, false, 'bar-chart', ['apple numbers', 'spreadsheet'], 'com.apple.Numbers'],
  ['keynote', 'Keynote', 'Productivity', null, false, 'monitor', ['apple keynote', 'presentations'], 'com.apple.Keynote'],
  ['goodnotes', 'Goodnotes', 'Productivity', null, false, 'edit-3', ['handwriting', 'notes'], null],
  ['forest-focus', 'Forest', 'Productivity', null, false, 'leaf', ['focus timer', 'pomodoro'], null],
  ['canvas-student', 'Canvas Student', 'Education', null, false, 'book-open', ['canvas', 'uni', 'school'], 'com.instructure.icanvas'],
  ['brainly', 'Brainly', 'Education', null, false, 'help-circle', ['homework help'], null],
  ['simply-piano', 'Simply Piano', 'Education', null, false, 'music', ['piano lessons'], null],
  ['babbel', 'Babbel', 'Education', null, false, 'globe', ['languages'], null],
  ['coursera', 'Coursera', 'Education', null, false, 'award', ['online courses'], null],
  ['kahoot', 'Kahoot!', 'Education', null, false, 'help-circle', ['kahoot', 'quiz'], null],
  ['classdojo', 'ClassDojo', 'Education', null, false, 'users', ['class dojo', 'school'], null],
  ['mathletics', 'Mathletics', 'Education', null, false, 'divide-square', ['maths practice'], null],

  // Everyday utilities
  ['speedtest', 'Speedtest', 'Utilities', null, false, 'activity', ['internet speed', 'wifi test'], 'com.ookla.speedtest'],
  ['authy', 'Authy', 'Utilities', null, false, 'shield', ['2fa', 'authenticator'], 'com.authy'],
  ['google-one', 'Google One', 'Utilities', null, false, 'cloud', ['storage', 'backup'], null],
  ['opera', 'Opera', 'Utilities', null, false, 'globe', ['opera browser', 'browser'], null],
  ['microsoft-bing', 'Microsoft Bing', 'Utilities', null, false, 'search', ['bing', 'search'], null],
  ['tile', 'Tile', 'Utilities', null, false, 'map-pin', ['tracker', 'lost keys'], null],
  ['accuweather', 'AccuWeather', 'Utilities', null, false, 'sun', ['forecast'], null],
  ['windy', 'Windy.com', 'Utilities', null, false, 'wind', ['windy', 'wind map'], null],
  ['amazon-alexa', 'Amazon Alexa', 'Utilities', null, false, 'speaker', ['alexa', 'echo', 'smart home'], 'com.amazon.echo'],
  ['nordvpn', 'NordVPN', 'Utilities', null, false, 'shield', ['vpn'], null],

  // Other popular categories
  ['picsart', 'Picsart', 'Photo & Design', null, false, 'image', ['photo editor', 'stickers'], 'com.picsart.studio'],
  ['inshot', 'InShot', 'Photo & Design', null, false, 'film', ['video editor'], null],
  ['adobe-express', 'Adobe Express', 'Photo & Design', null, false, 'pen-tool', ['graphics', 'design'], 'com.adobe.post'],
  ['imovie', 'iMovie', 'Photo & Design', null, false, 'film', ['video editor'], 'com.apple.iMovie'],
  ['clue', 'Clue', 'Health & Fitness', null, false, 'droplet', ['period tracker', 'cycle'], null],
  ['nike-training-club', 'Nike Training Club', 'Health & Fitness', null, false, 'dumbbell', ['ntc', 'workouts'], null],
  ['finch', 'Finch', 'Health & Fitness', null, false, 'smile', ['self care', 'habit'], null],
  ['klarna', 'Klarna', 'Finance', null, false, 'shopping-bag', ['buy now pay later', 'bnpl'], null],
  ['zip-pay', 'Zip', 'Finance', null, false, 'shopping-bag', ['zip pay', 'zip money', 'bnpl'], null],
  ['splitwise', 'Splitwise', 'Finance', null, false, 'divide', ['split bills'], null],
  ['aliexpress', 'AliExpress', 'Shopping', null, false, 'package', ['ali express'], 'com.alibaba.iAliexpress'],
  ['jb-hi-fi', 'JB Hi-Fi', 'Shopping', null, false, 'speaker', ['jb hifi', 'electronics'], null],
  ['dominos', "Domino's", 'Food & Drink', null, false, 'pizza', ['dominos', 'pizza'], null],
  ['kfc', 'KFC', 'Food & Drink', null, false, 'utensils', ['kentucky fried chicken'], null],
  ['too-good-to-go', 'Too Good To Go', 'Food & Drink', null, false, 'leaf', ['food waste', 'surprise bag'], null],
  ['jetstar', 'Jetstar', 'Travel & Transport', null, false, 'plane', ['airline', 'flights'], null],
  ['transit', 'Transit', 'Travel & Transport', null, false, 'map-pin', ['public transport', 'bus times'], null],
  ['tfl-go', 'TfL Go', 'Travel & Transport', null, false, 'navigation', ['tfl', 'london transport', 'tube'], null],
  ['flipboard', 'Flipboard', 'News & Reading', null, false, 'book-open', ['magazine'], null],
  ['substack', 'Substack', 'News & Reading', null, false, 'file-text', ['newsletters'], null],
  ['webtoon', 'WEBTOON', 'News & Reading', null, false, 'book-open', ['comics', 'manhwa'], null],

  // ---- T170: wider catalogue (owner: "what happens to icons that don't have themes?"). Every app
  // here gets an original generic glyph, so it draws theme art instead of falling back to a
  // monogram. Schemes only where publicly known; otherwise null and the Shortcuts method applies.
  // Social
  ['weibo', 'Weibo', 'Social', 'sinaweibo://', false, 'eye', ['sina weibo', 'microblog'], 'com.sina.weibo'],
  ['locket', 'Locket Widget', 'Social', null, false, 'image', ['locket', 'photo widget'], null],
  ['grindr', 'Grindr', 'Social', null, false, 'heart', ['dating'], 'com.grindrguy.grindrx'],
  ['patreon', 'Patreon', 'Social', null, false, 'award', ['creators', 'membership'], null],
  ['yik-yak', 'Yik Yak', 'Social', null, false, 'message-square', ['anonymous', 'campus'], null],
  ['flickr', 'Flickr', 'Social', null, false, 'aperture', ['photo sharing'], 'com.yahoo.flickr'],
  ['vk', 'VK', 'Social', null, false, 'users', ['vkontakte'], 'com.vk.vkclient'],
  // Messaging
  ['whatsapp-business', 'WhatsApp Business', 'Messaging', null, false, 'briefcase', ['wa business'], 'net.whatsapp.WhatsAppSMB'],
  ['kik', 'Kik', 'Messaging', null, false, 'message-circle', ['kik messenger'], 'com.kik.chat'],
  ['element', 'Element', 'Messaging', null, false, 'hash', ['matrix'], 'im.vector.app'],
  ['session', 'Session', 'Messaging', null, false, 'lock', ['private messenger'], null],
  ['wire', 'Wire', 'Messaging', null, false, 'shield', ['secure chat'], 'com.wearezeta.zclient.ios'],
  ['google-voice', 'Google Voice', 'Messaging', null, false, 'voicemail', ['gvoice'], 'com.google.GVDialer'],
  ['textnow', 'TextNow', 'Messaging', null, false, 'phone-call', ['free calls', 'texting'], null],
  ['zalo', 'Zalo', 'Messaging', null, false, 'message-circle', [], null],
  ['marco-polo', 'Marco Polo', 'Messaging', null, false, 'video', ['video messages'], null],
  // Photo & Design
  ['facetune', 'Facetune', 'Photo & Design', null, false, 'smile', ['retouch', 'selfie editor'], 'com.lightricks.Facetune2'],
  ['unfold', 'Unfold', 'Photo & Design', null, false, 'layout', ['story templates'], null],
  ['darkroom', 'Darkroom', 'Photo & Design', null, false, 'aperture', ['photo editor'], null],
  ['halide', 'Halide', 'Photo & Design', null, false, 'camera', ['pro camera', 'raw'], null],
  ['remini', 'Remini', 'Photo & Design', null, false, 'zap', ['photo enhancer'], null],
  ['photoroom', 'Photoroom', 'Photo & Design', null, false, 'scissors', ['background remover'], null],
  ['b612', 'B612', 'Photo & Design', null, false, 'camera', ['beauty camera'], null],
  ['unsplash', 'Unsplash', 'Photo & Design', null, false, 'image', ['free photos', 'wallpapers'], null],
  ['behance', 'Behance', 'Photo & Design', null, false, 'grid', ['portfolio'], null],
  ['vn-video-editor', 'VN Video Editor', 'Photo & Design', null, false, 'film', ['vn', 'video editing'], null],
  ['adobe-photoshop', 'Adobe Photoshop', 'Photo & Design', null, false, 'crop', ['photoshop', 'ps'], null],
  ['figma', 'Figma', 'Photo & Design', null, false, 'pen-tool', ['design', 'prototype'], null],
  // Music & Audio
  ['qobuz', 'Qobuz', 'Music & Audio', null, false, 'disc', ['hi-res', 'lossless'], null],
  ['musixmatch', 'Musixmatch', 'Music & Audio', null, false, 'file-text', ['lyrics'], null],
  ['genius', 'Genius', 'Music & Audio', null, false, 'star', ['lyrics', 'annotations'], null],
  ['smule', 'Smule', 'Music & Audio', null, false, 'mic', ['karaoke', 'sing'], null],
  ['anghami', 'Anghami', 'Music & Audio', null, false, 'music', [], null],
  ['jiosaavn', 'JioSaavn', 'Music & Audio', null, false, 'music', ['saavn'], null],
  ['audiomack', 'Audiomack', 'Music & Audio', null, false, 'headphones', [], null],
  ['castbox', 'Castbox', 'Music & Audio', null, false, 'radio', ['podcasts'], null],
  ['guitartuna', 'GuitarTuna', 'Music & Audio', null, false, 'sliders', ['tuner', 'guitar'], null],
  ['yousician', 'Yousician', 'Music & Audio', null, false, 'music', ['learn guitar', 'learn piano'], null],
  ['moises', 'Moises', 'Music & Audio', null, false, 'sliders', ['stems', 'practice'], null],
  // Video & TV
  ['vlc', 'VLC', 'Video & TV', 'vlc://', false, 'play', ['vlc media player', 'video player'], 'org.videolan.vlc-ios'],
  ['infuse', 'Infuse', 'Video & TV', 'infuse://', false, 'play-circle', ['video player'], 'com.firecore.infuse'],
  ['rumble', 'Rumble', 'Video & TV', null, false, 'play-circle', [], null],
  ['kick', 'Kick', 'Video & TV', null, false, 'cast', ['live streams'], null],
  ['mubi', 'MUBI', 'Video & TV', null, false, 'film', ['arthouse', 'cinema'], null],
  ['fubo', 'Fubo', 'Video & TV', null, false, 'tv', ['fubotv', 'live sport'], null],
  ['sling-tv', 'Sling TV', 'Video & TV', null, false, 'tv', ['sling'], null],
  ['discovery-plus', 'discovery+', 'Video & TV', null, false, 'tv', ['discovery plus'], null],
  ['youtube-tv', 'YouTube TV', 'Video & TV', null, false, 'tv', ['yt tv', 'live tv'], 'com.google.ios.youtubeunplugged'],
  ['dazn', 'DAZN', 'Video & TV', null, false, 'award', ['boxing', 'sport streaming'], null],
  ['viki', 'Viki', 'Video & TV', null, false, 'film', ['k-drama', 'kdrama'], null],
  // Productivity
  ['ulysses', 'Ulysses', 'Productivity', 'ulysses://', false, 'feather', ['writing'], null],
  ['due', 'Due', 'Productivity', 'due://', false, 'bell', ['reminders', 'timers'], null],
  ['day-one', 'Day One', 'Productivity', 'dayone://', false, 'book', ['journal', 'diary'], null],
  ['omnifocus', 'OmniFocus', 'Productivity', 'omnifocus://', false, 'check-square', ['gtd', 'tasks'], null],
  ['spark-mail', 'Spark Mail', 'Productivity', 'readdle-spark://', false, 'send', ['spark', 'email'], 'com.readdle.smartemail'],
  ['yahoo-mail', 'Yahoo Mail', 'Productivity', 'ymail://', false, 'inbox', ['yahoo', 'email'], 'com.yahoo.Aerogram'],
  ['proton-mail', 'Proton Mail', 'Productivity', null, false, 'lock', ['protonmail', 'encrypted email'], 'ch.protonmail.protonmail'],
  ['monday', 'monday.com', 'Productivity', null, false, 'columns', ['monday', 'work management'], null],
  ['clickup', 'ClickUp', 'Productivity', null, false, 'check-circle', ['tasks', 'projects'], null],
  ['jira', 'Jira', 'Productivity', null, false, 'layout', ['issues', 'tickets'], null],
  ['confluence', 'Confluence', 'Productivity', null, false, 'book-open', ['wiki'], null],
  ['miro', 'Miro', 'Productivity', null, false, 'edit-3', ['whiteboard', 'brainstorm'], null],
  ['airtable', 'Airtable', 'Productivity', null, false, 'table', ['database', 'spreadsheet'], null],
  ['craft', 'Craft', 'Productivity', null, false, 'file-text', ['docs', 'notes'], null],
  ['calendly', 'Calendly', 'Productivity', null, false, 'calendar', ['scheduling', 'meetings'], null],
  ['docusign', 'Docusign', 'Productivity', null, false, 'edit-2', ['e-signature', 'sign documents'], 'com.docusign.ink'],
  ['box', 'Box', 'Productivity', null, false, 'box', ['cloud storage'], 'net.box.BoxNet'],
  ['notability', 'Notability', 'Productivity', null, false, 'edit-3', ['handwritten notes'], 'com.gingerlabs.Notability'],
  ['grammarly', 'Grammarly', 'Productivity', null, false, 'type', ['grammar', 'keyboard'], null],
  ['deepl', 'DeepL', 'Productivity', null, false, 'globe', ['translator', 'deepl translate'], null],
  ['otter', 'Otter', 'Productivity', null, false, 'mic', ['otter.ai', 'transcription'], null],
  ['deepseek', 'DeepSeek', 'Productivity', null, false, 'search', ['ai chat'], null],
  ['grok', 'Grok', 'Productivity', null, false, 'message-square', ['ai chat'], null],
  ['adobe-scan', 'Adobe Scan', 'Productivity', null, false, 'file', ['scanner', 'pdf scan'], 'com.adobe.scan.ios'],
  // Finance
  ['zelle', 'Zelle', 'Finance', null, false, 'send', ['send money'], null],
  ['capital-one', 'Capital One', 'Finance', null, false, 'credit-card', ['capitalone'], 'com.capitalone.enterprisemobilebanking'],
  ['citi', 'Citi Mobile', 'Finance', null, false, 'bank', ['citibank', 'citi'], null],
  ['american-express', 'American Express', 'Finance', null, false, 'credit-card', ['amex'], null],
  ['sofi', 'SoFi', 'Finance', null, false, 'bank', ['loans', 'investing'], null],
  ['chime', 'Chime', 'Finance', null, false, 'bank', ['mobile banking'], null],
  ['credit-karma', 'Credit Karma', 'Finance', null, false, 'trending-up', ['credit score'], null],
  ['fidelity', 'Fidelity', 'Finance', null, false, 'bar-chart-2', ['investing', 'retirement'], null],
  ['charles-schwab', 'Charles Schwab', 'Finance', null, false, 'bar-chart', ['schwab', 'brokerage'], null],
  ['vanguard', 'Vanguard', 'Finance', null, false, 'pie-chart', ['index funds', 'super'], null],
  ['webull', 'Webull', 'Finance', null, false, 'trending-up', ['stocks', 'trading'], null],
  ['binance', 'Binance', 'Finance', null, false, 'hexagon', ['crypto', 'bitcoin'], null],
  ['n26', 'N26', 'Finance', null, false, 'bank', ['mobile bank'], null],
  ['lloyds', 'Lloyds Bank', 'Finance', null, false, 'bank', ['lloyds'], null],
  ['natwest', 'NatWest', 'Finance', null, false, 'bank', ['nat west'], null],
  ['macquarie', 'Macquarie', 'Finance', null, false, 'bank', ['macquarie bank'], null],
  ['commsec', 'CommSec', 'Finance', null, false, 'trending-up', ['shares', 'asx'], null],
  ['ynab', 'YNAB', 'Finance', null, false, 'pie-chart', ['you need a budget', 'budget'], null],
  ['rocket-money', 'Rocket Money', 'Finance', null, false, 'dollar-sign', ['budget', 'subscriptions'], null],
  ['google-wallet', 'Google Wallet', 'Finance', null, false, 'credit-card', ['google pay', 'gpay'], null],
  // Shopping
  ['best-buy', 'Best Buy', 'Shopping', null, false, 'monitor', ['electronics'], null],
  ['costco', 'Costco', 'Shopping', null, false, 'shopping-cart', ['wholesale'], null],
  ['home-depot', 'The Home Depot', 'Shopping', null, false, 'tool', ['home depot', 'hardware'], null],
  ['lowes', 'Lowe’s', 'Shopping', null, false, 'tool', ['lowes', 'hardware'], null],
  ['wayfair', 'Wayfair', 'Shopping', null, false, 'home', ['furniture'], null],
  ['sephora', 'Sephora', 'Shopping', null, false, 'droplet', ['makeup', 'beauty'], null],
  ['nike', 'Nike', 'Shopping', null, false, 'shopping-bag', ['sneakers', 'snkrs'], 'com.nike.omega'],
  ['zara', 'Zara', 'Shopping', null, false, 'shopping-bag', ['fashion'], null],
  ['h-and-m', 'H&M', 'Shopping', null, false, 'shopping-bag', ['hm', 'h and m'], null],
  ['uniqlo', 'UNIQLO', 'Shopping', null, false, 'shopping-bag', ['clothes'], null],
  ['argos', 'Argos', 'Shopping', null, false, 'package', [], null],
  ['offerup', 'OfferUp', 'Shopping', null, false, 'tag', ['second hand', 'marketplace'], null],
  ['mercari', 'Mercari', 'Shopping', null, false, 'tag', ['resale'], null],
  ['poshmark', 'Poshmark', 'Shopping', null, false, 'tag', ['resale', 'fashion'], null],
  ['stockx', 'StockX', 'Shopping', null, false, 'trending-up', ['sneakers', 'resale'], null],
  ['aldi', 'ALDI', 'Shopping', null, false, 'shopping-cart', ['groceries', 'supermarket'], null],
  ['flipkart', 'Flipkart', 'Shopping', null, false, 'shopping-bag', [], null],
  ['shopee', 'Shopee', 'Shopping', null, false, 'shopping-bag', [], null],
  ['rakuten', 'Rakuten', 'Shopping', null, false, 'gift', ['cash back'], null],
  ['big-w', 'BIG W', 'Shopping', null, false, 'shopping-cart', ['bigw'], null],
  ['the-iconic', 'THE ICONIC', 'Shopping', null, false, 'shopping-bag', ['iconic', 'fashion'], null],
  // Food & Drink
  ['subway-restaurants', 'Subway', 'Food & Drink', null, false, 'utensils', ['sandwiches'], null],
  ['chipotle', 'Chipotle', 'Food & Drink', null, false, 'utensils', ['burrito'], null],
  ['burger-king', 'Burger King', 'Food & Drink', null, false, 'utensils', ['bk', 'hungry jacks'], null],
  ['pizza-hut', 'Pizza Hut', 'Food & Drink', null, false, 'pizza', [], null],
  ['dunkin', 'Dunkin’', 'Food & Drink', null, false, 'coffee', ['dunkin donuts'], null],
  ['tim-hortons', 'Tim Hortons', 'Food & Drink', null, false, 'coffee', ['tims'], null],
  ['chick-fil-a', 'Chick-fil-A', 'Food & Drink', null, false, 'utensils', ['chicken'], null],
  ['hellofresh', 'HelloFresh', 'Food & Drink', null, false, 'package', ['meal kits', 'recipes'], null],
  ['opentable', 'OpenTable', 'Food & Drink', null, false, 'calendar', ['restaurant booking'], null],
  ['nyt-cooking', 'NYT Cooking', 'Food & Drink', null, false, 'book-open', ['recipes'], null],
  ['allrecipes', 'Allrecipes', 'Food & Drink', null, false, 'book-open', ['recipes'], null],
  ['zomato', 'Zomato', 'Food & Drink', null, false, 'utensils', ['food delivery'], null],
  ['swiggy', 'Swiggy', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  ['wolt', 'Wolt', 'Food & Drink', null, false, 'truck', ['food delivery'], null],
  // Travel & Transport
  ['hopper', 'Hopper', 'Travel & Transport', null, false, 'plane', ['cheap flights'], null],
  ['kayak', 'KAYAK', 'Travel & Transport', null, false, 'plane', ['flights', 'hotels'], null],
  ['united', 'United Airlines', 'Travel & Transport', null, false, 'plane', ['united'], 'com.united.UnitedCustomerFacingIPhoneApp'],
  ['delta', 'Fly Delta', 'Travel & Transport', null, false, 'plane', ['delta', 'delta air lines'], 'com.delta.iphone.ver1'],
  ['american-airlines', 'American Airlines', 'Travel & Transport', null, false, 'plane', ['aa'], null],
  ['southwest', 'Southwest Airlines', 'Travel & Transport', null, false, 'plane', ['southwest'], null],
  ['british-airways', 'British Airways', 'Travel & Transport', null, false, 'plane', ['ba'], null],
  ['virgin-australia', 'Virgin Australia', 'Travel & Transport', null, false, 'plane', ['virgin'], null],
  ['emirates', 'Emirates', 'Travel & Transport', null, false, 'plane', ['airline'], null],
  ['ryanair', 'Ryanair', 'Travel & Transport', null, false, 'plane', ['airline'], null],
  ['hotels-com', 'Hotels.com', 'Travel & Transport', null, false, 'home', ['hotels'], null],
  ['vrbo', 'Vrbo', 'Travel & Transport', null, false, 'home', ['holiday homes', 'vacation rentals'], null],
  ['agoda', 'Agoda', 'Travel & Transport', null, false, 'map-pin', ['hotels'], null],
  ['trip-com', 'Trip.com', 'Travel & Transport', null, false, 'globe', ['ctrip'], null],
  ['flightradar24', 'Flightradar24', 'Travel & Transport', null, false, 'navigation-2', ['flight tracker'], null],
  ['flighty', 'Flighty', 'Travel & Transport', null, false, 'navigation', ['flight tracker'], null],
  ['tripit', 'TripIt', 'Travel & Transport', null, false, 'briefcase', ['itinerary'], null],
  ['moovit', 'Moovit', 'Travel & Transport', null, false, 'map', ['public transport'], null],
  ['grab', 'Grab', 'Travel & Transport', null, false, 'car', ['ride hailing'], 'com.grabtaxi.iphone'],
  ['lime', 'Lime', 'Travel & Transport', null, false, 'zap', ['e-scooter', 'e-bike'], null],
  ['gasbuddy', 'GasBuddy', 'Travel & Transport', null, false, 'droplet', ['fuel prices', 'petrol'], null],
  ['amtrak', 'Amtrak', 'Travel & Transport', null, false, 'map', ['trains'], null],
  // Health & Fitness
  ['noom', 'Noom', 'Health & Fitness', null, false, 'activity', ['weight loss'], null],
  ['ww', 'WW (WeightWatchers)', 'Health & Fitness', null, false, 'target', ['weight watchers'], null],
  ['lose-it', 'Lose It!', 'Health & Fitness', null, false, 'target', ['calorie counter'], null],
  ['cronometer', 'Cronometer', 'Health & Fitness', null, false, 'pie-chart', ['nutrition tracker'], null],
  ['zero-fasting', 'Zero Fasting', 'Health & Fitness', null, false, 'clock', ['fasting', 'zero'], null],
  ['sweat', 'Sweat', 'Health & Fitness', null, false, 'dumbbell', ['workouts'], null],
  ['fitbod', 'Fitbod', 'Health & Fitness', null, false, 'dumbbell', ['gym', 'strength'], null],
  ['hevy', 'Hevy', 'Health & Fitness', null, false, 'dumbbell', ['workout log', 'gym'], null],
  ['whoop', 'WHOOP', 'Health & Fitness', null, false, 'activity', ['recovery', 'strain'], null],
  ['insight-timer', 'Insight Timer', 'Health & Fitness', null, false, 'sun', ['meditation'], null],
  ['medisafe', 'Medisafe', 'Health & Fitness', null, false, 'pill', ['pill reminder', 'medication'], null],
  ['runkeeper', 'Runkeeper', 'Health & Fitness', null, false, 'navigation', ['running'], null],
  ['zwift', 'Zwift', 'Health & Fitness', null, false, 'activity', ['indoor cycling'], null],
  ['komoot', 'komoot', 'Health & Fitness', null, false, 'map', ['hiking', 'cycling routes'], null],
  ['mychart', 'MyChart', 'Health & Fitness', null, false, 'clipboard', ['patient portal'], null],
  // News & Reading
  ['google-news', 'Google News', 'News & Reading', null, false, 'rss', ['headlines'], null],
  ['cnn', 'CNN', 'News & Reading', null, false, 'tv', ['cnn news'], 'com.cnn.iphone'],
  ['fox-news', 'Fox News', 'News & Reading', null, false, 'tv', ['fox'], null],
  ['reuters', 'Reuters', 'News & Reading', null, false, 'globe', ['world news'], null],
  ['ap-news', 'AP News', 'News & Reading', null, false, 'globe', ['associated press'], null],
  ['wsj', 'The Wall Street Journal', 'News & Reading', null, false, 'file-text', ['wsj', 'wall street journal'], null],
  ['washington-post', 'The Washington Post', 'News & Reading', null, false, 'file-text', ['wapo'], null],
  ['the-economist', 'The Economist', 'News & Reading', null, false, 'bar-chart', ['economist'], null],
  ['financial-times', 'Financial Times', 'News & Reading', null, false, 'trending-up', ['ft'], null],
  ['sydney-morning-herald', 'The Sydney Morning Herald', 'News & Reading', null, false, 'file-text', ['smh'], null],
  ['daily-mail', 'Daily Mail', 'News & Reading', null, false, 'file-text', ['mail online'], null],
  ['sky-news', 'Sky News', 'News & Reading', null, false, 'tv', [], null],
  ['ground-news', 'Ground News', 'News & Reading', null, false, 'layers', ['news bias'], null],
  ['wattpad', 'Wattpad', 'News & Reading', null, false, 'book-open', ['stories', 'fan fiction'], null],
  // Education
  ['wikipedia', 'Wikipedia', 'Education', 'wikipedia://', false, 'book', ['wiki', 'encyclopedia'], 'org.wikimedia.wikipedia'],
  ['brilliant', 'Brilliant', 'Education', null, false, 'zap', ['maths', 'science'], null],
  ['memrise', 'Memrise', 'Education', null, false, 'globe', ['languages'], null],
  ['busuu', 'Busuu', 'Education', null, false, 'message-circle', ['languages'], null],
  ['rosetta-stone', 'Rosetta Stone', 'Education', null, false, 'globe', ['languages'], null],
  ['elevate', 'Elevate', 'Education', null, false, 'trending-up', ['brain training'], null],
  ['lumosity', 'Lumosity', 'Education', null, false, 'cpu', ['brain games'], null],
  ['udemy', 'Udemy', 'Education', null, false, 'play-circle', ['courses'], null],
  ['ted', 'TED', 'Education', null, false, 'mic', ['ted talks'], null],
  ['ankimobile', 'AnkiMobile', 'Education', null, false, 'copy', ['anki', 'flashcards'], null],
  // Games
  ['fortnite', 'Fortnite', 'Games', null, false, 'game-controller', ['battle royale'], null],
  ['pokemon-unite', 'Pokémon UNITE', 'Games', null, false, 'game-controller', ['moba'], null],
  ['two-dots', 'Two Dots', 'Games', null, false, 'circle', ['puzzle'], null],
  ['altos-odyssey', 'Alto’s Odyssey', 'Games', null, false, 'wind', ['altos adventure', 'snowboard'], null],
  ['asphalt-legends', 'Asphalt Legends', 'Games', null, false, 'car', ['asphalt 9', 'racing'], 'com.gameloft.asphalt9'],
  ['real-racing-3', 'Real Racing 3', 'Games', null, false, 'car', ['racing'], null],
  ['vampire-survivors', 'Vampire Survivors', 'Games', null, false, 'moon', ['roguelike'], null],
  ['balatro', 'Balatro', 'Games', null, false, 'grid', ['poker', 'roguelike', 'cards'], null],
  ['wild-rift', 'League of Legends: Wild Rift', 'Games', null, false, 'award', ['lol', 'wild rift', 'moba'], null],
  ['efootball', 'eFootball', 'Games', null, false, 'target', ['pes', 'soccer', 'football'], null],
  // Utilities
  ['expressvpn', 'ExpressVPN', 'Utilities', null, false, 'shield', ['vpn'], null],
  ['proton-vpn', 'Proton VPN', 'Utilities', null, false, 'shield', ['vpn', 'protonvpn'], 'ch.protonmail.vpn'],
  ['surfshark', 'Surfshark', 'Utilities', null, false, 'shield', ['vpn'], null],
  ['bitwarden', 'Bitwarden', 'Utilities', null, false, 'lock', ['password manager'], 'com.8bit.bitwarden'],
  ['lastpass', 'LastPass', 'Utilities', null, false, 'lock', ['password manager'], null],
  ['dashlane', 'Dashlane', 'Utilities', null, false, 'key', ['password manager'], null],
  ['google-lens', 'Google Lens', 'Utilities', null, false, 'eye', ['visual search', 'lens'], null],
  ['scriptable', 'Scriptable', 'Utilities', 'scriptable://', false, 'code', ['javascript', 'automation'], 'dk.simonbs.Scriptable'],
  ['working-copy', 'Working Copy', 'Utilities', 'working-copy://', false, 'git-branch', ['git'], 'com.appliedphasor.working-copy'],
  ['the-weather-channel', 'The Weather Channel', 'Utilities', null, false, 'cloud-rain', ['weather channel', 'twc'], 'com.weather.TWC'],
  ['carrot-weather', 'CARROT Weather', 'Utilities', null, false, 'cloud-lightning', ['carrot'], null],
  ['arlo', 'Arlo', 'Utilities', null, false, 'video', ['security camera'], null],
  ['smartthings', 'SmartThings', 'Utilities', null, false, 'home', ['smart home'], null],
  ['philips-hue', 'Philips Hue', 'Utilities', null, false, 'sun', ['hue', 'smart lights'], null],
  ['tesla', 'Tesla', 'Utilities', null, false, 'car', ['ev', 'car app'], 'com.teslamotors.TeslaApp'],
  ['fing', 'Fing', 'Utilities', null, false, 'wifi', ['network scanner'], null],
  ['tailscale', 'Tailscale', 'Utilities', null, false, 'link', ['vpn', 'network'], 'io.tailscale.ipn.ios'],
  ['termius', 'Termius', 'Utilities', null, false, 'terminal', ['ssh'], null],
];

ROWS.push(...extraRowsT189(ROWS)); // T189: extra rows from catalogueExtra.ts (see the end of this file)

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

export const CATALOGUE: readonly CatalogueEntry[] = Object.freeze(ROWS.map(entryFromRow));

/** Every Feather glyph name used by the catalogue (sorted, unique). */
export const GLYPHS: readonly string[] = Object.freeze([...new Set(CATALOGUE.map((e) => e.glyph))].sort());

const byId = new Map<string, CatalogueEntry>(CATALOGUE.map((e) => [e.id, e]));

export function getById(id: string): CatalogueEntry | undefined {
  return byId.get(id);
}

// T189: one shared collator (same order as localeCompare('en', base), without a new collator per call).
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });
const ID_COLLATOR = new Intl.Collator();
const byName = (a: CatalogueEntry, b: CatalogueEntry) => NAME_COLLATOR.compare(a.name, b.name) || ID_COLLATOR.compare(a.id, b.id);

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
  // T189: three rolling rows instead of a full matrix (same result, far less allocation).
  let prev2 = new Int32Array(n + 1);
  let prev = new Int32Array(n + 1);
  let cur = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return prev[n];
}

// T189: editDistance(a, b) when it is <= max, else max + 1. Reuses three buffers and stops as soon
// as a whole row is above max (OSA distance never drops below a row's minimum two rows later).
let BD_A = new Int32Array(64);
let BD_B = new Int32Array(64);
let BD_C = new Int32Array(64);
function boundedDistance(a: string, b: string, max: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  if (m === 0 || n === 0) return Math.max(m, n);
  if (BD_A.length < n + 1) {
    BD_A = new Int32Array(n + 1);
    BD_B = new Int32Array(n + 1);
    BD_C = new Int32Array(n + 1);
  }
  let prev2 = BD_A;
  let prev = BD_B;
  let cur = BD_C;
  for (let j = 0; j <= n; j++) prev[j] = j;
  let lastRowMin = 0;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    // A transposition can reach back two rows, so stop only when two consecutive rows exceed max.
    if (rowMin > max && lastRowMin > max) return max + 1;
    lastRowMin = rowMin;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return Math.min(prev[n], max + 1);
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

type Indexed = {
  entry: CatalogueEntry;
  name: string;
  nameC: string;
  nameWords: string[];
  aliases: string[];
  aliasesC: string[];
  aliasWords: string[][];
  fuzzyTargets: string[];
  fuzzyMasks: number[];
};

const INDEX: Indexed[] = CATALOGUE.map((entry) => {
  const nameC = compact(entry.name);
  const nameWords = words(entry.name);
  const aliasesC = entry.aliases.map(compact);
  const fuzzyTargets = [nameC, ...nameWords, ...aliasesC].filter(Boolean);
  return {
    entry,
    name: normalize(entry.name),
    nameC,
    nameWords,
    aliases: entry.aliases.map(normalize),
    aliasesC,
    aliasWords: entry.aliases.map(words), // T189: precomputed (was split per query)
    fuzzyTargets,
    fuzzyMasks: fuzzyTargets.map((t) => charMask(t, t.length)),
  };
});

// T189: bit set of the [a-z0-9] characters in s[0..len) (compact strings only hold those).
function charMask(s: string, len: number): number {
  let m = 0;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c >= 97 && c <= 122) m |= 1 << (c - 97);
    else if (c >= 48 && c <= 57) m |= 1 << 26; // all digits share one bit (still a valid lower bound)
  }
  return m;
}

/** Distinct characters of the query mask missing from the target mask. */
function missingChars(q: number, t: number): number {
  let v = q & ~t;
  let n = 0;
  while (v) {
    v &= v - 1;
    n++;
  }
  return n;
}

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
    if (a.startsWith(q) || (qc && x.aliasesC[i].startsWith(qc)) || x.aliasWords[i].some((w) => w.startsWith(q)))
      return [T_ALIAS, 1];
  }
  if (x.name.includes(q) || (qc && x.nameC.includes(qc))) return [T_SUBSTRING, 0];
  if (x.aliases.some((a, i) => a.includes(q) || (qc && x.aliasesC[i].includes(qc)))) return [T_SUBSTRING, 1];

  if (qc.length < 2) return null;
  // Fuzzy: small edit distance against the whole name, its words, a same-length prefix, or aliases.
  const maxD = qc.length <= 4 ? 1 : 2;
  let best = Infinity;
  const qMask = charMask(qc, qc.length);
  for (let k = 0; k < x.fuzzyTargets.length; k++) {
    // T189: skip pairs that provably cannot be within maxD (same result, much less work): each edit
    // brings in at most one character the target lacks.
    const t = x.fuzzyTargets[k];
    if (missingChars(qMask, x.fuzzyMasks[k]) <= maxD) best = Math.min(best, boundedDistance(qc, t, maxD));
    if (t.length > qc.length && missingChars(qMask, charMask(t, qc.length)) <= maxD) {
      best = Math.min(best, boundedDistance(qc, t.slice(0, qc.length), maxD));
    }
    if (best === 0) break;
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

// ---------------------------------------------------------------- exact lookup by name (T170)

const NAME_INDEX = new Map<string, CatalogueEntry>();
const ALIAS_INDEX = new Map<string, CatalogueEntry>();
for (const e of CATALOGUE) {
  for (const k of [normalize(e.name), compact(e.name)]) if (k && !NAME_INDEX.has(k)) NAME_INDEX.set(k, e);
}
for (const e of CATALOGUE) {
  for (const a of e.aliases) {
    for (const k of [normalize(a), compact(a)]) if (k && !NAME_INDEX.has(k) && !ALIAS_INDEX.has(k)) ALIAS_INDEX.set(k, e);
  }
}

/**
 * T170: the catalogue entry for an app's display name (the label under a Home Screen icon), or
 * undefined. Exact match only (no fuzzy guesses), case-, accent-, space- and punctuation-insensitive:
 * a catalogue name first ("YouTube Music", "youtube music", "YOUTUBEMUSIC"), then an alias
 * ("Twitter" -> X). Use search() for type-ahead; use this to map a list of installed app names.
 */
export function findByName(name: string | null | undefined): CatalogueEntry | undefined {
  if (typeof name !== 'string') return undefined;
  const n = normalize(name);
  if (!n) return undefined;
  const c = compact(name);
  return NAME_INDEX.get(n) ?? (c ? NAME_INDEX.get(c) : undefined) ?? ALIAS_INDEX.get(n) ?? (c ? ALIAS_INDEX.get(c) : undefined);
}

/** T170: findByName for many names at once; names with no entry map to undefined (order kept). */
export function findAllByName(names: readonly string[]): (CatalogueEntry | undefined)[] {
  return names.map((n) => findByName(n));
}

// ---------------------------------------------------------------- T189: extra catalogue rows
// The bigger "find apps" list lives in catalogueExtra.ts ([id, name, category, bundleId, glyph,
// aliases]). It is appended to ROWS (one-line hook right after ROWS) before CATALOGUE is built,
// skipping any row whose id, name or bundle id is already in the hand-written list. Extra rows have
// no URL scheme (they install with the Shortcuts "Open App" action by bundle id) and are never
// verified. Imports and function declarations are hoisted, so this block can sit at the end.

import { EXTRA_ROWS } from './catalogueExtra.ts';

function extraRowsT189(existing: readonly Row[]): Row[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  const bundles = new Set<string>();
  for (const r of existing) {
    ids.add(r[0]);
    names.add(normalize(r[1]));
    // A bundle id carried by a hand-written row (any reverse-DNS string after the name).
    for (let i = 3; i < r.length; i++) {
      const v: unknown = r[i];
      if (typeof v === 'string' && /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v)) bundles.add(v.toLowerCase());
    }
  }
  const out: Row[] = [];
  for (const [id, name, category, bundleId, glyph, aliases] of EXTRA_ROWS) {
    const n = normalize(name);
    const b = bundleId.toLowerCase();
    if (ids.has(id) || names.has(n) || bundles.has(b)) continue;
    ids.add(id);
    names.add(n);
    bundles.add(b);
    out.push([id, name, category, null, false, glyph, [...aliases], bundleId]);
  }
  return out;
}

/** T189: ids of the catalogue entries that came from catalogueExtra.ts (list order). */
export const EXTRA_IDS: readonly string[] = Object.freeze(
  EXTRA_ROWS.filter((r) => getById(r[0])?.name === r[1]).map((r) => r[0]),
);

const EXTRA_BUNDLE_IDS = new Map<string, string>(EXTRA_IDS.map((id) => [id, EXTRA_ROWS.find((r) => r[0] === id)![3]]));

/**
 * T189: the public bundle id for a catalogue entry, or null when none is known. Uses the entry's
 * own `bundleId` field when it has one (T183), else the id from catalogueExtra.ts.
 */
export function bundleIdFor(id: string): string | null {
  const entry = getById(id) as (CatalogueEntry & { bundleId?: unknown }) | undefined;
  if (!entry) return null;
  if (typeof entry.bundleId === 'string' && entry.bundleId) return entry.bundleId;
  return EXTRA_BUNDLE_IDS.get(id) ?? null;
}
