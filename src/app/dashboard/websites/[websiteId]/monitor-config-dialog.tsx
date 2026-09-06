'use client';

import {
  CHANGE_SENSITIVITIES,
  CHANGE_SENSITIVITY_LABELS,
  MONITOR_INTERVAL_LABELS,
  MONITOR_TYPE_LABELS,
  type ChangeSensitivity,
  type MonitorConfig,
  type MonitorDto,
  type UpdateMonitorInput,
} from '@/contracts';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Editing one monitor's schedule and settings.
 *
 * The form is built from the monitor's own configuration union, so each type
 * shows only the fields that apply to it. The alternative — one form with every
 * field, most of them irrelevant — is how a settings screen becomes something
 * nobody reads.
 *
 * Nothing here enforces a plan limit. The server clamps a crawl to the plan's
 * page cap and refuses an interval below its floor; duplicating those numbers
 * in the browser would be two places to keep in step, and the second one would
 * be wrong.
 */

export interface MonitorConfigDialogProps {
  readonly monitor: MonitorDto;
  readonly saving: boolean;
  readonly intervals: readonly number[];
  readonly onCancel: () => void;
  readonly onSave: (input: UpdateMonitorInput) => void;
}

export function MonitorConfigDialog({
  monitor,
  saving,
  intervals,
  onCancel,
  onSave,
}: MonitorConfigDialogProps): React.ReactElement {
  const [intervalSeconds, setIntervalSeconds] = useState(monitor.intervalSeconds);
  const [config, setConfig] = useState<MonitorConfig>(monitor.config);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ intervalSeconds, config });
          }}
        >
          <DialogHeader>
            <DialogTitle>{MONITOR_TYPE_LABELS[monitor.type]}</DialogTitle>
            <DialogDescription>
              How often this check runs, and what it treats as a problem.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="monitor-interval">How often</Label>
              <select
                id="monitor-interval"
                value={intervalSeconds}
                onChange={(event) => {
                  setIntervalSeconds(Number(event.target.value));
                }}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {intervals.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {MONITOR_INTERVAL_LABELS[seconds] ??
                      `Every ${String(Math.round(seconds / 3600))} hours`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Your plan sets the fastest interval available. A slower one is always allowed.
              </p>
            </div>

            <ConfigFields config={config} onChange={setConfig} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ConfigFieldsProps {
  readonly config: MonitorConfig;
  readonly onChange: (config: MonitorConfig) => void;
}

/**
 * The fields for one monitor type.
 *
 * A switch on the discriminator rather than a lookup table, so TypeScript
 * proves every type is handled — adding a monitor without a form for it is a
 * compile error rather than a blank dialog.
 */
function ConfigFields({ config, onChange }: ConfigFieldsProps): React.ReactElement {
  switch (config.type) {
    case 'ssl':
    case 'domain':
      return (
        <>
          <NumberField
            id="warning-days"
            label="Warn this many days before expiry"
            value={config.warningDays}
            min={1}
            max={365}
            onChange={(warningDays) => {
              onChange({ ...config, warningDays });
            }}
          />
          <NumberField
            id="critical-days"
            label="Treat as urgent this many days before expiry"
            hint="Must be the same as or tighter than the warning threshold."
            value={config.criticalDays}
            min={1}
            max={365}
            onChange={(criticalDays) => {
              onChange({ ...config, criticalDays });
            }}
          />
        </>
      );

    case 'performance':
      return (
        <>
          <NumberField
            id="min-score"
            label="Warn below this performance score"
            value={config.minPerformanceScore}
            min={0}
            max={100}
            onChange={(minPerformanceScore) => {
              onChange({ ...config, minPerformanceScore });
            }}
          />
          <NumberField
            id="max-lcp"
            label="Warn above this Largest Contentful Paint (ms)"
            value={config.maxLargestContentfulPaintMs}
            min={500}
            max={60_000}
            step={100}
            onChange={(maxLargestContentfulPaintMs) => {
              onChange({ ...config, maxLargestContentfulPaintMs });
            }}
          />
          <SelectField
            id="strategy"
            label="Measure as"
            value={config.strategy}
            options={[
              { value: 'mobile', label: 'Mobile' },
              { value: 'desktop', label: 'Desktop' },
            ]}
            onChange={(strategy) => {
              onChange({ ...config, strategy: strategy === 'desktop' ? 'desktop' : 'mobile' });
            }}
          />
        </>
      );

    case 'content':
      return (
        <>
          <SelectField
            id="sensitivity"
            label="Report a change when"
            value={config.sensitivity}
            options={CHANGE_SENSITIVITIES.map((value) => ({
              value,
              label: CHANGE_SENSITIVITY_LABELS[value],
            }))}
            onChange={(value) => {
              onChange({ ...config, sensitivity: value as ChangeSensitivity });
            }}
          />
          <TextField
            id="watch-selector"
            label="Watch only this part of the page"
            hint="A tag, .class or #id. Leave blank to watch the whole page."
            value={config.watchSelector ?? ''}
            onChange={(value) => {
              onChange({ ...config, watchSelector: value.trim() === '' ? null : value });
            }}
          />
          <TextField
            id="ignore-selectors"
            label="Ignore these parts"
            hint="Comma-separated. Useful for adverts, timestamps and rotating banners."
            value={config.ignoreSelectors.join(', ')}
            onChange={(value) => {
              onChange({
                ...config,
                ignoreSelectors: value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0),
              });
            }}
          />
        </>
      );

    case 'seo':
      return (
        <NumberField
          id="min-seo-score"
          label="Warn below this SEO score"
          value={config.minScore}
          min={0}
          max={100}
          onChange={(minScore) => {
            onChange({ ...config, minScore });
          }}
        />
      );

    case 'links':
      return (
        <>
          <NumberField
            id="max-pages"
            label="Pages to crawl"
            hint="Capped by your plan. Asking for more simply crawls the maximum you have."
            value={config.maxPages}
            min={1}
            max={500}
            onChange={(maxPages) => {
              onChange({ ...config, maxPages });
            }}
          />
          <NumberField
            id="max-depth"
            label="How deep to follow links"
            value={config.maxDepth}
            min={1}
            max={5}
            onChange={(maxDepth) => {
              onChange({ ...config, maxDepth });
            }}
          />
          <CheckboxField
            id="check-external"
            label="Also check links to other sites"
            checked={config.checkExternal}
            onChange={(checkExternal) => {
              onChange({ ...config, checkExternal });
            }}
          />
          <CheckboxField
            id="respect-robots"
            label="Respect robots.txt"
            hint="Turning this off crawls pages the site asks robots to skip. Only do that for sites you own."
            checked={config.respectRobotsTxt}
            onChange={(respectRobotsTxt) => {
              onChange({ ...config, respectRobotsTxt });
            }}
          />
        </>
      );
  }
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: FieldProps & {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          // An empty input parses to NaN; keeping the previous value avoids
          // sending one and having the server reject the whole form.
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
}: FieldProps & {
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: FieldProps & {
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CheckboxField({
  id,
  label,
  hint,
  checked,
  onChange,
}: FieldProps & {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
        />
        <Label htmlFor={id} className="cursor-pointer font-normal">
          {label}
        </Label>
      </div>
      {hint ? <p className="ml-6.5 text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
