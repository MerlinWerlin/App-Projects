"""Validate a CI-local EAS bundle without inventing an Expo cloud build record."""
import json
import os
from pathlib import Path
import sys
from verify_aab import SOURCE, validate_bundle

output = Path(sys.argv[1]).resolve()
source = (output / 'source-commit.txt').read_text().strip()
assert source == SOURCE, 'Wrong frozen app source'
assert os.environ.get('GITHUB_ACTIONS') == 'true'
assert os.environ.get('GITHUB_REPOSITORY') == 'MerlinWerlin/App-Projects'
run_id = os.environ['GITHUB_RUN_ID']
assert run_id.isdigit()
receipt = {
    'origin': 'github_actions_local_eas', 'githubRunId': run_id,
    'githubWorkflowCommit': os.environ['GITHUB_SHA'], 'appSourceCommit': source,
    'expoCloudBuildId': None,
    'configurationDelta': 'CI links existing Expo project and disables autoIncrement; remote Android version remains4. Source diff archived separately.',
    'credentials': 'Existing Expo-managed upload key used only inside disposable CI; not included in artifacts',
}
(output / 'local-build-provenance.json').write_text(json.dumps(receipt, indent=2) + '\n')
validate_bundle(output, output / 'cue-production.aab', None, source, 'github_actions_local_eas')
