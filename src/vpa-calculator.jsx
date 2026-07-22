import { useState, useMemo } from "react";

const PALETTE = {
  primary: "#1F4E5B",
  accentTeal: "#4A7C7A",
  accentGold: "#B8860B",
  gridLight: "#E2E8F0",
  gridDark: "#1A202C",
};

const PRESETS = {
  A: {
    label: "Dataset A — steady service, one-off spike",
    values: [110, 105, 120, 115, 108, 112, 300, 118, 122, 119],
    halfLife: 1,
  },
  B: {
    label: "Dataset B — recurring nightly batch",
    values: [95, 600, 92, 600, 88, 600, 91, 600, 90, 600],
    halfLife: 1,
  },
  C: {
    label: "Dataset C — clean history before OOM",
    values: [200, 210, 205, 215, 220, 208, 212, 225, 218, 230],
    halfLife: 7,
  },
};

function weightedPercentile(values, halfLife, percentile) {
  // values ordered oldest -> newest, age counted from the newest sample
  const n = values.length;
  const items = values.map((v, i) => {
    const age = n - 1 - i;
    const weight = Math.pow(0.5, age / halfLife);
    return { value: v, age, weight };
  });
  const totalWeight = items.reduce((s, it) => s + it.weight, 0);
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const threshold = totalWeight * percentile;
  let cum = 0;
  let result = sorted[sorted.length - 1].value;
  for (const it of sorted) {
    cum += it.weight;
    if (cum >= threshold) {
      result = it.value;
      break;
    }
  }
  return { items: sorted, totalWeight, threshold, target: result };
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: PALETTE.accentTeal,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, suffix }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PALETTE.gridDark }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 96,
            padding: "6px 8px",
            border: `1px solid ${PALETTE.gridLight}`,
            borderRadius: 6,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 13,
          }}
        />
        {suffix && <span style={{ fontSize: 11, opacity: 0.6 }}>{suffix}</span>}
      </div>
    </label>
  );
}

