import PageContainer from "@/components/PageContainer";
import glossaryMd from "../../../../docs/financeiro-glossario.md?raw";

export default function FinancialGlossary() {
  return (
    <PageContainer
      title="Glossário Financeiro"
      description="Terminologia canônica do módulo financeiro — fonte única da verdade."
    >
      <div className="rounded-2xl border border-border/20 bg-card p-6 overflow-x-auto">
        <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono text-foreground/90">
          {glossaryMd}
        </pre>
      </div>
    </PageContainer>
  );
}
