// Stubs added by T05 for modules it imports (see ../README.md).
// expo-contacts ~57: the classic API members Satchel uses (system picker + permissions). Satchel deliberately never
// calls getContactsAsync (it would read the whole address book).
declare module 'expo-contacts' {
  export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
  export type PermissionResponse = {
    status: PermissionStatus;
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
    accessPrivileges?: 'all' | 'limited' | 'none';
  };
  export type PhoneNumber = {
    id?: string;
    label: string;
    number?: string;
    digits?: string;
    countryCode?: string;
    isPrimary?: boolean;
  };
  export type Contact = {
    id?: string;
    contactType?: 'person' | 'company';
    name: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    nickname?: string;
    company?: string;
    phoneNumbers?: PhoneNumber[];
  };
  export type ExistingContact = Contact & { id: string };
  export function isAvailableAsync(): Promise<boolean>;
  export function getPermissionsAsync(): Promise<PermissionResponse>;
  export function requestPermissionsAsync(): Promise<PermissionResponse>;
  export function presentContactPickerAsync(): Promise<ExistingContact | null>;
}