export default function VPACalculator() {
  const [presetKey, setPresetKey] = useState("A");
  const [halfLife, setHalfLife] = useState(PRESETS.A.halfLife);
  const [rawValues, setRawValues] = useState(PRESETS.A.values.join(", "));
  const [percentile, setPercentile] = useState(0.9);

  const [oomEnabled, setOomEnabled] = useState(false);
  const [oomUsage, setOomUsage] = useState(256);
  const [oomBump, setOomBump] = useState(250);

  const [replicas, setReplicas] = useState(8);
  const [quotaCpuVcores, setQuotaCpuVcores] = useState(32);
  const [limitRangeMaxMilli, setLimitRangeMaxMilli] = useState(2000);
  const [vpaMaxAllowedMilli, setVpaMaxAllowedMilli] = useState(2000);

  const values = useMemo(
    () =>
      rawValues
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n)),
    [rawValues]
  );

  const calc = useMemo(() => {
    if (values.length === 0) return null;
    return weightedPercentile(values, Math.max(halfLife, 0.01), percentile);
  }, [values, halfLife, percentile]);

  const histogramTarget = calc ? calc.target : 0;
  const oomAdjustedTarget = oomEnabled ? Math.max(histogramTarget, oomUsage + oomBump) : histogramTarget;

  const isMemoryMode = presetKey === "C" || oomEnabled;
  const unit = isMemoryMode ? "Mi" : "m";

  const perPodMilli = isMemoryMode ? null : oomAdjustedTarget;
  const totalRequestMilli = perPodMilli != null ? perPodMilli * replicas : null;
  const quotaMilli = quotaCpuVcores * 1000;
  const fitsQuota = totalRequestMilli != null ? totalRequestMilli <= quotaMilli : null;
  const fitsLimitRange = perPodMilli != null ? perPodMilli <= limitRangeMaxMilli : null;
  const vpaCapsBelowLimitRange = vpaMaxAllowedMilli <= limitRangeMaxMilli;

  const maxVal = calc ? Math.max(...calc.items.map((i) => i.value)) : 1;

  function applyPreset(key) {
    setPresetKey(key);
    setRawValues(PRESETS[key].values.join(", "));
    setHalfLife(PRESETS[key].halfLife);
    setOomEnabled(key === "C");
  }

  return (
    <div
      style={{
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
        background: "#ffffff",
        color: PALETTE.gridDark,
        maxWidth: 980,
        margin: "0 auto",
        padding: "28px 24px 40px",
      }}
    >
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>VPA Recommendation Calculator</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
          Decay-weighted percentile math, the OOM bump, and whether the result actually fits your quota and
          LimitRange. Same model described in the blog post, worked interactively.
        </div>
      </div>

      <Section title="1. Choose or edit a sample dataset">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${presetKey === key ? PALETTE.primary : PALETTE.gridLight}`,
                background: presetKey === key ? PALETTE.primary : "#fff",
                color: presetKey === key ? "#fff" : PALETTE.gridDark,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 12 }}>
          <span style={{ opacity: 0.75 }}>Samples, oldest to newest, comma separated ({unit === "Mi" ? "MiB" : "millicores"})</span>
          <textarea
            value={rawValues}
            onChange={(e) => setRawValues(e.target.value)}
            rows={2}
            style={{
              padding: "8px 10px",
              border: `1px solid ${PALETTE.gridLight}`,
              borderRadius: 6,
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 13,
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <NumberField label="Decay half-life" value={halfLife} onChange={setHalfLife} suffix="days" />
          <NumberField
            label="Target percentile"
            value={percentile}
            onChange={(v) => setPercentile(Math.min(Math.max(v, 0), 1))}
            suffix="0 to 1"
          />
        </div>
      </Section>

      {calc && (
        <Section title="2. Weighted histogram">
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {calc.items.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                <div style={{ width: 46, textAlign: "right", opacity: 0.6 }}>age {it.age}d</div>
                <div style={{ width: 42, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {it.value}
                </div>
                <div
                  style={{
                    height: 14,
                    width: `${(it.value / maxVal) * 260}px`,
                    background: PALETTE.accentTeal,
                    opacity: 0.35 + it.weight * 0.65,
                    borderRadius: 3,
                  }}
                />
                <div style={{ width: 60, opacity: 0.55, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  w={it.weight.toFixed(3)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12.5, opacity: 0.75 }}>
            Total weight ≈ {calc.totalWeight.toFixed(3)}, threshold for the {Math.round(percentile * 100)}th
            percentile ≈ {calc.threshold.toFixed(3)}
          </div>
        </Section>
      )}

      <Section title="3. Recommendation, with the OOM override">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={oomEnabled} onChange={(e) => setOomEnabled(e.target.checked)} />
            Container was OOMKilled
          </label>
          {oomEnabled && (
            <>
              <NumberField label="Usage at time of OOM" value={oomUsage} onChange={setOomUsage} suffix="Mi" />
              <NumberField label="Fixed bump" value={oomBump} onChange={setOomBump} suffix="Mi" />
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            padding: "16px 18px",
            background: PALETTE.gridLight,
            borderRadius: 10,
            border: `1px solid ${PALETTE.accentTeal}`,
          }}
        >
          <div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Histogram target</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>
              {histogramTarget}
              {unit}
            </div>
          </div>
          {oomEnabled && (
            <div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>After OOM override</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, Menlo, monospace",
                  color: PALETTE.accentGold,
                }}
              >
                {oomAdjustedTarget}
                {unit}
              </div>
            </div>
          )}
        </div>
      </Section>

      {!isMemoryMode && (
        <Section title="4. Does it fit the resource hierarchy? (CPU, millicores)">
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
            <NumberField label="Replicas" value={replicas} onChange={setReplicas} />
            <NumberField label="Namespace CPU quota" value={quotaCpuVcores} onChange={setQuotaCpuVcores} suffix="vCPU" />
            <NumberField
              label="LimitRange max per container"
              value={limitRangeMaxMilli}
              onChange={setLimitRangeMaxMilli}
              suffix="m"
            />
            <NumberField
              label="VPA maxAllowed"
              value={vpaMaxAllowedMilli}
              onChange={setVpaMaxAllowedMilli}
              suffix="m"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div>
              Per-pod recommendation: <strong>{perPodMilli}m</strong> &nbsp;×&nbsp; {replicas} replicas =
              <strong> {totalRequestMilli}m</strong> total request (namespace quota is {quotaMilli}m)
            </div>
            <StatusLine
              ok={fitsQuota}
              okText={`Fits inside the namespace CPU quota.`}
              badText={`Exceeds the namespace CPU quota by ${totalRequestMilli - quotaMilli}m. Some pods will resize successfully and the rest will stay deferred until quota increases or replica count drops.`}
            />
            <StatusLine
              ok={fitsLimitRange}
              okText={`Per-pod value is within the LimitRange max (${limitRangeMaxMilli}m).`}
              badText={`Per-pod value (${perPodMilli}m) exceeds the LimitRange max (${limitRangeMaxMilli}m). The admission controller will reject this patch outright, regardless of quota.`}
            />
            <StatusLine
              ok={vpaCapsBelowLimitRange}
              okText={`VPA's own maxAllowed (${vpaMaxAllowedMilli}m) is at or below the LimitRange max, so VPA will never even propose a value that gets rejected.`}
              badText={`VPA's maxAllowed (${vpaMaxAllowedMilli}m) is above the LimitRange max (${limitRangeMaxMilli}m). VPA can keep proposing values the cluster will keep rejecting, with no obvious error in kubectl describe pod.`}
            />
          </div>
        </Section>
      )}

      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8, borderTop: `1px solid ${PALETTE.gridLight}`, paddingTop: 14 }}>
        Model: weight = 0.5^(age_in_days / half_life). Target percentile found by walking the value-sorted
        histogram until cumulative weight crosses percentile × total weight. This mirrors VPA's real recommender
        logic at a level a person can check by hand; the production implementation uses finer-grained decayed
        histogram buckets rather than raw per-sample weights.
      </div>
    </div>
  );
}

function StatusLine({ ok, okText, badText }) {
  if (ok === null) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 10px",
        borderRadius: 6,
        background: ok ? "rgba(74,124,122,0.1)" : "rgba(184,134,11,0.12)",
      }}
    >
      <span style={{ fontWeight: 700, color: ok ? "#2f6b56" : "#8a5a05" }}>{ok ? "OK" : "!!"}</span>
      <span style={{ fontSize: 12.5 }}>{ok ? okText : badText}</span>
    </div>
  );
}
