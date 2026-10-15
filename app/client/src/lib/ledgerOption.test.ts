import { describe, expect, it, vi } from 'vitest';
import { buildLedgerOption, changeText } from './ledgerOption';
import type { LedgerOptionInput } from './ledgerOption';

/**
 * The AppKit React index pulls in echarts-for-react, which does not resolve
 * under node. The ledger option only takes the theme base from it, and every
 * field these tests assert is built here, so the base is a stub.
 */
vi.mock('@databricks/appkit-ui/react', () => ({
  buildCartesianOption: (ctx: { colors: string[] }) => ({ color: ctx.colors }),
}));

const ui: LedgerOptionInput['ui'] = {
  axisLabel: '#5b6472',
  axisTitle: '#14213d',
  grid: '#e6e8ec',
  tooltipBg: '#ffffff',
};

const format = (n: number) => `$${n.toLocaleString('en-US')}`;
const compact = (n: number) => `$${Math.round(n / 1000)}K`;

function build(variant: 'bar' | 'line', markers: LedgerOptionInput['markers'] = []): Record<string, unknown> {
  return buildLedgerOption({
    points: [
      { period_end_date: '2024-03-31', value: 350_000 },
      { period_end_date: '2024-06-30', value: 1_600_000 },
    ],
    labels: ['Q1 2024', 'Q2 2024'],
    markers,
    seriesName: 'Reported income',
    variant,
    interactive: false,
    ui,
    ledger: '#1f4fd8',
    event: '#c8841b',
    format,
    compact,
  });
}

type Formatter = (params: unknown) => string;

function formatterOf(option: Record<string, unknown>): Formatter {
  const tooltip = option.tooltip as { formatter: Formatter };
  return tooltip.formatter;
}

describe('buildLedgerOption tooltip', () => {
  it('finds the money series by name when it is drawn as a line', () => {
    const html = formatterOf(build('line'))([{ dataIndex: 1, seriesType: 'line', seriesName: 'Reported income' }]);
    expect(html).toContain('Q2 2024');
    expect(html).toContain('$1,600,000');
    expect(html).toContain('+$1250K (+357%) on the prior quarter');
  });

  it('skips marker series even though they are lines too', () => {
    const html = formatterOf(build('bar', [{ date: '2024-05-01', label: 'Passed House' }]))([
      { dataIndex: 0, seriesType: 'line', seriesName: 'Passed House' },
      { dataIndex: 1, seriesType: 'bar', seriesName: 'Reported income' },
    ]);
    expect(html).toContain('$1,600,000');
    expect(html).toContain('Passed House');
  });

  it('returns nothing when no money datum is under the pointer', () => {
    expect(formatterOf(build('line'))([{ dataIndex: 0, seriesName: 'Other' }])).toBe('');
  });

  it('gives every marker series its own id', () => {
    const option = build('bar', [
      { date: '2024-02-01', label: 'Introduced' },
      { date: '2024-05-01', label: 'Passed House' },
    ]);
    const ids = (option.series as Array<{ id?: string }>).map((s) => s.id);
    expect(ids).toEqual([undefined, 'marker-0', 'marker-1']);
  });
});

describe('changeText', () => {
  it('describes the change on the prior quarter', () => {
    expect(changeText(1_600_000, 350_000, compact)).toBe('+$1250K (+357%) on the prior quarter');
    expect(changeText(100, 100, compact)).toBe('No change on the prior quarter');
    expect(changeText(100, 0, compact)).toBe('+$0K on the prior quarter');
    expect(changeText(100, null, compact)).toBeNull();
  });
});
