import { mapToCanvas, mapToContainerLab, mapToVerefoo } from "./utils/mapper";
import { EdgeType, FirewallConfigurationType, FirewallType, NetworkNode, Topology, VerefooNode } from "./utils/types";
import buildClabYaml, { buildCanvasObj, buildVerefooXML, BuildXMLOptions, sanitizeNodeName } from "./utils/topologyTranslator";
import fs from "fs/promises";
import path from "path";
import { runCommand, spawnCommand, toContainerlabPath } from "./utils/platform";
import { Session, SessionData } from "express-session";
import { COOKIE_MAX_AGE } from "./utils/constants";

const VEREFOO_URL = 'http://localhost:8085/verefoo/';
const ALLOWED_COMMANDS = new Set([
  "ping",
  "ip",
  "traceroute",
  "iptables",
  "nmap",
  "nc",
  "tcpdump",
  "INTERRUPT"
]);


export async function runVerefoo(topology: Topology) {
  let xml = buildVerefooXML(mapToVerefoo(topology, 1));

  xml = xml.replace(
  /\bserviceGraph(?=[\s/>])/,
  'serviceGraph="true"'
  );
  xml = xml.replaceAll(
    /\bisSat(?=[\s/>])/g,
    'isSat="true"'
  )
  console.log(xml);
  console.log("\n\n\n")

  let response = await fetch(VEREFOO_URL + `adp/simulations?Algorithm=${topology.selectedAlgorithm ?? "AP"}&REACT=${topology.initialRequirements ? "true" : "false"}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml,
  });

  if (!response.ok) {
    throw new Error(`Verefoo responded with status ${response.status}`);
  }

  const resp = await response.text();
  console.log(resp);
  console.log("\n\n\n")

  const verefooTopology = buildCanvasObj(resp);
  console.log("Verefoo topology")
  console.log(verefooTopology);

  let nfvNodes = [];
  if (verefooTopology.nodes.some((n) => n.functional_type === "FIREWALL")) {
    response = await fetch(VEREFOO_URL + "fwd/nodes/addnfv", {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: resp,
    });

    console.log("NFV NODES")
    nfvNodes = await response.json();
    console.log(nfvNodes);
    console.log("\n\n\n");
  
    if (!response.ok) {
      throw new Error(`Posting NFV responded with status ${response.status}`); 
    }
  }
  
  const ipToId = new Map(topology.nodes.map(n => [n.ip, n.id]));

  let nextId =
  topology.nodes.reduce((max, n) => Math.max(max, n.id), 0) + 1;

  let firewallIndex = 0;

  const restoredNodes = verefooTopology.nodes.map(node => {return {
    ...node,
    firewallId: node.functional_type === "FIREWALL" ? nfvNodes[firewallIndex++].id : undefined,
    id: ipToId.get(node.name) ?? nextId++,
  }});


  console.log("Restored nodes");
  console.log(restoredNodes);

  return mapToCanvas({ ...verefooTopology, nodes: restoredNodes });
}

export function exportTopology(topology: Topology, options: Pick<BuildXMLOptions, "includeNodes" | "includeProperties" | "reactSuitable"> = {}): string {
  let xml = buildVerefooXML(mapToVerefoo(topology, 1), { ...options, includeLayout: true }); 
  xml = xml.replaceAll(
    /\bisSat(?=[\s/>])/g,
    'isSat="true"'
  );
  xml = xml.replaceAll(
    /\breactSuitable(?=[\s/>])/g,
    'reactSuitable="true"'
  );
  return xml;
}

export function importTopology(xml: string): Topology {
  console.log("Import");
  console.dir(buildCanvasObj(xml), {depth: null});
  return mapToCanvas(buildCanvasObj(xml));
}

export async function getFirewallScript(id: number, firewallType: FirewallType) {
  const firewallTypeMap: Record<FirewallType, string> = {
    "fortinet": "getFortinet",
    "ipfw": "getIpfw",
    "iptables": "getIptables",
    "openvswitch": "getOpenVswitch"
  }

  const url = VEREFOO_URL + "/fwd/deploy/" + firewallTypeMap[firewallType] + "/" + String(id);
  const response = await fetch(url); 
  if (!response.ok) {
    throw new Error(`Error getting the ${firewallType} script: ${response.status}`); 
  }

  const res = await response.text();
  return res;
}

async function forceCleanupLab(clabName: string) {
  const { stdout } = await runCommand([
    "docker", "ps", "-a",
    "--filter", `label=containerlab=${clabName}`,
    "--format", "{{.Names}}"
  ]);

  const containerNames = stdout.split("\n").map(s => s.trim()).filter(Boolean);

  if (containerNames.length > 0) {
    console.log("Force-removing orphaned containers:", containerNames);
    await runCommand(["docker", "rm", "-f", ...containerNames]);
  }

  try {
    await runCommand(["containerlab", "destroy", "--name", clabName, "--cleanup"]);
  } catch (err) {
    console.error("containerlab destroy cleanup (non-fatal):", err);
  }
}

export async function deploy(session: Session & Partial<SessionData>, { nodes, edges, firewallConfigurations }: { nodes: NetworkNode[]; edges: EdgeType[]; firewallConfigurations?: FirewallConfigurationType[]; }) {
  const deployNodes = mapToContainerLab({ nodes, edges, firewallConfigurations: firewallConfigurations ?? [] });
  const clabName = session.labName || "";
  const yamlContent = buildClabYaml(deployNodes, clabName);
  console.log(yamlContent);

  const yamlPath = path.join(
    process.cwd(),
    "generated-labs",
    `${clabName}.clab.yml`
  );
  const clabPath = toContainerlabPath(yamlPath);

  await forceCleanupLab(clabName);

  await fs.mkdir(
    path.dirname(yamlPath),
    { recursive: true }
  );
  
  await fs.writeFile(yamlPath, yamlContent);

  console.log(clabPath);

  try {
    const { stdout, stderr } = await runCommand([
        "containerlab",
        "deploy",
        "-t",
        clabPath,
        "--reconfigure"
    ]);

    setTimeout(() => {
      forceCleanupLab(clabName).catch((error) => {
        console.error(`Scheduled cleanup failed for ${clabName}:`, error);
      });
    }, COOKIE_MAX_AGE);

    console.log("Containerlab stdout:", stdout);
    console.error("Containerlab stderr:", stderr);
    return stdout ?? stderr;
  } catch (error) {
    await forceCleanupLab(clabName);
    throw error;
  }
}

export async function stopDeploy(session: Session & Partial<SessionData>) {
  const clabName = session.labName || "";
  await forceCleanupLab(clabName);
}


function validateCommand(command: string, args: string[]) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  if (args.some(arg => /[;&|`$<>]/.test(arg))) {
    throw new Error("Invalid characters in command arguments");
  }
}

