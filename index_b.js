const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

/* ===== BODY PARSER ===== */
app.use(express.json());

/* ===== CORS (BROWSER-SAFE) ===== */
app.use(
  cors({
    origin: true,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* ===== SAFE EXEC HELPER ===== */
const execJson = (cmd, res) => {
  exec(cmd, { shell: true, timeout: 8000 }, (err, stdout, stderr) => {
    if (err) {
      console.error("CMD ERROR:", stderr || err.message);
      return res.status(500).json({
        error: "oc command failed",
        details: stderr || err.message
      });
    }

    try {
      const parsed = JSON.parse(stdout);
      res.json(parsed);
    } catch (e) {
      console.error("JSON PARSE ERROR:", stdout);
      res.status(500).json({ error: "Invalid JSON from oc" });
    }
  });
};

/* ===== BASIC HEALTH (NO oc) ===== */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ===== oc HEALTH (OPTIONAL) ===== */
app.get("/api/health", (req, res) => {
  exec("oc whoami", { timeout: 5000 }, err => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

/* ===== NAMESPACES ===== */
app.get("/api/namespaces", (req, res) => {
  execJson("oc get projects -o json", res);
});

/* ===== DEPLOYMENTS ===== */
app.get("/api/projects/:project/deployments", (req, res) => {
  execJson(
    `oc get deployments -n ${req.params.project} -o json`,
    res
  );
});

/* ===== DEPLOYMENT DETAILS ===== */
app.get("/api/projects/:project/deployments/:deployment", (req, res) => {
  const { project, deployment } = req.params;

  exec(
    `oc get deployment ${deployment} -n ${project} -o json`,
    { shell: true, timeout: 8000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return res.status(500).json({ error: "deployment fetch failed" });
      }

      try {
        const dep = JSON.parse(stdout);

        res.json({
          containers: dep.spec.template.spec.containers.map(c => ({
            name: c.name,
            resources: c.resources || {}
          })),
          updateStrategy: dep.spec.strategy || { type: "RollingUpdate" }
        });
      } catch {
        res.status(500).json({ error: "Invalid deployment JSON" });
      }
    }
  );
});

/* ===== PODS BY DEPLOYMENT ===== */
app.get("/api/projects/:project/deployments/:deployment/pods", (req, res) => {
  const { project, deployment } = req.params;

  exec(
    `oc get deployment ${deployment} -n ${project} -o json`,
    { shell: true, timeout: 8000 },
    (err, stdout) => {
      if (err) {
        return res.status(500).json({ error: "deployment not found" });
      }

      try {
        const dep = JSON.parse(stdout);
        const selector = Object.entries(dep.spec.selector.matchLabels || {})
          .map(([k, v]) => `${k}=${v}`)
          .join(",");

        execJson(
          `oc get pods -n ${project} -l ${selector} -o json`,
          res
        );
      } catch {
        res.status(500).json({ error: "Invalid selector JSON" });
      }
    }
  );
});

/* ===== POD USAGE ===== */
app.get("/api/projects/:project/pods-usage", (req, res) => {
  const { project } = req.params;

  exec(
    `oc adm top pods -n ${project} --no-headers`,
    { shell: true, timeout: 8000 },
    (err, stdout) => {
      if (err) {
        console.warn("oc adm top failed");
        return res.json([]);
      }

      const usage = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(line => {
          const [name, cpu, memory] = line.split(/\s+/);
          return { name, cpu, memory };
        });

      res.json(usage);
    }
  );
});

/* ===== POD LOGS ===== */
app.get("/api/projects/:project/pods/:pod/logs", (req, res) => {
  const { project, pod } = req.params;

  exec(
    `oc logs ${pod} -n ${project} --tail=100`,
    { shell: true, timeout: 8000 },
    (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: stderr });
      res.json({ logs: stdout });
    }
  );
});

/* ===== UPDATE STRATEGY ===== */
app.patch("/api/projects/:project/deployments/:deployment/strategy", (req, res) => {
  const { project, deployment } = req.params;
  const { type, maxSurge, maxUnavailable } = req.body;

  const patch =
    type === "Recreate"
      ? { spec: { strategy: { type: "Recreate" } } }
      : {
          spec: {
            strategy: {
              type: "RollingUpdate",
              rollingUpdate: { maxSurge, maxUnavailable }
            }
          }
        };

  const tmp = path.join(__dirname, `patch-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(patch, null, 2));

  exec(
    `oc patch deployment ${deployment} -n ${project} --type=merge --patch-file "${tmp}"`,
    { shell: true, timeout: 8000 },
    err => {
      fs.unlinkSync(tmp);
      if (err) return res.status(500).json({ error: "patch failed" });
      res.json({ status: "ok" });
    }
  );
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
