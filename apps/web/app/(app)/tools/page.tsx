'use client';

import { useState } from 'react';
import {
  calcPaint,
  steelBarWeightKg,
  steelWeightKg,
  steelWeightPerMeterKg,
  type PaintResult,
} from '@bayan/shared';
import { PageHeader, TextInput } from '@/components/ui';

function num(t: string): number {
  const v = Number(t.trim());
  return Number.isFinite(v) ? v : 0;
}

type Tab = 'paint' | 'steel';

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>('paint');

  return (
    <div>
      <PageHeader title="أدوات مساعدة" />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('paint')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'paint' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          حاسبة كميات الدهانات
        </button>
        <button
          type="button"
          onClick={() => setTab('steel')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'steel' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          حاسبة أوزان الحدايد والمعادن
        </button>
      </div>

      {tab === 'paint' ? <PaintCalculator /> : <SteelCalculator />}
    </div>
  );
}

function PaintCalculator() {
  const [area, setArea] = useState('100');
  const [coats, setCoats] = useState('2');
  const [coverage, setCoverage] = useState('10');
  const [pack, setPack] = useState('4');

  let result: PaintResult | null = null;
  let error: string | null = null;
  try {
    result = calcPaint({
      areaM2: num(area),
      coats: num(coats),
      coverageM2PerLiter: num(coverage),
      packSizeL: num(pack),
    });
  } catch {
    error = 'أدخل قيماً موجبة لكل الحقول.';
  }

  return (
    <div className="max-w-md rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3">
        <Field label="المساحة (م²)" value={area} onChange={setArea} />
        <Field label="عدد الوجوه" value={coats} onChange={setCoats} />
        <Field label="تغطية اللتر (م²/لتر)" value={coverage} onChange={setCoverage} />
        <Field label="حجم العبوة (لتر)" value={pack} onChange={setPack} />
      </div>
      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
        <Row label="اللترات المطلوبة" value={result ? `${result.liters.toFixed(3)} لتر` : null} />
        <Row label="عدد العبوات" value={result ? `${result.packs} عبوة` : null} emphasize />
        <Row label="إجمالي المشترى" value={result ? `${result.totalLiters.toFixed(3)} لتر` : null} />
      </div>
      {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}
    </div>
  );
}

function SteelCalculator() {
  const [diameter, setDiameter] = useState('12');
  const [length, setLength] = useState('12');
  const [count, setCount] = useState('1');

  const d = num(diameter);
  const l = num(length);
  const n = num(count);

  let perMeter: number | null = null;
  let perBar: number | null = null;
  let total: number | null = null;
  let error: string | null = null;
  try {
    if (d > 0 && l > 0) {
      perMeter = steelWeightPerMeterKg(d);
      perBar = steelBarWeightKg({ diameterMm: d, lengthM: l });
    }
    if (d > 0 && l > 0 && n > 0) {
      total = steelWeightKg({ diameterMm: d, lengthM: l, count: n });
    }
  } catch {
    error = 'أدخل قيماً موجبة لكل الحقول.';
  }

  return (
    <div className="max-w-md rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3">
        <Field label="القطر (مم)" value={diameter} onChange={setDiameter} />
        <Field label="الطول (م)" value={length} onChange={setLength} />
        <Field label="عدد الأسياخ" value={count} onChange={setCount} />
      </div>
      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
        <Row label="وزن المتر الطولي" value={perMeter === null ? null : `${perMeter.toFixed(3)} كجم/م`} />
        <Row label="وزن السيخ الواحد" value={perBar === null ? null : `${perBar.toFixed(3)} كجم`} />
        <Row label="الوزن الإجمالي" value={total === null ? null : `${total.toFixed(3)} كجم`} emphasize />
      </div>
      {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <TextInput
        type="number"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string | null;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={emphasize ? 'text-lg font-bold text-gray-900' : 'text-sm text-gray-900'}>
        {value ?? '—'}
      </span>
    </div>
  );
}
