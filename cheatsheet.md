# 🌊 Ocean Protocol VS Code Extension — User Cheatsheet

Run **Compute-to-Data jobs** directly from VS Code.

---

## ✅ Requirements

- VS Code **v1.96.0 or higher**
- Algorithm file open (`.py` or `.js`)

---

## 📦 Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/).
2. Open the **Ocean Protocol** panel (left Activity Bar).
3. Configure settings:
   - **Node URL** (default provided)
   - **Algorithm file** (mandatory provided)
   - **Results folder** (mandatory provided)
   - (Optional) Custom Docker image/tag
   - (Optional) Dockerfile

---

## ▶️ Running a Compute Job

1. Open an **algorithm file** (`.js` or `.py`).
2. (Optional) Select:
   - Dataset file
3. Select **Results folder**
4. In the **Ocean panel**, click **Start Compute Job**.
5. Watch logs & job status in the **Output panel**.
6. When finished, results file opens automatically in VS Code.

---

## ⚡ Tips

- **Free compute credits** available for dev/testing.
- Switch settings anytime in the **Ocean panel**.
- Logs & errors show up in the **Output** or **Terminal**.
- Supports both **Python** and **JavaScript** algorithms.
- The extension allows to import **Dockerfiles**, instead typing docker image and docker tag.

---

## 🛠️ Troubleshooting

- ❌ Job not running → check Node URL.
- ❌ Compute environment fails → adjust Node URL.
- Always check **extension logs** in Output.

---

## 🔄 Workflow Summary

| Step | Action                                                        |
| ---- | ------------------------------------------------------------- |
| 1    | Open algorithm file (`.py` or `.js`)                          |
| 2    | Configure node, wallet, dataset, output folder in Ocean panel |
| 3    | Click **Start Compute Job**                                   |
| 4    | Monitor logs & job status                                     |
| 5    | Results open automatically in VS Code                         |

---

## 📚 Resources

- [Ocean Protocol Docs](https://docs.oceanprotocol.com/developers/vscode)
- [Ocean Blog – Free Compute-to-Data](https://blog.oceanprotocol.com/free-compute-to-data-with-ocean-nodes-vscode-extension-1f8385cb077c)
- [GitHub Repo](https://github.com/oceanprotocol/vscode-extension)
