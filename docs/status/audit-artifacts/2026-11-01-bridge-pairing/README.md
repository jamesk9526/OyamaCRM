# Bridge 2.0.1 verification

Packaged desktop QA passed with zero renderer errors. See bridge-checks.json and screenshots. Five focused API/parser tests and fifteen desktop unit tests passed. Web/server typechecks and targeted lint passed. Initial CRM fixture browser run passed; a later repeat stalled and is not counted as additional verification. Live Edge access remains blocked by the browser tool setting response, so live CRM end-to-end verification remains outstanding.

Installer: OyamaBridgeDesktopServer/release/Oyama-Bridge-Setup-2.0.1.exe (unsigned).
SHA256: 63B694B1188D3EC224AA15169EA83AC1A337677C19A186F59F35375C8CB80DEB

Screenshots use isolated QA profiles and synthetic CRM data. Deploy CRM changes before using desktop Sign in and connect CRM. No production deployment or installed-app replacement was performed.

Rebuilt with immediate GPU save/restart, stale-draft fix, verified Ollama port reclamation, and collapsed advanced settings. Packaged desktop QA passed again. Physical GPU inference remains unverified for this build.

