import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountChoice } from '@/data/sync';
import { Button, Card, Dialog, Icon, showToast, type IconName } from '@/ui';
import { downloadExport } from '../exportData';
import { chooseAccountData, postponeAccountChoice } from '../session';
import { useCloud } from '../store';

const OPTIONS: { value: AccountChoice; icon: IconName }[] = [
  { value: 'merge', icon: 'sparkle' },
  { value: 'keep_account', icon: 'cloud' },
  { value: 'keep_device', icon: 'home' },
];

/**
 * Signing in on a device that has guest data, into an account that has data too: the player
 * decides. Nothing changes until they choose; "Not now" signs out and keeps this device as is.
 */
export function AccountChoiceDialog() {
  const { t } = useTranslation('cloud');
  const choice = useCloud((s) => s.choice);
  const [selected, setSelected] = useState<AccountChoice>('merge');
  const working = choice === 'working';

  const confirm = async () => {
    try {
      await chooseAccountData(selected);
      showToast({ tone: 'success', icon: 'cloud', title: t(`choice.done_${selected}`) });
    } catch {
      showToast({ tone: 'warning', icon: 'alert', title: t('choice.failed') });
    }
  };

  return (
    <Dialog
      open={choice !== 'none'}
      onClose={() => undefined}
      hideClose
      dismissOnBackdrop={false}
      variant="modal"
      title={t('choice.title')}
      description={t('choice.body')}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={working} onClick={() => void postponeAccountChoice()}>
            {t('choice.not_now')}
          </Button>
          <Button loading={working} onClick={() => void confirm()}>
            {t('choice.confirm')}
          </Button>
        </div>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="ql-visually-hidden">{t('choice.title')}</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="block cursor-pointer">
            <Card
              tone={selected === o.value ? 'highlight' : 'default'}
              padding="sm"
              className="flex items-start gap-3"
            >
              <input
                type="radio"
                name="account-choice"
                className="mt-1.5 size-4 shrink-0 accent-[var(--ql-primary)]"
                checked={selected === o.value}
                onChange={() => setSelected(o.value)}
                disabled={working}
              />
              <Icon name={o.icon} className="mt-1 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-bold text-text">{t(`choice.${o.value}`)}</span>
                <span className="block text-sm text-muted">{t(`choice.${o.value}_hint`)}</span>
              </span>
            </Card>
          </label>
        ))}
      </fieldset>
      {selected !== 'merge' && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <Icon name="info" className="mt-0.5 shrink-0" />
          <span>
            {t(selected === 'keep_account' ? 'choice.warn_device' : 'choice.warn_account')}{' '}
            <button
              type="button"
              className="font-bold text-primary underline"
              onClick={() => void downloadExport()}
            >
              {t('choice.export_first')}
            </button>
          </span>
        </p>
      )}
    </Dialog>
  );
}
