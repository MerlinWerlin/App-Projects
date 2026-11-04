require 'xcodeproj'
require 'fileutils'

root = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(root)
FileUtils.cp(File.join(__dir__, 'native-link-test-host.swift'), File.join(root, 'NativeLinkHost.swift'))
fixture = ARGV[1] || 'native-link-ui-tests.swift'
abort 'Unexpected UI fixture' unless ['native-link-ui-tests.swift', 'native-widget-tap-tests.swift', 'native-album-ui-tests.swift'].include?(fixture)
FileUtils.cp(File.join(__dir__, fixture), File.join(root, 'GlazeDeepLinkTests.swift'))
project_path = File.join(root, 'GlazeLinkCheck.xcodeproj')
project = Xcodeproj::Project.new(project_path)
host = project.new_target(:application, 'GlazeLinkHost', :ios, '17.0')
tests = project.new_target(:ui_test_bundle, 'GlazeLinkUITests', :ios, '17.0')
host.source_build_phase.add_file_reference(project.main_group.new_file('NativeLinkHost.swift'))
tests.source_build_phase.add_file_reference(project.main_group.new_file('GlazeDeepLinkTests.swift'))
tests.add_dependency(host)
[host, tests].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
    config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
    config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = target == host ? 'com.glaze.link-test-host' : 'com.glaze.link-ui-tests'
    config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
    config.build_settings['INFOPLIST_KEY_UILaunchScreen_Generation'] = 'YES' if target == host
    if target == tests
      config.build_settings['TEST_TARGET_NAME'] = host.name
      config.build_settings['ENABLE_TESTING_SEARCH_PATHS'] = 'YES'
    end
  end
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(host)
scheme.add_build_target(tests)
scheme.add_test_target(tests)
scheme.set_launch_target(host)
scheme.save_as(project_path, 'GlazeLinkCheck', true)
