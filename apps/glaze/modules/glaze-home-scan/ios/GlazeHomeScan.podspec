Pod::Spec.new do |s|
  s.name           = 'GlazeHomeScan'
  s.version        = '0.1.0'
  s.summary        = 'Glaze Home Screen scan: on-device text recognition of Home Screen screenshots.'
  s.description    = 'Local Expo module for Glaze (modules/glaze-home-scan, T171). Vision text recognition, on device only.'
  s.author         = 'Glaze'
  s.homepage       = 'https://example.invalid/glaze'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'UIKit', 'ImageIO'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
