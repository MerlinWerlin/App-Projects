#!/usr/bin/env bash
set -euo pipefail
mkdir -p output
xcrun simctl status_bar "$DEVICE" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
xcrun simctl install "$DEVICE" DerivedData/Build/Products/Debug-iphonesimulator/CloudCompanion.app
launch() {
  xcrun simctl terminate "$DEVICE" com.jared797.cloudcompanion >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE" com.jared797.cloudcompanion "$@"
  sleep 3
}
launch --demo
xcrun simctl io "$DEVICE" screenshot output/01-home-demo.png
launch --demo --widget-preview
xcrun simctl io "$DEVICE" screenshot output/02-widget-layouts-demo.png
for mood in sunny cloudy rainy stormy snowy misty windy sleepy; do
  launch --demo --playground "--mood=$mood"
  xcrun simctl io "$DEVICE" screenshot "output/scene-$mood.png"
done
launch --demo --playground --mood=rainy
xcrun simctl io "$DEVICE" screenshot output/motion-a.png
sleep 2
xcrun simctl io "$DEVICE" screenshot output/motion-b.png
xcrun simctl io "$DEVICE" recordVideo --codec=h264 --force output/03-rain-animation.mp4 &
recording=$!
sleep 12
kill -INT "$recording"
wait "$recording" || true
launch --demo --playground --mood=rainy --motion-off
xcrun simctl io "$DEVICE" screenshot output/reduced-a.png
sleep 2
xcrun simctl io "$DEVICE" screenshot output/reduced-b.png
launch
xcrun simctl io "$DEVICE" screenshot output/04-first-launch.png
cp App/Assets.xcassets/AppIcon.appiconset/icon.png output/app-icon.png
