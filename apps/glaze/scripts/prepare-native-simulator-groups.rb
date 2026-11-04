# CI-only simulator entitlements. No device signing settings or production capabilities change.
require 'xcodeproj'
require 'fileutils'
require 'json'

abort 'Simulator Group harness is restricted to GitHub CI' unless ENV['GITHUB_ACTIONS'] == 'true' && ENV['GLAZE_SIMULATOR_GROUP_TEST'] == '1'
root = File.expand_path(ARGV.fetch(0))
project_path = Dir[File.join(root, '*.xcodeproj')].first or abort 'Generated app project missing'
out = File.join(ENV.fetch('RUNNER_TEMP'), 'glaze-simulator-groups')
FileUtils.mkdir_p(out)
project = Xcodeproj::Project.open(project_path)
targets = project.targets.select { |target| ['com.apple.product-type.application', 'com.apple.product-type.app-extension'].include?(target.product_type) }
abort 'Expected app and widget extension targets' unless targets.length == 2
records = targets.map do |target|
  bundle = target.build_configurations.first.build_settings['PRODUCT_BUNDLE_IDENTIFIER']
  abort "Unresolved target identity #{target.name}: #{bundle}" unless bundle&.match?(/\A[a-zA-Z0-9.-]+\z/)
  abort "Unexpected app identity #{bundle}" unless ['com.jared797.glaze', 'com.jared797.glaze.widget'].include?(bundle)
  entitlements = {
    'application-identifier' => "GLAZETEST0.#{bundle}",
    'com.apple.developer.team-identifier' => 'GLAZETEST0',
    'com.apple.security.application-groups' => ['group.com.jared797.glaze'],
    'get-task-allow' => true
  }
  xml = File.join(out, "#{target.name}.plist")
  Xcodeproj::Plist.write_to_path(entitlements, xml)
  abort 'Simulator DER entitlement conversion failed' unless system('/usr/bin/derq', 'query', '-f', 'xml', '-i', xml, '-o', "#{xml}.der", '--raw')
  target.build_configurations.each do |config|
    key = 'OTHER_LDFLAGS[sdk=iphonesimulator*]'
    flags = Array(config.build_settings[key] || '$(inherited)')
    flags += ["-Wl,-sectcreate,__TEXT,__entitlements,#{xml}", "-Wl,-sectcreate,__TEXT,__ents_der,#{xml}.der"]
    config.build_settings[key] = flags
  end
  {target: target.name, bundleId: bundle, simulatorOnly: true, team: 'GLAZETEST0', group: 'group.com.jared797.glaze'}
end
project.save
File.write(File.join(out, 'simulator-groups.json'), JSON.pretty_generate({sourceSHA: ENV.fetch('GITHUB_SHA'), targets: records, deviceSigningChanged: false}))
puts "Embedded simulator-only XML/DER Group entitlements for #{records.map { |r| r[:target] }.join(', ')}"
