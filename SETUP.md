# Playground Setup & Run Guide

This project has three moving parts that all need to be running at once:

1. **`verifoo-0.0.1-SNAPSHOT.jar`**, the VEREFOO engine (Java), listens on `http://localhost:8085/verefoo/`
2. **`backend_verefoo`**, Node/Express API, listens on `http://localhost:3000`
3. **`verefoo_app`**, React/Vite frontend, listens on `http://localhost:5173`

## 0. Prerequisites: Node.js and Docker

**Node.js** (needed for both `backend_verefoo` and `verefoo_app`):
- Download an LTS release from [nodejs.org](https://nodejs.org/) and run the installer for your OS (Windows/macOS installers are point-and-click; Linux users can also install via their package manager or [nvm](https://github.com/nvm-sh/nvm)).
- Verify with:
  ```
  node -v
  npm -v
  ```

**Docker** (needed to run containerlab-deployed topologies):
- Windows/macOS: install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and make sure it's running before you deploy a topology. On Windows, enable the WSL2 backend in Docker Desktop settings so it's reachable from inside WSL.
- Linux: install the [Docker Engine](https://docs.docker.com/engine/install/) for your distro, then make sure the Docker daemon is running (`sudo systemctl start docker`).
- Verify with:
  ```
  docker -v
  ```

**Tested versions:**

| node | npm | docker | java | containerlab |
|---|---|---|---|---|
| v24.14.1 | 11.11.0 | Docker version 28.5.1, build e180ab8 | Java 8 | 0.77.0 


## 1. VEREFOO 

The VEREFOO's jar needs the Z3 native library on the dynamic-link path.

1. Download Z3 **4.8.8** for your OS/architecture from the [Z3 releases page](https://github.com/Z3Prover/z3/releases).
2. Add the folder containing the Z3 native library to your dynamic linking path:
   - Linux: `LD_LIBRARY_PATH`
   - Windows: `PATH`

   Example on Linux:
   ```
   sudo nano /etc/environment
   # add:
   LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/home/VEREFOO/z3/bin/
   ```
3. Run the jar from the repository root:
   ```
   java -jar verifoo-0.0.1-SNAPSHOT.jar
   ```
4. Confirm it's up on `http://localhost:8085/verefoo/` before starting the backend, the backend calls this URL directly and will error out if it's not reachable.

## 2. Containerlab
Needed for the "deploy topology" feature (`/deploy`, `/execute` routes), which builds a `.clab.yml` and shells out to `containerlab deploy` / `docker exec`.

Install with:
```
curl -sL https://containerlab.dev/setup | sudo -E bash -s "all"
```

Requirements:
- Docker must be installed and running.
- **On Windows**: install/run this inside **WSL** (the backend invokes `wsl.exe <command>` for every containerlab/docker call, see `backend_verefoo/src/utils/platform.ts`). Native Windows Docker Desktop alone is not enough unless it's exposed to WSL.
- On Linux this runs natively.

You can skip this step if you only need to build/simulate topologies and don't need the "Deploy" feature.

## 3. Backend (`backend_verefoo`)

```
cd backend_verefoo
npm install
```

Create a `.env` file in `backend_verefoo/` with:
```
SESSION_SECRET=<any random long string>
NODE_ENV=development
```
`SESSION_SECRET` signs the session cookie, generate one yourself (e.g. `openssl rand -hex 32`), don't reuse an example value.

Run it:
```
npm run dev
```
This starts the API on port `3000` and expects the Verefoo jar already running on port `8085`. By default, CORS is configured for the host IP used by the frontend.

### Using a host IP

When the frontend and backend need to be reachable from another machine, set the host's IPv4 address in both endpoint configurations with the helper script from the repository root:

```
./scripts/set-public-ip.sh 192.168.11.88
```

The script validates the address and updates:

- `backend_verefoo/src/utils/constants.ts` for the frontend CORS origin
- `verefoo_app/src/utils/constants.ts` for the backend API URL

Restart the backend and frontend after changing the address.

## 4. Frontend 

```
cd verefoo_app
npm install
npm run dev
```
Opens on `http://localhost:5173` by default.

## Startup order

1. Start the Z3-linked Verefoo jar (port 8085)
2. Start Docker + containerlab (if you'll use Deploy)
3. Start the backend (port 3000)
4. Start the frontend (port 5173)

## Using the application

- Add nodes from the left panel and connect them on the canvas.
- Drag an empty area of the canvas with the left mouse button to pan the graph.  Hold `Shift` while dragging to select nodes with a rectangle. Arrow keys and Space + drag are also supported for panning.
- Use the requirements panel to define the network security requirements.
- After deploying a topology, double-click a deployed node or use `Open terminal` in the node properties panel to open its terminal directly. The `Terminals` menu in the navbar remains available as a fallback.
- Click the notification bell to open the notification list. Notifications can be cleared, and the list can be closed with its close button.

## Testing deployed connectivity

Open a terminal for the target deployed node, then use `nc` to test TCP or UDP
connectivity between nodes. Start the server on one node before starting the
client on another node. Replace `<port>` and `<ip>` with the listening port and
the destination node's IP address.

TCP server:

```bash
nc -l <port>
```

TCP client:

```bash
nc -v [-p <port>] <ip> <port>
```

UDP server:

```bash
nc -u -l <port>
```

UDP client:

```bash
nc -vu [-p <port>] <ip> <port>
```

On systems where `nc` requires the port option to precede the host, use the
equivalent form supported by that image, for example `nc -v -p <local-port>
<ip> <port>`. To inspect packet-filtering rules on a node, run:

```bash
iptables -L -n -v
```