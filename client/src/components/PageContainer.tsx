interface PageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function PageContainer({ title, description, actions, children, className, noPadding }: PageContainerProps) {
  return (
    <div className={`h-full flex flex-col min-h-0 ${className || ""}`}>
      <div className="flex-shrink-0 border-b border-border/30 bg-card/30 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto min-h-0 ${noPadding ? "" : "p-4 lg:p-6"}`}>
        <div className={noPadding ? "" : "space-y-6"}>{children}</div>
      </div>
    </div>
  );
}
