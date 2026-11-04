"""Read-only macOS preflight for a real Apple-signed Glaze .app or .ipa. Does not build or upload."""
from pathlib import Path
import argparse,datetime,hashlib,json,plistlib,subprocess,tempfile

GROUP='group.com.jared797.glaze'
def run(*args):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout

def verify(app):
    run('/usr/bin/codesign','--verify','--deep','--strict',str(app))
    bundles=[app,app/'PlugIns/GlazeWidgets.appex']
    records=[]
    for bundle,identifier in zip(bundles,['com.jared797.glaze','com.jared797.glaze.widget']):
        info=plistlib.loads((bundle/'Info.plist').read_bytes());assert info['CFBundleIdentifier']==identifier
        ent=plistlib.loads(run('/usr/bin/codesign','--display','--entitlements',':-',str(bundle)))
        profile=bundle/'embedded.mobileprovision';assert profile.is_file(),f'{identifier}: real provisioning profile missing'
        provisioning=plistlib.loads(run('/usr/bin/security','cms','-D','-i',str(profile)))
        team=ent.get('com.apple.developer.team-identifier')
        assert team and team!='GLAZETEST0' and team in provisioning['TeamIdentifier'],f'{identifier}: real Apple team required'
        expiry=provisioning['ExpirationDate'].replace(tzinfo=datetime.timezone.utc)
        assert expiry>datetime.datetime.now(datetime.timezone.utc),f'{identifier}: expired profile'
        assert ent.get('com.apple.security.application-groups')==[GROUP],f'{identifier}: signed Group entitlement missing'
        permitted=provisioning['Entitlements']
        assert GROUP in permitted.get('com.apple.security.application-groups',[]),f'{identifier}: profile does not authorize Group'
        app_id=ent.get('application-identifier','')
        assert app_id.endswith('.'+identifier),f'{identifier}: signed app identity mismatch'
        expected=permitted.get('application-identifier','')
        assert expected==app_id or (expected.endswith('.*') and app_id.startswith(expected[:-1])),f'{identifier}: profile app identity mismatch'
        exe=bundle/info['CFBundleExecutable'];raw=exe.read_bytes()
        records.append({'bundle':identifier,'team':team,'profileExpires':expiry.isoformat(),'executableSHA256':hashlib.sha256(raw).hexdigest(),'profileSHA256':hashlib.sha256(profile.read_bytes()).hexdigest(),'groupAuthorized':True})
    assert records[0]['team']==records[1]['team'],'App and extension signing teams differ'
    return {'schema':'GLAZE_SIGNED_GROUP_PREFLIGHT_V1','binaries':records,'signedGroupPreflightPassed':True,
            'actualBridgeSyncTest':False,'actualWidgetTapTest':False,'scope':'Signature, identity and provisioning authorization only; does not prove on-device synchronization or taps.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('package',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    package=a.package.resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix='glaze-signed-group-read-') as scratch:
        if package.suffix.lower()=='.ipa':
            run('/usr/bin/ditto','-x','-k',str(package),scratch)
            apps=list((Path(scratch)/'Payload').glob('*.app'));assert len(apps)==1,'Expected one application in IPA'
            app=apps[0]
        else:
            assert package.is_dir() and package.suffix=='.app','Pass an Apple-signed .app or .ipa';app=package
        report=verify(app)
    a.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('Signed app and extension authorize the same Group. Device sync/taps still need execution.')
if __name__=='__main__':main()
