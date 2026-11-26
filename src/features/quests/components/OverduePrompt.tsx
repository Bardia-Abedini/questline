import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays } from '@/domain/dates';
import { shouldAskOverdue } from '@/domain/quests';
import { db, useNow, useToday } from '@/data';
import { Button, DateField, Modal, showToast } from '@/ui';
import { answerOverdue, dismissOverdue } from '../model/actions';

/**
 * "Can this still be done?" asked once per quest, ever (plan section 9). Yes keeps it
 * (optionally with a new date); No archives it. No red, no lost XP, no guilt.
 * Recurring occurrences are never asked: they quietly move on to their next day.
 */
export function OverduePrompt() {
  const { t } = useTranslation('quests');
  const now = useNow(60_000);
  const today = useToday();
  const [newDate, setNewDate] = useState('');
  const [pickDate, setPickDate] = useState(false);
  const quest = useLiveQuery(async () => {
    const rows = await db.quests.where('due_date').belowOrEqual(today).toArray();
    return (
      rows
        .filter(
          (q) => q.deleted_at === null && q.recurrence_rule_id === null && shouldAskOverdue(q, now),
        )
        .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0] ?? null
    );
  }, [now, today]);

  const reset = () => {
    setNewDate('');
    setPickDate(false);
  };

  if (!quest) return null;

  return (
    <Modal
      open
      size="sm"
      onClose={() => {
        void dismissOverdue(quest.id);
        reset();
      }}
      dismissOnBackdrop={false}
      title={t('overdue.title')}
      description={t('overdue.body', { title: quest.title })}
      footer={
        <>
          <Button
            variant="secondary"
            icon="archive"
            onClick={async () => {
              await answerOverdue(quest.id, 'archive');
              reset();
              showToast({ title: t('overdue.archived', { title: quest.title }), icon: 'archive' });
            }}
          >
            {t('overdue.no')}
          </Button>
          <Button
            icon="check"
            onClick={async () => {
              await answerOverdue(quest.id, 'keep', newDate || null);
              reset();
            }}
          >
            {t('overdue.yes')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('overdue.note')}</p>
        {pickDate ? (
          <DateField
            label={t('overdue.new_date')}
            min={today}
            value={newDate}
            onChange={setNewDate}
          />
        ) : (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPickDate(true);
                setNewDate(addDays(today, 1));
              }}
            >
              {t('overdue.pick_date')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
