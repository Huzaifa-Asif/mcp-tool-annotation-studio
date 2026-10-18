# Security policy

Please report vulnerabilities privately through GitHub Security Advisories. Do not include live credentials or personal data. Supported release: 0.1.x.

The local server binds to `127.0.0.1`, serves a fixed route allowlist, rejects unexpected Host headers, and sets no-store and browser hardening headers. Imported strings are treated as untrusted data and inserted only through text-safe DOM properties.
