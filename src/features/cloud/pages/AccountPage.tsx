import type { TFunction } from 'i18next';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Card,
  Dialog,
  Icon,
  Input,
  Page,
  Section,
  SegmentedControl,
  showToast,
  Spinner,
} from '@/ui';
import { DangerZone, ExportButton } from '../components/DataActions';
import { useBadgeState } from '../components/badgeState';
import {
  resendConfirmation,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  syncNow,
  updatePassword,
  type AuthErrorKey,
} from '../session';
import { useCloud } from '../store';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

type Mode = 'sign_in' | 'sign_up' | 'reset';

export function AccountPage() {
  const { t } = useTranslation('cloud');
  const auth = useCloud((s) => s.auth);
  const recovery = useCloud((s) => s.recovery);
  const linkError = useCloud((s) => s.linkError);

  return (
    <Page title={t('account.title')} subtitle={t('account.subtitle')}>
      {linkError && (
        <Card tone="sunken" className="flex items-start gap-2" role="alert">
          <Icon name="alert" className="mt-0.5 shrink-0 text-warning" />
          <p className="min-w-0">{t('account.link_error')}</p>
        </Card>
      )}
      {auth === 'unconfigured' && <Unconfigured />}
      {auth === 'loading' && <Spinner label={t('account.loading')} />}
      {auth === 'guest' && <GuestForms />}
      {auth === 'signed_in' && (recovery ? <NewPassword /> : <SignedIn />)}
    </Page>
  );
}

