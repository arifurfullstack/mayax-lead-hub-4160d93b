import { useState, useEffect, useMemo } from "react";
import { Save, Award, Plus, Trash2, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_SCORE_RULES,
  DEFAULT_GRADE_BUCKETS,
  parseGradingSettings,
  validateGradeBuckets,
  calculateAiScore,
  type ScoreRule,
  type ScoreRuleOp,
  type GradeBucket,
} from "@/lib/leadScoring";

interface Props {
  platformSettings: Record<string, string>;
  onSaved: () => void;
}

const OP_OPTIONS: { value: ScoreRuleOp; label: string; needsValue: boolean }[] = [
  { value: "gte", label: "≥ value", needsValue: true },
  { value: "lte", label: "≤ value", needsValue: true },
  { value: "between", label: "between min–max", needsValue: true },
  { value: "specific", label: "specific (non-generic)", needsValue: false },
  { value: "generic", label: "generic value", needsValue: false },
  { value: "true", label: "is true", needsValue: false },
  { value: "present", label: "is present", needsValue: false },
  { value: "count_capped", label: "count × points (capped)", needsValue: true },
];

const FIELD_OPTIONS = [
  "income",
  "vehicle_preference",
  "trade_in",
  "has_bankruptcy",
  "appointment_time",
  "email",
  "phone",
  "document_files",
  "documents",
];

const SAMPLE_LEAD = {
  income: 5500,
  vehicle_preference: "2022 Honda Civic",
  trade_in: true,
  has_bankruptcy: false,
  appointment_time: new Date().toISOString(),
  email: "test@example.com",
  phone: "5551234567",
  document_files: [{ name: "paystub.pdf" }, { name: "id.jpg" }],
};

