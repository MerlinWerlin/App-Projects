// Every word the app shows, in English. Other languages live in ./locales/<code>.json with the same keys
// (checked by tests: same keys, same {placeholders}). Never hard-code UI text in app/ or src/ui/.
// Feature strings live in ./en/<feature>.ts (one file per backlog task, so parallel builds don't collide) and are
// spread in below. Keys stay globally unique: prefix them with the feature (ticket., emergency., vault., packing.).
import { emergency } from './en/emergency.ts';
import { packing } from './en/packing.ts';
import { tickets } from './en/tickets.ts';
import { vault } from './en/vault.ts';
import { battery } from './en/battery.ts';
import { map } from './en/map.ts';
import { brand } from './en/brand.ts';
import { permissions } from './en/permissions.ts';
import { trial } from './en/trial.ts';
import { spec } from './en/spec.ts';
import { followups27 } from './en/followups27.ts';
import { followups29 } from './en/followups29.ts';
import { release } from './en/release.ts';
import { pickers } from './en/pickers.ts';
import { sources } from './en/sources.ts';
import { followups31 } from './en/followups31.ts';
import { language } from './en/language.ts';
import { spec41 } from './en/spec41.ts';
import { tripfile } from './en/tripfile.ts';
import { citymaps } from './en/citymaps.ts';
import { toilets } from './en/toilets.ts';
import { design } from './en/design.ts';
import { privacy } from './en/privacy.ts';
import { essentials } from './en/essentials.ts';
import { phrases } from './en/phrases.ts';
import { spending } from './en/spending.ts';
import { help } from './en/help.ts';
import { readiness } from './en/readiness.ts';
import { convert } from './en/convert.ts';
import { followups85 } from './en/followups85.ts';
import { travels } from './en/travels.ts';
import { jetlag } from './en/jetlag.ts';
import { journal } from './en/journal.ts';
import { followups86 } from './en/followups86.ts';
import { triproute } from './en/triproute.ts';
import { weather } from './en/weather.ts';
import { smartpack } from './en/smartpack.ts';
import { plan } from './en/plan.ts';
import { position } from './en/position.ts';
import { licences } from './en/licences.ts';
import { wayback } from './en/wayback.ts';
import { airport } from './en/airport.ts';
import { pastebooking } from './en/pastebooking.ts';
import { troubles } from './en/troubles.ts';
import { toiletplus } from './en/toiletplus.ts';
import { followups88 } from './en/followups88.ts';
import { ideas } from './en/ideas.ts';
import { together } from './en/together.ts';
import { covers } from './en/covers.ts';
import { recap } from './en/recap.ts';
import { loyalty } from './en/loyalty.ts';
import { followups90 } from './en/followups90.ts';
import { calendar } from './en/calendar.ts';
import { units } from './en/units.ts';
import { look } from './en/look.ts';
import { followups91 } from './en/followups91.ts';
import { todos } from './en/todos.ts';
import { mapsearch } from './en/mapsearch.ts';
import { arrival } from './en/arrival.ts';
import { followups92 } from './en/followups92.ts';
import { safecheck } from './en/safecheck.ts';
import { dayplan } from './en/dayplan.ts';
import { bags } from './en/bags.ts';
import { followups93 } from './en/followups93.ts';
import { meds } from './en/meds.ts';
import { cash } from './en/cash.ts';
import { stamps } from './en/stamps.ts';
import { followups94 } from './en/followups94.ts';
import { tipping } from './en/tipping.ts';
import { holidays } from './en/holidays.ts';
import { gifts } from './en/gifts.ts';
import { followups95 } from './en/followups95.ts';
import { stay } from './en/stay.ts';
import { menu } from './en/menu.ts';
import { insights } from './en/insights.ts';
import { followups96 } from './en/followups96.ts';
import { inflight } from './en/inflight.ts';
import { callhome } from './en/callhome.ts';
import { customs } from './en/customs.ts';
import { followups97 } from './en/followups97.ts';
import { maplayers } from './en/maplayers.ts';
import { tripcopy } from './en/tripcopy.ts';
import { look2 } from './en/look2.ts';
import { followups98 } from './en/followups98.ts';
import { helpcards } from './en/helpcards.ts';
import { driving } from './en/driving.ts';
import { followups99 } from './en/followups99.ts';
import { leavehome } from './en/leavehome.ts';
import { games } from './en/games.ts';
import { followups100 } from './en/followups100.ts';
import { followups89 } from './en/followups89.ts';

