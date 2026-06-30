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
 * a linha inteira; clicar no rótulo da hora liga/desliga a coluna inteira; clicar
 * no canto superior esquerdo marca/desmarca TUDO de uma vez. Implementação ÚNICA
 * da grade — reutilizada pelo cadastro do Local e pelo cadastro de Tela. Os
 * helpers de chave/rótulo vêm de `shared/screen-schedule.ts` (fonte única).
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

  const toggleHour = (hour: number) => {
    const hourKeys = OPERATING_DAYS.map((d) => operatingCellKey(d.key, hour));
    const allOn = hourKeys.every((k) => value.includes(k));
    onChange(
      allOn
        ? value.filter((k) => !hourKeys.includes(k))
        : Array.from(new Set([...value, ...hourKeys])),
    );
  };

  const allKeys = OPERATING_DAYS.flatMap((d) => OPERATING_HOURS.map((h) => operatingCellKey(d.key, h)));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => value.includes(k));

  const toggleAll = () => {
    onChange(allSelected ? [] : [...allKeys]);
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-9 align-bottom">
              <button
                type="button"
                onClick={toggleAll}
                aria-pressed={allSelected}
                data-testid={`${testIdPrefix}-all`}
                title={allSelected ? "Desmarcar tudo" : "Marcar tudo"}
                className="text-[9px] font-medium text-muted-foreground hover:text-foreground w-9 text-left leading-tight"
              >
                {allSelected ? "Limpar" : "Tudo"}
              </button>
            </th>
            {OPERATING_HOURS.map((h) => (
              <th key={h} className="align-bottom">
                <button
                  type="button"
                  onClick={() => toggleHour(h)}
                  title={`Marcar/desmarcar coluna ${operatingHourLabel(h)}`}
                  className="text-[8px] text-muted-foreground hover:text-foreground [writing-mode:vertical-rl] mx-auto whitespace-nowrap py-0.5"
                >
                  {operatingHourLabel(h)}
                </button>
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
