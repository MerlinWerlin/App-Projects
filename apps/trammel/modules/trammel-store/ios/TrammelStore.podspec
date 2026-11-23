Pod::Spec.new do |s|
  s.name           = 'TrammelStore'
  s.version        = '1.0.0'
  s.summary        = 'Trammel 7-day free trial and one-time unlock (two non-consumables) with StoreKit 2.'
  s.description    = 'Local Expo module for Trammel (modules/trammel-store). See store/IAP.md.'
  s.author         = 'Trammel'
  s.homepage       = 'https://merlinwerlin.github.io/App-Projects/trammel/support.html'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
