# Ocean Orchestrator — User Cheatsheet

Run affordable GPU AI jobs from your editor with a one-click workflow and pay-per-use mechanism.

---

## Requirements

- VS Code **v1.96.0 or higher** (also works in Cursor, Antigravity, and Windsurf)

---

## Installation

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OceanProtocol.ocean-protocol-vscode-extension) or [Open VSX](https://open-vsx.org/).
2. Open the **Ocean Orchestrator** panel from the activity bar.

---

## Run Your First Compute Job

1. Create a **new project folder**.
2. Pick a **parent directory** for your project.
3. Name your project (default: `new-compute-job`).
4. Select your language: **Python**, **JavaScript**, or your **custom container**.
5. Explore your project: `Dockerfile`, dependencies file, algorithm, and `.env` secrets file.
6. Click **Start FREE Compute Job**.
7. Watch logs and job status in the **Output console**.
8. Results and logs are saved in your project's `results` folder when the job completes.

---

## Tips

- **Free compute** uses minimal resources for quick tests.
- Available resource tiers are listed under **Setup**.
- Switch to **paid compute** when you need more resources.
- Go to **Configure Compute** to adjust your settings.
- Logs and errors show up in the **Output console**.
- If no Dockerfile is provided, you can use your own docker image.

---

## Troubleshooting

- **Job cannot start** — Check node status under **Setup**, then press **Check**.
- **Not enough funds** — Switch to free compute or top up your account.
- **General issues** — Check logs in the Output console. Logs are also saved in your project folder under `logs`.

---

## Advanced Setup

- **Custom Docker Image** — Use your own image if no Dockerfile is provided in your project folder.
- **Compute Resources** — Free compute uses minimal resources. See available tiers under Setup.
- **Paid Compute** — Paid jobs charge per run based on resources, time, and environment.
- **Node Status Check** — Use **Check** under Setup to verify node availability before running a job.

---

## Workflow Summary

| Step | Action                                         |
| ---- | ---------------------------------------------- |
| 1    | Create or select a project folder              |
| 2    | Review algorithm, Dockerfile, and dependencies |
| 3    | Click **Start Compute Job**                    |
| 4    | Monitor logs and job status                    |
| 5    | Check results and logs in your project folder  |

---

## Resources

- [Ocean Protocol Docs](https://docs.oceanprotocol.com/developers/vscode)
- [GitHub Repo](https://github.com/oceanprotocol/ocean-orchestrator)
