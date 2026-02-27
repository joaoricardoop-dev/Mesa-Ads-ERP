import type { LucideIcon } from "lucide-react";

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Section({ title, icon: Icon, description, children, className }: SectionProps) {
  return (
    <div className={`bg-card border border-border/30 rounded-xl ${className || ""}`}>
      <div className="px-4 lg:px-5 py-3 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-4 lg:p-5">{children}</div>
    </div>
  );
}
