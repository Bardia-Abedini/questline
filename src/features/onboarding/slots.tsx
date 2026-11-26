/**
 * Mounted once at the app root. OWNER: Finish package. Sends first-time players
 * (profile.onboarded_at is null) to the four welcome screens.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { clock, updateProfile, useProfile } from '@/data';
import { hasExistingData, skipFlagSet, WELCOME_PATH } from './state';

/** Paths the gate never redirects away from (focus mode restores, email links land on /account). */
const OPEN_PATHS = [WELCOME_PATH, '/focus', '/account', '/dev'];

export function OnboardingGate() {
  const profile = useProfile();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const settled = useRef(false);

  useEffect(() => {
    if (!profile || settled.current) return;
    if (profile.onboarded_at || skipFlagSet()) {
      settled.current = true;
      return;
    }
    if (OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    settled.current = true;
    void hasExistingData().then((existing) => {
      if (existing) void updateProfile({ onboarded_at: clock.iso() });
      else navigate(WELCOME_PATH, { replace: true });
    });
  }, [profile, pathname, navigate]);

  return null;
}

/** "Show the welcome again" (Settings): walks the screens once more without changing data. */
export function useReplayOnboarding(): () => void {
  const navigate = useNavigate();
  return () => navigate(`${WELCOME_PATH}?replay=1`);
}
