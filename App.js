import { useEffect, useRef, useState, useMemo, useCallback } from "react";

/* ===== BUTTON STYLES ===== */
const btnBase = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  cursor: "pointer"
};
const btnPrimary = { ...btnBase, background: "#2563eb", color: "white" };
const btnSecondary = { ...btnBase, background: "#e5e7eb", color: "#020617" };

/* ===== PARSERS ===== */
const parseMem = v => {
  if (!v) return 0;
  if (v.endsWith("Mi")) return parseInt(v);
  if (v.endsWith("Gi")) return parseInt(v) * 1024;
  return parseInt(v);
};

const parseCpu = v => {
  if (!v) return 0;
  if (v.endsWith("m")) return parseInt(v);
  return parseInt(v) * 1000;
};

/* ===== UI ===== */
const Bar = ({ percent, color }) => (
  <div style={{ height: 10, background: "#e5e7eb", borderRadius: 6 }}>
    <div
      style={{
        height: "100%",
        width: `${Math.min(percent, 100)}%`,
        background: color,
        borderRadius: 6,
        transition: "width .2s linear"
      }}
    />
  </div>
);

const statusColor = p =>
  p > 85 ? "#dc2626" : p > 65 ? "#f59e0b" : "#16a34a";

const replicaColor = (available, desired) => {
  if (available === desired) return "#16a34a";
  if (available === 0) return "#dc2626";
  return "#f59e0b";
};

const podHealth = pod => {
  const phase = pod.status?.phase || "Unknown";
  const restarts =
    pod.status?.containerStatuses?.reduce(
      (a, c) => a + (c.restartCount || 0),
      0
    ) || 0;

  if (phase !== "Running") return { label: phase, color: "#dc2626" };
  if (restarts > 0) return { label: "Restarting", color: "#f59e0b" };
  return { label: "Healthy", color: "#16a34a" };
};

const API = "http://127.0.0.1:3001";

