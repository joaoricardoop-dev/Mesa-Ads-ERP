import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Download,
  Phone,
  Mail,
  Building2,
  Star,
  Users,
  UserPlus,
} from "lucide-react";

export default function Contacts() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = trpc.contact.listAll.useQuery();

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  function handleCsvExport() {
    const headers = ["Nome", "E-mail", "Telefone", "Cargo", "Cliente", "Principal", "Notas"];
    const rows = filtered.map((c: any) => [
      c.name,
      c.email || "",
      c.phone || "",
      c.role || "",
      c.clientName || "",
      c.isPrimary ? "Sim" : "Não",
      (c.notes || "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v: string) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer
      title="Contatos"
      description="Todos os contatos de anunciantes"
      actions={
        <Button variant="outline" className="gap-2" onClick={handleCsvExport} disabled={filtered.length === 0}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Contatos</p>
          <p className="text-2xl font-bold font-mono">{contacts.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Contatos Principais</p>
          <p className="text-2xl font-bold font-mono text-amber-500">{contacts.filter((c: any) => c.isPrimary).length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Clientes com Contato</p>
          <p className="text-2xl font-bold font-mono text-primary">{new Set(contacts.map((c: any) => c.clientId)).size}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/30"
        />
      </div>

      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium">CONTATO</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">CLIENTE</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">E-MAIL</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">TELEFONE</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">CARGO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id} className="border-border/20 hover:bg-card/80 cursor-pointer" onClick={() => navigate(`/clientes/${c.clientId}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {c.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            {c.isPrimary && <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground md:hidden truncate">{c.clientName || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{c.clientName || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.email ? (
                        <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.phone ? (
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {c.role || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageContainer>
  );
}
