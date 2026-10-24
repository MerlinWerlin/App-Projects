Pod::Spec.new do |s|
  s.name           = 'GlazeLivelock'
  s.version        = '0.1.0'
  s.summary        = 'Glaze Live Lock Screen: loops as animated Now Playing artwork (iOS 26+).'
  s.description    = 'Exports a loop to a portrait, silent video and presents it as animated Now Playing artwork on the Lock Screen.'
  s.author         = 'Glaze'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer', 'ImageIO', 'CoreVideo', 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
