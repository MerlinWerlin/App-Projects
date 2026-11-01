// T189 (owner-1101 item 7): extra "find apps" catalogue rows, each with its public bundle id.
//
// How this list was built (honest note):
//  - Candidates came from public references (vendor pages, MDM / Shortcuts bundle-id lists) and
//    general knowledge. No StarNet / OpenAI / other AI service was used.
//  - EVERY bundle id below was then looked up in Apple's public iTunes lookup data
//    (itunes.apple.com/lookup?bundleId=...&country=au) on 31 Oct 2026, and only ids that the AU
//    App Store returned are kept (casing as Apple returned it). Candidates Apple did not return
//    (retired apps, China-only apps, ids that were wrong) were dropped, not guessed.
//  - Not exhaustively tested on a device. These rows install with the Shortcuts "Open App"
//    action (by bundle id), so urlScheme is always null and every row is verified: false.
//  - The list is much smaller than the owner's 1,500-2,000 aim on purpose: "fewer correct
//    entries over many guessed ones". Grow it by adding rows here once each id is looked up.
//  - 1 Nov 2026 (T196): +71 more, same method (AU lookup, a few ids per request; requests with
//    5+ ids came back empty, so those were re-sent 1-3 at a time; ids still not returned were dropped).
//  - 1 Nov 2026 (T197/T211): +115 more, same method (1-3 ids per lookup, AU store; three via the
//    US store). Apple's search endpoint is robots-blocked, so only candidate ids were looked up.
//  - 1 Nov 2026 (T215): +119 more. Same lookup endpoint, plus lookups by developer id
//    (lookup?id=<artistId>&entity=software), which return that developer's apps and bundle ids.
//    The same lookups filled 20 null bundle ids in catalogue.ts main rows.
//
// Glyphs are GENERIC names already used by the main catalogue (Feather or src/core/glyphnames.ts).
// Never a brand logo; app names are plain labels.
// Pure TypeScript (no React Native / Expo imports) so Node can run it directly.

import type { Category } from './catalogue.ts';

/** [id, name, category, bundleId, glyph, aliases] */
export type ExtraRow = readonly [string, string, Category, string, string, readonly string[]];

