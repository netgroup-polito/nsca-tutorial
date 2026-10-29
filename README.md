# Tutorial on Network Security Configuration Automation

This repository contains the code and content used for the [NFV-SDN Tutorial: "Automating Network Security Configuration: NFV-SDN Foundations, Challenges, and Hands-on Experience"](https://nfvsdn2026.ieee-nfvsdn.org/t2-automating-network-security-configuration-nfvsdn-foundations-challenges-and-hands-experience).

It includes:
- The code to run the network topology playground for VEREFOO.
- Setup and usage documentation.
- The tutorial presentation.
- The tutorial references.

The playground provides a web interface for designing network topologies and defining requirements and constraints, which are then used as inputs for Verefoo. It produces an optimal allocation schema and configuration for distributed firewalls that can optionally be deployed in real containers with containerlab.

## Architecture

The project has three runtime components:

- `verifoo-0.0.1-SNAPSHOT.jar`: the Verefoo executable.
- `backend_verefoo`: the backend connecting frontend to Verefoo and manages containerlab.
- `verefoo_app`: the frontend for editing and running topologies.

## Getting Started

See [SETUP.md](SETUP.md) for prerequisites, installation, configuration, and startup order. The short version is:

```bash
# Terminal 1: Verefoo engine
java -jar verifoo-0.0.1-SNAPSHOT.jar

# Terminal 2: backend
cd backend_verefoo
npm install
npm run dev

# Terminal 3: frontend
cd verefoo_app
npm install
npm run dev
```

The frontend is then available at `http://localhost:5173`. The backend listens on port `3000` and the Verefoo engine on port `8085`.

## Main Workflows

1. Add network nodes and connect them on the canvas.
2. Define the topology's requirements and constraints, then run Verefoo to automatically configure it. 
3. Deploy a valid topology when container-based execution is needed and interact with it. Terminals are opened either via double-click on icons or through the contextual menu.
4. Test effective connectivity with several allowed commands; see [SETUP.md](SETUP.md#testing-deployed-connectivity) for more details.

## Configuration

When the frontend and backend are accessed from another machine, update both endpoint addresses with:

```bash
./scripts/set-public-ip.sh <host-ip>
```

## Acknowledgment

This project has received funding from the European Union’s Horizon Europe Research and Innovation Programme under grant agreement No. 101168144 (MIRANDA). The views and opinions expressed are those of the authors only and do not necessarily reflect those of the European Union or the European Cybersecurity Competence Centre. Neither the European Union nor the granting authority can be held responsible.