const base = {
  'app.name': 'Satchel',
  'app.tagline': 'Leave your phone in flight mode. Satchel still works.',

  'tab.trips': 'Trips',
  'tab.map': 'Map',
  'tab.wallet': 'Wallet',
  'tab.emergency': 'Emergency',

  'trips.title': 'Your trips',
  'trips.empty': 'No trips yet',
  'trips.emptyBody': 'Add a trip to keep your plans and travel details together, or add the demo trip to look around first.',
  'trips.add': 'Add trip',
  'trips.settings': 'Settings',
  'trips.settingsHint': 'Opens appearance, haptics, essentials and privacy settings',

  'trips.demoBadge': 'Demo',
  'trips.dates': '{range} · {n} days',
  'trips.phase.upcoming': 'Coming up',
  'trips.phase.active': 'On now',
  'trips.phase.past': 'Past',
  'trips.open': 'Open {name}',
  'trips.addDemo': 'Add the demo trip',

  'next.title': 'Next up',
  'next.now': 'Now · ends in {d}',
  'next.in': 'In {d}',
  'next.none': 'Nothing coming up. Add a booking to a trip to see it here.',
  'next.open': 'Opens the details for {title}',

  'kind.flight': 'Flight',
  'kind.train': 'Train',
  'kind.ferry': 'Ferry',
  'kind.bus': 'Bus',
  'kind.hotel': 'Hotel',
  'kind.car': 'Car hire',
  'kind.activity': 'Activity',
  'kind.note': 'Note',

  'trip.edit': 'Edit trip',
  'trip.add': 'Add a booking',
  'trip.addHint': 'Choose what kind of booking to add',
  'trip.chooseKind': 'What are you adding?',
  'trip.dayEmpty': 'Nothing planned for this day',
  'trip.addToDay': 'Add to {day}',
  'trip.warnNights': 'No bed booked for {n} night(s): {days}',
  'trip.warnClash': '{a} clashes with {b}',
  'trip.notFound': 'This trip is no longer on this phone.',
  'trip.items': '{n} bookings',

  'tripEdit.newTitle': 'New trip',
  'tripEdit.title': 'Edit trip',
  'tripEdit.name': 'Trip name',
  'tripEdit.namePlaceholder': 'Japan in spring',
  'tripEdit.start': 'First day (YYYY-MM-DD)',
  'tripEdit.end': 'Last day (YYYY-MM-DD)',
  'tripEdit.homeTz': 'Home time zone',
  'tripEdit.save': 'Save trip',
  'tripEdit.delete': 'Delete trip',
  'tripEdit.deleteConfirm': 'Delete {name} and all its bookings from this phone?',
  'tripEdit.err.name': 'Give the trip a name.',
  'tripEdit.err.startDate': 'First day must look like 2026-11-03.',
  'tripEdit.err.endDate': 'Last day must look like 2026-11-11.',
  'tripEdit.err.endBeforeStart': 'The last day is before the first day.',
  'tripEdit.err.homeTz': 'Time zone not recognised. Use a name like Australia/Sydney.',

  'item.edit': 'Edit',
  'item.delete': 'Delete',
  'item.deleteConfirm': 'Delete {title}?',
  'item.notFound': 'This booking is no longer on this phone.',
  'item.departs': 'Departs',
  'item.arrives': 'Arrives',
  'item.checkIn': 'Check-in',
  'item.checkOut': 'Check-out',
  'item.starts': 'Starts',
  'item.ends': 'Ends',
  'item.duration': 'Duration {d}',
  'item.dayShift': '{n} day',
  'item.ref': 'Booking ref',
  'item.seat': 'Seat',
  'item.carrier': 'Operator',
  'item.number': 'Number',
  'item.address': 'Address',
  'item.localAddress': 'Address in the local language',
  'item.notes': 'Notes',
  'item.from': 'From',
  'item.to': 'To',
  'item.place': 'Place',
  'item.zone': '{time} {city} time',

  'itemEdit.newTitle': 'New booking',
  'itemEdit.title': 'Edit booking',
  'itemEdit.kind': 'Kind',
  'itemEdit.name': 'Title',
  'itemEdit.namePlaceholder': 'Sydney → Tokyo',
  'itemEdit.startDate': 'Start date (YYYY-MM-DD)',
  'itemEdit.startTime': 'Start time (HH:MM, 24-hour)',
  'itemEdit.startTz': 'Start time zone',
  'itemEdit.endDate': 'End date (YYYY-MM-DD)',
  'itemEdit.endTime': 'End time (HH:MM, 24-hour)',
  'itemEdit.endTz': 'End time zone',
  'itemEdit.tzHint': 'Times are as printed on the ticket, in that place\'s local time.',
  'itemEdit.useZone': 'Use {city}',
  'itemEdit.save': 'Save booking',
  'itemEdit.err.title': 'Give the booking a title.',
  'itemEdit.err.start': 'Start must be a real date and a time like 09:30.',
  'itemEdit.err.startTz': 'Start time zone not recognised. Use a name like Asia/Tokyo.',
  'itemEdit.err.end': 'End must be a real date and a time like 17:45.',
  'itemEdit.err.endTz': 'End time zone not recognised. Use a name like Asia/Tokyo.',
  'itemEdit.err.endBeforeStart': 'It ends before it starts. Check the dates, times and time zones.',
  'itemEdit.err.endRequired': 'Add when it ends (arrival, check-out or drop-off).',

  'map.title': 'Map',

  'wallet.title': 'Wallet',
  'wallet.empty': 'No tickets yet',
  'wallet.emptyBody': 'Tickets you attach to a trip show here in time order, ready to open at full brightness.',

  'emergency.title': 'Emergency',
  'emergency.empty': 'Your emergency card',
  'emergency.emptyBody': 'Local emergency numbers, your insurance and emergency contacts, one tap away even in flight mode.',

  'trip.title': 'Trip',
  'item.title': 'Booking',
  'essentials.title': 'Essentials',
  'essentials.body': 'Next ticket, hotel address and emergency card on a plain black screen.',

  'settings.title': 'Settings',
  'settings.haptics': 'Haptics',
  'settings.hapticsHint': 'Small vibrations when you tap',
  'settings.privacy': 'Privacy',
  'settings.version': 'Version {v}',

  'common.back': 'Back',
  'common.comingSoon': 'Not available yet',
  'common.on': 'On',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.off': 'Off',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.openSettings': 'Open Settings',
  'common.tryAgain': 'Try again',

  'route.ticket': 'Ticket',
  'route.address': 'Address card',
  'route.emergencyEdit': 'Edit emergency card',
  'route.vault': 'Documents',
  'route.doc': 'Document',
  'route.docEdit': 'Document',
  'route.packing': 'Packing list',

  // ---- t43 (T43, TR-021 load case): an item whose saved time zone this phone can't read. Kept, not dropped. ----
  't43.row.zoneUnreadable': 'Time zone not recognised — edit to fix',
  't43.item.zoneUnreadable': 'Time zone not recognised — edit to fix. This booking is kept as saved, but it can’t show in Next up, clashes or the time until it starts until you choose its time zone again.',
  // ---- t44 (spec pass 2 leftovers): emergency -> hotel address shortcut, adjustable battery threshold,
  // item-form Attachments section (FLOWS §4.1, §5.1, §6.1, §12.1; ACCESSIBILITY.md). Keep this block last. ----
  'emergency.hotelShortcut': 'Hotel address',
  'emergency.hotelShortcutHint': 'Opens the address card for {name}.',
  'emergency.hotelShortcutNow': 'Where you’re staying: {name}',
  'emergency.hotelShortcutNext': 'Next stay: {name}',
  'settings.thresholdAdjustLabel': 'Essentials battery threshold',
  'settings.thresholdAdjustHint': 'Adjusts when Satchel suggests essentials mode.',
  'itemEdit.attachments': 'Attachments',
  'itemEdit.attachmentsEmpty': 'No files attached yet. Add a ticket or confirmation from Files or Photos.',
  'itemEdit.attachmentsNote': 'File changes are kept when you save this booking.',
  'itemEdit.attachmentRow': 'Attachment, {name}',
  'itemEdit.attachmentRemove': 'Remove {name}',
  'itemEdit.attachmentRemoveHint': 'Removes this file from the item.',
  'itemEdit.attachmentAdd': 'Add attachment',
  'itemEdit.attachmentAddHint': 'Choose a file or photo to attach.',
  'itemEdit.attachmentFromFiles': 'Choose from Files',
  'itemEdit.attachmentFromPhotos': 'Choose from Photos',
} as const;

