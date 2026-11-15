/** Account, sync, AI, calendar, reminders and data settings. OWNER: Cloud. */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  updateNotificationPrefs,
  updateSettings,
  useNotificationPrefs,
  useSettings,
  type NotificationPrefs,
} from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, Card, Input, Section, Select, showToast, Toggle } from '@/ui';
import { aiStatusFrom } from './aiClient';
import {
  connectCalendar,
  disconnectCalendar,
  refreshCalendarStatus,
  useCalendar,
} from './calendar/api';
import { DangerZone, ExportButton } from './components/DataActions';
import { SyncSummary } from './pages/AccountPage';
import {
  disablePush,
  enablePush,
  ensureNotificationPermission,
  pushSupported,
} from './reminders/push';
import { useCloud } from './store';

const DUE_SOON_MINUTES = [15, 30, 60, 120, 240];

export function SettingsSection() {
  return (
    <>
      <AccountSettings />
      <AiSettings />
      <CalendarSettings />
      <ReminderSettings />
      <DataSettings />
    </>
  );
}

function AccountSettings() {
  const { t } = useTranslation('cloud');
  const auth = useCloud((s) => s.auth);
  const email = useCloud((s) => s.user?.email);
  return (
    <Section title={t('settings.account_title')}>
      <Card className="flex flex-col gap-3" data-testid="settings-account">
        {auth === 'signed_in' ? (
          <p className="truncate text-sm text-muted">
            {t('account.signed_in_as')} {email}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {t(auth === 'unconfigured' ? 'account.unconfigured_body' : 'settings.guest_body')}
          </p>
        )}
        <SyncSummary />
        <div>
          <Link to="/account" className={buttonClass('secondary', 'sm')}>
            {t(auth === 'guest' ? 'settings.sign_in' : 'settings.manage_account')}
          </Link>
        </div>
      </Card>
    </Section>
  );
}

function AiSettings() {
  const { t } = useTranslation('cloud');
  const { number } = useFormat();
  const settings = useSettings();
  const enabled = settings?.ai_enabled !== false;
  const status = useCloud((s) => aiStatusFrom(s));
  const ai = useCloud((s) => s.ai);
  const key = enabled ? status : 'off';
  return (
    <Section title={t('settings.ai_title')}>
      <Card className="flex flex-col gap-4" data-testid="settings-ai">
        <Toggle
          label={t('settings.ai_switch')}
          description={t('settings.ai_switch_hint')}
          checked={enabled}
          disabled={!settings}
          onChange={(on) => void updateSettings({ ai_enabled: on })}
        />
        <div className="flex flex-col gap-1">
          <p className="font-bold text-text">
            {key === 'ready' ? t('settings.ai_ready') : t(`ai.unavailable_${key}`)}
          </p>
          <p className="text-sm text-muted">
            {key === 'ready' || key === 'limit_reached'
              ? ai.limit > 0
                ? t('settings.ai_usage', { used: number(ai.used), limit: number(ai.limit) })
                : t('settings.ai_ready_hint')
              : t(`ai.unavailable_${key}_hint`)}
          </p>
        </div>
        <div>
          <Link to="/brain-dump" className={buttonClass('soft', 'sm')}>
            {t('settings.open_brain_dump')}
          </Link>
        </div>
      </Card>
    </Section>
  );
}

function CalendarSettings() {
  const { t } = useTranslation('cloud');
  const connected = useCloud((s) => s.connected);
  const auth = useCloud((s) => s.auth);
  const calendar = useCalendar();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (connected) void refreshCalendarStatus();
  }, [connected]);

  const state =
    auth !== 'signed_in'
      ? auth === 'unconfigured'
        ? 'unconfigured'
        : 'guest'
      : calendar.status === 'unknown'
        ? 'checking'
        : calendar.status;

  return (
    <Section title={t('settings.calendar_title')}>
      <Card className="flex flex-col gap-3" data-testid="settings-calendar">
        <p className="text-sm text-muted">
          {state === 'connected'
            ? t('calendar.connected_as', { email: calendar.email ?? '' })
            : t(`calendar.explain_${state}_hint`)}
        </p>
        <div className="flex flex-wrap gap-2">
          {state === 'disconnected' && (
            <Button
              size="sm"
              icon="globe"
              loading={busy}
              onClick={() => {
                setBusy(true);
                void connectCalendar().catch(() => setBusy(false));
              }}
            >
              {t('calendar.connect')}
            </Button>
          )}
          {state === 'connected' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void disconnectCalendar().then(() =>
                  showToast({ tone: 'success', title: t('calendar.disconnected') }),
                )
              }
            >
              {t('calendar.disconnect')}
            </Button>
          )}
          <Link to="/calendar" className={buttonClass('soft', 'sm')}>
            {t('settings.open_calendar')}
          </Link>
        </div>
      </Card>
    </Section>
  );
}

