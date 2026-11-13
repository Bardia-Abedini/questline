import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AvatarSvg } from '@/art/avatar/AvatarSvg';
import { RoomScene } from '@/art/cottage/RoomScene';
import type { DecorSlot } from '@/art/cottage/slots';
import { usePlayerStats } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, Chip, cx, Dialog, Icon, SegmentedControl, showToast, ToggleChip } from '@/ui';
import {
  AVATAR_SLOTS,
  COSMETICS,
  COTTAGE_SLOTS,
  cosmeticById,
  type CosmeticItem,
  type CosmeticSlot,
} from '../catalog/cosmetics';
import { equipCosmetic, isEquipped } from '../logic/looks';
import { buyCosmetic } from '../logic/shop';
import { scheduleRefresh } from '../setup';
import { ItemArt } from '../ui/ItemArt';
import { useGameT, useLooks, useOwnedCosmetics } from '../ui/hooks';
import { BuyButton } from './common';

const RARITY_TONE = { common: 'neutral', uncommon: 'info', rare: 'xp' } as const;

function Preview({ item }: { item: CosmeticItem }) {
  const { tx } = useGameT();
  const { look, room } = useLooks();
  if (item.area === 'avatar') {
    return (
      <div className="mx-auto w-fit rounded-xl bg-primary-soft p-2">
        <AvatarSvg
          look={{ ...look, [item.slot]: item.id }}
          size={180}
          title={tx('avatar.preview_label', { item: tx(item.nameKey) })}
        />
      </div>
    );
  }
  const preview =
    item.slot === 'pet'
      ? { ...room, pet: item.id }
      : item.slot === 'wallpaper'
        ? { ...room, wallpaper: item.id }
        : item.slot === 'floor'
          ? { ...room, floor: item.id }
          : { ...room, slots: { ...room.slots, [item.slot]: item.id } };
  const highlight =
    item.slot === 'wallpaper' || item.slot === 'floor' ? null : (item.slot as DecorSlot | 'pet');
  return (
    <RoomScene
      look={preview}
      highlight={highlight}
      title={tx(item.nameKey)}
      className="block w-full rounded-lg"
    />
  );
}

/** Cosmetics: browse by slot, preview on the avatar or in the cottage, buy and use. */
export function CosmeticsTab() {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const [params, setParams] = useSearchParams();
  const owned = useOwnedCosmetics() ?? new Set<string>();
  const { look, room } = useLooks();
  const level = usePlayerStats()?.level.level ?? 1;
  const previewId = params.get('item');
  const previewItem = cosmeticById(previewId);
  const [area, setArea] = useState<'avatar' | 'cottage'>(previewItem?.area ?? 'avatar');
  const [slot, setSlot] = useState<CosmeticSlot | 'all'>('all');

  const slots = (area === 'avatar' ? AVATAR_SLOTS : COTTAGE_SLOTS).filter((s) =>
    COSMETICS.some((c) => c.slot === s && !c.starter),
  );
  const items = COSMETICS.filter(
    (c) => c.area === area && !c.starter && (slot === 'all' || c.slot === slot),
  );

  const openPreview = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('item', id);
    else next.delete('item');
    setParams(next, { replace: true });
  };

  const equip = async (id: string) => {
    await equipCosmetic(id);
    scheduleRefresh();
    showToast({ title: t('shop.equipped'), tone: 'success', duration: 2000 });
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t('shop.area_label')}
        value={area}
        onChange={(v) => {
          setArea(v);
          setSlot('all');
        }}
        options={[
          { value: 'avatar', label: t('shop.area_avatar'), icon: 'user' },
          { value: 'cottage', label: t('shop.area_cottage'), icon: 'home' },
        ]}
      />
      <div role="group" aria-label={t('shop.slot_filter')} className="flex flex-wrap gap-1.5">
        <ToggleChip selected={slot === 'all'} onChange={() => setSlot('all')}>
          {t('shop.all_slots')}
        </ToggleChip>
        {slots.map((s) => (
          <ToggleChip key={s} selected={slot === s} onChange={() => setSlot(s)}>
            {tx(`slots.${s}`)}
          </ToggleChip>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const has = owned.has(item.id);
          const locked = !has && level < item.unlockLevel;
          const name = tx(item.nameKey);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openPreview(item.id)}
                className={cx(
                  'flex h-full w-full flex-col items-center gap-1.5 rounded-lg border p-3 text-center shadow-sm transition-colors',
                  locked
                    ? 'border-dashed border-border-strong bg-surface-2'
                    : 'border-border bg-surface hover:bg-surface-2',
                )}
                data-testid={`cosmetic-${item.id}`}
                aria-label={`${name}, ${
                  has
                    ? t('shop.owned')
                    : locked
                      ? t('shop.locked', { level: number(item.unlockLevel) })
                      : t('shop.price', { price: number(item.price) })
                }`}
              >
                <span className={locked ? 'opacity-50 grayscale' : undefined}>
                  <ItemArt itemId={item.id} size={72} wearer={look} />
                </span>
                <span className="line-clamp-2 font-bold leading-tight">{name}</span>
                {item.rarity !== 'common' && (
                  <Chip size="sm" tone={RARITY_TONE[item.rarity]}>
                    {tx(`rarity.${item.rarity}`)}
                  </Chip>
                )}
                <span
                  className={cx(
                    'inline-flex items-center gap-1 text-sm font-bold',
                    has ? 'text-success' : locked ? 'text-muted' : 'text-gold-text',
                  )}
                >
                  <Icon name={has ? 'check' : locked ? 'lock' : 'coin'} size={14} />
                  {has
                    ? isEquipped(item.id, look, room)
                      ? t('shop.equipped')
                      : t('shop.owned')
                    : locked
                      ? t('shop.locked_short', { level: number(item.unlockLevel) })
                      : number(item.price)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">{t('shop.rare_drop_hint')}</p>

      {previewItem && (
        <Dialog
          open
          onClose={() => openPreview(null)}
          title={t('shop.preview_title', { item: tx(previewItem.nameKey) })}
          description={tx(`slots.${previewItem.slot}`)}
          footer={
            owned.has(previewItem.id) ? (
              isEquipped(previewItem.id, look, room) ? (
                <Chip tone="success" icon="check">
                  {t('shop.equipped')}
                </Chip>
              ) : (
                <Button icon="check" onClick={() => void equip(previewItem.id)}>
                  {t('shop.equip')}
                </Button>
              )
            ) : level < previewItem.unlockLevel ? (
              <p className="font-bold text-muted" data-testid="locked-note">
                {t('shop.locked', { level: number(previewItem.unlockLevel) })}
              </p>
            ) : (
              <BuyButton price={previewItem.price} onBuy={() => buyCosmetic(previewItem.id)} />
            )
          }
        >
          <Preview item={previewItem} />
        </Dialog>
      )}
    </div>
  );
}
