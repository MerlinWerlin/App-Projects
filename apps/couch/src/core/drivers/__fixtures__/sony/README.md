# Sony Bravia fixtures

**Reconstructed, not captured.** Shapes follow public descriptions of the Bravia REST
("Scalar") API and IRCC (Sony BRAVIA Professional Display developer docs, pybravia /
braviarc behaviour). Every value is UNVERIFIED: model, serial, MAC, icon URLs and IRCC codes
are illustrative (the driver looks IRCC codes up by name, so wrong codes would not change test
results, but wrong names would).

- `remote-controller-info.json` — `system/getRemoteControllerInfo`: `[ {bundled,type}, [ {name,value} ] ]`.
- `application-list.json` — `appControl/getApplicationList`: `[[ {title, uri, icon} ]]`, incl. an
  empty icon, a missing icon and an entry without a uri.
- `external-inputs-status.json` — `avContent/getCurrentExternalInputsStatus` v1.1.
- `system-information.json` — `system/getSystemInformation`.
- `misc.json` — power status, volume information, playing-content info and error replies
  (`[7,"Illegal State"]` when an app is in front, `[40005,"Display Is Turned off"]`,
  `[12, method]` for an unknown method).

Replace with real captures once hardware testing starts (`curl -H 'X-Auth-PSK: <psk>' -d
'{"method":"getRemoteControllerInfo","id":1,"params":[],"version":"1.0"}' http://<tv>/sony/system`)
and note the model and firmware here.
