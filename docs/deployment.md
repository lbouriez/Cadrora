# Install your photography website

The Windows assistant guides you from your own copy of Cadrora to a website on your domain. It explains each step and saves your progress.

**[View the installation script: setup.ps1](../setup.ps1)** · [Back to the README](../README.md)

## Before you start

- A **Windows computer** with internet access and permission to install software.
- A **[GitHub account](https://github.com/signup)** for your copy of the project.
- A **domain you own**, and access to the account where you bought it. Choose an unused website address, such as `photos.your-domain.com`.
- Access to **[Cloudflare](https://dash.cloudflare.com/)**, which hosts the website. You can create an account during setup.

You do **not** need to install Node.js or Wrangler, create API keys or configure photo storage beforehand. The assistant handles the tools and guides the account steps. Cloudflare may request billing details when activating storage; review its terms before accepting. [About costs](free-tier.md).

## 1. Create your own copy

Open **[Create a fork](https://github.com/lbouriez/Cadrora/fork)**, select your GitHub account as the owner, keep the name `Cadrora`, then click **Create fork**.

Your copy should appear at `github.com/YOUR-USERNAME/Cadrora`. Use this copy for your site.

## 2. Get the files onto your computer

The easiest option if you do not already use Git:

1. Install **[GitHub Desktop](https://desktop.github.com/)** and sign in.
2. Choose **File → Clone repository**, select **your** Cadrora fork, then click **Clone**. Note the folder where it saves the files.

This creates a local copy that stays connected to your GitHub account. **Download ZIP** or downloading only `setup.ps1` will not work for this installation. [GitHub's cloning guide](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop).

Already use Git? Clone your fork as usual and open its folder.

## 3. Run the assistant

Open the cloned folder in **File Explorer**. Click the address bar, type `powershell`, then press **Enter**. In the window that opens, paste:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Language en
```

For French, use the same command with **`-Language fr`**. These are the two supported languages.

Follow the instructions in the window. The assistant will:

- Install missing tools and help you sign in to GitHub.
- Create your profile from the **Studio** template, or let you choose an existing personal profile. A profile is the folder containing your site's design and starting content.
- Open the relevant Cloudflare pages and explain how to connect your domain, enable storage and create the required keys.
- Show a summary and ask before publishing. **Enter approves publication; STOP saves your progress for later.**
- Configure automatic publication from your fork, check the website and guide your first administrator sign-in.

Connecting a new domain can take time. If Cloudflare is still waiting for activation, stop and resume later. You complete browser sign-ins and account approvals yourself.

## 4. Make it yours

The assistant gives you the website address and the location of your administrator password:

```text
.artifacts/instances/<your-installation-name>/admin-credentials.env
```

Sign in at **`https://your-website-address/admin/login`**, then add your photos, name, services and contact details. Follow the short [launch checklist](after-deployment.md) before sharing the site.

Changes made in the administration area are saved directly. Changes to your profile or code publish automatically when you commit and push them to the configured GitHub branch. [Updating your site](upgrading.md).

## Stopped or something went wrong?

Run the **same command**, from the **same folder**, and enter the **same installation name**. The assistant checks what is already done before continuing. Keep `.artifacts/instances/`: it contains your progress and private installation files. Do not share or commit that folder.

If it cannot continue, follow the displayed message and note the log-file location. The [installer reference](guided-windows-setup.md) covers recovery and account restrictions.

For macOS/Linux, manual deployment, local previews or the maintained Atelier Giulia installation, use the [advanced reference](deployment-advanced.md).
