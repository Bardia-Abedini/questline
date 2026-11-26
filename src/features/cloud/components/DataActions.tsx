import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Toggle, showToast } from '@/ui';
import { downloadExport } from '../exportData';
import { deleteAccount, deviceBootstrap } from '../session';
import { useCloud } from '../store';
import { resetToGuest } from '@/data/sync';

export function ExportButton() {
  const { t } = useTranslation('cloud');
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button variant="secondary" icon="book" onClick={() => void downloadExport()}>
          {t('data.export')}
        </Button>
      </div>
      <p className="text-sm text-muted">{t('data.export_hint')}</p>
    </div>
  );
}

/** Delete the account (signed in) or erase this device's data (guest), after confirmation. */
export function DangerZone() {
  const { t } = useTranslation('cloud');
  const signedIn = useCloud((s) => s.auth === 'signed_in');
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefix = signedIn ? 'data.delete_account' : 'data.erase_device';

  const confirm = async () => {
    setBusy(true);
    if (signedIn) {
      const r = await deleteAccount();
      setBusy(false);
      if (!r.ok) {
        showToast({ tone: 'warning', icon: 'alert', title: t('data.delete_failed') });
        return;
      }
    } else {
      await resetToGuest(deviceBootstrap());
      setBusy(false);
    }
    setOpen(false);
    setUnderstood(false);
    showToast({ tone: 'success', title: t(`${prefix}_done`) });
  };

  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
          {t(prefix)}
        </Button>
      </div>
      <p className="text-sm text-muted">{t(`${prefix}_hint`)}</p>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        variant="modal"
        title={t(`${prefix}_title`)}
        description={t(`${prefix}_body`)}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('data.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!understood}
              loading={busy}
              onClick={() => void confirm()}
            >
              {t(`${prefix}_confirm`)}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <ExportButton />
          <Toggle label={t('data.understand')} checked={understood} onChange={setUnderstood} />
        </div>
      </Dialog>
    </div>
  );
}
