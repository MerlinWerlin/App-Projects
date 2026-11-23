Pod::Spec.new do |s|
  s.name           = 'LiquidlineStore'
  s.version        = '1.0.0'
  s.summary        = 'Liquidline 7-day free trial and one-time unlock (two non-consumables) with StoreKit 2.'
  s.description    = 'Local Expo module for Liquidline (modules/liquidline-store). See store/IAP.md.'
  s.author         = 'Liquidline'
  s.homepage       = 'https://merlinwerlin.github.io/App-Projects/liquidline/support.html'
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
