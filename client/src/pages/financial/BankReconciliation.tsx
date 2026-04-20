import { useMemo, useRef, useState } from "react";
import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { ArrowDownCircle, ArrowUpCircle, Plus, Upload, Undo2, Wand2, Link2 } from "lucide-react";
import { toast } from "sonner";

type Account = RouterOutputs["bank"]["listAccounts"][number];
type BankTxn = RouterOutputs["bank"]["listTransactions"][number];
type OpenItem = RouterOutputs["bank"]["listOpenItems"][number];
type Suggestion = RouterOutputs["bank"]["suggestMatches"][number];

const BANK_OPTIONS = [
  { value: "itau", label: "Itaú" },
  { value: "bradesco", label: "Bradesco" },
  { value: "inter", label: "Inter" },
  { value: "bb", label: "Banco do Brasil" },
  { value: "santander", label: "Santander" },
  { value: "outro", label: "Outro" },
];

export default function BankReconciliation() {
  const utils = trpc.useUtils();
  const { data: accounts = [] } = trpc.bank.listAccounts.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [side, setSide] = useState<"credit" | "debit">("credit");

  const accountId = selectedAccountId ?? accounts[0]?.id ?? null;

  const { data: transactions = [], isLoading: loadingTxns } = trpc.bank.listTransactions.useQuery(
    { bankAccountId: accountId ?? 0, reconciled: false, type: side },
    { enabled: !!accountId },
  );

  const { data: openItems = [], isLoading: loadingItems } = trpc.bank.listOpenItems.useQuery(
    { type: side },
    { enabled: !!accountId },
  );

  const { data: summary } = trpc.bank.summary.useQuery(
    { bankAccountId: accountId ?? 0 },
    { enabled: !!accountId },
  );

  const [selectedTxnId, setSelectedTxnId] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const selectedTxn: BankTxn | undefined = useMemo(
    () => transactions.find((t) => t.id === selectedTxnId),
    [transactions, selectedTxnId],
  );

  const selectedItems = useMemo(
    () => openItems.filter((i) => selectedItemIds.includes(i.id)),
    [openItems, selectedItemIds],
  );

  const sumSelected = selectedItems.reduce((acc, i) => acc + Number(i.amount), 0);
  const txAmount = selectedTxn ? Number(selectedTxn.amount) : 0;
  const matches = sumSelected.toFixed(2) === txAmount.toFixed(2);

  function toggleItem(id: number) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function resetSelection() {
    setSelectedTxnId(null);
    setSelectedItemIds([]);
  }

  const reconcileMutation = trpc.bank.reconcile.useMutation({
    onSuccess: () => {
      toast.success("Transação conciliada");
      resetSelection();
      utils.bank.listTransactions.invalidate();
      utils.bank.listOpenItems.invalidate();
      utils.bank.summary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const undoMutation = trpc.bank.undoReconcile.useMutation({
    onSuccess: () => {
      toast.success("Conciliação desfeita");
      utils.bank.listTransactions.invalidate();
      utils.bank.listOpenItems.invalidate();
      utils.bank.summary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleReconcile() {
    if (!selectedTxn || selectedItems.length === 0) return;
    reconcileMutation.mutate({
      transactionId: selectedTxn.id,
      matches: selectedItems.map((i) => ({
        kind: side === "credit" ? "invoice" : "accounts_payable",
        id: i.id,
      })),
    });
  }

  // Reconciled tab — listagem do que já foi conciliado, com botão de desfazer.
  const { data: reconciledTxns = [] } = trpc.bank.listTransactions.useQuery(
    { bankAccountId: accountId ?? 0, reconciled: true },
    { enabled: !!accountId },
  );

  return (
    <PageContainer
      title="Conciliação Bancária"
      description="Importe extratos OFX/CSV e concilie com faturas e contas a pagar em aberto."
    >
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1">
          <Label>Conta bancária</Label>
          <div className="flex gap-2 items-center">
            <Select
              value={accountId ? String(accountId) : ""}
              onValueChange={(v) => setSelectedAccountId(Number(v))}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name} — {a.bank}
                    {a.account ? ` (${a.account})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NewAccountDialog />
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <ImportDialog accountId={accountId} />
        </div>
      </div>

      {accountId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <SummaryCard
            label="Não conciliadas"
            value={summary?.unreconciledCount ?? 0}
          />
          <SummaryCard
            label="Créditos pendentes"
            value={formatCurrency(Number(summary?.unreconciledCredits ?? 0))}
            tone="green"
          />
          <SummaryCard
            label="Débitos pendentes"
            value={formatCurrency(Number(summary?.unreconciledDebits ?? 0))}
            tone="red"
          />
        </div>
      )}

      {!accountId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Cadastre uma conta bancária para começar.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={side} onValueChange={(v) => { setSide(v as "credit" | "debit"); resetSelection(); }} className="space-y-4">
          <TabsList>
            <TabsTrigger value="credit">
              <ArrowDownCircle className="w-4 h-4 mr-1" />
              Recebimentos × Faturas
            </TabsTrigger>
            <TabsTrigger value="debit">
              <ArrowUpCircle className="w-4 h-4 mr-1" />
              Pagamentos × Contas a pagar
            </TabsTrigger>
          </TabsList>

          {(["credit", "debit"] as const).map((tabSide) => (
            <TabsContent key={tabSide} value={tabSide} className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Coluna esquerda: transações bancárias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Transações bancárias ({transactions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {loadingTxns && <div className="text-sm text-muted-foreground">Carregando…</div>}
                    {!loadingTxns && transactions.length === 0 && (
                      <div className="text-sm text-muted-foreground">Nenhuma transação pendente.</div>
                    )}
                    {transactions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTxnId(t.id); setSelectedItemIds([]); }}
                        className={`w-full text-left p-3 rounded border transition ${
                          selectedTxnId === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{t.date}</span>
                          <span className={`font-mono font-semibold ${t.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "credit" ? "+" : "-"}
                            {formatCurrency(Number(t.amount))}
                          </span>
                        </div>
                        <div className="text-sm mt-1 line-clamp-2">{t.description}</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Coluna direita: itens em aberto */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {tabSide === "credit" ? "Faturas em aberto" : "Contas a pagar"} ({openItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {selectedTxn && (
                      <SuggestionsBar
                        transactionId={selectedTxn.id}
                        onPick={(id) => setSelectedItemIds([id])}
                      />
                    )}
                    {loadingItems && <div className="text-sm text-muted-foreground">Carregando…</div>}
                    {!loadingItems && openItems.length === 0 && (
                      <div className="text-sm text-muted-foreground">Nenhum item em aberto.</div>
                    )}
                    {openItems.map((it) => {
                      const checked = selectedItemIds.includes(it.id);
                      return (
                        <label
                          key={`${it.kind}-${it.id}`}
                          className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                            checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleItem(it.id)}
                            disabled={!selectedTxn}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {it.kind === "invoice"
                                  ? `Fatura ${it.invoiceNumber} — ${it.counterpartName ?? ""}`
                                  : `${("description" in it ? it.description : "") || "Conta"} — ${it.counterpartName ?? ""}`}
                              </span>
                              <span className="font-mono font-semibold">
                                {formatCurrency(Number(it.amount))}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Vence em {it.date ?? "—"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Footer de ação */}
              {selectedTxn && (
                <Card className="mt-4">
                  <CardContent className="py-4 flex flex-wrap items-center gap-4">
                    <div className="text-sm">
                      <div className="text-muted-foreground">Transação</div>
                      <div className="font-mono font-semibold">
                        {formatCurrency(txAmount)}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-muted-foreground">Selecionados ({selectedItems.length})</div>
                      <div className={`font-mono font-semibold ${matches ? "text-green-600" : "text-amber-600"}`}>
                        {formatCurrency(sumSelected)}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-muted-foreground">Diferença</div>
                      <div className="font-mono">
                        {formatCurrency(txAmount - sumSelected)}
                      </div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" onClick={resetSelection}>Cancelar</Button>
                      <Button
                        onClick={handleReconcile}
                        disabled={!matches || selectedItems.length === 0 || reconcileMutation.isPending}
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        Conciliar {selectedItems.length > 1 ? `(${selectedItems.length})` : ""}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}

          {/* Histórico de conciliações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conciliadas ({reconciledTxns.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {reconciledTxns.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma transação conciliada ainda.</div>
              )}
              {reconciledTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.date}</Badge>
                      <span className={`font-mono font-semibold ${t.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "credit" ? "+" : "-"}
                        {formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                    <div className="text-sm mt-1 truncate">{t.description}</div>
                    {t.matches && t.matches.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t.matches.length === 1
                          ? `${t.matches[0].entityType === "invoice" ? "Fatura" : "Conta a pagar"} #${t.matches[0].entityId}`
                          : `${t.matches.length} itens conciliados`}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undoMutation.mutate({ transactionId: t.id })}
                    disabled={undoMutation.isPending}
                  >
                    <Undo2 className="w-4 h-4 mr-1" /> Desfazer
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </Tabs>
      )}
    </PageContainer>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SuggestionsBar({ transactionId, onPick }: { transactionId: number; onPick: (id: number) => void }) {
  const { data: suggestions = [] } = trpc.bank.suggestMatches.useQuery({ transactionId });
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded border border-dashed border-primary/50 bg-primary/5 p-2 mb-2">
      <div className="text-xs flex items-center gap-1 text-primary mb-1">
        <Wand2 className="w-3 h-3" /> Sugestões automáticas
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, 5).map((s: Suggestion) => (
          <Button
            key={`${s.kind}-${s.id}`}
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onPick(s.id)}
          >
            {s.label} · {s.score}%
          </Button>
        ))}
      </div>
    </div>
  );
}

function NewAccountDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("itau");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const create = trpc.bank.createAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta criada");
      utils.bank.listAccounts.invalidate();
      setOpen(false);
      setName(""); setAgency(""); setAccount("");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Nova conta
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta bancária</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Apelido</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Conta Principal" />
          </div>
          <div>
            <Label>Banco</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Agência</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <div>
              <Label>Conta</Label>
              <Input value={account} onChange={(e) => setAccount(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => create.mutate({ name, bank, agency: agency || undefined, account: account || undefined })}
            disabled={!name || !bank || create.isPending}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ accountId }: { accountId: number | null }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [encoding, setEncoding] = useState<"utf8" | "base64">("utf8");
  const [kind, setKind] = useState<"ofx" | "csv">("ofx");
  const fileInput = useRef<HTMLInputElement>(null);

  const preview = trpc.bank.previewImport.useMutation();
  const confirm = trpc.bank.confirmImport.useMutation({
    onSuccess: (res) => {
      toast.success(`Importadas ${res.imported}, ignoradas ${res.skipped}`);
      utils.bank.listTransactions.invalidate();
      utils.bank.summary.invalidate();
      setOpen(false);
      preview.reset();
      setContent("");
      setFilename("");
    },
    onError: (e) => toast.error(e.message),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const lower = f.name.toLowerCase();
    setKind(lower.endsWith(".ofx") || lower.endsWith(".qfx") ? "ofx" : "csv");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setContent(result);
        setEncoding("utf8");
      } else if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        setContent(btoa(binary));
        setEncoding("base64");
      }
    };
    reader.readAsText(f);
  }

  function runPreview() {
    if (!accountId || !content) return;
    preview.mutate({ bankAccountId: accountId, filename, encoding, content, kind });
  }

  function runConfirm() {
    if (!accountId || !content) return;
    confirm.mutate({ bankAccountId: accountId, filename, encoding, content, kind });
  }

  const result = preview.data;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { preview.reset(); setContent(""); setFilename(""); } }}>
      <Button onClick={() => setOpen(true)} disabled={!accountId}>
        <Upload className="w-4 h-4 mr-1" /> Importar extrato
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
          <DialogDescription>
            Selecione um arquivo OFX ou CSV. Faremos um preview antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input ref={fileInput} type="file" accept=".ofx,.qfx,.csv,.txt" onChange={onFile} className="block text-sm" />
          {filename && (
            <div className="text-xs text-muted-foreground">
              Arquivo: {filename} · Formato: {kind.toUpperCase()}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={runPreview} disabled={!content || preview.isPending}>
              Pré-visualizar
            </Button>
            {result && (
              <Button onClick={runConfirm} disabled={confirm.isPending}>
                Confirmar import ({result.total - result.duplicates} novas)
              </Button>
            )}
          </div>

          {result && (
            <div className="border rounded p-3 max-h-80 overflow-y-auto">
              <div className="text-sm mb-2">
                Banco detectado: <strong>{result.bank}</strong> · Total: {result.total} ·
                Duplicadas: <strong>{result.duplicates}</strong>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Data</th>
                    <th className="text-left py-1">Descrição</th>
                    <th className="text-right py-1">Valor</th>
                    <th className="text-right py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.slice(0, 100).map((i) => (
                    <tr key={i.externalId} className="border-t">
                      <td className="py-1">{i.date}</td>
                      <td className="py-1 truncate max-w-[260px]">{i.description}</td>
                      <td className={`py-1 text-right font-mono ${i.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                        {i.type === "credit" ? "+" : "-"}{formatCurrency(Number(i.amount))}
                      </td>
                      <td className="py-1 text-right">
                        {i.duplicate ? <Badge variant="secondary">duplicada</Badge> : <Badge>nova</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
