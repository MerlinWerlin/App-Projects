Pod::Spec.new do |s|
  s.name           = 'GlazeProfileServer'
  s.version        = '0.1.0'
  s.summary        = 'Serves the Glaze icon profile to Safari from a short-lived loopback HTTP server.'
  s.description    = 'Local Expo module for Glaze (modules/glaze-profile-server, T126). See docs/OWNER_1024E_B.md.'
  s.author         = 'Glaze'
  s.homepage       = 'https://example.invalid/glaze'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Network', 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
