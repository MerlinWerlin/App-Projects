// Set up Expo iOS App Store signing for a NEW app without the interactive `eas credentials` wizard.
// Non-interactive EAS builds stop with "Distribution Certificate is not validated for non-interactive builds"
// when an app has no credentials yet. This copies the team's existing distribution certificate (already on
// Expo, used by a reference app) onto the new app, together with an App Store provisioning profile made by
// scripts/asc/asc.py (profile mode) for that certificate. Same GraphQL calls eas-cli makes.
//
//   node ios_credentials.mjs info <owner/slug of reference app>          -> prints JSON {serial, ...}
//   node ios_credentials.mjs setup <owner/slug of new app> <bundleId> <reference owner/slug> <profile.b64 file>
// Needs EXPO_TOKEN. Prints no secrets.
import fs from 'node:fs';

const TOKEN = process.env.EXPO_TOKEN;
if (!TOKEN) throw new Error('EXPO_TOKEN missing');

async function gql(query, variables) {
  const r = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors.map((e) => e.message)));
  return j.data;
}

async function reference(fullName) {
  const d = await gql(
    `query($n: String!) { app { byFullName(fullName: $n) { id ownerAccount { id name }
      iosAppCredentials { id appleTeam { id appleTeamIdentifier }
        iosAppBuildCredentialsList { iosDistributionType distributionCertificate { id serialNumber validityNotAfter } } } } } }`,
    { n: fullName },
  );
  const app = d.app.byFullName;
  for (const c of app.iosAppCredentials) {
    for (const b of c.iosAppBuildCredentialsList) {
      if (b.iosDistributionType === 'APP_STORE' && b.distributionCertificate) {
        return {
          accountId: app.ownerAccount.id,
          accountName: app.ownerAccount.name,
          appleTeamId: c.appleTeam?.id,
          appleTeamIdentifier: c.appleTeam?.appleTeamIdentifier,
          certId: b.distributionCertificate.id,
          serial: b.distributionCertificate.serialNumber,
          certExpires: b.distributionCertificate.validityNotAfter,
        };
      }
    }
  }
  throw new Error(`no APP_STORE distribution certificate on ${fullName}`);
}

async function setup(fullName, bundleId, refName, profileFile) {
  const ref = await reference(refName);
  const profile = fs.readFileSync(profileFile, 'utf8').trim();
  const appD = await gql(`query($n: String!) { app { byFullName(fullName: $n) { id } } }`, { n: fullName });
  const appId = appD.app.byFullName.id;

  // Apple app identifier (bundle id) record on Expo.
  const idD = await gql(
    `query($a: String!, $b: String!) { account { byName(accountName: $a) { appleAppIdentifiers(bundleIdentifier: $b) { id bundleIdentifier } } } }`,
    { a: ref.accountName, b: bundleId },
  );
  let appleAppIdentifierId = idD.account.byName.appleAppIdentifiers[0]?.id;
  if (!appleAppIdentifierId) {
    const c = await gql(
      `mutation($i: AppleAppIdentifierInput!, $acc: ID!) { appleAppIdentifier { createAppleAppIdentifier(appleAppIdentifierInput: $i, accountId: $acc) { id } } }`,
      { i: { bundleIdentifier: bundleId, appleTeamId: ref.appleTeamId }, acc: ref.accountId },
    );
    appleAppIdentifierId = c.appleAppIdentifier.createAppleAppIdentifier.id;
    console.log('created Apple app identifier on Expo');
  }

  // Existing credentials for this app + bundle?
  const credD = await gql(
    `query($n: String!, $id: String!) { app { byFullName(fullName: $n) { iosAppCredentials(filter: { appleAppIdentifierId: $id }) { id
       iosAppBuildCredentialsList { id iosDistributionType distributionCertificate { id } provisioningProfile { id } } } } } }`,
    { n: fullName, id: appleAppIdentifierId },
  );
  let creds = credD.app.byFullName.iosAppCredentials[0];
  if (!creds) {
    const c = await gql(
      `mutation($i: IosAppCredentialsInput!, $app: ID!, $id: ID!) { iosAppCredentials { createIosAppCredentials(iosAppCredentialsInput: $i, appId: $app, appleAppIdentifierId: $id) { id } } }`,
      { i: { appleTeamId: ref.appleTeamId }, app: appId, id: appleAppIdentifierId },
    );
    creds = { id: c.iosAppCredentials.createIosAppCredentials.id, iosAppBuildCredentialsList: [] };
    console.log('created iOS app credentials on Expo');
  }

  const p = await gql(
    `mutation($i: AppleProvisioningProfileInput!, $acc: ID!, $id: ID!) { appleProvisioningProfile { createAppleProvisioningProfile(appleProvisioningProfileInput: $i, accountId: $acc, appleAppIdentifierId: $id) { id expiration } } }`,
    { i: { appleProvisioningProfile: profile }, acc: ref.accountId, id: appleAppIdentifierId },
  );
  const profileId = p.appleProvisioningProfile.createAppleProvisioningProfile.id;
  console.log('uploaded provisioning profile to Expo');

  const existing = creds.iosAppBuildCredentialsList.find((b) => b.iosDistributionType === 'APP_STORE');
  if (existing) {
    await gql(
      `mutation($b: ID!, $c: ID!) { iosAppBuildCredentials { setDistributionCertificate(id: $b, distributionCertificateId: $c) { id } } }`,
      { b: existing.id, c: ref.certId },
    );
    await gql(
      `mutation($b: ID!, $p: ID!) { iosAppBuildCredentials { setProvisioningProfile(id: $b, provisioningProfileId: $p) { id } } }`,
      { b: existing.id, p: profileId },
    );
    console.log('updated existing App Store build credentials');
  } else {
    await gql(
      `mutation($i: IosAppBuildCredentialsInput!, $c: ID!) { iosAppBuildCredentials { createIosAppBuildCredentials(iosAppBuildCredentialsInput: $i, iosAppCredentialsId: $c) { id } } }`,
      { i: { iosDistributionType: 'APP_STORE', distributionCertificateId: ref.certId, provisioningProfileId: profileId }, c: creds.id },
    );
    console.log('created App Store build credentials');
  }
  console.log(`done: ${fullName} (${bundleId}) uses certificate ${ref.serial}`);
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'info') {
  const r = await reference(a[0]);
  console.log(JSON.stringify({ serial: r.serial, certExpires: r.certExpires, team: r.appleTeamIdentifier, account: r.accountName }));
} else if (cmd === 'setup') {
  await setup(a[0], a[1], a[2], a[3]);
} else {
  throw new Error('usage: info <ref> | setup <app> <bundleId> <ref> <profileFile>');
}
