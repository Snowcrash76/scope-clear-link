import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useJobCosts,
  COST_CATEGORIES,
  calculateGst,
  completeMissingCostSubtotal,
  jobCostInputSchema,
  aud,
  uploadCostReceipt,
  getCostReceiptUrl,
  prepareReceiptForScan,
  extractCostReceipt,
  findCostDuplicates,
  receiptWarnings,
  validateReceiptFile,
} from "@/hooks/useJobCosts";
import type {
  JobCost,
  JobCostInput,
  ReceiptDuplicate,
  ReceiptExtraction,
  ReceiptLineItem,
} from "@/hooks/useJobCosts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  JobCostSetupHelp,
  isJobCostSetupError,
} from "@/components/job-costing/JobCostSetupHelp";
import { ReceiptScanControls } from "@/components/job-costing/ReceiptScanControls";
import { ReceiptLineItemsEditor } from "@/components/job-costing/ReceiptLineItemsEditor";
import { ReceiptItemsSummary } from "@/components/job-costing/ReceiptItemsSummary";
import { JobCostView } from "@/components/job-costing/JobCostView";
import { ReceiptReviewFields } from "@/components/job-costing/ReceiptReviewFields";
import { receiptCurrencyForReview } from "../../../shared/receiptScanning";

type FormState = {
  supplier: string;
  description: string;
  cost_date: string;
  category: (typeof COST_CATEGORIES)[number];
  amount_ex_gst: string;
  amount_inc_gst: string;
  gst_applies: boolean;
  reference_number: string;
  notes: string;
  status: "draft" | "confirmed";
  quote_line_item_id: string;
  scope_item_id: string;
  receipt_image_url: string | null;
};

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const freshForm = (): FormState => ({
  supplier: "",
  description: "",
  cost_date: localDate(),
  category: "Materials",
  amount_ex_gst: "",
  amount_inc_gst: "",
  gst_applies: true,
  reference_number: "",
  notes: "",
  status: "draft",
  quote_line_item_id: "",
  scope_item_id: "",
  receipt_image_url: null,
});
const errText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
const numberOrNull = (value: string): number | null =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const amountLooksValid = (value: number | null) => value !== null && value >= 0;
const hasStoredScanData = (cost: JobCost) =>
  !!cost.receipt_confidence ||
  cost.receipt_abn != null ||
  cost.receipt_currency != null ||
  (Array.isArray(cost.receipt_line_items) &&
    cost.receipt_line_items.length > 0);
const descriptionFromReceipt = (extraction: ReceiptExtraction) =>
  (extraction.line_items ?? [])
    .map((item) =>
      !item.description
        ? ""
        : `${item.quantity === null ? "" : `${item.quantity} × `}${item.description}`,
    )
    .filter(Boolean)
    .join("; ")
    .slice(0, 5000);