function App() {
  const [connected, setConnected] = useState(false);
  const [namespaces, setNamespaces] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  const [deployments, setDeployments] = useState(null);
  const [deploymentDetails, setDeploymentDetails] = useState({});
  const [podUsage, setPodUsage] = useState(null);

  const [expandedDeployment, setExpandedDeployment] = useState(null);
  const [podsByDeployment, setPodsByDeployment] = useState({});

  // ✅ MISSING STATE (FIX)
  const [lastUpdated, setLastUpdated] = useState(null);

  const pollRef = useRef(null);

  /* ===== CONNECT ===== */
  useEffect(() => {
    if (!connected) return;
    fetch(`${API}/api/namespaces`)
      .then(r => r.json())
      .then(setNamespaces);
  }, [connected]);

  /* ===== LOAD + POLLING ===== */
  useEffect(() => {
    if (!selectedProject) return;

    const loadStatic = async () => {
      const depRes = await fetch(
        `${API}/api/projects/${selectedProject}/deployments`
      );
      const depData = await depRes.json();
      setDeployments(depData);

      const details = {};
      await Promise.all(
        depData.items.map(async d => {
          const r = await fetch(
            `${API}/api/projects/${selectedProject}/deployments/${d.metadata.name}`
          );
          details[d.metadata.name] = await r.json();
        })
      );
      setDeploymentDetails(details);
    };

    const loadUsage = async () => {
      const r = await fetch(
        `${API}/api/projects/${selectedProject}/pods-usage`
      );
      setPodUsage(await r.json());
      setLastUpdated(new Date());
    };

    loadStatic();
    loadUsage();
    pollRef.current = setInterval(loadUsage, 5000);

    return () => clearInterval(pollRef.current);
  }, [selectedProject]);

  /* ===== INDEX POD USAGE ===== */
  const podUsageByDeployment = useMemo(() => {
    const map = {};
    podUsage?.forEach(p => {
      const base = p.name.split("-").slice(0, -2).join("-");
      map[base] ??= [];
      map[base].push(p);
    });
    return map;
  }, [podUsage]);

  /* ===== PRECOMPUTE STATS ===== */
  const statsByDeployment = useMemo(() => {
    const stats = {};

    deployments?.items?.forEach(d => {
      const pods = podUsageByDeployment[d.metadata.name] || [];

      const cpuUsed = pods.reduce((a, p) => a + parseCpu(p.cpu), 0);
      const memUsed = pods.reduce((a, p) => a + parseMem(p.memory), 0);

      const details = deploymentDetails[d.metadata.name];
      const cpuLimit =
        details?.containers?.reduce(
          (a, c) => a + parseCpu(c.resources?.limits?.cpu),
          0
        ) || 0;

      const memLimit =
        details?.containers?.reduce(
          (a, c) => a + parseMem(c.resources?.limits?.memory),
          0
        ) || 0;

      stats[d.metadata.name] = {
        cpuUsed,
        memUsed,
        cpuLimit,
        memLimit,
        cpuPct: cpuLimit ? (cpuUsed / cpuLimit) * 100 : 0,
        memPct: memLimit ? (memUsed / memLimit) * 100 : 0
      };
    });

    return stats;
  }, [deployments, podUsageByDeployment, deploymentDetails]);

  /* ===== HANDLERS ===== */
  const toggleDeployment = useCallback(
    async name => {
      setExpandedDeployment(p => (p === name ? null : name));

      if (!podsByDeployment[name]) {
        const r = await fetch(
          `${API}/api/projects/${selectedProject}/deployments/${name}/pods`
        );
        const j = await r.json();
        setPodsByDeployment(p => ({ ...p, [name]: j.items || [] }));
      }
    },
    [podsByDeployment, selectedProject]
  );

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 280, background: "#020617", color: "#e5e7eb", padding: 16 }}>
        <h3>OpenShift Explorer</h3>
        <button style={{ ...btnPrimary, width: "100%" }} onClick={() => setConnected(true)}>
          Connect
        </button>

        {namespaces?.items?.map(ns => (
          <div
            key={ns.metadata.name}
            onClick={() => setSelectedProject(ns.metadata.name)}
            style={{
              padding: 8,
              marginTop: 6,
              cursor: "pointer",
              borderRadius: 6,
              background:
                selectedProject === ns.metadata.name ? "#1e293b" : "transparent"
            }}
          >
            {ns.metadata.name}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 24 }}>
        {lastUpdated && (
          <div style={{ marginBottom: 12, color: "#64748b", fontSize: 14 }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {deployments?.items?.map(d => {
          const stats = statsByDeployment[d.metadata.name];
          if (!stats) return null;

          const desired = d.spec?.replicas ?? 0;
          const available = d.status?.availableReplicas ?? 0;

          return (
            <div key={d.metadata.name} style={{ background: "white", padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{d.metadata.name}</strong>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: replicaColor(available, desired), fontWeight: 600 }}>
                    Replicas: {available}/{desired}
                  </span>
                  <button style={btnSecondary} onClick={() => toggleDeployment(d.metadata.name)}>
                    {expandedDeployment === d.metadata.name ? "Close" : "Details"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div>
                  CPU: {stats.cpuUsed}m{stats.cpuLimit ? ` / ${stats.cpuLimit}m` : ""}
                  <Bar percent={stats.cpuPct} color="#2563eb" />
                </div>

                <div style={{ marginTop: 6 }}>
                  RAM: {stats.memUsed}Mi
                  {stats.memLimit ? ` / ${stats.memLimit}Mi` : " (Unlimited)"}
                  <Bar percent={stats.memPct} color={statusColor(stats.memPct)} />
                </div>
              </div>

              {expandedDeployment === d.metadata.name && (
                <div style={{ marginTop: 16 }}>
                  <h4>Pods</h4>
                  {podsByDeployment[d.metadata.name]?.map(pod => {
                    const health = podHealth(pod);
                    return (
                      <div key={pod.metadata.name} style={{ padding: 8 }}>
                        <strong>{pod.metadata.name}</strong>
                        <span style={{ marginLeft: 8, color: health.color }}>
                          {health.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

export default App;
