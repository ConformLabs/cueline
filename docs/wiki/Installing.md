# Installing

Download the installer for your computer from [conformlabs.co/cueline](https://conformlabs.co/cueline/) or [the latest release](https://github.com/ConformLabs/cueline/releases/latest).

| Computer | File |
|---|---|
| Mac (Apple silicon or Intel), macOS 12+ | `Cueline-<version>.pkg` |
| Windows 10/11, 64-bit | `Cueline-Setup-<version>.exe` |

Both install for your user only. No administrator password or admin rights.

## Mac

1. Double-click `Cueline-<version>.pkg` and click through the installer.
2. Restart Premiere Pro if it is open.
3. **Window › Extensions › Cueline Captions**.

The package is signed and notarized by Apple. It installs the panel to
`~/Library/Application Support/Adobe/CEP/extensions/com.conformlabs.cueline`.

## Windows

1. Double-click `Cueline-Setup-<version>.exe` and click through Setup.
2. Restart Premiere Pro if it is open (Setup tells you when it is).
3. **Window › Extensions › Cueline Captions**.

Setup is signed. It installs the panel to `%APPDATA%\Adobe\CEP\extensions\com.conformlabs.cueline` and adds
Cueline to **Settings › Apps**, where you can uninstall it. Running Setup again offers **Update** or **Uninstall**.

## Speech models

Both installers can download the speech models while they install, so the panel is ready the first time:

- **Mac:** on **Installation Type**, tick the models you want.
- **Windows:** on **Choose speech models**.

**ivrit.ai large-v3-turbo** (Hebrew, 1.6 GB) and the **speaker and silence models** (35 MB) are ticked. A model
already on your computer is not downloaded again. A download that fails doesn't stop the install; get it later in the
panel's **Models**. See [Models and languages](Models-and-languages) for what each one is for.

Models are kept in Cueline's data folder ([Settings and files](Settings-and-files)), so updating Cueline never
downloads them again.

For a silent Windows install: `Cueline-Setup-<version>.exe /S` downloads the ticked ones; `/MODELS=ivrit-turbo,turbo,helpers`
picks others (ids: `ivrit-turbo`, `turbo`, `ivrit-large`, `large`, `small`, `helpers`); `/MODELS=none` downloads none.

## Uninstalling

- **Mac:** delete `~/Library/Application Support/Adobe/CEP/extensions/com.conformlabs.cueline`. The models and
  history are in `~/Library/Application Support/Cueline`; delete that too to remove everything.
- **Windows:** **Settings › Apps › Cueline › Uninstall**. Tick **Also remove the speech models, settings and history**
  to remove everything.
