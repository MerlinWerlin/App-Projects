Pod::Spec.new do |s|
  s.name           = 'GlazeLivePhoto'
  s.version        = '0.1.0'
  s.summary        = 'Glaze Live Photo export: still JPEG + paired MOV saved to Photos.'
  s.description    = 'Local Expo module for Glaze (modules/glaze-livephoto). See docs/LIVEPHOTO.md.'
  s.author         = 'Glaze'
  s.homepage       = 'https://example.invalid/glaze'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMedia', 'CoreVideo', 'ImageIO', 'Photos', 'UniformTypeIdentifiers'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