export async function executeCommands (session: Session & Partial<SessionData>, name: string, command: string, args: string[]) {
  const clabName = session.labName;
  const containerName = `clab-${clabName}-${sanitizeNodeName(name)}`;
  validateCommand(command, args);
  try {
    const { stdout, stderr } = await runCommand([
          "docker",
          "exec", 
          containerName,
          command,
          ...args
    ]);
    console.log("Containerlab stdout:", stdout);
    console.error("Containerlab stderr:", stderr);
    return stdout ?? stderr;
  } catch (err) { 
    return err;
  }
}

const runningExecs = new Map<string, { child: ReturnType<typeof spawnCommand>; pid: string | null }>();

export function executeCommandStream(session: Session & Partial<SessionData>, name: string, command: string, args: string[], onLine: (line: string, stream: "stdout" | "stderr") => void): Promise<{ code: number | null }> {
  const clabName = session.labName;
  const containerName = `clab-${clabName}-${sanitizeNodeName(name)}`;
  validateCommand(command, args);

  if (command === "INTERRUPT") {
    const running = runningExecs.get(containerName);
    if (running && running.pid) {
      runCommand(["docker", "exec", containerName, "kill", "-INT", running.pid])
        .catch((err) => {
          console.warn(`Failed to interrupt pid ${running.pid} in ${containerName}:`, err);
        });
    } else {
      console.warn(`INTERRUPT requested for ${containerName} but no running exec (or no captured pid yet) was found`);
    }

    return Promise.resolve({ code: null });
  }

  return new Promise((resolve, reject) => {
    const child = spawnCommand([
      "docker",
      "exec",
      "-i",
      containerName,
      "sh",
      "-c",
      'echo $$; exec "$0" "$@"',
      command,
      ...args
    ]);

    const execEntry = { child, pid: null as string | null };
    runningExecs.set(containerName, execEntry);
    console.log(`Spawned exec for container="${containerName}" command=${command} args=${JSON.stringify(args)}`);

    let stdoutBuf = "";
    let stderrBuf = "";
    let pidLineBuf = "";
    let pidCaptured = false;

    const flush = (buf: string, stream: "stdout" | "stderr") => {
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        onLine(buf.slice(0, idx), stream);
        buf = buf.slice(idx + 1);
      }
      return buf;
    };

    child.stdout.on("data", (chunk: Buffer) => {
      let text = chunk.toString();
      if (!pidCaptured) {
        pidLineBuf += text;
        const nlIdx = pidLineBuf.indexOf("\n");
        if (nlIdx < 0) return; // still waiting for the "echo $$" line to complete
        execEntry.pid = pidLineBuf.slice(0, nlIdx).trim();
        text = pidLineBuf.slice(nlIdx + 1);
        pidCaptured = true;
      }
      stdoutBuf = flush(stdoutBuf + text, "stdout");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf = flush(stderrBuf + chunk.toString(), "stderr");
    });

    child.on("error", (err) => {
      if (runningExecs.get(containerName) === execEntry) runningExecs.delete(containerName);
      reject(err);
    });

    child.on("close", (code) => {
      if (runningExecs.get(containerName) === execEntry) runningExecs.delete(containerName);
      if (stdoutBuf) onLine(stdoutBuf, "stdout");
      if (stderrBuf) onLine(stderrBuf, "stderr");
      resolve({ code });
    });
  });
}