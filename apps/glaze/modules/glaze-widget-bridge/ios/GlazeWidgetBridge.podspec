Pod::Spec.new do |s|
  s.name           = 'GlazeWidgetBridge'
  s.version        = '0.1.0'
  s.summary        = 'Writes the active Glaze theme and widget photo into the App Group for the widget extension.'
  s.description    = s.summary
  s.author         = 'Glaze'
  s.homepage       = 'https://example.invalid/glaze'
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
