import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from "express-session";
import "dotenv/config";
import { runVerefoo, exportTopology, importTopology, getFirewallScript, deploy, executeCommands, executeCommandStream, stopDeploy } from './contoller';
import { FirewallType, Topology } from './utils/types';
import { randomBytes } from 'node:crypto';
import { validateAction, validateIp, validateName, validatePort, validateProtocol, validateType } from './utils/validators';
import rateLimit from 'express-rate-limit';
import { DEPLOY_MS_LIMIT, DEPLOY_REQ_LIMIT, PORT, FRONTEND_ORIGIN, COOKIE_MAX_AGE } from './utils/constants';

const app = express();

const deployLimiter = rateLimit({
    windowMs: DEPLOY_MS_LIMIT,
    limit: DEPLOY_REQ_LIMIT,

    handler: (req, res) => {
        res.status(429).json({
            error: "Too many deployment requests. Please try again later."
        });
    }
});

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));
app.use(express.json());

app.use(
  session({
    name: "verefoo_session",
    secret: process.env.SESSION_SECRET!,
    genid: () => {
      return randomBytes(32).toString("hex");
    },
    resave: false,
    saveUninitialized: false,
    
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    }
  })
);

app.get('/', (req, res) => {
  res.send('Backend Verefoo API runninggg');
});

const validateNodes = (req: Request, res: Response, next: NextFunction) => {
  const { nodes, edges } = req.body;
  if (!nodes) {
    res.status(400).json({ error: "The request must contain nodes" });
    return;
  }

  const namesMap = new Map<string, number>();
  const ipsMap = new Map<string, number>();

  for (let node of nodes) {
    if (!validateIp(node.ip) || !validateName(node.name) || !validateType(node.type)) {
      res.status(400).json({ error: "Invalid nodes" });
      return;
    }

    if (namesMap.get(node.name.trim().toLowerCase())) {
      res.status(400).json({ error: "Invalid nodes" });
      return;
    } else {
      namesMap.set(node.name.trim().toLowerCase(), 1);
    }

    if (ipsMap.get(node.ip.trim().toLowerCase())) {
      res.status(400).json({ error: "Invalid nodes" });
      return;
    } else {
      ipsMap.set(node.ip.trim().toLowerCase(), 1);
    }
  }

  if (!edges) {
    res.status(400).json({ error: "The request must contain edges" });
    return;
  }

  for (const edge of edges) {
    let fromExists = false;
    let toExists = false;

    for (const node of nodes) {
      if (node.id === edge.nodeFrom) fromExists = true;
      if (node.id === edge.nodeTo) toExists = true;
    }

    if (!fromExists || !toExists) return res.status(400).json({ error: "Invalid edge" });
  }

  next();
}

const validateRequirements = (req: Request, res: Response, next: NextFunction) => {
  const { requirements } = req.body;

  if (!requirements) {
    res.status(400).json({ error: "The request must contain requirements"});
    return;
  }

  for (let requirement of requirements) {
  if (!validateIp(requirement.sourceIP) || !validateIp(requirement.destIP) || !validatePort(requirement.sourcePort) || !validatePort(requirement.destPort) || !validateAction(requirement.action) || !validateProtocol(requirement.protocol)) {
      res.status(400).json({ error: "Invalid requirements"});
      return;
    }
  }

  next();
}

app.post('/run', validateNodes, validateRequirements, async (req, res) => {
  try {
    const { nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, initialRequirements, selectedAlgorithm } = req.body;
    const result = await runVerefoo({ nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, initialRequirements, selectedAlgorithm } as Topology);
    res.set('Content-Type', 'application/xml').send(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Failed to run Verefoo simulation' });
  }
});

app.post('/export', validateNodes, async (req, res) => {
  try {
    const { nodes, edges, requirements, allocationConstraints, linkConstraints, includeNodes, includeProperties, reactOption, firewallConfigurations } = req.body;
    const xml = exportTopology(
      { nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations } as Topology,
      { includeNodes, includeProperties, reactSuitable: reactOption }
    );
    res.set('Content-Type', 'application/xml').send(xml);
    console.log(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export topology' });
  }
});

app.post('/import', express.text({ type: () => true, limit: '10mb' }), (req, res) => {
  try {
    const topology = importTopology(req.body as string);
    res.json(topology);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to import topology' });
  }
});

app.get("/fwd/config/:firewalltype", async (req, res) => {
  const firewalltype = req.params.firewalltype as FirewallType;
  const id = Number(req.query.id);
  
  if (Number.isNaN(id)) {
    return res.status(400).json({error: "Firewall ID is not valid"});
  } 

  try {
    const script = await getFirewallScript(id, firewalltype);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${firewalltype}-${id}.sh"`
    );
    res.setHeader("Content-Type", "text/plain");
    res.send(script);
  } catch (error) {
    res.status(500).json({error: error});
  }
});

app.post("/deploy", deployLimiter, validateNodes, async (req, res) => {
  const {nodes, edges, firewallConfigurations} = req.body;
  req.session.nodes = nodes;
  if (!req.session.labName) {
    req.session.labName = `verefoo-lab-${req.session.id}`; 
  } 
  try {  
    console.log(await deploy(req.session, {nodes, edges, firewallConfigurations}));
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});

app.delete("/deploy", async (req, res) => {
  if(!req.session.nodes || !req.session.labName) {
    res.sendStatus(204);
    return;
  }
  try {
    await stopDeploy(req.session);
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: err.message });
      }
      res.clearCookie("verefoo_session");
      return res.sendStatus(200);
    });
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});

const requireSession = (req: Request, res: Response, next: NextFunction) => {
  if(!req.session.labName){
    res.status(401).json({error: "You are not authorized to execute the command"});
    return;
  }
  next();
}

app.post("/execute", requireSession, async (req, res) => {
  try {
    const { node, command, args } = req.body;
    if (!req.session.nodes?.find(n => n.name === node)) {res.status(401).json({error: "The node has not been deployed"}); return;}
    const result = await executeCommands(req.session, node, command, args);
    res.status(200).json({result})
  } catch (err: any) {
    console.error("execute error:", err);
    const error = (err?.stderr || err?.stdout || err?.message || String(err))?.toString().trim();
    res.status(500).json({
      error: error,
      stdout: err?.stdout,
      stderr: err?.stderr,
      code: err?.code,
    });
  }  
});

app.post("/execute-stream", requireSession, async (req, res) => {
  const { node, command, args } = req.body;

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  (res as any).flushHeaders?.();

  try {
    if (!req.session.nodes?.find(n => n.name === node)) {res.status(401).json({error: "The node has not been deployed"}); return;}
    const { code } = await executeCommandStream(req.session, node, command, args, (line, stream) => {
      res.write(JSON.stringify({ type: stream, text: line }) + "\n");
    });
    res.write(JSON.stringify({ type: "done", code }) + "\n");
  } catch (err: any) {
    console.error("execute-stream error:", err);
    const error = (err?.stderr || err?.message || String(err))?.toString().trim();
    res.write(JSON.stringify({ type: "error", text: error }) + "\n");
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
