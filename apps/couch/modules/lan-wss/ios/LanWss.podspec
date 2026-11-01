# Google Cast switch (oversight D147-1): the single source is src/core/cast/googleCast/switch.ts.
# When it says GOOGLE_CAST_ON = false, LanTls.swift compiles only its stub (COUCH_NO_GOOGLE_CAST),
# so a Google Cast compile error can be removed from the iOS build by flipping that one line.
google_cast_switch = File.join(__dir__, '..', '..', '..', 'src', 'core', 'cast', 'googleCast', 'switch.ts')
google_cast_on = !(File.exist?(google_cast_switch) &&
                   File.read(google_cast_switch) =~ /^export const GOOGLE_CAST_ON\s*=\s*false\s*;/m)

# Google TV remote switch: the single source is src/core/drivers/androidtv/switch.ts. When it says
# ANDROIDTV_NATIVE_ON = false, LanAtv.swift compiles only its stub (COUCH_NO_ANDROIDTV_TLS).
androidtv_switch = File.join(__dir__ || '.', '..', '..', '..', 'src', 'core', 'drivers', 'androidtv', 'switch.ts')
androidtv_on = !(File.exist?(androidtv_switch) &&
                 File.read(androidtv_switch) =~ /^export const ANDROIDTV_NATIVE_ON\s*=\s*false\s*;/m)

# Bonjour switch: the single source is src/core/bonjour/switch.ts. When it says
# BONJOUR_NATIVE_ON = false, LanBonjour.swift compiles only its stub (COUCH_NO_BONJOUR).
bonjour_switch = File.join(__dir__ || '.', '..', '..', '..', 'src', 'core', 'bonjour', 'switch.ts')
bonjour_on = !(File.exist?(bonjour_switch) &&
               File.read(bonjour_switch) =~ /^export const BONJOUR_NATIVE_ON\s*=\s*false\s*;/m)

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

  xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  conditions = []
  conditions << 'COUCH_NO_GOOGLE_CAST' unless google_cast_on
  conditions << 'COUCH_NO_ANDROIDTV_TLS' unless androidtv_on
  conditions << 'COUCH_NO_BONJOUR' unless bonjour_on
  xcconfig['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = (['$(inherited)'] + conditions).join(' ') unless conditions.empty?
  s.pod_target_xcconfig = xcconfig

  s.source_files = '**/*.{h,m,swift}'
end
