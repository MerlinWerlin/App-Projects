Pod::Spec.new do |s|
  s.name           = 'GlazeStore'
  s.version        = '0.1.0'
  s.summary        = 'Buys and restores Glaze Plus (one non-consumable) with StoreKit 2.'
  s.description    = 'Local Expo module for Glaze (modules/glaze-store, T152). See docs/IAP_SANDBOX.md.'
  s.author         = 'Glaze'
  s.homepage       = 'https://example.invalid/glaze'
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
