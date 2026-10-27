# Settings and files

| What | Mac | Windows |
|---|---|---|
| The panel | `~/Library/Application Support/Adobe/CEP/extensions/com.conformlabs.cueline` | `%APPDATA%\Adobe\CEP\extensions\com.conformlabs.cueline` |
| Models | `~/Library/Application Support/Cueline/models` | `%APPDATA%\Cueline\models` |
| History | `~/Library/Application Support/Cueline/history` | `%APPDATA%\Cueline\history` |
| Last update check | `~/Library/Application Support/Cueline/update-check.json` | `%APPDATA%\Cueline\update-check.json` |

Panel settings (language, model, style, options, glossary) are kept by the panel itself.

Temporary audio exports and caption files are deleted as soon as they are used: Cueline leaves no SRT files in your
project or on disk.

## Network

No accounts, no analytics, no telemetry. Cueline goes online only to download the models you ask for and, at most
once a day, to look for a new version. See [PRIVACY.md](https://github.com/ConformLabs/cueline/blob/main/PRIVACY.md).
