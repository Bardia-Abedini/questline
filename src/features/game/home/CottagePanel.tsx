import { useState } from 'react';
import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import { ExteriorScene, MAX_EXTERIOR_TIER } from '@/art/cottage/ExteriorScene';
import { RoomScene } from '@/art/cottage/RoomScene';
import { DECOR_SLOTS, type DecorSlot } from '@/art/cottage/slots';
import { usePlayerStats } from '@/data';
import { cottageTier, MILESTONE_EVERY } from '@/domain/levels';
import { useFormat } from '@/i18n/useFormat';
import { Button, Card, SegmentedControl, Sheet, showToast, ToggleChip } from '@/ui';
import { cosmeticsForSlot, type CottageSlot } from '../catalog/cosmetics';
import { placeCottageItem } from '../logic/looks';
import { scheduleRefresh } from '../setup';
import { ItemPicker } from '../ui/ItemPicker';
import { useGameT, useLooks, useOwnedCosmetics } from '../ui/hooks';

const PICK_SLOTS: CottageSlot[] = [...DECOR_SLOTS, 'pet', 'wallpaper', 'floor'];

/** The cottage room (or its outside view) and a simple, phone-friendly decorate sheet. */
export function CottagePanel() {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const { room } = useLooks();
  const owned = useOwnedCosmetics() ?? new Set<string>();
  const level = usePlayerStats()?.level.level ?? 1;
  const tier = cottageTier(level);
  const [view, setView] = useState<'inside' | 'outside'>('inside');
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<CottageSlot>('rug');

  const selected =
    slot === 'pet'
      ? room.pet
      : slot === 'wallpaper'
        ? room.wallpaper
        : slot === 'floor'
          ? room.floor
          : (room.slots[slot as DecorSlot] ?? null);

  const pick = async (id: string | null) => {
    try {
      await placeCottageItem(slot, id);
      scheduleRefresh();
    } catch {
      showToast({ title: t('shop.error_generic'), tone: 'warning' });
    }
  };

  const nextTierLevel = (tier + 1) * MILESTONE_EVERY;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={t('cottage.view_label')}
          value={view}
          onChange={setView}
          options={[
            { value: 'inside', label: t('cottage.view_inside'), icon: 'home' },
            { value: 'outside', label: t('cottage.view_outside'), icon: 'sun' },
          ]}
        />
        <Button icon="palette" onClick={() => setOpen(true)}>
          {t('cottage.decorate')}
        </Button>
      </div>
      <Card padding="none" className="overflow-hidden">
        {view === 'inside' ? (
          <RoomScene look={room} title={t('cottage.room_label')} className="block w-full" />
        ) : (
          <ExteriorScene tier={tier} title={t('cottage.exterior_label')} className="block w-full" />
        )}
      </Card>
      <p className="text-sm text-muted">
        {tier >= MAX_EXTERIOR_TIER
          ? t('cottage.max_upgrade')
          : `${t('cottage.tier_hint')} ${t('cottage.next_upgrade', { level: number(nextTierLevel) })}`}
      </p>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('cottage.decorate_title')}
        size="lg"
        footer={<Button onClick={() => setOpen(false)}>{t('cottage.done')}</Button>}
      >
        <div className="flex flex-col gap-3">
          <RoomScene
            look={room}
            highlight={slot === 'wallpaper' || slot === 'floor' ? null : slot}
            className="block w-full rounded-lg"
          />
          <div
            role="group"
            aria-label={t('cottage.slot_picker')}
            className="flex flex-wrap gap-1.5"
          >
            {PICK_SLOTS.map((s) => (
              <ToggleChip key={s} selected={slot === s} onChange={() => setSlot(s)}>
                {tx(`slots.${s}`)}
              </ToggleChip>
            ))}
          </div>
          <ItemPicker
            label={tx(`slots.${slot}`)}
            items={cosmeticsForSlot(slot)}
            owned={owned}
            selected={selected}
            level={level}
            noneLabel={
              slot === 'wallpaper' || slot === 'floor' ? undefined : t('cottage.empty_slot')
            }
            onPick={(id) => void pick(id)}
          />
          <Link
            to={`${PATHS.shop}?tab=cosmetics`}
            className="text-sm font-bold text-primary underline"
          >
            {t('cottage.more_in_shop')}
          </Link>
        </div>
      </Sheet>
    </div>
  );
}
