import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageContainer from "@/components/PageContainer";
import glossaryMd from "../../../../docs/financeiro-glossario.md?raw";

export default function FinancialGlossary() {
  return (
    <PageContainer
      title="Glossário Financeiro"
      description="Terminologia canônica do módulo financeiro — fonte única da verdade."
    >
      <div className="rounded-2xl border border-border/20 bg-card p-8 overflow-x-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-0
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border/30 prose-h2:pb-2
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-sm prose-p:leading-relaxed
          prose-li:text-sm
          prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
          prose-table:text-xs
          prose-th:bg-muted prose-th:px-3 prose-th:py-2
          prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-border/30
          prose-strong:text-foreground
          prose-a:text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {glossaryMd}
          </ReactMarkdown>
        </div>
      </div>
    </PageContainer>
  );
}
