import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, useInventory, useUserRewards, type UserReward } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Section,
  showToast,
  Textarea,
} from '@/ui';
import { fx } from '../effects/store';
import {
  buyUserReward,
  createUserReward,
  deleteUserReward,
  redeemUserReward,
  updateUserReward,
  validRewardPrice,
} from '../logic/shop';
import { scheduleRefresh } from '../setup';
import { useGameT } from '../ui/hooks';
import { BuyButton } from './common';

const ICONS = ['🎬', '🍫', '🎮', '☕', '📚', '🛁', '🎧', '🍦', '🌳', '🛍️', '🍕', '😴'];

function RewardIcon({ icon }: { icon: string }) {
  return (
    <span
      aria-hidden
      className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-2xl"
    >
      {icon || '🎁'}
    </span>
  );
}

function RewardForm({
  reward,
  open,
  onClose,
}: {
  reward: UserReward | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useGameT();
  const [title, setTitle] = useState(reward?.title ?? '');
  const [notes, setNotes] = useState(reward?.notes ?? '');
  const [price, setPrice] = useState(reward ? String(reward.price_gold) : '50');
  const [icon, setIcon] = useState(reward?.icon ?? ICONS[0]!);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priceNum = Number(price.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
  const titleError = tried && !title.trim() ? t('rewards.title_required') : undefined;
  const priceError = tried && !validRewardPrice(priceNum) ? t('rewards.price_invalid') : undefined;

  const save = async () => {
    setTried(true);
    if (!title.trim() || !validRewardPrice(priceNum)) return;
    const input = { title, notes, price_gold: priceNum, icon };
    if (reward) await updateUserReward(reward.id, input);
    else await createUserReward(input);
    showToast({ title: t('shop.saved'), tone: 'success', duration: 2000 });
    onClose();
  };

  return (
    <>
      <Dialog
        open={open && !confirmDelete}
        onClose={onClose}
        dismissOnBackdrop={false}
        title={reward ? t('rewards.edit_title') : t('rewards.create_title')}
        footer={
          <>
            {reward && (
              <Button variant="danger" className="me-auto" onClick={() => setConfirmDelete(true)}>
                {t('rewards.delete')}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t('rewards.cancel')}
            </Button>
            <Button onClick={() => void save()}>{t('rewards.save')}</Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            label={t('rewards.title_label')}
            placeholder={t('rewards.title_placeholder')}
            value={title}
            maxLength={80}
            error={titleError}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            label={t('rewards.price_label')}
            inputMode="numeric"
            value={price}
            error={priceError}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Textarea
            label={t('rewards.notes_label')}
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-bold">{t('rewards.icon_label')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {['', ...ICONS].map((e) => (
                <button
                  key={e || 'none'}
                  type="button"
                  aria-pressed={icon === e}
                  aria-label={e || t('rewards.no_icon')}
                  onClick={() => setIcon(e)}
                  className={
                    icon === e
                      ? 'grid size-11 place-items-center rounded-md border-2 border-primary bg-primary-soft text-xl'
                      : 'grid size-11 place-items-center rounded-md border border-border bg-surface text-xl'
                  }
                >
                  {e || '–'}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" hidden />
        </form>
      </Dialog>
      <Dialog
        variant="modal"
        size="sm"
        open={open && confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('rewards.delete_confirm_title')}
        description={t('rewards.delete_confirm_body')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('rewards.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void deleteUserReward(reward!.id).then(() => {
                  showToast({ title: t('rewards.deleted'), tone: 'neutral', duration: 2000 });
                  setConfirmDelete(false);
                  onClose();
                });
              }}
            >
              {t('rewards.delete')}
            </Button>
          </>
        }
      />
    </>
  );
}

/** My Rewards: the player's own real-life treats, bought with gold and enjoyed later. */
export function RewardsTab() {
  const { t } = useGameT();
  const { number, date } = useFormat();
  const rewards = useUserRewards();
  const inventory = useInventory();
  const [editing, setEditing] = useState<UserReward | 'new' | null>(null);
  const allRewards = useLiveQuery(() => db.user_rewards.toArray(), []);
  const titleOf = (id: string) => allRewards?.find((r) => r.id === id) ?? null;

  const bought = (inventory ?? []).filter((i) => i.kind === 'user_reward');
  const ready = bought
    .filter((i) => !i.used_at)
    .sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1));
  const history = bought
    .filter((i) => i.used_at)
    .sort((a, b) => (a.used_at! < b.used_at! ? 1 : -1))
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-muted">{t('rewards.intro')}</p>
        <Button icon="plus" onClick={() => setEditing('new')}>
          {t('rewards.new')}
        </Button>
      </div>

      <Section title={t('rewards.list_title')}>
        {rewards && rewards.length === 0 ? (
          <EmptyState icon="gift" title={t('rewards.empty_title')}>
            {t('rewards.empty_body')}
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(rewards ?? []).map((r) => (
              <Card
                as="li"
                key={r.id}
                padding="sm"
                className="flex flex-col gap-2"
                data-testid="user-reward"
              >
                <div className="flex items-center gap-3">
                  <RewardIcon icon={r.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold">{r.title}</p>
                    {r.notes && <p className="text-sm text-muted">{r.notes}</p>}
                    <Chip tone="gold" size="sm" icon="coin">
                      {t('shop.price', { price: number(r.price_gold) })}
                    </Chip>
                  </div>
                  <IconButton
                    icon="edit"
                    variant="ghost"
                    size="sm"
                    label={t('rewards.edit', { title: r.title })}
                    onClick={() => setEditing(r)}
                  />
                </div>
                <BuyButton
                  price={r.price_gold}
                  size="sm"
                  label={`${t('shop.buy')}: ${r.title}`}
                  onBuy={() => buyUserReward(r.id)}
                />
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('rewards.inventory_title')}>
        {ready.length === 0 ? (
          <p className="text-muted">{t('rewards.inventory_empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="reward-inventory">
            {ready.map((item) => {
              const r = titleOf(item.ref_id);
              const title = r?.title ?? t('rewards.removed_reward');
              return (
                <Card
                  as="li"
                  key={item.id}
                  padding="sm"
                  tone="highlight"
                  className="flex items-center gap-3"
                >
                  <RewardIcon icon={r?.icon ?? ''} />
                  <p className="min-w-0 flex-1 break-words font-bold">{title}</p>
                  <Button
                    size="sm"
                    icon="gift"
                    aria-label={t('rewards.redeem_label', { title })}
                    onClick={() =>
                      void redeemUserReward(item.id).then(() => {
                        fx.note({ kind: 'redeem', title });
                        scheduleRefresh();
                      })
                    }
                  >
                    {t('rewards.redeem')}
                  </Button>
                </Card>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('rewards.history_title')}>
        {history.length === 0 ? (
          <p className="text-muted">{t('rewards.history_empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="reward-history">
            {history.map((item) => {
              const r = titleOf(item.ref_id);
              return (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span aria-hidden>{r?.icon || '🎁'}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {r?.title ?? t('rewards.removed_reward')}
                  </span>
                  <span className="shrink-0 text-muted">
                    {t('rewards.enjoyed_on', { date: date(Date.parse(item.used_at!)) })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {editing && (
        <RewardForm
          key={editing === 'new' ? 'new' : editing.id}
          reward={editing === 'new' ? null : editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
