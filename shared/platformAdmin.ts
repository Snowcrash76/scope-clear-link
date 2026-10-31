export type PlatformStatus = 'active' | 'suspended' | 'archived';
export type PlatformKind = 'account' | 'business';
export interface PlatformControl { status: PlatformStatus; reason: string; updated_at?: string }
export interface PlatformMembership {
  id: string; ownerId: string; name: string; email: string; role: string;
  active: boolean; removed: boolean; accountId: string | null;
  invitation: 'accepted' | 'pending' | 'expired' | 'not_invited';
}
export interface PlatformAccount {
  id: string; email: string; name: string; createdAt: string; lastSignInAt: string | null;
  emailConfirmed: boolean; systemAdmin: boolean; providerBanned: boolean;
  control: PlatformControl; businessIds: string[]; membershipIds: string[];
}
export interface PlatformBusiness {
  id: string; name: string; email: string; contact: string | null;
  phone: string | null; abn: string | null; address: string | null; website: string | null;
  createdAt: string | null; lastSignInAt: string | null; control: PlatformControl;
  systemAdmin: boolean; loginExists: boolean; memberCount: number; projectCount: number; quoteCount: number; invoiceCount: number;
}
export interface PlatformDirectory {
  ready: boolean; setupMessage?: string; accounts: PlatformAccount[];
  businesses: PlatformBusiness[]; memberships: PlatformMembership[];
  deletionPolicy: 'history_preserving_only';
}
export interface PlatformBusinessDetail {
  business: PlatformBusiness; memberships: PlatformMembership[];
  projects: { id: string; name: string; status: string; created_at: string }[];
}
export interface PlatformAudit {
  id: string; actor_id: string; target_kind: string; target_id: string;
  action: string; reason: string; outcome: string; created_at: string;
}
