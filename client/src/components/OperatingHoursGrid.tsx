import { OPERATING_DAYS, OPERATING_HOURS, operatingCellKey, operatingHourLabel } from "@shared/screen-schedule";

interface OperatingHoursGridProps {
  /** Seleção atual: array de chaves canônicas "dia-hora" (fonte única). */
  value: string[];
  /** Recebe a nova seleção a cada toggle de célula/dia. */
  onChange: (next: string[]) => void;
  /** Prefixo dos data-testid das células (default: "op-cell"). */
  testIdPrefix?: string;
}

/**
 * Grade interativa de horário de funcionamento: 7 dias × 24 faixas de 1 hora.
 * Clicar numa célula liga/desliga a faixa; clicar no rótulo do dia liga/desliga
 * a linha inteira. Implementação ÚNICA da grade — reutilizada pelo cadastro do
 * Local e pelo cadastro de Tela. Os helpers de chave/rótulo vêm de
 * `shared/screen-schedule.ts` (fonte única).
 */
export function OperatingHoursGrid({ value, onChange, testIdPrefix = "op-cell" }: OperatingHoursGridProps) {
  const toggleCell = (day: number, hour: number) => {
    const key = operatingCellKey(day, hour);
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  const toggleDay = (day: number) => {
    const dayKeys = OPERATING_HOURS.map((h) => operatingCellKey(day, h));
    const allOn = dayKeys.every((k) => value.includes(k));
    onChange(
      allOn
        ? value.filter((k) => !dayKeys.includes(k))
        : Array.from(new Set([...value, ...dayKeys])),
    );
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-9" />
            {OPERATING_HOURS.map((h) => (
              <th key={h} className="align-bottom">
                <div className="text-[8px] text-muted-foreground [writing-mode:vertical-rl] mx-auto whitespace-nowrap py-0.5">{operatingHourLabel(h)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OPERATING_DAYS.map((day) => (
            <tr key={day.key}>
              <td>
                <button
                  type="button"
                  onClick={() => toggleDay(day.key)}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground w-9 text-left"
                >
                  {day.label}
                </button>
              </td>
              {OPERATING_HOURS.map((h) => {
                const on = value.includes(operatingCellKey(day.key, h));
                return (
                  <td key={h}>
                    <button
                      type="button"
                      onClick={() => toggleCell(day.key, h)}
                      aria-pressed={on}
                      aria-label={`${day.label} ${operatingHourLabel(h)}`}
                      data-testid={`${testIdPrefix}-${day.key}-${h}`}
                      className={`w-5 h-5 rounded-full border transition-colors ${on ? "bg-primary border-primary" : "bg-background border-border/40 hover:border-primary/50"}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
