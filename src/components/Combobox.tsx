import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';

/**
 * 絞り込みつきの択一。shadcn/ui の Combobox と同じ組み合わせ (Radix Popover + cmdk) だが、
 * 見た目は Tailwind ではなく styles.css のトークンに合わせてある。
 * 曲が増えても、打ち込んで絞り込める。
 */
export type ComboItem = { value: string; label: string; hint?: string };

type Props = {
  items: ComboItem[];
  value: string;
  onChange: (value: string) => void;
  /** 未選択のときにボタンへ出す文言 */
  placeholder?: string;
  searchPlaceholder?: string;
  empty?: string;
  disabled?: boolean;
  label: string;
};

export function Combobox({
  items,
  value,
  onChange,
  placeholder = '選ぶ',
  searchPlaceholder = '絞り込む',
  empty = '見つかりません',
  disabled,
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="combo-trigger"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
        >
          <span className={current ? 'v' : 'v ph'}>{current?.label ?? placeholder}</span>
          <span className="caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="combo-pop" align="start" sideOffset={6}>
          <Command
            // 絞り込みは曲名と説明の両方に当てる
            filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <Command.Input className="combo-input" placeholder={searchPlaceholder} />
            <Command.List className="combo-list">
              <Command.Empty className="combo-empty">{empty}</Command.Empty>
              {items.map((i) => (
                <Command.Item
                  key={i.value}
                  value={`${i.label} ${i.hint ?? ''}`}
                  className="combo-item"
                  onSelect={() => {
                    onChange(i.value);
                    setOpen(false);
                  }}
                >
                  <span className="t">
                    {i.label}
                    {i.value === value && <b aria-hidden="true"> ✓</b>}
                  </span>
                  {i.hint && <span className="m">{i.hint}</span>}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
