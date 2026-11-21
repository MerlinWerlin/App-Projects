"""Satchel store captures: put a realistic, invented trip on the simulator before Satchel's first launch.

python3 seed.py --data <app data container> --bundle <bundle id> [--start YYYY-MM-DD]

Writes Satchel's AsyncStorage (Library/Application Support/<bundle>/RCTAsyncLocalStorage_V1/manifest.json, the
@react-native-async-storage 2.x iOS layout) and one boarding-pass image in Documents/attachments/. The trip is made
up: no real airline, hotel, person, policy or booking number (phone numbers are from Australia's fiction ranges).
It also marks the in-app sample trip as already seeded and the welcome cards as done, so no "demo" data, tips or
first-run cards show in the captures. Only for simulator store captures; never shipped in the app.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TRIP = 'japan-autumn'
SYD = {'id': 'syd', 'name': 'Sydney Airport T1', 'lat': -33.9366, 'lon': 151.1658}
HND = {'id': 'hnd', 'name': 'Haneda Airport T3', 'lat': 35.5447, 'lon': 139.7682}
TYO = {'id': 'tyo', 'name': 'Tokyo Station', 'lat': 35.6812, 'lon': 139.7671}
KYO = {'id': 'kyo', 'name': 'Kyoto Station', 'lat': 34.9858, 'lon': 135.7588}
KIX = {'id': 'kix', 'name': 'Kansai Airport T1', 'lat': 34.4347, 'lon': 135.2441}
TOKYO, KYOTO = 'Asia/Tokyo', 'Asia/Tokyo'
PASS_FILE = 'attachments/sk21-boarding-pass.png'
# The code area of the boarding pass image, as fractions (the ticket view shows this crop big).
PASS_CROP = {'x': 0.2, 'y': 0.47, 'w': 0.6, 'h': 0.37}


def place(pid, name, lat, lon, address=None, local=None):
    p = {'id': pid, 'name': name, 'lat': lat, 'lon': lon}
    if address:
        p['address'] = address
    if local:
        p['localAddress'] = local
    return p


def trip(start, now):
    d = lambda n: (start + dt.timedelta(days=n)).isoformat()
    st = lambda n, hm, tz=TOKYO: {'local': f'{d(n)}T{hm}', 'tz': tz}
    items = []

    def it(**x):
        x.setdefault('attachments', [])
        x['tripId'] = TRIP
        items.append(x)

    it(id='f1', kind='flight', title='Sydney → Tokyo Haneda', carrier='Southern Skies', number='SK 21', seat='34K',
       ref='K7Q4XT', start=st(0, '09:30', 'Australia/Sydney'), end=st(0, '17:45'), **{'from': SYD, 'to': HND},
       attachments=[{'id': 'f1-pass', 'uri': PASS_FILE, 'name': 'SK21 boarding pass.png', 'mime': 'image/png', 'role': 'ticket', 'qrCrop': PASS_CROP}])
    it(id='h1', kind='hotel', title='Asakusa Lantern Hotel', ref='58213-AL', start=st(0, '19:30'), end=st(4, '11:00'),
       place=place('h1', 'Asakusa Lantern Hotel', 35.7148, 139.7967, '2-1 Asakusa, Taito City, Tokyo', '東京都台東区浅草2-1'))
    it(id='a1', kind='activity', title='Breakfast at Tsukiji Outer Market', start=st(1, '07:30'), end=st(1, '09:00'),
       place=place('a1', 'Tsukiji Outer Market', 35.6655, 139.7707))
    it(id='a2', kind='activity', title='Senso-ji and Nakamise Street', start=st(1, '10:00'), end=st(1, '12:00'),
       place=place('a2', 'Senso-ji', 35.7148, 139.7967))
    it(id='a3', kind='activity', title='Lunch: soba near Kappabashi', start=st(1, '12:30'), end=st(1, '13:30'),
       place=place('a3', 'Kappabashi Dougu Street', 35.7133, 139.7883))
    it(id='a4', kind='activity', title='Meiji Shrine and Yoyogi Park walk', start=st(1, '15:00'), end=st(1, '17:00'),
       place=place('a4', 'Meiji Jingu', 35.6764, 139.6993))
    it(id='a5', kind='activity', title='Dinner booking, Ebisu izakaya', ref='Table for 2', start=st(1, '19:00'), end=st(1, '21:00'),
       place=place('a5', 'Ebisu', 35.6467, 139.7101))
    it(id='a6', kind='activity', title='Ueno Park and the National Museum', start=st(2, '09:30'), end=st(2, '13:00'),
       place=place('a6', 'Tokyo National Museum', 35.7188, 139.7765))
    it(id='a7', kind='activity', title='Sumo morning practice tour', ref='TR-2210', start=st(3, '07:00'), end=st(3, '09:30'),
       place=place('a7', 'Ryogoku', 35.6969, 139.7934))
    it(id='t1', kind='train', title='Tokyo → Kyoto', number='Shinkansen 215', seat='Car 7, 12E', ref='90314',
       start=st(4, '12:03'), end=st(4, '14:18', KYOTO), **{'from': TYO, 'to': KYO})
    it(id='h2', kind='hotel', title='Gion Garden Inn', ref='GG-7781', start=st(4, '15:00', KYOTO), end=st(7, '10:00', KYOTO),
       place=place('h2', 'Gion Garden Inn', 35.0037, 135.7788, '570 Gionmachi, Higashiyama Ward, Kyoto', '京都府京都市東山区祇園町570'))
    it(id='a8', kind='activity', title='Fushimi Inari at sunrise', start=st(5, '06:30', KYOTO), end=st(5, '09:00', KYOTO),
       place=place('a8', 'Fushimi Inari Taisha', 34.9671, 135.7727))
    it(id='n1', kind='note', title='Temple day: carry cash, shoes off inside', start=st(5, '09:30', KYOTO))
    it(id='a9', kind='activity', title='Tea ceremony in Higashiyama', ref='TC-0412', start=st(5, '14:00', KYOTO), end=st(5, '15:30', KYOTO),
       place=place('a9', 'Higashiyama', 34.9986, 135.7808))
    it(id='a10', kind='activity', title='Arashiyama bamboo grove', start=st(6, '08:00', KYOTO), end=st(6, '11:00', KYOTO),
       place=place('a10', 'Arashiyama Bamboo Grove', 35.0170, 135.6713))
    it(id='f2', kind='flight', title='Osaka Kansai → Sydney', carrier='Southern Skies', number='SK 6', seat='41A', ref='K7Q4XT',
       start=st(7, '21:30', KYOTO), end=st(8, '08:50', 'Australia/Sydney'), **{'from': KIX, 'to': SYD})
    return {
        'id': TRIP, 'name': 'Girls trip', 'startDate': d(0), 'endDate': d(8), 'homeTz': 'Australia/Sydney',
        'items': items, 'createdAt': now,
        'budget': {'currency': 'AUD', 'amount': 450000}, 'rates': {'JPY': 0.0102},
    }



def second_trip(start, now):
    """1.0 feedback (multiple trips): a later, invented second trip, so Home's Your trips row and the Itinerary
    switcher have two trips to show."""
    tid = 'bali-mum'
    d = lambda n: (start + dt.timedelta(days=n)).isoformat()
    st = lambda n, hm, tz='Asia/Makassar': {'local': f'{d(n)}T{hm}', 'tz': tz}
    items = [
        {'id': 'b1', 'tripId': tid, 'kind': 'flight', 'title': 'Sydney → Denpasar', 'carrier': 'Southern Skies', 'number': 'SK 44',
         'start': st(0, '10:15', 'Australia/Sydney'), 'end': st(0, '14:05'), 'attachments': []},
        {'id': 'b2', 'tripId': tid, 'kind': 'hotel', 'title': 'Ubud Ricefield Villas', 'start': st(0, '16:00'), 'end': st(6, '11:00'), 'attachments': []},
        {'id': 'b3', 'tripId': tid, 'kind': 'flight', 'title': 'Denpasar → Sydney', 'carrier': 'Southern Skies', 'number': 'SK 45',
         'start': st(6, '15:30'), 'end': st(7, '00:40', 'Australia/Sydney'), 'attachments': []},
    ]
    return {'id': tid, 'name': 'Bali with Mum', 'startDate': d(0), 'endDate': d(7), 'homeTz': 'Australia/Sydney', 'items': items, 'createdAt': now}


def boarding_pass(path):
    import qrcode  # pip install qrcode

    W, H = 1080, 1700
    im = Image.new('RGB', (W, H), (250, 248, 243))
    d = ImageDraw.Draw(im)
    try:
        big = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 86)
        mid = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 46)
        small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 34)
    except OSError:
        big = mid = small = ImageFont.load_default()
    d.rectangle((0, 0, W, 170), fill=(20, 33, 61))
    d.text((60, 52), 'SOUTHERN SKIES', font=mid, fill=(255, 255, 255))
    d.text((W - 360, 60), 'BOARDING PASS', font=small, fill=(255, 210, 170))
    d.text((60, 230), 'SYD', font=big, fill=(20, 33, 61))
    d.text((W - 260, 230), 'HND', font=big, fill=(20, 33, 61))
    d.text((60, 330), 'Sydney', font=small, fill=(100, 100, 110))
    d.text((W - 260, 330), 'Tokyo Haneda', font=small, fill=(100, 100, 110))
    rows = [('PASSENGER', 'LEE / SAM'), ('FLIGHT', 'SK 21'), ('SEAT', '34K'), ('GATE', '54'), ('BOARDS', '08:50')]
    for i, (k, v) in enumerate(rows):
        cx = 60 + (i % 3) * 330
        cy = 430 + (i // 3) * 140
        d.text((cx, cy), k, font=small, fill=(120, 120, 130))
        d.text((cx, cy + 44), v, font=mid, fill=(20, 33, 61))
    q = qrcode.QRCode(border=2, box_size=12)
    q.add_data('M1LEE/SAM            EK7Q4XT SYDHNDSK 0021 001Y034K0001 100')
    q.make(fit=True)
    code = q.make_image(fill_color='black', back_color='white').convert('RGB').resize((600, 600), Image.NEAREST)
    im.paste(code, ((W - 600) // 2, 820))
    d.text((60, 1520), 'Booking K7Q4XT  ·  Seq 001  ·  Economy', font=small, fill=(100, 100, 110))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--bundle', required=True)
    ap.add_argument('--start')
    a = ap.parse_args()
    data = Path(a.data)
    start = dt.date.fromisoformat(a.start) if a.start else dt.date.today() - dt.timedelta(days=1)
    now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    t = trip(start, now)
    card = {
        'insurer': 'Harbourside Travel Insurance', 'policy': 'HT-4471-2093', 'insurerPhone': '+61 2 5550 0101',
        'contacts': [{'id': 'c1', 'name': 'Jordan Lee', 'phone': '+61 491 570 157', 'relation': 'Partner'}],
        'medicalNotes': 'No known allergies. Blood type O+.',
    }
    keys = {
        'satchel.trips.v1': json.dumps([t, second_trip(start + dt.timedelta(days=96), now)], ensure_ascii=False),
        'satchel.seeded.v1': '1',
        'satchel.demoJournal.v1': '1',
        'satchel.welcome.done.v1': 'true',
        'satchel.demoIntro.done.v1': 'true',
        'satchel.emergency.v1': json.dumps(card),
        'satchel.emergencyCountry.v1': json.dumps('JP'),
        'satchel.homeCountry.v1': json.dumps('AU'),
    }
    store = data / 'Library' / 'Application Support' / a.bundle / 'RCTAsyncLocalStorage_V1'
    store.mkdir(parents=True, exist_ok=True)
    (store / 'manifest.json').write_text(json.dumps(keys, ensure_ascii=False), encoding='utf-8')
    boarding_pass(data / 'Documents' / PASS_FILE)
    print(f'seeded {t["name"]} {t["startDate"]}..{t["endDate"]} ({len(t["items"])} plans) into {store}')


if __name__ == '__main__':
    main()
