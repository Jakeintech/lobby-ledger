import { Button, ButtonGroup } from '@databricks/appkit-ui/react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  /** Names the choice for assistive technology, for example `Congress`. */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A row of joined buttons where exactly one is pressed: the Congress
 * selector on the bills page and the filings or income toggle on the trend
 * charts. The foundation has no segmented control, so this one lives with
 * the pages that need it.
 */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <ButtonGroup role="group" aria-label={label} className={className}>
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={pressed ? 'default' : 'outline'}
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
