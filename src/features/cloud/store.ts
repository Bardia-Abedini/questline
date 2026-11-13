/** Cloud UI state: auth, the sync engine's status, AI availability. */
import { create } from 'zustand';
import type { SyncStatus } from '@/data/sync';
import { cloudConfig } from './config';

export type AuthPhase =
  /** No Supabase project configured in this build. */
  'unconfigured' | 'loading' | 'guest' | 'signed_in';

export interface CloudUser {
  id: string;
  email: string | null;
  provider: string | null;
}

export type ServerAiStatus = 'unknown' | 'unconfigured' | 'limit_reached' | 'ready';

export interface CloudState {
  auth: AuthPhase;
  user: CloudUser | null;
  /** The player opened a password reset link and must choose a new password. */
  recovery: boolean;
  /** An error returned by an email or Google sign-in link. */
  linkError: string | null;
  /** Signing in on a device with guest data, into an account with data: waiting for a choice. */
  choice: 'none' | 'needed' | 'working';
  /** The account is linked and the engine runs. */
  connected: boolean;
  sync: SyncStatus | null;
  online: boolean;
  ai: { status: ServerAiStatus; used: number; limit: number };
}

export const useCloud = create<CloudState>(() => ({
  auth: cloudConfig.configured ? 'loading' : 'unconfigured',
  user: null,
  recovery: false,
  linkError: null,
  choice: 'none',
  connected: false,
  sync: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  ai: { status: 'unknown', used: 0, limit: 0 },
}));

export const setCloud = (patch: Partial<CloudState>) => useCloud.setState(patch);
