Pod::Spec.new do |s|
  s.name           = 'RoamlingsWidgetBridge'
  s.version        = '0.1.0'
  s.summary        = 'Shares the Roamlings buddy image and state with the home-screen widget through the App Group.'
  s.description    = s.summary
  s.author         = 'Roamlings'
  s.homepage       = 'https://example.invalid/roamlings'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
