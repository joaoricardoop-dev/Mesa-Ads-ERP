import PageContainer from "@/components/PageContainer";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PageContainer title={title} description={description}>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Construction className="w-7 h-7 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-1">Em desenvolvimento</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Este módulo está sendo construído e estará disponível em breve.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