export const en = { ...base, ...tickets, ...emergency, ...vault, ...packing, ...battery, ...map, ...brand, ...permissions, ...trial, ...spec, ...followups27, ...followups29, ...release, ...pickers, ...sources, ...followups31, ...language, ...spec41, ...tripfile, ...citymaps, ...toilets, ...design, ...privacy, ...essentials, ...phrases, ...spending, ...help, ...readiness, ...convert, ...followups85, ...travels, ...jetlag, ...journal, ...followups86, ...triproute, ...weather, ...plan, ...position, ...licences, ...wayback, ...airport, ...smartpack, ...pastebooking, ...troubles, ...toiletplus, ...followups88, ...ideas, ...together, ...covers, ...followups89, ...recap, ...loyalty, ...followups90, ...calendar, ...units, ...look, ...followups91, ...todos, ...mapsearch, ...arrival, ...followups92, ...safecheck, ...dayplan, ...bags, ...followups93, ...meds, ...cash, ...stamps, ...followups94, ...tipping, ...holidays, ...gifts, ...followups95, ...stay, ...menu, ...insights, ...followups96, ...inflight, ...callhome, ...customs, ...followups97, ...maplayers, ...tripcopy, ...look2, ...followups98, ...helpcards, ...driving, ...followups99, ...leavehome, ...games, ...followups100 } as const;

export type Key = keyof typeof en;
