'use client';

type Item = { ageGroup: string; gender: string; viewerPercentage: number };
type Props = { title?: string; data: Item[]; emptyMessage?: string };

// Стандартные группы YT Analytics
const AGE_GROUPS = [
  'age13-17', 'age18-24', 'age25-34', 'age35-44', 'age45-54', 'age55-64', 'age65-',
];
const AGE_LABEL: Record<string, string> = {
  'age13-17': '13–17',
  'age18-24': '18–24',
  'age25-34': '25–34',
  'age35-44': '35–44',
  'age45-54': '45–54',
  'age55-64': '55–64',
  'age65-': '65+',
};

export function DemographicsPyramid({ title, data, emptyMessage }: Props) {
  const isEmpty = !data || data.length === 0 || data.every((d) => d.viewerPercentage === 0);

  // Группируем
  const byAge: Record<string, { female: number; male: number }> = {};
  for (const ag of AGE_GROUPS) byAge[ag] = { female: 0, male: 0 };
  for (const d of data ?? []) {
    if (!byAge[d.ageGroup]) byAge[d.ageGroup] = { female: 0, male: 0 };
    if (d.gender === 'female') byAge[d.ageGroup].female = d.viewerPercentage;
    else if (d.gender === 'male') byAge[d.ageGroup].male = d.viewerPercentage;
  }

  const maxVal = Math.max(
    ...Object.values(byAge).flatMap((v) => [v.female, v.male]),
    1,
  );

  return (
    <div className="border border-border rounded-xl bg-background p-5 h-full">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {isEmpty ? (
        <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
          {emptyMessage ?? 'Демография недоступна'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>♀ Женщины</span>
            <span>Возраст</span>
            <span>♂ Мужчины</span>
          </div>
          {AGE_GROUPS.map((ag) => {
            const v = byAge[ag];
            const fW = (v.female / maxVal) * 100;
            const mW = (v.male / maxVal) * 100;
            return (
              <div key={ag} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                <div className="flex justify-end items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">{v.female.toFixed(1)}%</span>
                  <div className="h-4 bg-pink-500/70 rounded-l-sm" style={{ width: `${fW}%` }} />
                </div>
                <div className="text-muted-foreground tabular-nums w-12 text-center">
                  {AGE_LABEL[ag] ?? ag}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-blue-500/70 rounded-r-sm" style={{ width: `${mW}%` }} />
                  <span className="text-muted-foreground tabular-nums">{v.male.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
