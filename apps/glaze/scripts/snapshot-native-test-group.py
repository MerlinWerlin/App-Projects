"""CI-only, read-only capture of this fresh simulator's Glaze test Group after a UI run."""
from pathlib import Path
import hashlib,json,os,plistlib,re,shutil,sys
assert os.environ.get('GITHUB_ACTIONS')=='true','Only isolated Actions simulators'
device=sys.argv[1];assert re.fullmatch(r'[A-Fa-f0-9-]{36}',device)
out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
base=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Shared/AppGroup'
matches=[]
for folder in base.glob('*'):
    metadata=folder/'.com.apple.mobile_container_manager.metadata.plist'
    try:values=plistlib.loads(metadata.read_bytes())
    except (OSError,plistlib.InvalidFileException):continue
    if values.get('MCMMetadataIdentifier')=='group.com.jared797.glaze':matches.append(folder)
report={'group':'group.com.jared797.glaze','containersFound':len(matches),'runtimeQualification':False,'files':[]}
if len(matches)==1:
    folder=matches[0]
    for name in ['theme.json','widgets.json','widget-art/index.json','Library/Preferences/group.com.jared797.glaze.plist']:
        source=folder/name
        if source.is_file():
            shutil.copy2(source,out/source.name);report['files'].append(source.name)
    index=folder/'widget-art/index.json'
    if index.is_file():
        library=json.loads(index.read_text())
        files=[]
        for p in library.get('pieces',[]):
            pid=p.get('id')
            if not isinstance(pid,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',pid):continue
            image=folder/'widget-art'/(pid+'.jpg')
            size=image.stat().st_size if image.is_file() else 0
            if image.is_file():
                target=out/'composed-art';target.mkdir(exist_ok=True);shutil.copy2(image,target/(pid+'.jpg'))
            files.append({'id':pid,'size':p.get('size'),'name':p.get('name'),'bytes':size,'offered':not p.get('hiddenFromPicker',False) and not p.get('live',{}).get('design')})
        report['artIndexTheme']=library.get('currentThemeId')
        report['artFiles']=files
    prefs=folder/'Library/Preferences/group.com.jared797.glaze.plist'
    if prefs.is_file():
        values=plistlib.loads(prefs.read_bytes())
        report['habitKeysPresent']=[key for key in ['glaze.habits.v1','glaze.habitLog.v1'] if key in values]
    manifest=folder/'widgets.json'
    if manifest.is_file():
        values=json.loads(manifest.read_text())
        refs={r for spec in values.get('catalogue',{}).get('specs',[]) if spec.get('kind')=='photoAlbum' for r in spec.get('photoRefs',[]) if isinstance(r,str) and re.fullmatch(r'album-[a-f0-9]{40}\.jpg',r)}
        images=[]
        for ref in sorted(refs):
            image=folder/ref
            if not image.is_file():continue
            raw=image.read_bytes();digest=hashlib.sha256(raw).hexdigest()
            images.append({'file':ref,'bytes':len(raw),'contentHashMatches':ref=='album-'+digest[:40]+'.jpg','jpeg':raw[:2]==b'\xff\xd8'})
            target=out/'native-images';target.mkdir(exist_ok=True);shutil.copy2(image,target/ref)
        report['albumImages']=images
        cursors=[]
        for cursor in sorted(folder.glob('album-cursor-*.json')):
            if not re.fullmatch(r'album-cursor-[a-f0-9]{64}\.json',cursor.name):continue
            value=json.loads(cursor.read_text())
            if isinstance(value,int) and not isinstance(value,bool) and 0<=value<12:
                cursors.append({'file':cursor.name,'offset':value});shutil.copy2(cursor,out/cursor.name)
        report['albumCursors']=cursors
(out/'group-capture.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Preserved test-only Group files; capture alone is not a passing UI test')