export function JobCostsTab({ jobId }: { jobId: string }) {
  const {
    costs,
    quoteLineItems,
    scopeLinkSetupRequired,
    loading,
    error,
    refetch,
    saveCost,
    deleteCost,
    saving,
    deleting,
  } = useJobCosts(jobId);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<JobCost | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(freshForm);
  const [amountBasis, setAmountBasis] = useState<"ex" | "inc">("ex");
  const [gstAmount, setGstAmount] = useState("0.00");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadedReceiptFile, setUploadedReceiptFile] = useState<File | null>(
    null,
  );
  const [uploadedReceiptPath, setUploadedReceiptPath] = useState<string | null>(
    null,
  );
  const [scanBusy, setScanBusy] = useState(false);
  const [scanUsed, setScanUsed] = useState(false);
  const [scanConfidence, setScanConfidence] = useState<
    ReceiptExtraction["confidence"] | null
  >(null);
  const [scanReviewed, setScanReviewed] = useState(false);
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);
  const [receiptAbn, setReceiptAbn] = useState("");
  const receiptCurrency = receiptCurrencyForReview();
  const [clearStoredScanData, setClearStoredScanData] = useState(false);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<JobCost | null>(null);
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptLink, setReceiptLink] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [lineItemsTarget, setLineItemsTarget] = useState<JobCost | null>(null);
  const [duplicates, setDuplicates] = useState<ReceiptDuplicate[]>([]);
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [acknowledgedDuplicateKey, setAcknowledgedDuplicateKey] = useState("");
  const [duplicateRetry, setDuplicateRetry] = useState(0);

  const filtered = useMemo(
    () =>
      costs.filter(
        (cost) =>
          (categoryFilter === "all" || cost.category === categoryFilter) &&
          (statusFilter === "all" || cost.status === statusFilter),
      ),
    [costs, categoryFilter, statusFilter],
  );
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, cost) => ({
          ex: acc.ex + cost.amount_ex_gst,
          gst: acc.gst + cost.gst_amount,
          inc: acc.inc + cost.amount_inc_gst,
        }),
        { ex: 0, gst: 0, inc: 0 },
      ),
    [filtered],
  );

  const completedAmounts = completeMissingCostSubtotal(
    form.amount_ex_gst,
    form.amount_inc_gst,
    gstAmount,
    form.gst_applies,
  );
  const exGstAmount = completedAmounts.amount_ex_gst;
  const effectiveGstAmount = completedAmounts.gst_amount;
  const currentEx = numberOrNull(exGstAmount);
  const currentGst = numberOrNull(effectiveGstAmount);
  const currentInc = numberOrNull(form.amount_inc_gst);
  const currentExtraction: ReceiptExtraction = {
    supplier: form.supplier.trim() || null,
    abn: receiptAbn.trim() || null,
    date: form.cost_date || null,
    reference_number: form.reference_number.trim() || null,
    currency: receiptCurrency.trim() || null,
    line_items: lineItems.length ? lineItems : null,
    subtotal_ex_gst: currentEx,
    gst: currentGst,
    total_inc_gst: currentInc,
    suggested_category: form.category || null,
    confidence: scanConfidence ?? "high",
  };
  const liveScanWarnings = scanUsed ? receiptWarnings(currentExtraction) : [];

  const setAmount = (
    basis: "ex" | "inc",
    value: string,
    applies = form.gst_applies,
  ) => {
    if (scanUsed) {
      // Keep displayed calculated GST when the reviewer starts editing the subtotal.
      if (basis === "ex" && !gstAmount.trim() && effectiveGstAmount.trim()) {
        setGstAmount(effectiveGstAmount);
      }
      const field = basis === "ex" ? "amount_ex_gst" : "amount_inc_gst";
      setForm((current) => ({ ...current, [field]: value }));
      setAmountBasis(basis);
      return;
    }
    const number = Number(value);
    const calc = calculateGst(
      Number.isFinite(number) ? number : 0,
      basis,
      applies,
    );
    setAmountBasis(basis);
    setForm((current) => ({
      ...current,
      amount_ex_gst: basis === "ex" ? value : calc.amount_ex_gst.toFixed(2),
      amount_inc_gst: basis === "inc" ? value : calc.amount_inc_gst.toFixed(2),
    }));
    setGstAmount(calc.gst_amount.toFixed(2));
  };

  const onSelectFile = (file: File | null) => {
    if (file) {
      try {
        validateReceiptFile(file);
      } catch (cause) {
        setFormError(errText(cause));
        return;
      }
      // Selecting a file is not approval to overwrite the form. Keep all entered values;
      // hide old scan metadata until the selected receipt is actually scanned/replaced.
      if (scanUsed || (editing && hasStoredScanData(editing))) {
        setScanUsed(false);
        setScanConfidence(null);
        setScanReviewed(false);
        setLineItems([]);
        setReceiptAbn("");
      }
      setFormError("");
      setFieldErrors({});
      setUploadedReceiptFile(null);
      setUploadedReceiptPath(null);
      setRemoveReceipt(false);
      setPreviewFile(file);
      setSelectedFile(file);
      return;
    }
    setSelectedFile(null);
    setPreviewFile(null);
    if (!uploadedReceiptPath && editing && hasStoredScanData(editing)) {
      setScanUsed(true);
      setScanConfidence(editing.receipt_confidence ?? null);
      setLineItems(
        (editing.receipt_line_items ?? []).map((item) => ({ ...item })),
      );
      setReceiptAbn(editing.receipt_abn ?? "");
      setScanReviewed(true);
      setClearStoredScanData(false);
    }
  };
  const resetReceiptFiles = () => {
    setSelectedFile(null);
    setPreviewFile(null);
    setUploadedReceiptFile(null);
    setUploadedReceiptPath(null);
    setScanBusy(false);
  };
  const closeForm = () => {
    setOpen(false);
    resetReceiptFiles();
  };
  const startNew = () => {
    void refetch();
    setEditing(null);
    setForm(freshForm());
    setGstAmount("0.00");
    setAmountBasis("ex");
    resetReceiptFiles();
    setScanUsed(false);
    setScanConfidence(null);
    setScanReviewed(false);
    setLineItems([]);
    setReceiptAbn("");
    setClearStoredScanData(false);
    setRemoveReceipt(false);
    setFormError("");
    setFieldErrors({});
    setDuplicates([]);
    setDuplicateError("");
    setAcknowledgedDuplicateKey("");
    setOpen(true);
  };
  const startEdit = (cost: JobCost) => {
    void refetch();
    const storedLines = cost.receipt_line_items;
    const hasScanData = hasStoredScanData(cost);
    setEditing(cost);
    setForm({
      supplier: cost.supplier,
      description: cost.description,
      cost_date: cost.cost_date,
      category: cost.category,
      amount_ex_gst: cost.amount_ex_gst.toFixed(2),
      amount_inc_gst: cost.amount_inc_gst.toFixed(2),
      gst_applies: cost.gst_applies,
      reference_number: cost.reference_number,
      notes: cost.notes,
      status: cost.status,
      quote_line_item_id: cost.quote_line_item_id ?? "",
      scope_item_id: cost.scope_item_id ?? "",
      receipt_image_url: cost.receipt_image_url,
    });
    setGstAmount(cost.gst_amount.toFixed(2));
    setAmountBasis("ex");
    resetReceiptFiles();
    setScanUsed(hasScanData);
    setScanConfidence(cost.receipt_confidence ?? null);
    setScanReviewed(true);
    setLineItems(
      hasScanData ? (storedLines ?? []).map((item) => ({ ...item })) : [],
    );
    setReceiptAbn(cost.receipt_abn ?? "");
    setClearStoredScanData(false);
    setRemoveReceipt(false);
    setFormError("");
    setFieldErrors({});
    setDuplicates([]);
    setDuplicateError("");
    setAcknowledgedDuplicateKey("");
    setOpen(true);
  };
  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const scanReceipt = async () => {
    const fileToScan =
      selectedFile ??
      (previewFile && uploadedReceiptFile === previewFile ? previewFile : null);
    if (!fileToScan || scanBusy) return;
    setFormError("");
    setFieldErrors({});
    setScanBusy(true);
    let receiptPath =
      uploadedReceiptFile === fileToScan ? uploadedReceiptPath : null;
    try {
      if (!receiptPath) {
        receiptPath = await uploadCostReceipt(jobId, fileToScan);
        setUploadedReceiptFile(fileToScan);
        setUploadedReceiptPath(receiptPath);
        setSelectedFile(null);
        setClearStoredScanData(!!editing && hasStoredScanData(editing));
        updateForm("receipt_image_url", receiptPath);
        setRemoveReceipt(false);
      }
      const prepared = await prepareReceiptForScan(fileToScan);
      const result = await extractCostReceipt(jobId, receiptPath, prepared);
      const extraction = result.extraction;
      setForm((current) => ({
        ...current,
        supplier: extraction.supplier ?? "",
        // A null category is not a suggestion; keep the user's current selection.
        category: extraction.suggested_category ?? current.category,
        cost_date: extraction.date ?? "",
        reference_number: extraction.reference_number ?? "",
        description: descriptionFromReceipt(extraction),
        amount_ex_gst:
          extraction.subtotal_ex_gst === null
            ? ""
            : extraction.subtotal_ex_gst.toFixed(2),
        amount_inc_gst:
          extraction.total_inc_gst === null
            ? ""
            : extraction.total_inc_gst.toFixed(2),
        gst_applies:
          extraction.gst === null ? current.gst_applies : extraction.gst !== 0,
        status: "draft",
      }));
      setReceiptAbn(extraction.abn ?? "");
      setGstAmount(extraction.gst === null ? "" : extraction.gst.toFixed(2));
      setAmountBasis("ex");
      setLineItems((extraction.line_items ?? []).map((item) => ({ ...item })));
      setScanConfidence(extraction.confidence);
      setScanUsed(true);
      setScanReviewed(false);
      setClearStoredScanData(false);
      setFormError("");
    } catch (cause) {
      setFormError(
        receiptPath
          ? `${errText(cause)} The original receipt is attached; you can continue with manual entry.`
          : `Receipt upload failed: ${errText(cause)} The file was not attached; you can continue with manual entry.`,
      );
    } finally {
      setScanBusy(false);
    }
  };

  const supplierForDuplicate = form.supplier.trim();
  const duplicateAmount = numberOrNull(form.amount_inc_gst);
  const duplicateInputReady =
    supplierForDuplicate.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.cost_date) &&
    amountLooksValid(duplicateAmount);
  const duplicateQueryKey = duplicateInputReady
    ? `${supplierForDuplicate.toLocaleLowerCase("en-AU")}|${form.cost_date}|${duplicateAmount}|${editing?.id ?? ""}`
    : "";
  const duplicateMatchKey = duplicateQueryKey
    ? `${duplicateQueryKey}|${duplicates
        .map((item) => item.id)
        .sort()
        .join(",")}`
    : "";

  useEffect(() => {
    if (!open || !duplicateQueryKey || scanBusy || submitting) {
      setDuplicates([]);
      setDuplicateError("");
      setDuplicateLoading(false);
      return;
    }
    let current = true;
    setDuplicateLoading(true);
    const timer = window.setTimeout(() => {
      findCostDuplicates({
        job_id: jobId,
        supplier: supplierForDuplicate,
        cost_date: form.cost_date,
        amount_inc_gst: duplicateAmount!,
        ...(editing?.id ? { exclude_cost_id: editing.id } : {}),
      })
        .then((found) => {
          if (!current) return;
          setDuplicates(found);
          setDuplicateError("");
          setDuplicateLoading(false);
        })
        .catch((cause) => {
          if (!current) return;
          setDuplicates([]);
          setDuplicateError(errText(cause));
          setDuplicateLoading(false);
        });
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [
    open,
    jobId,
    duplicateQueryKey,
    duplicateRetry,
    scanBusy,
    submitting,
    supplierForDuplicate,
    form.cost_date,
    duplicateAmount,
    editing?.id,
  ]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || scanBusy) return;
    setFormError("");
    setFieldErrors({});
    if (scanUsed && !scanReviewed) {
      setFormError(
        "Review the scanned receipt fields and confirm before saving.",
      );
      return;
    }
    if (
      !exGstAmount.trim() ||
      !form.amount_inc_gst.trim() ||
      !effectiveGstAmount.trim()
    ) {
      setFieldErrors({
        ...(!exGstAmount.trim() ? { amount_ex_gst: "Enter an amount" } : {}),
        ...(!effectiveGstAmount.trim()
          ? { gst_amount: "Enter the GST amount" }
          : {}),
        ...(!form.amount_inc_gst.trim()
          ? { amount_inc_gst: "Enter an amount" }
          : {}),
      });
      setFormError("Enter all three amounts before saving.");
      return;
    }
    const ex = Number(exGstAmount),
      inc = Number(form.amount_inc_gst),
      gst = Number(effectiveGstAmount);
    const basePayload = {
      job_id: jobId,
      supplier: form.supplier,
      description: form.description,
      cost_date: form.cost_date,
      category: form.category,
      amount_ex_gst: ex,
      gst_amount: gst,
      amount_inc_gst: inc,
      gst_applies: form.gst_applies,
      reference_number: form.reference_number,
      receipt_image_url: removeReceipt ? null : form.receipt_image_url,
      status: form.status,
      notes: form.notes,
      quote_line_item_id: form.quote_line_item_id || null,
      // Do not require the new column for unrelated costs on older databases.
      ...(form.scope_item_id || editing?.scope_item_id
        ? { scope_item_id: form.scope_item_id || null }
        : {}),
    };
    const parsed = jobCostInputSchema.safeParse({
      ...basePayload,
      ...(scanUsed
        ? { receipt_line_items: lineItems, receipt_confidence: scanConfidence }
        : {}),
      ...(scanUsed
        ? {
            receipt_abn: receiptAbn.trim() || null,
            receipt_currency: receiptCurrency.trim() || null,
          }
        : {}),
      ...(!scanUsed && clearStoredScanData
        ? {
            receipt_line_items: [],
            receipt_confidence: null,
            receipt_abn: null,
            receipt_currency: null,
          }
        : {}),
    });
    if (!parsed.success) {
      const flattened: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!flattened[key]) flattened[key] = issue.message;
      });
      setFieldErrors(flattened);
      const amountIssue = parsed.error.issues.some((issue) =>
        ["amount_ex_gst", "gst_amount", "amount_inc_gst"].includes(
          String(issue.path[0]),
        ),
      );
      setFormError(
        amountIssue
          ? "Amounts need checking. Ex GST plus GST must match the total, and GST should match the GST setting."
          : "Check the highlighted fields before saving.",
      );
      return;
    }
    if (!duplicateInputReady) {
      setFormError("Enter a supplier, valid date and total before saving.");
      return;
    }
    setSubmitting(true);
    try {
      let payload: JobCostInput = parsed.data;
      let latestDuplicates: ReceiptDuplicate[];
      try {
        latestDuplicates = await findCostDuplicates({
          job_id: jobId,
          supplier: form.supplier.trim(),
          cost_date: form.cost_date,
          amount_inc_gst: inc,
          ...(editing?.id ? { exclude_cost_id: editing.id } : {}),
        });
      } catch (cause) {
        const message = errText(cause);
        setDuplicateError(message);
        setFormError(
          `Duplicate check failed: ${message} Retry the check before saving.`,
        );
        return;
      }
      setDuplicates(latestDuplicates);
      setDuplicateError("");
      const latestKey = `${duplicateQueryKey}|${latestDuplicates
        .map((item) => item.id)
        .sort()
        .join(",")}`;
      if (latestDuplicates.length && acknowledgedDuplicateKey !== latestKey) {
        setAcknowledgedDuplicateKey("");
        setFormError(
          "Possible matching costs were found. Review them and acknowledge before saving.",
        );
        return;
      }
      if (selectedFile) {
        const receiptPath =
          uploadedReceiptFile === selectedFile && uploadedReceiptPath
            ? uploadedReceiptPath
            : await uploadCostReceipt(jobId, selectedFile);
        payload = {
          ...payload,
          receipt_image_url: receiptPath,
          ...(!scanUsed && editing && hasStoredScanData(editing)
            ? {
                receipt_line_items: [],
                receipt_confidence: null,
                receipt_abn: null,
                receipt_currency: null,
              }
            : {}),
        };
        setUploadedReceiptFile(selectedFile);
        setUploadedReceiptPath(receiptPath);
        updateForm("receipt_image_url", receiptPath);
        setClearStoredScanData(!!editing && hasStoredScanData(editing));
        setSelectedFile(null);
      }
      await saveCost(payload, editing?.id);
      toast.success(editing ? "Cost updated" : "Cost added");
      closeForm();
    } catch (cause) {
      setFormError(errText(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCost(deleteTarget.id);
      toast.success("Cost deleted");
      setDeleteTarget(null);
    } catch (cause) {
      toast.error(errText(cause));
    }
  };
  const viewReceipt = async (cost: JobCost) => {
    setOpeningReceipt(cost.id);
    try {
      const url = await getCostReceiptUrl(cost.id);
      setReceiptLink({ url, name: cost.supplier });
    } catch (cause) {
      toast.error(errText(cause));
    } finally {
      setOpeningReceipt(null);
    }
  };

  const changeGst = (value: string) => {
    setGstAmount(value);
    if (scanUsed) return;
    const ex = numberOrNull(form.amount_ex_gst);
    setForm((current) => ({
      ...current,
      amount_inc_gst:
        value.trim() && ex !== null && Number.isFinite(Number(value))
          ? (ex + Number(value)).toFixed(2)
          : "",
    }));
  };

  return (
    <section
      className="min-w-0 max-w-full space-y-4 [overflow-wrap:anywhere]"
      data-testid="job-costs-tab"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Job costs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record what the job actually costs. Only confirmed costs affect
            profit.
          </p>
        </div>
        <Button onClick={startNew} data-testid="button-add-job-cost">
          <Plus className="mr-2 h-4 w-4" />
          Add cost
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Ex GST", totals.ex],
          ["GST", totals.gst],
          ["Inc GST", totals.inc],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-lg">
              {error ? "Unavailable" : aud(Number(value))}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="cost-category-filter"
            className="text-sm text-muted-foreground"
          >
            Category
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              id="cost-category-filter"
              className="h-11 w-full sm:h-9 sm:w-[155px]"
              data-testid="select-cost-category-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {COST_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="cost-status-filter"
            className="text-sm text-muted-foreground"
          >
            Status
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              id="cost-status-filter"
              className="h-11 w-full sm:h-9 sm:w-[140px]"
              data-testid="select-cost-status-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="col-span-2 text-right text-xs text-muted-foreground sm:ml-auto">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {error && (
        <Card className="border-warning/25 bg-warning/10 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Could not load job costs</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {errText(error)}
              </p>
              {isJobCostSetupError(error) && <JobCostSetupHelp />}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}
      {loading ? (
        <Card className="animate-pulse space-y-3 p-5">
          <div className="h-5 w-1/3 rounded bg-muted" />
          <div className="h-12 rounded bg-muted/70" />
          <div className="h-12 rounded bg-muted/70" />
        </Card>
      ) : filtered.length === 0 && !error ? (
        <Card className="border-dashed px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
            <FileText className="h-5 w-5" />
          </div>
          <p className="font-semibold">
            {costs.length
              ? "No costs match this filter"
              : "Nothing logged against this job yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {costs.length
              ? "Choose another category or status."
              : "Add receipts and actual expenses as they come in."}
          </p>
          {!costs.length && (
            <Button className="mt-4" variant="outline" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add first cost
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered
            .slice()
            .sort((a, b) => b.cost_date.localeCompare(a.cost_date))
            .map((cost) => (
              <Card
                key={cost.id}
                className="p-3.5 sm:p-4"
                data-testid={`job-cost-row-${cost.id}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {cost.supplier}
                      </h3>
                      <Badge
                        variant={
                          cost.status === "confirmed" ? "success" : "secondary"
                        }
                      >
                        {cost.status === "confirmed" ? "Confirmed" : "Draft"}
                      </Badge>
                      <Badge variant="outline">{cost.category}</Badge>
                      {hasStoredScanData(cost) && (
                        <Badge variant="outline">
                          {cost.receipt_confidence ?? "unknown"} scan confidence
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {cost.description}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {new Date(
                          `${cost.cost_date}T00:00:00`,
                        ).toLocaleDateString("en-AU")}
                      </span>
                      {cost.reference_number && (
                        <span>Ref {cost.reference_number}</span>
                      )}
                      {(cost.quote_line_item_id || cost.scope_item_id) && (
                        <span>
                          Linked to:{" "}
                          {quoteLineItems.find(
                            (item) =>
                              item.id ===
                                (cost.scope_item_id ||
                                  cost.quote_line_item_id) &&
                              item.source ===
                                (cost.scope_item_id ? "scope" : "quote"),
                          )?.title || "quote item"}
                        </span>
                      )}
                    </p>
                    {cost.receipt_line_items?.length ? (
                      <div className="mt-3">
                        <ReceiptItemsSummary
                          items={cost.receipt_line_items}
                          subtotal={cost.amount_ex_gst}
                          gst={cost.gst_amount}
                          total={cost.amount_inc_gst}
                          compact
                        />
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                        <span>
                          Ex GST <b>{aud(cost.amount_ex_gst)}</b>
                        </span>
                        <span>
                          GST <b>{aud(cost.gst_amount)}</b>
                        </span>
                        <span>
                          Inc GST <b>{aud(cost.amount_inc_gst)}</b>
                        </span>
                      </div>
                    )}
                    {cost.status === "draft" && (
                      <p className="mt-2 text-sm text-warning">
                        Draft — excluded from job profit until confirmed.
                      </p>
                    )}
                    {cost.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {cost.notes}
                      </p>
                    )}
                    {hasStoredScanData(cost) && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-8 px-0"
                        onClick={() => setLineItemsTarget(cost)}
                        data-testid={`button-view-line-items-${cost.id}`}
                      >
                        View line items
                      </Button>
                    )}
                    {cost.receipt_image_url && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-8 px-0"
                        disabled={openingReceipt === cost.id}
                        onClick={() => viewReceipt(cost)}
                      >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                        {openingReceipt === cost.id
                          ? "Opening…"
                          : "View receipt"}
                      </Button>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => setLineItemsTarget(cost)}
                      aria-label={`View ${cost.supplier}`}
                      data-testid={`button-view-cost-${cost.id}`}
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => startEdit(cost)}
                      aria-label={`Edit ${cost.supplier}`}
                      data-testid={`button-edit-cost-${cost.id}`}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(cost)}
                      aria-label={`Delete ${cost.supplier}`}
                      data-testid={`button-delete-cost-${cost.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <Card
          className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
          data-testid="job-cost-list-totals"
        >
          <span className="font-semibold">
            Filtered total · {filtered.length} entries
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span>
              Ex GST <b>{aud(totals.ex)}</b>
            </span>
            <span>
              GST <b>{aud(totals.gst)}</b>
            </span>
            <span>
              Inc GST <b>{aud(totals.inc)}</b>
            </span>
          </div>
          <p className="w-full text-sm text-muted-foreground">
            List totals include the selected draft and confirmed entries. Only
            confirmed entries affect profitability.
          </p>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if ((submitting || scanBusy) && !next) return;
          if (next) setOpen(true);
          else closeForm();
        }}
      >
        <DialogContent
          className="max-h-[92dvh] min-w-0 [overflow-wrap:anywhere] overflow-y-auto sm:max-w-2xl"
          data-testid="dialog-job-cost"
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit job cost" : "Add a job cost"}
            </DialogTitle>
            <DialogDescription>
              Record the actual expense. Use draft while it needs checking;
              confirmed costs count towards profit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="min-w-0 max-w-full space-y-4">
            {!editing && (
              <ReceiptScanControls
                file={previewFile}
                busy={scanBusy || submitting}
                scanning={scanBusy}
                uploaded={
                  !!uploadedReceiptPath && uploadedReceiptFile === previewFile
                }
                onFileChange={onSelectFile}
                onScan={scanReceipt}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Supplier"
                id="cost-supplier"
                error={fieldErrors.supplier}
              >
                <Input
                  id="cost-supplier"
                  value={form.supplier}
                  maxLength={200}
                  onChange={(e) => updateForm("supplier", e.target.value)}
                  placeholder="Supplier or crew"
                  required
                />
              </Field>
              <Field label="Date" id="cost-date" error={fieldErrors.cost_date}>
                <Input
                  id="cost-date"
                  type="date"
                  value={form.cost_date}
                  onChange={(e) => updateForm("cost_date", e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field
              label="Description"
              id="cost-description"
              error={fieldErrors.description}
            >
              <Input
                id="cost-description"
                value={form.description}
                maxLength={5000}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="What was purchased or done?"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Category"
                id="cost-category"
                error={fieldErrors.category}
              >
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    updateForm("category", value as FormState["category"])
                  }
                >
                  <SelectTrigger id="cost-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status" id="cost-status" error={fieldErrors.status}>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    updateForm("status", value as FormState["status"])
                  }
                >
                  <SelectTrigger id="cost-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      Draft — not included in profit
                    </SelectItem>
                    <SelectItem value="confirmed">
                      Confirmed — included in profit
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {scanUsed && (
              <section aria-label="Receipt line items" className="min-w-0">
                <ReceiptLineItemsEditor
                  items={lineItems}
                  onChange={(items) => {
                    setLineItems(items);
                    setScanReviewed(false);
                  }}
                  disabled={scanBusy || submitting}
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Item prices are recorded as printed and may include GST. Bill
                  totals below are kept separately; editing an item does not
                  overwrite the receipt total.
                </p>
              </section>
            )}
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Bill totals{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    AUD
                  </span>
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!form.gst_applies}
                    onChange={(e) => {
                      const applies = !e.target.checked;
                      updateForm("gst_applies", applies);
                      if (!scanUsed)
                        setAmount(
                          amountBasis,
                          form[
                            amountBasis === "ex"
                              ? "amount_ex_gst"
                              : "amount_inc_gst"
                          ],
                          applies,
                        );
                    }}
                    className="h-4 w-4 accent-amber-700"
                  />
                  GST-free cost
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Ex GST"
                  id="cost-ex"
                  error={fieldErrors.amount_ex_gst}
                >
                  <Input
                    id="cost-ex"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={exGstAmount}
                    onChange={(e) => setAmount("ex", e.target.value)}
                  />
                  {!form.amount_ex_gst.trim() && exGstAmount && (
                    <span className="text-sm text-muted-foreground">
                      Calculated from total and GST.
                    </span>
                  )}
                </Field>
                <Field label="GST" id="cost-gst" error={fieldErrors.gst_amount}>
                  <Input
                    id="cost-gst"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={effectiveGstAmount}
                    onChange={(e) => changeGst(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {effectiveGstAmount !== gstAmount
                      ? form.gst_applies
                        ? "Calculated at 10% because no GST amount was provided."
                        : "Calculated as GST-free."
                      : scanUsed
                        ? "Editable scanned value"
                        : "Enter ex-GST or inc-GST; GST is calculated at 10%."}
                  </span>
                </Field>
                <Field
                  label="Inc GST"
                  id="cost-inc"
                  error={fieldErrors.amount_inc_gst}
                >
                  <Input
                    id="cost-inc"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.amount_inc_gst}
                    onChange={(e) => setAmount("inc", e.target.value)}
                  />
                </Field>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {scanUsed
                  ? "Printed totals stay independent: editing one does not change the others. Check any mismatch against the receipt; scanned GST may not be 10%."
                  : "Enter either ex-GST or inc-GST; the other amount and GST are calculated."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Reference (optional)"
                id="cost-reference"
                error={fieldErrors.reference_number}
              >
                <Input
                  id="cost-reference"
                  maxLength={200}
                  value={form.reference_number}
                  onChange={(e) =>
                    updateForm("reference_number", e.target.value)
                  }
                  placeholder="Invoice or docket number"
                />
              </Field>
              <Field
                label="Link to quote item (optional)"
                id="cost-quote-link"
                error={
                  fieldErrors.quote_line_item_id || fieldErrors.scope_item_id
                }
              >
                <Select
                  value={
                    form.scope_item_id
                      ? `scope:${form.scope_item_id}`
                      : form.quote_line_item_id || "none"
                  }
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      quote_line_item_id:
                        value === "none" || value.startsWith("scope:")
                          ? ""
                          : value,
                      scope_item_id: value.startsWith("scope:")
                        ? value.slice(6)
                        : "",
                    }))
                  }
                >
                  <SelectTrigger id="cost-quote-link">
                    <SelectValue placeholder="No linked item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked item</SelectItem>
                    {quoteLineItems.map((item) => (
                      <SelectItem
                        key={`${item.source}:${item.id}`}
                        value={
                          item.source === "scope" ? `scope:${item.id}` : item.id
                        }
                      >
                        {item.quote_number} · {item.title}
                        {item.source === "scope" ? " (included work)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {quoteLineItems.length
                    ? "Choose included work or a line item from this job’s quotes, then save the cost. This does not change the quote."
                    : "No saved quote items found for this job. Save included work or a quote line item in Quotes, then reopen this form."}
                </span>
                {scopeLinkSetupRequired &&
                  form.scope_item_id &&
                  !isJobCostSetupError(formError) && (
                    <JobCostSetupHelp scopeLinksOnly />
                  )}
              </Field>
            </div>
            <Field
              label="Notes (optional)"
              id="cost-notes"
              error={fieldErrors.notes}
            >
              <Textarea
                id="cost-notes"
                maxLength={10000}
                rows={3}
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Add a note for your records"
              />
            </Field>
            {scanUsed && (
              <>
                <section
                  className="space-y-3 rounded-lg border border-warning/25 bg-warning/10 p-3"
                  aria-label="Receipt scan review"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Receipt scan review
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Nothing is posted automatically. Check the original
                        before saving.
                      </p>
                    </div>
                    <Badge
                      variant={
                        scanConfidence === "low" ? "destructive" : "secondary"
                      }
                    >
                      {scanConfidence ?? "unknown"} confidence
                    </Badge>
                  </div>
                  {liveScanWarnings.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-warning">
                      {liveScanWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The current values reconcile. Still confirm them against
                      the receipt.
                    </p>
                  )}
                  <ReceiptReviewFields
                    abn={receiptAbn}
                    currency={receiptCurrency}
                    disabled={scanBusy || submitting}
                    onAbnChange={setReceiptAbn}
                  />
                  <label className="flex cursor-pointer items-start gap-2 border-t border-warning/25 pt-3 text-sm">
                    <input
                      data-testid="checkbox-receipt-reviewed"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-amber-700"
                      checked={scanReviewed}
                      disabled={scanBusy || submitting}
                      onChange={(event) =>
                        setScanReviewed(event.target.checked)
                      }
                    />
                    <span>
                      I reviewed the extracted details against the original
                      receipt.
                    </span>
                  </label>
                </section>
              </>
            )}
            {editing?.receipt_image_url && !removeReceipt && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-xs">
                  <Paperclip className="h-4 w-4" />
                  Existing receipt attached
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-7 px-1"
                    disabled={openingReceipt === editing.id}
                    onClick={() => viewReceipt(editing)}
                  >
                    {openingReceipt === editing.id ? "Loading…" : "View"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={() => {
                      setRemoveReceipt(true);
                      if (hasStoredScanData(editing)) {
                        setClearStoredScanData(true);
                        setScanUsed(false);
                        setScanConfidence(null);
                        setLineItems([]);
                        setReceiptAbn("");
                        setScanReviewed(false);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
            {removeReceipt && (
              <p className="text-sm text-warning">
                Existing attachment will be removed when saved.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setRemoveReceipt(false);
                    if (
                      editing &&
                      hasStoredScanData(editing) &&
                      !uploadedReceiptPath
                    ) {
                      setClearStoredScanData(false);
                      setScanUsed(true);
                      setScanConfidence(editing.receipt_confidence ?? null);
                      setLineItems(
                        (editing.receipt_line_items ?? []).map((item) => ({
                          ...item,
                        })),
                      );
                      setReceiptAbn(editing.receipt_abn ?? "");
                      setScanReviewed(true);
                    }
                  }}
                >
                  Undo
                </button>
              </p>
            )}
            {editing && (
              <div className="space-y-2">
                <Label htmlFor="cost-receipt-edit">
                  {editing.receipt_image_url
                    ? "Replace receipt attachment"
                    : "Receipt attachment (optional)"}
                </Label>
                <label
                  htmlFor="cost-receipt-edit"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 hover:bg-muted/30"
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {selectedFile
                      ? selectedFile.name
                      : "Choose JPEG, PNG, WebP or PDF (max 10 MB)"}
                  </span>
                  <span className="text-xs font-semibold text-warning">
                    Browse
                  </span>
                </label>
                <input
                  id="cost-receipt-edit"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    onSelectFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
                {selectedFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectFile(null)}
                  >
                    Clear selected file
                  </Button>
                )}
              </div>
            )}
            {editing && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Created {new Date(editing.created_at).toLocaleString("en-AU")} ·
                Updated {new Date(editing.updated_at).toLocaleString("en-AU")} ·
                Creator {editing.created_by}
              </div>
            )}
            {duplicates.length > 0 && (
              <div className="space-y-2 rounded-md border border-warning/25 bg-warning/10 p-3">
                <p className="text-sm font-semibold text-warning">
                  Possible matching costs
                </p>
                <ul className="space-y-2">
                  {duplicates.map((item) => (
                    <li key={item.id} className="text-xs text-warning">
                      <span className="font-semibold">{item.job_name}</span> ·{" "}
                      {new Date(
                        `${item.cost_date}T00:00:00`,
                      ).toLocaleDateString("en-AU")}{" "}
                      · {aud(item.amount_inc_gst)}
                      {item.reference_number
                        ? ` · Ref ${item.reference_number}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-sm text-warning">
                  <input
                    data-testid="checkbox-duplicate-acknowledged"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-amber-700"
                    checked={acknowledgedDuplicateKey === duplicateMatchKey}
                    disabled={duplicateLoading || submitting}
                    onChange={(event) =>
                      setAcknowledgedDuplicateKey(
                        event.target.checked ? duplicateMatchKey : "",
                      )
                    }
                  />
                  <span>
                    This is a legitimate separate cost. I checked the matches
                    and want to continue.
                  </span>
                </label>
              </div>
            )}
            {duplicateError && (
              <div
                role="alert"
                className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Duplicate check failed: {duplicateError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={duplicateLoading || submitting}
                    onClick={() => {
                      setDuplicateError("");
                      setDuplicateRetry((value) => value + 1);
                    }}
                  >
                    Retry check
                  </Button>
                </div>
                {isJobCostSetupError(new Error(duplicateError)) && (
                  <JobCostSetupHelp />
                )}
              </div>
            )}
            {duplicateLoading && duplicateQueryKey && (
              <p role="status" className="text-sm text-muted-foreground">
                Checking for matching costs…
              </p>
            )}
            {(formError || Object.keys(fieldErrors).length > 0) && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {formError || "Please correct the highlighted fields."}
              </p>
            )}
            {formError && isJobCostSetupError(formError) && (
              <JobCostSetupHelp
                scopeLinksOnly={formError.startsWith("Included-work linking")}
              />
            )}
            <DialogFooter className="sticky bottom-[-1px] -mx-1 gap-2 border-t bg-background/95 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:pt-0">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={submitting || scanBusy}
                onClick={closeForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={
                  saving ||
                  submitting ||
                  scanBusy ||
                  duplicateLoading ||
                  !!duplicateError
                }
              >
                {submitting ? "Saving…" : editing ? "Save changes" : "Add cost"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!lineItemsTarget}
        onOpenChange={(next) => !next && setLineItemsTarget(null)}
      >
        <DialogContent className="max-w-xl" data-testid="dialog-view-cost">
          <DialogHeader>
            <DialogTitle>Receipt and cost details</DialogTitle>
            <DialogDescription>
              Read-only details for {lineItemsTarget?.supplier}. Close this view
              and choose Edit to make changes.
            </DialogDescription>
          </DialogHeader>
          {lineItemsTarget && (
            <JobCostView key={lineItemsTarget.id} cost={lineItemsTarget} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineItemsTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!receiptLink}
        onOpenChange={(next) => !next && setReceiptLink(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt attachment</DialogTitle>
            <DialogDescription>
              Private receipt for {receiptLink?.name}. Use the link below to
              open it in a new tab.
            </DialogDescription>
          </DialogHeader>
          {receiptLink?.url && (
            <a
              href={receiptLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open receipt
            </a>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptLink(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cost?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              {deleteTarget?.supplier
                ? `the cost from ${deleteTarget.supplier}`
                : "this job cost"}{" "}
              from the job. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete cost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
