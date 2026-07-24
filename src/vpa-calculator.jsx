import { useState, useMemo, useEffect } from "react";

// Free, no-signup hit counter. Namespace/key pair below acts as the unique
// counter ID; change either string if you ever want to reset the count.
const COUNTAPI_NAMESPACE = "prasad-m-k-vpa-calc";
const COUNTAPI_KEY = "views";

function useViewCounter() {
  const [count, setCount] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Avoid double-counting on React StrictMode's dev double-invoke.
    const alreadyHitThisSession = sessionStorage.getItem("vpa-calc-hit");
    const url = alreadyHitThisSession
      ? `https://api.countapi.xyz/get/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`
      : `https://api.countapi.xyz/hit/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.value === "number") {
          setCount(data.value);
          sessionStorage.setItem("vpa-calc-hit", "1");
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, []);

  return { count, failed };
}

function ViewCounter({ palette }) {
  const { count, failed } = useViewCounter();
  if (failed) return null; // fail silently, never block the tool itself
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 24,
        fontSize: 11.5,
        color: palette.accentTeal,
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
      title="Page views since launch"
    >
      <span aria-hidden="true">◎</span>
      <span>{count === null ? "…" : count.toLocaleString()} views</span>
    </div>
  );
}

const PALETTE = {
  primary: "#1F4E5B",
  accentTeal: "#4A7C7A",
  accentGold: "#B8860B",
  gridLight: "#E2E8F0",
  gridDark: "#1A202C",
};

const PRESETS = {
  A: {
    label: "Dataset A: steady service, one-off spike",
    description:
      "A normal, steady workload that had one unusual day (a deploy that briefly spiked CPU). Shows how the decay math treats a one-time event: the spike barely moves the recommendation because it's already fading in importance by the time you're looking at it.",
    values: [110, 105, 120, 115, 108, 112, 300, 118, 122, 119],
    halfLife: 1,
  },
  B: {
    label: "Dataset B: recurring nightly batch",
    description:
      "The same shape as Dataset A, but the 'spike' happens every single day, like a nightly batch job. Because it keeps recurring, it never gets the chance to fade away, so the recommendation ends up sized for the batch job, not the quiet hours in between.",
    values: [95, 600, 92, 600, 88, 600, 91, 600, 90, 600],
    halfLife: 1,
  },
  C: {
    label: "Dataset C: clean history before OOM",
    description:
      "A calm, boring memory history right up until the container got OOMKilled. Turn on the OOM checkbox below to see how the recommendation jumps directly to a safer number, skipping the usual percentile math entirely.",
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

function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", marginLeft: 4 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: PALETTE.gridLight,
          color: PALETTE.accentTeal,
          fontSize: 10,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          border: `1px solid ${PALETTE.accentTeal}`,
          lineHeight: 1,
        }}
        aria-label="More info"
      >
        i
      </span>
      {open && (
        <span
          style={{
            position: "absolute",
            bottom: "140%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 220,
            background: PALETTE.gridDark,
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 400,
            lineHeight: 1.4,
            padding: "8px 10px",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 10,
            textTransform: "none",
            letterSpacing: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function NumberField({ label, value, onChange, suffix, tooltip }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PALETTE.gridDark }}>
      <span style={{ opacity: 0.75, display: "inline-flex", alignItems: "center" }}>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
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

  // CPU-side quota / limit fields (millicores)
  const [quotaCpuVcores, setQuotaCpuVcores] = useState(32);
  const [usedCpuMilli, setUsedCpuMilli] = useState(0);
  const [limitRangeMaxMilliCpu, setLimitRangeMaxMilliCpu] = useState(2000);
  const [vpaMaxAllowedMilliCpu, setVpaMaxAllowedMilliCpu] = useState(2000);

  // Memory-side quota / limit fields (Mi)
  const [quotaMemoryGi, setQuotaMemoryGi] = useState(64);
  const [usedMemoryMi, setUsedMemoryMi] = useState(0);
  const [limitRangeMaxMi, setLimitRangeMaxMi] = useState(4096);
  const [vpaMaxAllowedMi, setVpaMaxAllowedMi] = useState(4096);

  const [resourceType, setResourceType] = useState("cpu"); // "cpu" | "memory", user can override

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

  const perPodValue = oomAdjustedTarget;

  // CPU fit math (millicores)
  const newRequestMilliCpu = perPodValue * replicas;
  const totalRequestMilliCpu = usedCpuMilli + newRequestMilliCpu;
  const quotaMilliCpu = quotaCpuVcores * 1000;
  const fitsQuotaCpu = totalRequestMilliCpu <= quotaMilliCpu;
  const fitsLimitRangeCpu = perPodValue <= limitRangeMaxMilliCpu;
  const vpaCapsBelowLimitRangeCpu = vpaMaxAllowedMilliCpu <= limitRangeMaxMilliCpu;

  // Memory fit math (Mi)
  const newRequestMi = perPodValue * replicas;
  const totalRequestMi = usedMemoryMi + newRequestMi;
  const quotaMi = quotaMemoryGi * 1024;
  const fitsQuotaMemory = totalRequestMi <= quotaMi;
  const fitsLimitRangeMemory = perPodValue <= limitRangeMaxMi;
  const vpaCapsBelowLimitRangeMemory = vpaMaxAllowedMi <= limitRangeMaxMi;

  const maxVal = calc ? Math.max(...calc.items.map((i) => i.value)) : 1;

  function applyPreset(key) {
    setPresetKey(key);
    setRawValues(PRESETS[key].values.join(", "));
    setHalfLife(PRESETS[key].halfLife);
    const oomOn = key === "C";
    setOomEnabled(oomOn);
    setResourceType(oomOn || key === "C" ? "memory" : "cpu");
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
        position: "relative",
      }}
    >
      <ViewCounter palette={PALETTE} />

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>VPA Recommendation Calculator</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
          Decay-weighted percentile math, the OOM bump, and whether the result actually fits your quota and
          LimitRange. Same model described in the blog post, worked interactively.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 24,
          padding: "10px 14px",
          background: PALETTE.gridLight,
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, marginRight: 4 }}>Resource type:</span>
        {["cpu", "memory"].map((rt) => (
          <button
            key={rt}
            onClick={() => setResourceType(rt)}
            style={{
              padding: "6px 16px",
              borderRadius: 7,
              border: `1px solid ${resourceType === rt ? PALETTE.primary : PALETTE.accentTeal}`,
              background: resourceType === rt ? PALETTE.primary : "#fff",
              color: resourceType === rt ? "#fff" : PALETTE.gridDark,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {rt}
          </button>
        ))}
        <InfoTooltip text="Sets the unit used throughout the whole tool, millicores for CPU or MiB for memory, and determines which quota and LimitRange fields show up in step 4." />
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

        {PRESETS[presetKey] && (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: PALETTE.gridDark,
              background: PALETTE.gridLight,
              borderLeft: `3px solid ${PALETTE.accentTeal}`,
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 14,
            }}
          >
            {PRESETS[presetKey].description}
          </div>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 12 }}>
          <span style={{ opacity: 0.75 }}>
            Samples, oldest to newest, comma separated ({resourceType === "cpu" ? "millicores" : "MiB"})
          </span>
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
          <NumberField
            label="Decay half-life"
            value={halfLife}
            onChange={setHalfLife}
            suffix="days"
            tooltip="How fast older samples stop mattering. A 1-day half-life means a sample from yesterday counts half as much as one from today, and a sample from a week ago counts almost nothing. A longer half-life (like 7 days) keeps history relevant for longer."
          />
          <NumberField
            label="Target percentile"
            value={percentile}
            onChange={(v) => setPercentile(Math.min(Math.max(v, 0), 1))}
            suffix="0 to 1"
            tooltip="The recommendation aims to cover this fraction of observed usage. 0.9 means the recommended value is high enough to cover 90% of the weighted samples, with the top 10% (usually brief spikes) exceeding it."
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
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
            <input type="checkbox" checked={oomEnabled} onChange={(e) => setOomEnabled(e.target.checked)} />
            Container was OOMKilled
            <InfoTooltip text="Turn this on if the container was killed for using too much memory. When this happens, the recommender skips its usual math and jumps straight to a higher number, so the container has enough headroom not to die the same way again." />
          </label>
          {oomEnabled && (
            <>
              <NumberField
                label="Usage at time of OOM"
                value={oomUsage}
                onChange={setOomUsage}
                suffix={resourceType === "cpu" ? "m" : "Mi"}
                tooltip="How much memory the container was actually using right when it got killed. Usually close to whatever its limit was set to."
              />
              <NumberField
                label="Fixed bump"
                value={oomBump}
                onChange={setOomBump}
                suffix={resourceType === "cpu" ? "m" : "Mi"}
                tooltip="A flat amount of extra headroom added on top of the usage-at-OOM value, so the next attempt has more room to breathe. This is added directly, it does not come from the percentile calculation above."
              />
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
              {resourceType === "cpu" ? "m" : "Mi"}
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
                {resourceType === "cpu" ? "m" : "Mi"}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="4. Does it fit the resource hierarchy?">
        <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 16 }}>
          Checking against the {resourceType === "cpu" ? "CPU" : "memory"} recommendation from step 3 (
          {perPodValue}
          {resourceType === "cpu" ? "m" : "Mi"}). Change the resource type at the top of the page if needed.
        </div>

        {resourceType === "cpu" ? (
          <>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
              <NumberField
                label="Replicas"
                value={replicas}
                onChange={setReplicas}
                tooltip="How many copies of this pod are running. Every replica gets the same per-pod recommendation, so this multiplies straight into the total request below."
              />
              <NumberField
                label="Namespace CPU quota"
                value={quotaCpuVcores}
                onChange={setQuotaCpuVcores}
                suffix="vCPU"
                tooltip="The total CPU this namespace is allowed to request across every pod combined, set by a ResourceQuota. Run: kubectl describe resourcequota -n <namespace>"
              />
              <NumberField
                label="Already used by other pods"
                value={usedCpuMilli}
                onChange={setUsedCpuMilli}
                suffix="m"
                tooltip="How much of this quota is already consumed by pods that aren't part of this calculation, before your new or resized pods are counted. Check the 'Used' column in: kubectl describe resourcequota -n <namespace>"
              />
              <NumberField
                label="LimitRange max per container"
                value={limitRangeMaxMilliCpu}
                onChange={setLimitRangeMaxMilliCpu}
                suffix="m"
                tooltip="The single highest CPU value any one container in this namespace is allowed to request or be limited to, set by a LimitRange. Run: kubectl describe limitrange -n <namespace>"
              />
              <NumberField
                label="VPA maxAllowed"
                value={vpaMaxAllowedMilliCpu}
                onChange={setVpaMaxAllowedMilliCpu}
                suffix="m"
                tooltip="A ceiling you set directly on the VPA object itself (resourcePolicy.containerPolicies[].maxAllowed), so VPA never proposes more than this, regardless of what the histogram calculates."
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div>
                Per-pod recommendation: <strong>{perPodValue}m</strong> × {replicas} replicas =
                <strong> {newRequestMilliCpu}m</strong> new request, plus <strong>{usedCpuMilli}m</strong> already
                used = <strong>{totalRequestMilliCpu}m</strong> total (namespace quota is {quotaMilliCpu}m)
              </div>
              <StatusLine
                ok={fitsQuotaCpu}
                okText={`Fits inside the namespace CPU quota, with ${quotaMilliCpu - totalRequestMilliCpu}m to spare.`}
                badText={`Exceeds the namespace CPU quota by ${totalRequestMilliCpu - quotaMilliCpu}m once existing usage is counted. Some pods will resize successfully and the rest will stay deferred until quota increases, other usage drops, or replica count drops.`}
              />
              <StatusLine
                ok={fitsLimitRangeCpu}
                okText={`Per-pod value is within the LimitRange max (${limitRangeMaxMilliCpu}m).`}
                badText={`Per-pod value (${perPodValue}m) exceeds the LimitRange max (${limitRangeMaxMilliCpu}m). The admission controller will reject this patch outright, regardless of quota.`}
              />
              <StatusLine
                ok={vpaCapsBelowLimitRangeCpu}
                okText={`VPA's own maxAllowed (${vpaMaxAllowedMilliCpu}m) is at or below the LimitRange max, so VPA will never even propose a value that gets rejected.`}
                badText={`VPA's maxAllowed (${vpaMaxAllowedMilliCpu}m) is above the LimitRange max (${limitRangeMaxMilliCpu}m). VPA can keep proposing values the cluster will keep rejecting, with no obvious error in kubectl describe pod.`}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
              <NumberField
                label="Replicas"
                value={replicas}
                onChange={setReplicas}
                tooltip="How many copies of this pod are running. Every replica gets the same per-pod recommendation, so this multiplies straight into the total request below."
              />
              <NumberField
                label="Namespace memory quota"
                value={quotaMemoryGi}
                onChange={setQuotaMemoryGi}
                suffix="Gi"
                tooltip="The total memory this namespace is allowed to request across every pod combined, set by a ResourceQuota. Run: kubectl describe resourcequota -n <namespace>"
              />
              <NumberField
                label="Already used by other pods"
                value={usedMemoryMi}
                onChange={setUsedMemoryMi}
                suffix="Mi"
                tooltip="How much of this quota is already consumed by pods that aren't part of this calculation, before your new or resized pods are counted. Check the 'Used' column in: kubectl describe resourcequota -n <namespace>. This is often the missing piece when a deployment fails quota even though a single pod's request looks small."
              />
              <NumberField
                label="LimitRange max per container"
                value={limitRangeMaxMi}
                onChange={setLimitRangeMaxMi}
                suffix="Mi"
                tooltip="The single highest memory value any one container in this namespace is allowed to request or be limited to, set by a LimitRange. Run: kubectl describe limitrange -n <namespace>"
              />
              <NumberField
                label="VPA maxAllowed"
                value={vpaMaxAllowedMi}
                onChange={setVpaMaxAllowedMi}
                suffix="Mi"
                tooltip="A ceiling you set directly on the VPA object itself (resourcePolicy.containerPolicies[].maxAllowed), so VPA never proposes more than this, regardless of what the histogram calculates."
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div>
                Per-pod recommendation: <strong>{perPodValue}Mi</strong> × {replicas} replicas =
                <strong> {newRequestMi}Mi</strong> new request, plus <strong>{usedMemoryMi}Mi</strong> already used
                = <strong>{totalRequestMi}Mi</strong> total (namespace quota is {quotaMi}Mi)
              </div>
              <StatusLine
                ok={fitsQuotaMemory}
                okText={`Fits inside the namespace memory quota, with ${quotaMi - totalRequestMi}Mi to spare.`}
                badText={`Exceeds the namespace memory quota by ${totalRequestMi - quotaMi}Mi once existing usage is counted. Some pods will resize successfully and the rest will stay deferred until quota increases, other usage drops, or replica count drops.`}
              />
              <StatusLine
                ok={fitsLimitRangeMemory}
                okText={`Per-pod value is within the LimitRange max (${limitRangeMaxMi}Mi).`}
                badText={`Per-pod value (${perPodValue}Mi) exceeds the LimitRange max (${limitRangeMaxMi}Mi). The admission controller will reject this patch outright, regardless of quota. This is exactly the situation an OOM bump can trigger if the bump isn't checked against LimitRange.`}
              />
              <StatusLine
                ok={vpaCapsBelowLimitRangeMemory}
                okText={`VPA's own maxAllowed (${vpaMaxAllowedMi}Mi) is at or below the LimitRange max, so VPA will never even propose a value that gets rejected.`}
                badText={`VPA's maxAllowed (${vpaMaxAllowedMi}Mi) is above the LimitRange max (${limitRangeMaxMi}Mi). VPA can keep proposing values the cluster will keep rejecting, with no obvious error in kubectl describe pod.`}
              />
            </div>
          </>
        )}
      </Section>

      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8, borderTop: `1px solid ${PALETTE.gridLight}`, paddingTop: 14 }}>
        Model: weight = 0.5^(age_in_days / half_life). Target percentile found by walking the value-sorted
        histogram until cumulative weight crosses percentile × total weight. This mirrors VPA's real recommender
        logic at a level a person can check by hand; the production implementation uses finer-grained decayed
        histogram buckets rather than raw per-sample weights.
      </div>

      <div
        style={{
          fontSize: 11,
          opacity: 0.5,
          marginTop: 20,
          paddingTop: 14,
          borderTop: `1px solid ${PALETTE.gridLight}`,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Built by{" "}
        <a
          href="https://github.com/prasad-m-k"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: PALETTE.accentTeal, textDecoration: "none" }}
        >
          Prasad MK
        </a>{" "}
        · independent, personal open-source project, not affiliated with or endorsed by any employer ·{" "}
        <a
          href="https://github.com/prasad-m-k/vpa-calc"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: PALETTE.accentTeal, textDecoration: "none" }}
        >
          source on GitHub
        </a>
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
