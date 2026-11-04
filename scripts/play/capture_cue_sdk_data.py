"""Read only Cue's synthetic-emulator transport queue; never inspect a user's device."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys

output = Path(sys.argv[1]) / 'sdk-audit'
output.mkdir(parents=True, exist_ok=True)
commands = []

def adb(*args):
    result = subprocess.run(['adb', *args], capture_output=True, text=True, timeout=90)
    commands.append({'args': list(args), 'returncode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
    return result

receipt = {'scope': 'Own synthetic preview app only; not licensed billing, production Play delivery or a complete network audit', 'status': 'capture_incomplete'}
try:
    # Stop only after all UI/video assertions and app log inspection have finished.
    adb('shell', 'am', 'force-stop', 'com.jared797.cue.playtest')
    adb('root')
    adb('wait-for-device')
    identity = adb('shell', 'id')
    if 'uid=0(' not in identity.stdout:
        receipt['status'] = 'root_unavailable_no_private_data_read'
    else:
        remote = '/data/user/0/com.jared797.cue.playtest/databases/'
        listing = adb('shell', 'ls', '-la', remote)
        name = 'com.google.android.datatransport.events'
        if listing.returncode or name not in listing.stdout:
            receipt['status'] = 'no_transport_database_observed_not_no_collection'
        else:
            for suffix in ['', '-wal', '-shm', '-journal']:
                if name + suffix in listing.stdout:
                    adb('pull', remote + name + suffix, str(output / (name + suffix)))
            database = output / name
            connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
            integrity = connection.execute('PRAGMA integrity_check').fetchall()
            receipt['integrity'] = integrity
            tables = [r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            receipt['tables'] = tables
            values = {}
            for table in ['events', 'event_metadata', 'transport_contexts', 'event_payloads']:
                if table not in tables:
                    continue
                cursor = connection.execute('SELECT * FROM ' + table)
                columns = [c[0] for c in cursor.description]
                values[table] = [dict(zip(columns, [
                    {'hex': value.hex(), 'bytes': len(value)} if isinstance(value, bytes) else value for value in row
                ])) for row in cursor.fetchall()]
            connection.close()
            receipt['rows'] = values
            receipt['status'] = 'queue_captured_not_a_complete_data_safety_audit' if integrity == [('ok',)] else 'database_integrity_failed'
    receipt['files'] = [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in output.iterdir() if p.is_file()]
finally:
    (output / 'commands.json').write_text(json.dumps(commands, indent=2))
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2))
print('SDK queue audit: ' + receipt['status'])
