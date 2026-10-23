Pod::Spec.new do |s|
  s.name           = 'LanWss'
  s.version        = '0.1.0'
  s.summary        = 'Minimal LAN WebSocket client (self-signed TLS only for RFC 1918 IPv4 hosts).'
  s.description    = 'Local Expo module for Couch. UNVERIFIED: not compiled yet.'
  s.author         = 'Couch'
  s.homepage       = 'https://example.invalid/couch'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
