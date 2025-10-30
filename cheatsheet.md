# 🌊 Ocean Protocol VS Code Extension — User Cheatsheet

Run **Compute-to-Data jobs** directly from VS Code.

---

## ✅ Requirements

- VS Code **v1.96.0 or higher**

---

## 📦 Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OceanProtocol.ocean-protocol-vscode-extension).
2. Open the **Ocean Protocol** panel (left Activity Bar).

---

## ▶️ Run your first compute job

1. Create a **new project folder**.
2. Pick a **parent directory** for your project. This is where your algo and compute results will be saved.
3. Find a name for your new project. Default is `new-compute-job`.
4. Pick your favorite language for your algorithm. At the moment, we support **Python** and **JavaScript**.
5. Explore your newly created project. It will have a `Dockerfile`, dependencies file and an algorithm.
6. Run your first compute job by clicking **Start FREE Compute Job**.
7. Watch logs & job status in the **Output console**.
8. When finished, results and logs will be saved in your project folder under the `results` folder.

---

## ⚡ Tips

- **Free compute** uses an environment with minimal resources.
- Resources are displayed under the **Setup** dropdown.
- Whenever you want to get more resources, you can upgrade to a paid compute job.
- Go to **Configure Compute** to change your compute settings.
- Logs & errors show up in the **Output console**.
- If no dockerfile is provided, you can use your own docker image and tag.

---

## 🛠️ Troubleshooting

- ❌ Job cannot start → check node status. (Under the **Setup** dropdown, press the **Check** button)
- ❌ Job not running → check peer ID.
- ❌ Not enough funds → use **Configure Compute** to change your compute settings.
- Always check **extension logs** in Output. Logs are also saved in your project folder under the `logs` folder.

---

## 📦 Advanced Setup

- Custom Docker image/tag. Only if no dockerfile is provided in your project folder.
- Auth Token. This is auto-generated once you configure your compute settings.

---

## 🔄 Workflow Summary

| Step | Action                                                       |
| ---- | ------------------------------------------------------------ |
| 1    | Create a new project folder / Select existing project folder |
| 2    | Click **Start Compute Job**                                  |
| 3    | Monitor logs & job status                                    |
| 4    | Check results in your project folder                         |

---

## 📚 Resources

- [Ocean Protocol Docs](https://docs.oceanprotocol.com/developers/vscode)
- [GitHub Repo](https://github.com/oceanprotocol/vscode-extension)