export const EXTRA_ROWS: readonly ExtraRow[] = Object.freeze([
  // ---- System (Apple)
  ['apple-store', 'Apple Store', 'System', 'com.apple.store.Jolly', 'shopping-bag', ['apple retail']],
  ['apple-support', 'Apple Support', 'System', 'com.apple.supportapp', 'help-circle', ['support']],
  ['testflight', 'TestFlight', 'System', 'com.apple.TestFlight', 'send', ['beta apps']],
  ['itunes-store', 'iTunes Store', 'System', 'com.apple.MobileStore', 'music', ['itunes']],
  ['apple-watch', 'Watch', 'System', 'com.apple.Bridge', 'watch', ['apple watch']],
  ['image-playground', 'Image Playground', 'System', 'com.apple.GenerativePlaygroundApp', 'image', ['genmoji']],
  ['apple-developer', 'Apple Developer', 'System', 'developer.apple.wwdc-Release', 'code', ['wwdc']],

  // ---- Social
  ['clubhouse', 'Clubhouse', 'Social', 'co.alphaexploration.clubhouse', 'mic', ['audio rooms']],
  ['rednote', 'rednote', 'Social', 'com.xingin.discover', 'book-open', ['xiaohongshu', 'little red book']],
  ['kuaishou', 'Kuaishou', 'Social', 'com.jiangjia.gif', 'video', ['kwai']],
  ['zhihu', 'Zhihu', 'Social', 'com.zhihu.ios', 'help-circle', ['q and a']],
  ['ivory', 'Ivory for Mastodon', 'Social', 'com.tapbots.Ivory', 'at-sign', ['ivory', 'mastodon client']],
  ['badoo', 'Badoo', 'Social', 'com.badoo.Badoo', 'heart', ['dating']],
  ['eventbrite', 'Eventbrite', 'Social', 'com.eventbrite.attendee', 'calendar', ['events', 'tickets']],
  ['weverse', 'Weverse', 'Social', 'co.benx.weverse', 'star', ['k-pop', 'fan community']],
  ['character-ai', 'Character.AI', 'Social', 'ai.character.app', 'message-square', ['character ai', 'ai chat']],

  // ---- Messaging
  ['qq', 'QQ', 'Messaging', 'com.tencent.mqq', 'message-circle', ['tencent qq']],
  ['wecom', 'WeCom', 'Messaging', 'com.tencent.ww', 'briefcase', ['wechat work']],
  ['dingtalk', 'DingTalk', 'Messaging', 'com.laiwang.DingTalk', 'message-square', ['ding']],

  // ---- Video & TV
  ['tencent-video', 'Tencent Video', 'Video & TV', 'com.tencent.live4iphone', 'play-circle', ['tencent tv']],
  ['youku', 'Youku', 'Video & TV', 'com.youku.YouKu', 'play-circle', ['youku tudou']],
  ['dailymotion', 'Dailymotion', 'Video & TV', 'com.dailymotion.dailymotion', 'play', ['videos']],
  ['justwatch', 'JustWatch', 'Video & TV', 'com.justwatch.justwatch', 'film', ['where to watch']],
  ['mlb', 'MLB', 'Video & TV', 'com.mlb.AtBatUniversal', 'award', ['baseball', 'at bat']],

  // ---- Productivity
  ['poe', 'Poe', 'Productivity', 'com.quora.app.Experts', 'message-square', ['ai chat']],
  ['microsoft-365', 'Microsoft 365 Copilot', 'Productivity', 'com.microsoft.officemobile', 'layers', ['office', 'microsoft office']],
  ['sharepoint', 'SharePoint', 'Productivity', 'com.microsoft.sharepoint', 'folder', ['microsoft sharepoint']],
  ['microsoft-planner', 'Microsoft Planner', 'Productivity', 'com.microsoft.PlannerMobile', 'check-square', ['planner']],
  ['power-bi', 'Microsoft Power BI', 'Productivity', 'com.microsoft.powerbimobile', 'bar-chart', ['power bi']],
  ['tuta-mail', 'Tuta Mail', 'Productivity', 'de.tutao.tutanota', 'lock', ['tutanota', 'encrypted email']],
  ['documents-readdle', 'Documents by Readdle', 'Productivity', 'com.readdle.ReaddleDocsIPad', 'folder', ['documents', 'file manager']],
  ['salesforce', 'Salesforce', 'Productivity', 'com.salesforce.chatter', 'cloud', ['crm']],
  ['shopify', 'Shopify', 'Productivity', 'com.jadedpixel.shopify', 'shopping-bag', ['shopify admin', 'online store']],
  ['wordpress', 'WordPress', 'Productivity', 'org.wordpress', 'edit', ['blog']],
  ['mega', 'MEGA', 'Productivity', 'mega.ios', 'cloud', ['cloud storage']],
  ['nextcloud', 'Nextcloud', 'Productivity', 'it.twsweb.Nextcloud', 'cloud', ['self hosted']],

  // ---- Utilities
  ['company-portal', 'Company Portal', 'Utilities', 'com.microsoft.CompanyPortal', 'shield', ['intune']],
  ['windows-app', 'Windows App', 'Utilities', 'com.microsoft.rdc.ios', 'monitor', ['remote desktop', 'rdp']],
  ['microsoft-translator', 'Microsoft Translator', 'Utilities', 'com.microsoft.translator', 'globe', ['translator']],
  ['gboard', 'Gboard', 'Utilities', 'com.google.keyboard', 'type', ['google keyboard']],
  ['google-assistant', 'Google Assistant', 'Utilities', 'com.google.OPA', 'mic', ['assistant']],
  ['blink', 'Blink Home Monitor', 'Utilities', 'com.immediasemi.ios.blink', 'video', ['blink camera']],
  ['github', 'GitHub', 'Utilities', 'com.github.stormbreaker.prod', 'git-branch', ['git', 'code']],
  ['indeed', 'Indeed', 'Utilities', 'com.indeed.JobSearch', 'briefcase', ['jobs']],
  ['duo-mobile', 'Duo Mobile', 'Utilities', 'com.duosecurity.DuoMobile', 'shield', ['2fa', 'duo']],
  ['cloudflare-warp', '1.1.1.1', 'Utilities', 'com.cloudflare.1dot1dot1dot1', 'shield', ['warp', 'cloudflare']],
  ['wireguard', 'WireGuard', 'Utilities', 'com.wireguard.ios', 'shield', ['vpn']],
  ['openvpn', 'OpenVPN Connect', 'Utilities', 'net.openvpn.connect.app', 'shield', ['vpn', 'openvpn']],
  ['ifttt', 'IFTTT', 'Utilities', 'com.ifttt.ifttt', 'zap', ['automation']],
  ['baidu', 'Baidu', 'Utilities', 'com.baidu.BaiduMobile', 'search', ['baidu search']],

  // ---- News & Reading
  ['feedly', 'Feedly', 'News & Reading', 'com.devhd.feedly', 'rss', ['rss reader']],
  ['instapaper', 'Instapaper', 'News & Reading', 'com.marcoarment.instapaperpro', 'bookmark', ['read later']],

  // ---- Education
  ['swift-playgrounds', 'Swift Playgrounds', 'Education', 'com.apple.Playgrounds', 'code', ['swift', 'coding']],

  // ---- Photo & Design
  ['photoshop-express', 'Photoshop Express', 'Photo & Design', 'com.adobe.PSMobile', 'sliders', ['ps express']],
  ['ibis-paint', 'ibisPaint X', 'Photo & Design', 'jp.ne.ibis.ibisPaintX', 'feather', ['drawing']],

  // ---- Finance
  ['square-pos', 'Square Point of Sale', 'Finance', 'com.squareup.square', 'credit-card', ['square pos']],
  ['metamask', 'MetaMask', 'Finance', 'io.metamask.MetaMask', 'lock', ['crypto wallet']],
  ['trust-wallet', 'Trust Wallet', 'Finance', 'com.sixdays.trust', 'lock', ['crypto wallet']],
  ['crypto-com', 'Crypto.com', 'Finance', 'co.mona.Monaco', 'hexagon', ['crypto', 'bitcoin']],
  ['alipay', 'Alipay', 'Finance', 'com.alipay.iphoneclient', 'dollar-sign', ['zhifubao']],
  ['paytm', 'Paytm', 'Finance', 'com.one97.paytm', 'dollar-sign', ['upi']],
  ['phonepe', 'PhonePe', 'Finance', 'com.phonepe.PhonePeApp', 'dollar-sign', ['upi']],

  // ---- Shopping
  ['taobao', 'Taobao', 'Shopping', 'com.taobao.taobao4iphone', 'shopping-bag', ['tao bao']],
  ['jd', 'JD.com', 'Shopping', 'com.360buy.jdmobile', 'shopping-cart', ['jingdong']],
  ['pinduoduo', 'Pinduoduo', 'Shopping', 'com.xunmeng.pinduoduo', 'shopping-bag', ['pdd']],
  ['wish', 'Wish', 'Shopping', 'com.contextlogic.Wish', 'gift', ['wish shopping']],
  ['groupon', 'Groupon', 'Shopping', 'com.groupon.grouponapp', 'tag', ['deals']],

  // ---- Food & Drink
  ['meituan', 'Meituan', 'Food & Drink', 'com.meituan.imeituan', 'truck', ['food delivery']],
  ['eleme', 'Ele.me', 'Food & Drink', 'me.ele.ios.eleme', 'truck', ['food delivery']],
  ['dianping', 'Dianping', 'Food & Drink', 'com.dianping.dpscope', 'star', ['reviews']],

  // ---- Travel & Transport
  ['amap', 'Amap', 'Travel & Transport', 'com.autonavi.amap', 'map', ['gaode', 'autonavi']],
  ['baidu-maps', 'Baidu Maps', 'Travel & Transport', 'com.baidu.map', 'map', ['baidu ditu']],
  ['organic-maps', 'Organic Maps', 'Travel & Transport', 'app.organicmaps', 'map', ['offline maps']],

  // ---- Games
  ['boom-beach', 'Boom Beach', 'Games', 'com.supercell.reef', 'target', ['supercell']],
  ['hearthstone', 'Hearthstone', 'Games', 'com.blizzard.wtcg.hearthstone', 'layers', ['card game']],
  ['super-mario-run', 'Super Mario Run', 'Games', 'com.nintendo.zara', 'star', ['mario']],
  ['fire-emblem-heroes', 'Fire Emblem Heroes', 'Games', 'com.nintendo.zaba', 'shield', ['fire emblem']],
  ['temple-run', 'Temple Run', 'Games', 'com.imangi.templerun', 'navigation', ['endless runner']],
  ['farm-heroes-saga', 'Farm Heroes Saga', 'Games', 'com.midasplayer.apps.farmheroessaga', 'sun', ['match 3']],
  ['steam', 'Steam', 'Games', 'com.valvesoftware.Steam', 'game-controller', ['valve', 'pc games']],
  ['meta-horizon', 'Meta Horizon', 'Games', 'com.oculus.twilight', 'eye', ['oculus', 'quest', 'vr']],

  // ==== T196 batch (1 Nov 2026): each id returned by the AU lookup, casing as Apple returned it.
  // ---- System (Apple)
  ['apple-sports', 'Apple Sports', 'System', 'com.apple.sports', 'award', ['scores', 'live scores']],
  ['itunes-remote', 'iTunes Remote', 'System', 'com.apple.Remote', 'tv', ['apple remote', 'remote']],
  ['airport-utility', 'AirPort Utility', 'System', 'com.apple.airport.mobileairportutility', 'wifi', ['airport', 'wi-fi base station']],

  // ---- Social
  ['meta-business-suite', 'Meta Business Suite', 'Social', 'com.facebook.PageAdminApp', 'briefcase', ['facebook pages', 'pages manager']],
  ['9gag', '9GAG', 'Social', 'com.9gag.ios.mobile', 'smile', ['memes']],

  // ---- Messaging
  ['messenger-kids', 'Messenger Kids', 'Messaging', 'com.facebook.talk', 'message-circle', ['kids chat']],
  ['mattermost', 'Mattermost', 'Messaging', 'com.mattermost.rn', 'message-square', ['team chat']],

  // ---- Music & Audio
  ['logic-pro', 'Logic Pro', 'Music & Audio', 'com.apple.mobilelogic', 'sliders', ['music production', 'daw']],

  // ---- Video & TV
  ['youtube-studio', 'YouTube Studio', 'Video & TV', 'com.google.ios.ytcreator', 'bar-chart', ['creator studio', 'yt studio']],
  ['roku', 'Roku', 'Video & TV', 'com.roku.ios.roku', 'tv', ['roku remote']],
  ['kanopy', 'Kanopy', 'Video & TV', 'com.kanopy.Kanopy', 'film', ['library films']],

  // ---- Photo & Design
  ['final-cut-pro', 'Final Cut Pro', 'Photo & Design', 'com.apple.FinalCutApp', 'film', ['video editor', 'fcp']],
  ['microsoft-designer', 'Microsoft Designer', 'Photo & Design', 'com.microsoft.designer', 'feather', ['designer']],
  ['snow', 'SNOW', 'Photo & Design', 'com.campmobile.snow', 'camera', ['selfie camera']],

  // ---- Productivity
  ['power-apps', 'Power Apps', 'Productivity', 'com.microsoft.msapps', 'layers', ['microsoft power apps']],
  ['microsoft-loop', 'Microsoft Loop', 'Productivity', 'com.microsoft.loop', 'layers', ['loop']],
  ['any-do', 'Any.do', 'Productivity', 'com.anydo.AnyDO', 'check-square', ['anydo', 'to do list']],
  ['pdf-expert', 'PDF Expert', 'Productivity', 'com.readdle.PDFExpert5', 'edit', ['pdf editor']],
  ['camscanner', 'CamScanner', 'Productivity', 'com.intsig.CamScanner', 'camera', ['document scanner']],
  ['vibe-mistral', 'Vibe by Mistral', 'Productivity', 'ai.mistral.chat', 'message-square', ['le chat', 'mistral', 'ai chat']],

  // ---- Utilities
  ['microsoft-defender', 'Microsoft Defender', 'Utilities', 'com.microsoft.scmx', 'shield', ['defender', 'antivirus']],
  ['firefox-focus', 'Firefox Focus', 'Utilities', 'org.mozilla.ios.Focus', 'globe', ['private browser']],
  ['onion-browser', 'Onion Browser', 'Utilities', 'com.miketigas.OnionBrowser', 'globe', ['tor']],
  ['ecosia', 'Ecosia', 'Utilities', 'com.ecosia.ecosiaapp', 'search', ['search engine', 'trees']],
  ['mullvad-vpn', 'Mullvad VPN', 'Utilities', 'net.mullvad.MullvadVPN', 'shield', ['vpn', 'mullvad']],
  ['home-assistant', 'Home Assistant', 'Utilities', 'io.robbie.HomeAssistant', 'home', ['smart home', 'hass']],
  ['nest', 'Nest', 'Utilities', 'com.nestlabs.jasper.release', 'home', ['nest thermostat', 'google nest']],
  ['lg-thinq', 'LG ThinQ', 'Utilities', 'com.lgeha.nuts', 'home', ['lg appliances']],
  ['xiaomi-home', 'Xiaomi Home', 'Utilities', 'com.xiaomi.mihome', 'home', ['mi home', 'xiaomi']],
  ['hp-smart', 'HP', 'Utilities', 'com.hp.printer.control', 'printer', ['hp smart', 'printer']],
  ['ds-file', 'DS file', 'Utilities', 'com.synology.DSfile', 'hard-drive', ['synology', 'nas']],
  ['citrix-workspace', 'Citrix Workspace', 'Utilities', 'com.citrix.ReceiveriPad', 'monitor', ['citrix', 'remote desktop']],
  ['teamviewer', 'TeamViewer', 'Utilities', 'com.teamviewer.rc', 'monitor', ['remote control', 'remote support']],
  ['okta-verify', 'Okta Verify', 'Utilities', 'com.okta.mobile', 'shield', ['okta', '2fa']],

  // ---- Health & Fitness
  ['withings', 'Withings', 'Health & Fitness', 'com.withings.wiScaleNG', 'activity', ['health mate', 'smart scale']],
  ['polar-flow', 'Polar Flow', 'Health & Fitness', 'fi.polar.polarflow', 'activity', ['polar', 'heart rate']],

  // ---- News & Reading
  ['bloomberg', 'Bloomberg', 'News & Reading', 'com.bloomberg.Bloomberg', 'trending-up', ['business news', 'markets']],
  ['smartnews', 'SmartNews', 'News & Reading', 'jp.gocro.SmartNews', 'rss', ['news']],
  ['everand', 'Everand', 'News & Reading', 'com.scribd.iscribd', 'book-open', ['scribd', 'audiobooks', 'ebooks']],
  ['hoopla', 'Hoopla', 'News & Reading', 'com.hoopladigital.hoopla', 'book', ['library', 'audiobooks']],

  // ---- Education
  ['chegg-study', 'Chegg Study', 'Education', 'com.chegg.mobile.consumer', 'help-circle', ['chegg', 'homework help']],
  ['edx', 'edX', 'Education', 'org.edx.mobile', 'award', ['online courses']],
  ['skillshare', 'Skillshare', 'Education', 'com.skillshare.Skillshare', 'play-circle', ['online classes']],
  ['mathway', 'Mathway', 'Education', 'com.bagatrix.mathway', 'hash', ['math solver']],

  // ---- Finance
  ['etoro', 'eToro', 'Finance', 'com.etoro.openbook', 'trending-up', ['investing', 'trading']],
  ['coinbase-wallet', 'Coinbase Wallet', 'Finance', 'org.toshi.distribution', 'lock', ['crypto wallet', 'base']],
  ['phantom', 'Phantom', 'Finance', 'app.phantom', 'lock', ['crypto wallet', 'solana']],
  ['ledger-wallet', 'Ledger Wallet', 'Finance', 'com.ledger.live', 'lock', ['ledger live', 'crypto wallet']],

  // ---- Shopping
  ['zalando', 'Zalando', 'Shopping', 'de.zalando.iphone', 'shopping-bag', ['fashion']],
  ['alibaba', 'Alibaba.com', 'Shopping', 'com.alibaba.sourcing', 'package', ['alibaba', 'wholesale']],
  ['adidas', 'adidas', 'Shopping', 'com.adidas.app', 'shopping-bag', ['sneakers', 'sportswear']],

  // ---- Food & Drink
  ['tasty', 'Tasty', 'Food & Drink', 'com.buzzfeed.tasty', 'coffee', ['recipes']],

  // ---- Travel & Transport
  ['maps-me', 'MAPS.ME', 'Travel & Transport', 'com.mapswithme.full', 'map', ['maps me', 'offline maps']],

  // ---- Games
  ['crossy-road', 'Crossy Road', 'Games', 'com.hipsterwhale.crossy', 'navigation', ['hipster whale']],
  ['plague-inc', 'Plague Inc.', 'Games', 'com.ndemiccreations.plagueinc', 'globe', ['plague']],
  ['dumb-ways-to-die', 'Dumb Ways to Die', 'Games', 'au.com.metro.DumbWaysToDie', 'smile', ['dumb ways']],
  ['pokemon-sleep', 'Pokémon Sleep', 'Games', 'jp.pokemon.pokemonsleep', 'moon', ['pokemon sleep']],
  ['pikmin-bloom', 'Pikmin Bloom', 'Games', 'com.nianticlabs.pikmin', 'sun', ['pikmin']],
  ['pokemon-home', 'Pokémon HOME', 'Games', 'jp.pokemon.pokemonhome', 'box', ['pokemon home']],
  ['riot-mobile', 'Riot Mobile', 'Games', 'com.riotgames.mobile.leagueconnect', 'users', ['riot games', 'league friends']],
  ['zenless-zone-zero', 'Zenless Zone Zero', 'Games', 'com.HoYoverse.Nap', 'zap', ['zzz', 'hoyoverse']],
  ['monument-valley-2', 'Monument Valley 2', 'Games', 'com.ustwo.monumentvalley2', 'triangle', ['puzzle']],
  ['my-talking-angela-2', 'My Talking Angela 2', 'Games', 'com.outfit7.mytalkingangela2', 'heart', ['talking angela']],
  ['bubble-witch-3', 'Bubble Witch 3 Saga', 'Games', 'com.midasplayer.apps.bubblewitchsaga3', 'circle', ['bubble shooter']],
  ['royal-kingdom', 'Royal Kingdom', 'Games', 'com.dreamgames.royalkingdom', 'award', ['match 3']],
  ['sky-children-of-the-light', 'Sky: Children of the Light', 'Games', 'com.tgc.sky.ios', 'cloud', ['sky', 'thatgamecompany']],
  ['diablo-immortal', 'Diablo Immortal', 'Games', 'com.blizzard.diablo.immortal', 'shield', ['diablo']],
  ['altos-adventure', "Alto's Adventure", 'Games', 'com.snowman.alto', 'wind', ['alto', 'snowboarding']],
  ['jetpack-joyride', 'Jetpack Joyride', 'Games', 'com.halfbrick.jetpack', 'zap', ['halfbrick']],
  ['lichess', 'Lichess', 'Games', 'org.lichess.mobileV2', 'grid', ['chess']],
  ['mobilityware-solitaire', 'Solitaire by MobilityWare', 'Games', 'com.mobilityware.SolitaireFree', 'layers', ['solitaire', 'card game']],

  // ==== T197 / T211 batch (1 Nov 2026): each id returned by Apple's public lookup (AU store;
  // the last three via the US store), casing as Apple returned it. Run 205 retries: Family Link,
  // FotMob and Hill Climb Racing 2 now verified; Lifesum, Xero, NetNewsWire, Genius Scan and
  // FlightAware still not returned for any id tried, so they stay out.
  // ---- System (Apple)
  ['app-store-connect', 'App Store Connect', 'System', 'com.apple.AppStoreConnect', 'bar-chart', ['itunes connect', 'developer sales']],

  // ---- Social
  ['okcupid', 'OkCupid', 'Social', 'com.okcupid.app', 'heart', ['dating']],
  ['plenty-of-fish', 'Plenty of Fish', 'Social', 'com.pof.mobileapp.iphone', 'heart', ['pof', 'dating']],
  ['replika', 'Replika', 'Social', 'ai.replika.app', 'message-circle', ['ai companion']],
  ['naver', 'NAVER', 'Social', 'com.nhncorp.NaverSearch', 'search', ['naver search', 'korea']],
  ['hellotalk', 'HelloTalk', 'Social', 'com.helloTalk.helloTalk', 'message-square', ['language exchange']],

  // ---- Music & Audio
  ['soundhound', 'SoundHound', 'Music & Audio', 'com.melodis.midomi', 'mic', ['song finder', 'midomi']],
  ['sonos', 'Sonos', 'Music & Audio', 'com.sonos.SonosController2', 'speaker', ['speakers', 'multiroom']],
  ['bose', 'Bose', 'Music & Audio', 'com.bose.bosemusic', 'headphones', ['bose music', 'headphones']],

  // ---- Video & TV
  ['abema', 'ABEMA', 'Video & TV', 'tv.abema.AbemaTV', 'tv', ['abematv', 'japan tv']],

  // ---- Photo & Design
  ['faceapp', 'FaceApp', 'Photo & Design', 'io.faceapp.ios', 'smile', ['face editor']],
  ['piccollage', 'PicCollage', 'Photo & Design', 'com.cardinalblue.PicCollage', 'grid', ['photo collage']],
  ['concepts', 'Concepts', 'Photo & Design', 'com.tophatch.Concepts', 'pen-tool', ['sketching', 'drawing']],

  // ---- Productivity
  ['simplenote', 'Simplenote', 'Productivity', 'com.codality.NotationalFlow', 'file-text', ['notes']],
  ['jetpack-wordpress', 'Jetpack for WordPress', 'Productivity', 'com.automattic.jetpack', 'edit', ['jetpack', 'blog stats']],
  ['zotero', 'Zotero', 'Productivity', 'org.zotero.ios.Zotero', 'book', ['citations', 'research']],
  ['scanner-pro', 'Scanner Pro', 'Productivity', 'com.readdle.Scanner', 'camera', ['document scanner']],
  ['calendars-readdle', 'Calendars by Readdle', 'Productivity', 'com.readdle.CalendarsLite', 'calendar', ['calendars', 'planner']],
  ['smartsheet', 'Smartsheet', 'Productivity', 'com.smartsheet.smartsheet', 'grid', ['spreadsheets', 'projects']],
  ['structured', 'Structured', 'Productivity', 'com.leomehlig.today', 'list', ['daily planner']],
  ['remember-the-milk', 'Remember The Milk', 'Productivity', 'com.rememberthemilk.mobilertm', 'check-square', ['rtm', 'to do list']],
  ['logseq', 'Logseq', 'Productivity', 'com.logseq.logseq', 'file-text', ['outliner', 'notes']],
  ['standard-notes', 'Standard Notes', 'Productivity', 'com.standardnotes.standardnotes', 'lock', ['encrypted notes']],
  ['edison-mail', 'Edison Mail', 'Productivity', 'com.easilydo.mail', 'mail', ['email']],
  ['airmail', 'Airmail', 'Productivity', 'it.bloop.airmail2', 'mail', ['email']],
  ['fiverr', 'Fiverr', 'Productivity', 'com.fiverr.fiverr', 'briefcase', ['freelance']],
  ['glassdoor', 'Glassdoor', 'Productivity', 'com.glassdoor.glassdoor', 'briefcase', ['jobs', 'company reviews']],

  // ---- Utilities
  ['google-family-link', 'Google Family Link', 'Utilities', 'com.google.FamilyLink', 'users', ['family link', 'parental controls']],
  ['truecaller', 'Truecaller', 'Utilities', 'com.truesoftware.TrueCallerOther', 'phone', ['caller id', 'spam calls']],
  ['tp-link-tether', 'TP-Link Tether', 'Utilities', 'com.tplink.tether', 'wifi', ['tp-link', 'router']],
  ['tunnelbear', 'TunnelBear', 'Utilities', 'com.tunnelbear.ios.TunnelBear', 'shield', ['vpn']],
  ['pia-vpn', 'Private Internet Access', 'Utilities', 'com.privateinternetaccess.ios.PIA-VPN', 'shield', ['pia', 'vpn']],
  ['proton-pass', 'Proton Pass', 'Utilities', 'me.proton.pass.ios', 'key', ['password manager']],
  ['proton-drive', 'Proton Drive', 'Utilities', 'ch.protonmail.drive', 'cloud', ['cloud storage']],
  ['blink-shell', 'Blink Shell', 'Utilities', 'sh.blink.blinkshell', 'terminal', ['ssh', 'mosh']],
  ['ish-shell', 'iSH Shell', 'Utilities', 'app.ish.iSH', 'terminal', ['linux shell']],
  ['pythonista', 'Pythonista 3', 'Utilities', 'com.omz-software.Pythonista3', 'code', ['python']],
  ['ups', 'UPS', 'Utilities', 'com.ups.m.iphone', 'package', ['parcel tracking']],

  // ---- Health & Fitness
  ['autosleep', 'AutoSleep', 'Health & Fitness', 'com.tantsissa.AutoSleep', 'moon', ['sleep tracker']],
  ['daylio', 'Daylio', 'Health & Fitness', 'net.daylio.Daylio', 'smile', ['mood tracker', 'journal']],
  ['classpass', 'ClassPass', 'Health & Fitness', 'com.classpass.classpass', 'activity', ['gym classes']],
  ['mindbody', 'Mindbody', 'Health & Fitness', 'com.mindbodyonline.connect', 'activity', ['fitness classes', 'wellness']],
  ['cvs-health', 'CVS Health', 'Health & Fitness', 'com.cvs.cvspharmacy', 'plus', ['cvs', 'pharmacy']],

  // ---- News & Reading
  ['blinkist', 'Blinkist', 'News & Reading', 'com.blinkslabs.Blinkist', 'book-open', ['book summaries']],
  ['inoreader', 'Inoreader', 'News & Reading', 'com.innologica.inoreader', 'rss', ['rss reader']],
  ['fotmob', 'FotMob', 'News & Reading', 'com.mobilefootie.fotmobpro', 'award', ['football scores', 'soccer']],
  ['onefootball', 'OneFootball', 'News & Reading', 'de.motain.iliga', 'award', ['football news', 'soccer']],
  ['bleacher-report', 'Bleacher Report', 'News & Reading', 'com.bleacherreport.TeamStream', 'award', ['sports news', 'br']],
  ['nhl', 'NHL', 'News & Reading', 'com.nhl.gc1112.free', 'award', ['ice hockey']],

  // ---- Education
  ['moodle', 'Moodle', 'Education', 'com.moodle.moodlemobile', 'book', ['lms', 'school']],
  ['wolframalpha', 'WolframAlpha', 'Education', 'com.wolframalpha.wolframalpha', 'hash', ['wolfram', 'math']],
  ['linkedin-learning', 'LinkedIn Learning', 'Education', 'com.linkedin.Learning', 'play-circle', ['online courses']],
  ['inaturalist', 'iNaturalist', 'Education', 'org.inaturalist.iNaturalistMobile', 'feather', ['nature', 'species id']],
  ['merlin-bird-id', 'Merlin Bird ID', 'Education', 'edu.cornell.birds.merlin', 'feather', ['birds', 'birdwatching']],
  ['star-walk-2', 'Star Walk 2', 'Education', 'com.vitotechnology.StarWalk2Free', 'star', ['stargazing', 'astronomy']],
  ['sky-guide', 'Sky Guide', 'Education', 'com.fifthstarlabs.skyguide', 'moon', ['stargazing', 'astronomy']],

  // ---- Finance
  ['yahoo-finance', 'Yahoo Finance', 'Finance', 'com.yahoo.finance', 'trending-up', ['stocks', 'markets']],
  ['tradingview', 'TradingView', 'Finance', 'com.tradingview.tradingviewapp', 'bar-chart', ['charts', 'stocks']],
  ['okx', 'OKX', 'Finance', 'com.okex.OKExAppstoreFull', 'hexagon', ['crypto', 'bitcoin']],
  ['kraken', 'Kraken', 'Finance', 'com.kraken.invest.app', 'hexagon', ['crypto', 'bitcoin']],
  ['bybit', 'Bybit', 'Finance', 'com.bybit.app', 'hexagon', ['crypto']],
  ['remitly', 'Remitly', 'Finance', 'com.remitly.remitly', 'send', ['send money', 'remittance']],
  ['toss', 'Toss', 'Finance', 'com.vivarepublica.cash', 'dollar-sign', ['korea payments']],
  ['ibotta', 'Ibotta', 'Finance', 'com.ibotta.Ibotta', 'percent', ['cash back']],
  ['paypal-honey', 'PayPal Honey', 'Finance', 'com.joinhoney.honey', 'tag', ['honey', 'coupons']],

  // ---- Shopping
  ['lazada', 'Lazada', 'Shopping', 'com.LazadaSEA.Lazada', 'shopping-bag', ['south east asia shopping']],
  ['carousell', 'Carousell', 'Shopping', 'com.thecarousell.Carousell', 'tag', ['marketplace', 'second hand']],
  ['coupang', 'Coupang', 'Shopping', 'com.coupang.Coupang', 'shopping-cart', ['korea shopping']],
  ['myntra', 'Myntra', 'Shopping', 'com.myntra.Myntra', 'shopping-bag', ['fashion', 'india']],
  ['carsales', 'carsales', 'Shopping', 'com.carsales.Carsales', 'truck', ['cars for sale', 'buy a car']],
  ['houzz', 'Houzz', 'Shopping', 'com.houzz.app', 'home', ['home design', 'renovation']],
  ['zoopla', 'Zoopla', 'Shopping', 'com.zoopla.Zoopla', 'home', ['uk property']],

  // ---- Food & Drink
  ['paprika', 'Paprika Recipe Manager', 'Food & Drink', 'com.hindsightlabs.paprika.ios.v3', 'coffee', ['paprika', 'recipes']],
  ['foodpanda', 'foodpanda', 'Food & Drink', 'com.global.foodpanda.ios', 'truck', ['food delivery']],
  ['doordash-dasher', 'DoorDash Dasher', 'Food & Drink', 'com.doordash.dasher', 'truck', ['dasher', 'delivery driver']],

  // ---- Travel & Transport
  ['ola', 'Ola', 'Travel & Transport', 'olacabs.OlaCabs', 'navigation', ['ola cabs', 'rideshare']],
  ['kakao-t', 'Kakao T', 'Travel & Transport', 'com.kakao.taxi', 'navigation', ['kakao taxi']],
  ['gojek', 'Gojek', 'Travel & Transport', 'com.go-jek.ios', 'navigation', ['ride hailing']],
  ['polarsteps', 'Polarsteps', 'Travel & Transport', 'com.polarsteps.Polarsteps', 'map-pin', ['travel tracker']],
  ['seatgeek', 'SeatGeek', 'Travel & Transport', 'com.seatgeek.SeatGeek', 'tag', ['event tickets']],

  // ---- Games
  ['hill-climb-racing-2', 'Hill Climb Racing 2', 'Games', 'com.fingersoft.hillclimbracing2', 'truck', ['hcr2']],
  ['toon-blast', 'Toon Blast', 'Games', 'net.peakgames.toonblast', 'zap', ['puzzle']],
  ['pet-rescue-saga', 'Pet Rescue Saga', 'Games', 'com.midasplayer.apps.petrescuesaga', 'heart', ['match 3']],
  ['merge-dragons', 'Merge Dragons!', 'Games', 'com.gramgames.mergedragons', 'layers', ['merge game']],
  ['empires-puzzles', 'Empires & Puzzles', 'Games', 'com.smallgiantgames.empires', 'shield', ['match 3 rpg']],
  ['my-talking-tom-friends', 'My Talking Tom Friends', 'Games', 'com.outfit7.mytalkingtomfriends', 'smile', ['talking tom']],
  ['talking-tom-gold-run', 'Talking Tom Gold Run', 'Games', 'com.outfit7.talkingtomgoldrun', 'navigation', ['endless runner']],
  ['farmville-2', 'FarmVille 2: Country Escape', 'Games', 'com.zynga.FarmVille2CountryEscape', 'sun', ['farmville']],
  ['angry-birds-friends', 'Angry Birds Friends', 'Games', 'com.rovio.angrybirdsfriends', 'target', ['angry birds']],
  ['bad-piggies', 'Bad Piggies', 'Games', 'com.rovio.BadPiggies', 'tool', ['rovio']],
  ['simcity-buildit', 'SimCity BuildIt', 'Games', 'com.ea.simcitymobile.bv', 'home', ['simcity', 'city builder']],
  ['archero', 'Archero', 'Games', 'com.habby.archero', 'target', ['archer']],
  ['tetris', 'Tetris', 'Games', 'com.n3twork.tetris', 'grid', ['blocks']],
  ['terraria', 'Terraria', 'Games', 'com.505games.terraria', 'tool', ['sandbox']],
  ['mini-metro', 'Mini Metro', 'Games', 'nz.co.codepoint.minimetro', 'git-branch', ['subway map']],
  ['the-room', 'The Room', 'Games', 'com.FireproofStudios.TheRoom', 'key', ['puzzle box']],
  ['csr-2', 'CSR 2', 'Games', 'com.naturalmotion.customstreetracer2', 'truck', ['drag racing', 'csr racing 2']],
  ['monster-hunter-now', 'Monster Hunter Now', 'Games', 'com.nianticlabs.monsterhunter', 'compass', ['monster hunter']],
  ['marvel-contest-of-champions', 'Marvel Contest of Champions', 'Games', 'com.kabam.marvelbattle', 'shield', ['mcoc']],
  ['marvel-strike-force', 'MARVEL Strike Force', 'Games', 'com.foxnextgames.m3', 'zap', ['msf']],
  ['teamfight-tactics', 'TFT: Teamfight Tactics', 'Games', 'com.riotgames.league.teamfighttactics', 'grid', ['tft', 'auto battler']],
  ['legends-of-runeterra', 'Legends of Runeterra', 'Games', 'com.riotgames.legendsofruneterra', 'layers', ['lor', 'card game']],
  ['stack', 'Stack', 'Games', 'com.ketchapp.stack', 'layers', ['ketchapp']],
  ['agar-io', 'Agar.io', 'Games', 'com.miniclip.agar.io', 'circle', ['agario']],
  ['squad-busters', 'Squad Busters', 'Games', 'com.supercell.squad', 'users', ['supercell']],
  ['honkai-impact-3', 'Honkai Impact 3', 'Games', 'com.miHoYo.bh3oversea', 'zap', ['honkai impact 3rd', 'hoyoverse']],
  ['wuthering-waves', 'Wuthering Waves', 'Games', 'com.kurogame.wutheringwaves.global', 'wind', ['kuro games']],
  ['raid-shadow-legends', 'RAID: Shadow Legends', 'Games', 'com.plarium.raidlegends', 'shield', ['raid']],
  ['smash-hit', 'Smash Hit', 'Games', 'com.mediocre.smashhit', 'circle', ['glass smash']],
  ['shadow-fight-3', 'Shadow Fight 3', 'Games', 'com.nekki.shadowfight3', 'user', ['fighting game']],
  ['shadow-fight-2', 'Shadow Fight 2', 'Games', 'com.nekki.shadowfight', 'user', ['fighting game']],
  ['mortal-kombat', 'Mortal Kombat', 'Games', 'com.wb.MK.Brawler2015', 'zap', ['mk mobile', 'fighting game']],
  ['jurassic-world-alive', 'Jurassic World Alive', 'Games', 'com.ludia.jw2', 'map-pin', ['dinosaurs']],
  ['head-ball-2', 'Head Ball 2', 'Games', 'com.masomo.headball2', 'circle', ['soccer game']],
  ['soccer-stars', 'Soccer Stars', 'Games', 'com.miniclip.soccerstars', 'circle', ['football game']],

  // ==== T215 batch (1 Nov 2026): each id returned by Apple's public lookup endpoint (AU store
  // unless noted), casing as Apple returned it. Two lookup forms were used: by candidate bundle
  // id (1-3 per request), and by developer id (lookup?id=<artistId>&entity=software), which lists
  // that developer's apps with their bundle ids straight from Apple. The search endpoint was not used
  // (robots-blocked). Candidates Apple did not return were dropped.
  // ---- Social
  ['douban', 'Douban', 'Social', 'com.douban.frodo', 'book-open', ['douban movies', 'china']],
  ['hoyolab', 'HoYoLAB', 'Social', 'com.miHoYo.HoYoLAB', 'users', ['hoyoverse community']],
  ['tiktok-studio', 'TikTok Studio', 'Social', 'com.ss.iphone.tt.creator', 'video', ['tiktok creator']],

  // ---- Music & Audio
  ['nintendo-music', 'Nintendo Music', 'Music & Audio', 'com.nintendo.znba', 'music', ['game music']],
  ['spotify-kids', 'Spotify Kids', 'Music & Audio', 'com.spotify.kids', 'music', ['kids music']],
  ['spotify-for-creators', 'Spotify for Creators', 'Music & Audio', 'com.anchorfminc.Anchor', 'mic', ['anchor', 'podcast maker']],
  ['spotify-for-artists', 'Spotify for Artists', 'Music & Audio', 'com.spotify.s4a', 'bar-chart', ['artist stats']],

  // ---- Video & TV
  ['google-tv', 'Google TV', 'Video & TV', 'com.google.Movies', 'tv', ['google play movies', 'movies']],
  ['nfl', 'NFL', 'Video & TV', 'com.nfl.gamecenter', 'award', ['american football', 'nfl app']],
  ['amazon-fire-tv', 'Amazon Fire TV', 'Video & TV', 'com.amazon.firetv.remote', 'tv', ['fire tv remote', 'firestick']],

  // ---- Photo & Design
  ['meitu', 'Meitu', 'Photo & Design', 'com.meitu.mtxx', 'image', ['photo editor']],
  ['beautycam', 'BeautyCam', 'Photo & Design', 'com.meitu.myxj', 'camera', ['beauty camera', 'meitu']],
  ['wink', 'Wink', 'Photo & Design', 'com.meitu.wink', 'film', ['video enhancer']],
  ['airbrush', 'AirBrush', 'Photo & Design', 'com.magicv.AirBrush', 'smile', ['retouch', 'face editor']],
  ['lumafusion', 'LumaFusion', 'Photo & Design', 'com.luma-touch.LumaFusion', 'film', ['video editor']],
  ['hypic', 'Hypic', 'Photo & Design', 'com.xt.retouchoversea', 'image', ['photo editor', 'ai art']],
  ['ulike', 'Ulike', 'Photo & Design', 'com.light.beautyabroad', 'camera', ['selfie camera']],
  ['dreamina', 'Dreamina', 'Photo & Design', 'com.lemon.dreamina', 'image', ['ai image', 'ai video']],
  ['edits', 'Edits', 'Photo & Design', 'com.burbn.basel', 'film', ['instagram edits', 'video editor']],
  ['affinity', 'Affinity by Canva', 'Photo & Design', 'com.canva.affinity', 'pen-tool', ['affinity designer', 'affinity photo']],
  ['photoleap', 'Photoleap', 'Photo & Design', 'com.lightricks.Enlight-Editor', 'image', ['ai photo', 'lightricks']],
  ['videoleap', 'Videoleap', 'Photo & Design', 'com.lightricks.Enlight-Video', 'film', ['video editor', 'lightricks']],
  ['motionleap', 'Motionleap', 'Photo & Design', 'com.lightricks.Enlight-Phoenix', 'wind', ['photo animator', 'lightricks']],
  ['lightleap', 'Lightleap', 'Photo & Design', 'com.lightricks.Enlight-Photos', 'sun', ['photo editor', 'lightricks']],

  // ---- Productivity
  ['gemini-notebook', 'Gemini Notebook', 'Productivity', 'com.google.NotebookLM', 'book-open', ['notebooklm', 'notebook lm']],
  ['hootsuite', 'Hootsuite', 'Productivity', 'com.hootsuite.hootsuite', 'send', ['social media scheduler']],
  ['basecamp', 'Basecamp', 'Productivity', 'com.basecamp.bc3-ios', 'briefcase', ['project management']],
  ['meta-ai', 'Meta AI', 'Productivity', 'com.facebook.stellaapp', 'message-circle', ['ray-ban meta', 'meta glasses', 'meta view']],
  ['meta-ads-manager', 'Meta Ads Manager', 'Productivity', 'com.facebook.MAdMan', 'bar-chart', ['facebook ads']],

  // ---- Utilities
  ['pcalc', 'PCalc', 'Utilities', 'uk.co.tla-systems.pcalc', 'hash', ['calculator']],
  ['nintendo-switch-parental-controls', 'Nintendo Switch Parental Controls', 'Utilities', 'com.nintendo.znma', 'lock', ['parental controls']],
  ['my-verizon', 'My Verizon', 'Utilities', 'com.vzw.hss.myverizon', 'phone', ['verizon']], // US store

  // ---- Finance
  ['expensify', 'Expensify', 'Finance', 'com.expensify.expensifylite', 'file-text', ['expenses', 'receipts']],
  ['blockchain-com', 'Blockchain.com', 'Finance', 'com.rainydayapps.Blockchain', 'dollar-sign', ['bitcoin', 'crypto wallet']],
  ['kakaobank', 'KakaoBank', 'Finance', 'com.kakaobank.channel', 'credit-card', ['kakao bank', 'korea']],

  // ---- Shopping
  ['tmall', 'Tmall', 'Shopping', 'com.taobao.tmall', 'shopping-bag', ['tian mao', 'china']],
  ['xianyu', 'Xianyu', 'Shopping', 'com.taobao.fleamarket', 'tag', ['idle fish', 'second hand']],
  ['tokopedia', 'Tokopedia', 'Shopping', 'com.tokopedia.Tokopedia', 'shopping-cart', ['indonesia']],
  ['stubhub', 'StubHub', 'Shopping', 'com.stubhub.stubhub', 'tag', ['tickets', 'event tickets']], // US store

  // ---- Travel & Transport
  ['uber-driver', 'Uber Driver', 'Travel & Transport', 'com.ubercab.UberPartner', 'navigation', ['driver app', 'uber partner']],
  ['amazon-flex', 'Amazon Flex', 'Travel & Transport', 'com.amazon.flex.irabbit', 'package', ['delivery driver']],
  ['disneyland', 'Disneyland', 'Travel & Transport', 'com.disney.DLR', 'map', ['disney parks']],
  ['my-disney-experience', 'My Disney Experience', 'Travel & Transport', 'com.disney.MyDisneyExperience', 'map-pin', ['walt disney world']],

  // ---- News & Reading
  ['npr', 'NPR', 'News & Reading', 'org.npr.nprnews', 'rss', ['public radio', 'news']],
  ['espn-fantasy', 'ESPN Fantasy', 'News & Reading', 'com.espn.fantasyFootball', 'award', ['fantasy football', 'fantasy sports']],

  // ---- Education
  ['epic-kids-books', "Epic: Kids' Books", 'Education', 'com.getepic.Epic', 'book', ['epic reading', 'kids books']],
  ['picturethis', 'PictureThis', 'Education', 'cn.danatech.xingseus', 'search', ['plant identifier']],
  ['night-sky', 'Night Sky', 'Education', 'com.icandiapps.nightsky', 'moon', ['stars', 'astronomy']],
  ['duolingo-abc', 'Duolingo ABC', 'Education', 'com.duolingo.literacy', 'book', ['learn to read']],
  ['duolingo-english-test', 'Duolingo English Test', 'Education', 'com.duolingo.DetMobile', 'check-square', ['det', 'english exam']],

  // ---- Games
  ['cookierun-kingdom', 'CookieRun: Kingdom', 'Games', 'com.devsisters.ck', 'home', ['cookie run']],
  ['cookierun-ovenbreak', 'CookieRun: OvenBreak', 'Games', 'com.devsisters.gb', 'navigation', ['cookie run', 'endless runner']],
  ['cookierun-tower-of-adventures', 'CookieRun: Tower of Adventures', 'Games', 'com.devsisters.cba', 'shield', ['cookie run']],
  ['dragon-city', 'Dragon City', 'Games', 'es.socialpoint.dragoncity', 'zap', ['dragons']],
  ['hungry-shark-evolution', 'Hungry Shark Evolution', 'Games', 'com.fgol.HungrySharkEvolution', 'target', ['shark game']],
  ['bloons-td-6', 'Bloons TD 6', 'Games', 'com.ninjakiwi.bloonstd6', 'target', ['btd6', 'tower defense']],
  ['sniper-3d', 'Sniper 3D', 'Games', 'com.fungames.sniper3d', 'target', ['shooter']],
  ['arknights', 'Arknights', 'Games', 'com.YoStarEN.Arknights', 'shield', ['tower defense']],
  ['blue-archive', 'Blue Archive', 'Games', 'com.nexon.bluearchive', 'book', ['nexon']],
  ['fate-grand-order', 'Fate/Grand Order', 'Games', 'com.aniplex.fategrandorder.en', 'shield', ['fgo']],
  ['tears-of-themis', 'Tears of Themis', 'Games', 'com.miHoYo.tot.glb', 'heart', ['hoyoverse']],
  ['pou', 'Pou', 'Games', 'me.pou.app', 'smile', ['virtual pet']],
  ['homescapes', 'Homescapes', 'Games', 'com.playrix.gardenscapes-sweethome', 'home', ['match 3', 'playrix']],
  ['fishdom', 'Fishdom', 'Games', 'com.playrix.fishdom-freeplay', 'circle', ['aquarium', 'match 3']],
  ['manor-matters', 'Manor Matters', 'Games', 'com.playrix.manor-matters', 'key', ['hidden object']],
  ['wildscapes', 'Wildscapes', 'Games', 'com.playrix.zoo-m3-ios', 'sun', ['zoo', 'match 3']],
  ['toy-blast', 'Toy Blast', 'Games', 'net.peakgames.amy', 'box', ['puzzle']],
  ['match-factory', 'Match Factory!', 'Games', 'net.peakgames.match', 'grid', ['match 3d']],
  ['candy-crush-jelly', 'Candy Crush Jelly Saga', 'Games', 'com.midasplayer.apps.candycrushjellysaga1', 'grid', ['candy crush']],
  ['bubble-witch-2', 'Bubble Witch 2 Saga', 'Games', 'com.midasplayer.apps.bubblewitchsaga2', 'circle', ['bubble shooter']],
  ['need-for-speed-no-limits', 'Need for Speed No Limits', 'Games', 'com.ea.nfs2014.bv', 'truck', ['nfs', 'racing']],
  ['angry-birds-transformers', 'Angry Birds Transformers', 'Games', 'com.rovio.angrybirdstransformers', 'truck', ['angry birds']],
  ['angry-birds-pop', 'Angry Birds POP!', 'Games', 'com.rovio.stellapop', 'circle', ['angry birds', 'bubble shooter']],
  ['angry-birds-evolution', 'Angry Birds Evolution', 'Games', 'com.rovio.tnt', 'shield', ['angry birds']],
  ['angry-birds-dream-blast', 'Angry Birds Dream Blast', 'Games', 'com.rovio.dream', 'circle', ['angry birds']],
  ['classic-words-with-friends', 'Classic Words With Friends', 'Games', 'com.newtoyinc.WordsWithFriendsFree', 'type', ['words with friends classic']],
  ['zynga-poker', 'Zynga Poker', 'Games', 'com.zynga.livepoker.700', 'layers', ['texas holdem', 'poker']],
  ['my-talking-tom', 'My Talking Tom', 'Games', 'com.outfit7.mytalkingtom', 'smile', ['talking tom', 'virtual pet']],
  ['talking-tom-cat', 'Talking Tom Cat', 'Games', 'com.outfit7.talkingtom', 'smile', ['talking tom']],
  ['talking-tom-cat-2', 'Talking Tom Cat 2', 'Games', 'com.outfit7.talkingtom2', 'smile', ['talking tom']],
  ['my-talking-angela', 'My Talking Angela', 'Games', 'com.outfit7.mytalkingangela', 'heart', ['talking angela']],
  ['talking-ben', 'Talking Ben the Dog', 'Games', 'com.outfit7.talkingdog', 'smile', ['talking ben']],
  ['golf-battle', 'Golf Battle', 'Games', 'games.onebutton.golfbattle', 'target', ['golf']],
  ['basketball-stars', 'Basketball Stars', 'Games', 'com.miniclip.basketballstars', 'circle', ['basketball']],
  ['football-strike', 'Football Strike', 'Games', 'com.miniclip.footballstrike', 'circle', ['soccer game']],
  ['mini-militia', 'Mini Militia - Doodle Army 2', 'Games', 'com.chadtowns.da2', 'target', ['doodle army']],
  ['ketchapp-2048', '2048', 'Games', 'com.ketchapp.2048', 'grid', ['number puzzle']],
  ['rider', 'Rider', 'Games', 'com.ketchapp.rider', 'navigation', ['stunt bike']],
  ['knife-hit', 'Knife Hit', 'Games', 'com.ketchapp.knifehit', 'target', ['ketchapp']],
  ['ballz', 'Ballz', 'Games', 'com.ketchapp.ballz', 'circle', ['ketchapp']],
  ['stick-hero', 'Stick Hero', 'Games', 'com.ketchapp.stickhero', 'user', ['ketchapp']],
  ['dont-touch-the-spikes', "Don't Touch The Spikes", 'Games', 'com.ketchapp.donttouchthespikes', 'triangle', ['ketchapp']],
  ['zigzag', 'ZigZag', 'Games', 'com.ketchapp.zigzaggame', 'git-branch', ['ketchapp']],
  ['fruit-ninja-2', 'Fruit Ninja 2', 'Games', 'com.halfbrick.fruitninjax', 'zap', ['fruit ninja']],
  ['dan-the-man', 'Dan The Man', 'Games', 'com.halfbrick.dantheman', 'user', ['platformer']],
  ['monster-dash', 'Monster Dash', 'Games', 'com.Halfbrick.Monster', 'zap', ['halfbrick']],
  ['wheres-my-water', "Where's My Water?", 'Games', 'com.disney.SwampyGame', 'cloud', ['swampy', 'puzzle']],
  ['bike-race', 'Bike Race', 'Games', 'com.topfreegames.bikeracefree', 'navigation', ['motorbike']],
  ['colorfy', 'Colorfy', 'Games', 'com.fungames.colorfy', 'pen-tool', ['colouring book', 'coloring']],
  ['block-craft-3d', 'Block Craft 3D', 'Games', 'com.fungames.blockcraft', 'box', ['building game']],
  ['blades-of-brim', 'Blades of Brim', 'Games', 'com.sybogames.brim', 'zap', ['endless runner']],
  ['subway-surfers-city', 'Subway Surfers City', 'Games', 'com.sybogames.subway.surfers.game', 'navigation', ['subway surfers']],
  ['squid-game-unleashed', 'Squid Game: Unleashed', 'Games', 'com.netflix.NGP.ProjectKraken', 'users', ['netflix games']],
  ['red-dead-redemption', 'Red Dead Redemption', 'Games', 'com.netflix.NGP.Kamo', 'map', ['netflix games', 'rdr']],
  ['survivor-io', 'Survivor!.io', 'Games', 'com.dxx.firenow', 'shield', ['survivor io']],
  ['archero-2', 'Archero 2', 'Games', 'com.xq.archeroii', 'target', ['archero']],
  ['capybara-go', 'Capybara Go!', 'Games', 'com.habby.capybara', 'smile', ['capybara']],
  ['penguin-isle', 'Penguin Isle', 'Games', 'com.fantome.penguinsisle', 'sun', ['idle game']],
  ['geometry-dash-lite', 'Geometry Dash Lite', 'Games', 'com.robtop.geometryjumplite', 'triangle', ['geometry dash']],
  ['geometry-dash-meltdown', 'Geometry Dash Meltdown', 'Games', 'com.robtop.geometrydashmeltdown', 'triangle', ['geometry dash']],
  ['geometry-dash-world', 'Geometry Dash World', 'Games', 'com.robtop.geometrydashworld', 'triangle', ['geometry dash']],
  ['geometry-dash-subzero', 'Geometry Dash SubZero', 'Games', 'com.robtop.geometrydashsubzero', 'triangle', ['geometry dash']],
  ['asphalt-8', 'Asphalt 8: Airborne', 'Games', 'com.gameloft.asphalt8', 'truck', ['asphalt', 'racing']],
  ['gangstar-vegas', 'Gangstar Vegas', 'Games', 'com.gameloft.gangstar4', 'map', ['gameloft']],
  ['disney-magic-kingdoms', 'Disney Magic Kingdoms', 'Games', 'com.gameloft.disneykingdom', 'star', ['disney game']],
  ['my-little-pony', 'My Little Pony: Magic Princess', 'Games', 'com.gameloft.mylittlepony', 'star', ['my little pony']],
  ['modern-combat-5', 'Modern Combat 5', 'Games', 'com.gameloft.ModernCombat5', 'target', ['shooter']],
  ['rebel-inc', 'Rebel Inc.', 'Games', 'com.ndemiccreations.peaceinc', 'shield', ['ndemic']],
  ['after-inc', 'After Inc.', 'Games', 'com.ndemiccreations.survivors', 'users', ['ndemic', 'plague inc']],
] as ExtraRow[]);
