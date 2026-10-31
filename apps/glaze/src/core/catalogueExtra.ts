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
] as ExtraRow[]);