export default function AdminGradeSettings({ platformSettings, onSaved }: Props) {
  const initial = useMemo(() => parseGradingSettings(platformSettings), [platformSettings]);
  const [base, setBase] = useState<number>(initial.scoreRules.base);
  const [rules, setRules] = useState<ScoreRule[]>(initial.scoreRules.rules);
  const [buckets, setBuckets] = useState<GradeBucket[]>(initial.gradeBuckets.buckets);
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);

  useEffect(() => {
    const parsed = parseGradingSettings(platformSettings);
    setBase(parsed.scoreRules.base);
    setRules(parsed.scoreRules.rules);
    setBuckets(parsed.gradeBuckets.buckets);
  }, [platformSettings]);

  const bucketError = validateGradeBuckets(buckets);

  const previewSampleScore = useMemo(() => {
    return calculateAiScore(SAMPLE_LEAD as never, {
      scoreRules: { base, rules },
      gradeBuckets: { buckets },
    });
  }, [base, rules, buckets]);

  const updateRule = (idx: number, patch: Partial<ScoreRule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => setRules((prev) => prev.filter((_, i) => i !== idx));

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule_${Date.now()}`,
        label: "New rule",
        field: "income",
        op: "gte",
        value: 0,
        points: 5,
      },
    ]);
  };

  const updateBucket = (idx: number, patch: Partial<GradeBucket>) => {
    setBuckets((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBucket = (idx: number) => setBuckets((prev) => prev.filter((_, i) => i !== idx));

  const addBucket = () => {
    setBuckets((prev) => {
      const lowest = prev[prev.length - 1];
      const max = lowest ? Math.max(0, lowest.min - 1) : 100;
      return [...prev, { grade: "NEW", min: Math.max(0, max - 9), max }];
    });
  };

  const resetDefaults = () => {
    setBase(DEFAULT_SCORE_RULES.base);
    setRules(DEFAULT_SCORE_RULES.rules);
    setBuckets(DEFAULT_GRADE_BUCKETS.buckets);
  };

  const handleSave = async () => {
    if (bucketError) {
      toast({ title: "Invalid grade buckets", description: bucketError, variant: "destructive" });
      return;
    }
    setSaving(true);
    const scoreRulesPayload = JSON.stringify({ base, rules });
    const gradeBucketsPayload = JSON.stringify({ buckets });

    const upserts = [
      { key: "grading_score_rules", value: scoreRulesPayload },
      { key: "grading_grade_buckets", value: gradeBucketsPayload },
    ];

    for (const { key, value } of upserts) {
      if (platformSettings[key] !== undefined) {
        await supabase.from("platform_settings").update({ value }).eq("key", key);
      } else {
        await supabase.from("platform_settings").insert({ key, value });
      }
    }
    setSaving(false);
    toast({ title: "Saved", description: "Grade & AI score settings updated." });
    onSaved();
  };

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const { data, error } = await supabase.functions.invoke("recalculate-lead-scores");
      if (error) throw error;
      toast({
        title: "Recalculated",
        description: `Updated ${data?.updated ?? 0} of ${data?.total ?? 0} leads.`,
      });
      onSaved();
    } catch (err) {
      toast({
        title: "Recalc failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRecalcing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header / preview ─── */}
      <div className="glass-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Grade & AI Score Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Higher grades must always require higher scores. Score is calculated additively from rules below; the resulting score is mapped to a grade by the bucket ranges.
        </p>
        <div className="rounded-lg bg-muted/30 border border-border/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Sample lead preview</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Income $5,500 • specific vehicle • trade-in • appointment • email + phone • 2 documents
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-mono text-xs">Score: {previewSampleScore.ai_score}</Badge>
            <Badge variant="outline" className="font-mono text-xs">Grade: {previewSampleScore.quality_grade}</Badge>
          </div>
        </div>
      </div>

      {/* ─── Score rules ─── */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">AI Score Rules</h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Base score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={base}
              onChange={(e) => setBase(Number(e.target.value) || 0)}
              className="w-20 h-8 bg-background border-border text-xs"
            />
          </div>
        </div>

        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const opMeta = OP_OPTIONS.find((o) => o.value === rule.op);
            return (
              <div
                key={rule.id}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-border/40 bg-background/30"
              >
                <Input
                  className="col-span-3 h-8 text-xs bg-background border-border"
                  value={rule.label}
                  onChange={(e) => updateRule(idx, { label: e.target.value })}
                  placeholder="Label"
                />
                <Select value={rule.field} onValueChange={(v) => updateRule(idx, { field: v })}>
                  <SelectTrigger className="col-span-2 h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rule.op} onValueChange={(v) => updateRule(idx, { op: v as ScoreRuleOp })}>
                  <SelectTrigger className="col-span-3 h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {opMeta?.needsValue ? (
                  rule.op === "between" ? (
                    <div className="col-span-2 flex items-center gap-1">
                      <Input
                        type="number"
                        className="h-8 text-xs bg-background border-border"
                        value={Array.isArray(rule.value) ? rule.value[0] : 0}
                        onChange={(e) => {
                          const v = Array.isArray(rule.value) ? [...rule.value] : [0, 0];
                          v[0] = Number(e.target.value) || 0;
                          updateRule(idx, { value: v });
                        }}
                      />
                      <Input
                        type="number"
                        className="h-8 text-xs bg-background border-border"
                        value={Array.isArray(rule.value) ? rule.value[1] : 0}
                        onChange={(e) => {
                          const v = Array.isArray(rule.value) ? [...rule.value] : [0, 0];
                          v[1] = Number(e.target.value) || 0;
                          updateRule(idx, { value: v });
                        }}
                      />
                    </div>
                  ) : (
                    <Input
                      type="number"
                      className="col-span-2 h-8 text-xs bg-background border-border"
                      value={typeof rule.value === "number" ? rule.value : 0}
                      onChange={(e) => updateRule(idx, { value: Number(e.target.value) || 0 })}
                    />
                  )
                ) : (
                  <div className="col-span-2 text-[10px] text-muted-foreground/60 px-2">—</div>
                )}
                <Input
                  type="number"
                  className="col-span-1 h-8 text-xs bg-background border-border"
                  value={rule.points}
                  onChange={(e) => updateRule(idx, { points: Number(e.target.value) || 0 })}
                  title="Points"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRule(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button onClick={addRule} variant="outline" size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Add rule
        </Button>
      </div>

      {/* ─── Grade buckets ─── */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Grade Buckets (top → bottom)</h3>
          <span className="text-[10px] text-muted-foreground">Higher grade = higher score range</span>
        </div>

        <div className="space-y-2">
          {buckets.map((b, idx) => (
            <div
              key={`${b.grade}_${idx}`}
              className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-border/40 bg-background/30"
            >
              <Input
                className="col-span-2 h-8 text-xs bg-background border-border font-mono"
                value={b.grade}
                onChange={(e) => updateBucket(idx, { grade: e.target.value })}
              />
              <div className="col-span-4 flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 text-xs bg-background border-border"
                  value={b.min}
                  onChange={(e) => updateBucket(idx, { min: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 text-xs bg-background border-border"
                  value={b.max}
                  onChange={(e) => updateBucket(idx, { max: Number(e.target.value) || 0 })}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="col-span-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeBucket(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button onClick={addBucket} variant="outline" size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Add bucket
          </Button>
          {bucketError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {bucketError}
            </div>
          )}
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={resetDefaults} variant="ghost" size="sm" className="text-xs">
          Reset to defaults
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRecalc}
            disabled={recalcing || saving}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${recalcing ? "animate-spin" : ""}`} />
            {recalcing ? "Recalculating…" : "Recalculate all leads"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !!bucketError}
            className="gradient-blue-cyan text-foreground gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