function WhyAccount() {
  const { t } = useTranslation('cloud');
  return (
    <Card tone="sunken">
      <h2 className="mb-2 font-bold text-text">{t('account.why_title')}</h2>
      <ul className="flex flex-col gap-1.5 text-sm text-muted">
        {(['sync', 'ai', 'calendar', 'reminders'] as const).map((k) => (
          <li key={k} className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 shrink-0 text-primary" />
            <span className="min-w-0">{t(`account.why_${k}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">{t('account.guest_ok')}</p>
    </Card>
  );
}

function Unconfigured() {
  const { t } = useTranslation('cloud');
  return (
    <>
      <Card className="flex items-start gap-3" data-testid="account-unconfigured">
        <Icon name="home" className="mt-1 shrink-0 text-primary" size={24} />
        <div className="min-w-0">
          <h2 className="font-bold text-text">{t('account.unconfigured_title')}</h2>
          <p className="text-muted">{t('account.unconfigured_body')}</p>
        </div>
      </Card>
      <Section title={t('data.title')}>
        <Card>
          <ExportButton />
        </Card>
      </Section>
    </>
  );
}

function errorText(t: TFunction<'cloud'>, key: AuthErrorKey) {
  return t(`account.error_${key}`);
}

function GuestForms() {
  const { t } = useTranslation('cloud');
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null);

  const validate = () => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t('account.invalid_email');
    if (mode !== 'reset' && password.length < MIN_PASSWORD)
      next.password = t('account.short_password', { count: MIN_PASSWORD });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const address = email.trim();
    const result =
      mode === 'sign_in'
        ? await signIn(address, password)
        : mode === 'sign_up'
          ? await signUp(address, password)
          : await sendPasswordReset(address);
    setBusy(false);
    if (!result.ok) {
      setErrors({ form: errorText(t, result.error) });
      return;
    }
    if (mode === 'reset') setSent('reset');
    else if (mode === 'sign_up' && result.needsConfirmation) setSent('confirm');
  };

  if (sent) {
    return (
      <Card className="flex flex-col gap-3" role="status">
        <div className="flex items-start gap-3">
          <Icon name="sparkle" className="mt-1 shrink-0 text-primary" size={24} />
          <div className="min-w-0">
            <h2 className="font-bold text-text">{t('account.check_email_title')}</h2>
            <p className="text-muted">
              {t(sent === 'confirm' ? 'account.check_email_confirm' : 'account.check_email_reset', {
                email: email.trim(),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sent === 'confirm' && (
            <Button
              variant="secondary"
              onClick={() =>
                void resendConfirmation(email.trim()).then((r) =>
                  showToast({
                    tone: r.ok ? 'success' : 'warning',
                    title: r.ok ? t('account.resent') : errorText(t, r.ok ? 'unknown' : r.error),
                  }),
                )
              }
            >
              {t('account.resend')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => (setSent(null), setMode('sign_in'))}>
            {t('account.back_to_sign_in')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        {mode !== 'reset' && (
          <SegmentedControl
            label={t('account.mode_label')}
            value={mode}
            onChange={(m) => (setMode(m), setErrors({}))}
            options={[
              { value: 'sign_in', label: t('account.sign_in') },
              { value: 'sign_up', label: t('account.sign_up') },
            ]}
          />
        )}
        {mode === 'reset' && (
          <div>
            <h2 className="font-bold text-text">{t('account.reset_title')}</h2>
            <p className="text-sm text-muted">{t('account.reset_body')}</p>
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
          <Input
            label={t('account.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          {mode !== 'reset' && (
            <Input
              label={t('account.password')}
              type="password"
              autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint={
                mode === 'sign_up' ? t('account.password_hint', { count: MIN_PASSWORD }) : undefined
              }
            />
          )}
          {errors.form && (
            <p role="alert" className="flex items-start gap-2 text-sm font-bold text-danger">
              <Icon name="alert" className="mt-0.5 shrink-0" />
              <span className="min-w-0">{errors.form}</span>
            </p>
          )}
          <Button type="submit" loading={busy} fullWidth>
            {t(
              mode === 'sign_in'
                ? 'account.sign_in'
                : mode === 'sign_up'
                  ? 'account.create'
                  : 'account.send_reset',
            )}
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {mode === 'reset' ? (
            <Button variant="ghost" size="sm" onClick={() => setMode('sign_in')}>
              {t('account.back_to_sign_in')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => (setMode('reset'), setErrors({}))}>
              {t('account.forgot')}
            </Button>
          )}
        </div>
        {mode !== 'reset' && (
          <>
            <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              {t('account.or')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              variant="secondary"
              icon="globe"
              fullWidth
              onClick={() =>
                void signInWithGoogle().then(
                  (r) => !r.ok && setErrors({ form: errorText(t, r.error) }),
                )
              }
            >
              {t('account.google')}
            </Button>
          </>
        )}
      </Card>
      <WhyAccount />
    </>
  );
}

function NewPassword() {
  const { t } = useTranslation('cloud');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length < MIN_PASSWORD) {
            setError(t('account.short_password', { count: MIN_PASSWORD }));
            return;
          }
          setBusy(true);
          void updatePassword(password).then((r) => {
            setBusy(false);
            if (r.ok) showToast({ tone: 'success', title: t('account.password_changed') });
            else setError(errorText(t, r.error));
          });
        }}
      >
        <h2 className="font-bold text-text">{t('account.new_password_title')}</h2>
        <Input
          label={t('account.new_password')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <Button type="submit" loading={busy}>
          {t('account.save_password')}
        </Button>
      </form>
    </Card>
  );
}

export function SyncSummary() {
  const { t } = useTranslation('cloud');
  const { number, time, date } = useFormat();
  const state = useBadgeState();
  const sync = useCloud((s) => s.sync);
  const last = sync?.lastSyncedAt ? new Date(sync.lastSyncedAt) : null;
  return (
    <div className="flex flex-col gap-1" data-testid="sync-summary">
      <p className="font-bold text-text">{t(`sync.state_${state}`)}</p>
      {state !== 'guest' && (
        <p className="text-sm text-muted">
          {sync &&
            sync.pending > 0 &&
            t('sync.pending', { count: sync.pending, n: number(sync.pending) })}
          {sync && sync.pending > 0 && last && ' · '}
          {last && t('sync.last', { when: `${date(last, 'short')} ${time(last)}` })}
        </p>
      )}
      {state === 'error' && <p className="text-sm text-muted">{t('sync.error_hint')}</p>}
    </div>
  );
}

function SignedIn() {
  const { t } = useTranslation('cloud');
  const user = useCloud((s) => s.user);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  const doSignOut = async (force = false) => {
    setBusy(true);
    const r = await signOut({ force });
    setBusy(false);
    if (!r.done) setPending(r.pending);
    else {
      setPending(0);
      showToast({ tone: 'success', icon: 'cloud', title: t('account.signed_out') });
    }
  };

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Icon name="user" className="mt-1 shrink-0 text-primary" size={24} />
          <div className="min-w-0">
            <p className="text-sm text-muted">{t('account.signed_in_as')}</p>
            <p className="truncate font-bold text-text" data-testid="account-email">
              {user?.email}
            </p>
          </div>
        </div>
        <SyncSummary />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="refresh" onClick={() => void syncNow()}>
            {t('sync.sync_now')}
          </Button>
          <Button variant="ghost" loading={busy} onClick={() => void doSignOut()}>
            {t('account.sign_out')}
          </Button>
        </div>
        <p className="text-sm text-muted">{t('account.sign_out_note')}</p>
      </Card>

      <Section title={t('data.title')}>
        <Card className="flex flex-col gap-4">
          <ExportButton />
          <DangerZone />
        </Card>
      </Section>
      <p className="text-sm text-muted">
        <Link to={PATHS.settings} className="font-bold text-primary underline">
          {t('account.more_settings')}
        </Link>
      </p>

      <Dialog
        open={pending > 0}
        onClose={() => setPending(0)}
        variant="modal"
        title={t('account.unsynced_title')}
        description={t('account.unsynced_body', { count: pending })}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(0)}>
              {t('account.stay_signed_in')}
            </Button>
            <Button variant="danger" onClick={() => void doSignOut(true)}>
              {t('account.sign_out_anyway')}
            </Button>
          </div>
        }
      >
        <ExportButton />
      </Dialog>
    </>
  );
}
