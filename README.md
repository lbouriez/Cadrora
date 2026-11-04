# Cadrora

**Your photography website and client galleries, on your own account.**

Show your work, present your services and share photos through public or password-protected galleries. Manage your content from your browser, in **English or French**.

[Explore the demo](https://cadrora.com/) · [Install your site](docs/deployment.md) · [Open the installer](setup.ps1)

## Install on Windows

You need a **Windows computer**, a **GitHub account** and a **domain you own**. Have access to your Cloudflare account, or create one when the assistant asks. No programming knowledge is needed for the guided setup.

1. **[Create your fork](https://github.com/lbouriez/Cadrora/fork)** — your own copy of this project on GitHub.
2. **Clone your fork to your computer** using Git or GitHub Desktop. The [installation guide](docs/deployment.md) explains how; downloading a ZIP is not enough.
3. **Open PowerShell in that folder** and run [setup.ps1](setup.ps1):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Language en
```

For French, replace `en` with `fr`.

The assistant installs missing tools, creates your studio profile or lists your existing profiles, and opens the Cloudflare pages with instructions. You do not need to prepare API keys first. It asks for confirmation before publishing your site and setting up automatic updates through GitHub.

**Need to stop?** Run the same command later and use the same installation name to resume. Keep the project folder and its saved installation files.

## What you get

- A website for your portfolio, services and contact details.
- Public, unlisted or password-protected galleries, with optional downloads.
- An administration area to manage your photos and site content.
- Optional face search within a gallery; the visitor's selfie stays in their browser.

Your site runs on **your Cloudflare account**. Hosting and your domain may cost money; see [costs and usage limits](docs/free-tier.md). The demo's sample photos and text should be replaced before sharing your site.

## Useful guides

- [Install your site](docs/deployment.md)
- [Personalize it and prepare to launch](docs/after-deployment.md)
- [Manage galleries and settings](docs/admin-guide.md)
- [Update an existing site](docs/upgrading.md)
- [Features](docs/features.md) · [Privacy](docs/privacy.md)
- [Contribute](CONTRIBUTING.md) · [Technical documentation](docs/technical/README.md)

## License

Cadrora uses the [PolyForm Perimeter License 1.0.1](LICENSE.md). You may fork and customize it for your own photography website and business. The license does not permit competing products or services, such as a hosted gallery platform. The license text governs these permissions and restrictions. See also [third-party notices](THIRD_PARTY_NOTICES.md).