function ReminderSettings() {
  const { t } = useTranslation('cloud');
  const prefs = useNotificationPrefs();
  const signedIn = useCloud((s) => s.auth === 'signed_in');
  if (!prefs) return null;

  const save = (patch: Partial<NotificationPrefs>) => void updateNotificationPrefs(patch);

  /** Turning a reminder on is the only moment notification permission is requested. */
  const turnOn = async (patch: Partial<NotificationPrefs>) => {
    save(patch);
    await ensureNotificationPermission();
    if (signedIn && !prefs.push_enabled && pushSupported()) {
      const r = await enablePush();
      if (r === 'denied') showToast({ tone: 'info', title: t('reminders.permission_denied') });
    }
  };
  const toggle = (key: 'due_soon' | 'daily_nudge' | 'paused_reminder') => (on: boolean) =>
    on ? void turnOn({ [key]: true }) : save({ [key]: false });

  return (
    <Section title={t('settings.reminders_title')} description={t('settings.reminders_hint')}>
      <Card className="flex flex-col gap-5" data-testid="settings-reminders">
        <Toggle
          label={t('reminders.due_soon')}
          description={t('reminders.due_soon_hint')}
          checked={prefs.due_soon}
          onChange={toggle('due_soon')}
        />
        {prefs.due_soon && (
          <Select
            label={t('reminders.due_soon_minutes')}
            value={String(prefs.due_soon_minutes)}
            onChange={(e) => save({ due_soon_minutes: Number(e.target.value) })}
            options={DUE_SOON_MINUTES.map((m) => ({
              value: String(m),
              label: t('calendar.minutes', { count: m }),
            }))}
          />
        )}
        <Toggle
          label={t('reminders.nudge')}
          description={t('reminders.nudge_hint')}
          checked={prefs.daily_nudge}
          onChange={toggle('daily_nudge')}
        />
        {prefs.daily_nudge && (
          <Input
            label={t('reminders.nudge_time')}
            type="time"
            value={prefs.daily_nudge_time}
            onChange={(e) => e.target.value && save({ daily_nudge_time: e.target.value })}
          />
        )}
        <Toggle
          label={t('reminders.paused')}
          description={t('reminders.paused_hint')}
          checked={prefs.paused_reminder}
          onChange={toggle('paused_reminder')}
        />
        <Toggle
          label={t('reminders.quiet')}
          description={t('reminders.quiet_hint')}
          checked={prefs.quiet_hours_enabled}
          onChange={(on) => save({ quiet_hours_enabled: on })}
        />
        {prefs.quiet_hours_enabled && (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Input
              label={t('reminders.quiet_start')}
              type="time"
              value={prefs.quiet_start}
              onChange={(e) => e.target.value && save({ quiet_start: e.target.value })}
            />
            <Input
              label={t('reminders.quiet_end')}
              type="time"
              value={prefs.quiet_end}
              onChange={(e) => e.target.value && save({ quiet_end: e.target.value })}
            />
          </div>
        )}
        {signedIn && pushSupported() ? (
          <Toggle
            label={t('reminders.push')}
            description={t('reminders.push_hint')}
            checked={prefs.push_enabled}
            onChange={(on) => {
              if (!on) {
                void disablePush();
                return;
              }
              void enablePush().then((r) => {
                if (r !== 'enabled') showToast({ tone: 'info', title: t(`reminders.push_${r}`) });
              });
            }}
          />
        ) : (
          <p className="text-sm text-muted">{t('reminders.in_app_only')}</p>
        )}
      </Card>
    </Section>
  );
}

function DataSettings() {
  const { t } = useTranslation('cloud');
  return (
    <Section title={t('data.title')}>
      <Card className="flex flex-col gap-4" data-testid="settings-data">
        <ExportButton />
        <DangerZone />
      </Card>
    </Section>
  );
}
