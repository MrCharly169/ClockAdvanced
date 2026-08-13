# Security policy

## Supported releases

Security fixes are evaluated for the latest published stable and current beta lines. Older releases may require an update before a fix can be applied. The repository does not promise a fixed support lifetime for every prerelease.

## Reporting a vulnerability

Do not open a public issue for a vulnerability, credential exposure, authentication bypass or report containing sensitive Home Assistant data.

Use GitHub's private [Report a vulnerability](https://github.com/MrCharly169/ClockAdvanced/security/advisories/new) form. Include:

- the affected Clock Advanced and Home Assistant versions;
- the smallest reproducible description;
- the expected security boundary and observed impact;
- whether the issue affects the integration, Card, Badge, release package or documentation;
- only sanitized logs or diagnostics.

Never include production access tokens, passwords, private notification targets, personal URLs or a full Home Assistant configuration. If private vulnerability reporting is unavailable, open a public issue that asks the maintainer to provide a private contact channel, without describing the vulnerability itself.

Please allow time for validation before public disclosure. The maintainer will coordinate scope, remediation and release notes through the private advisory when that facility is available.

For ordinary setup problems and non-sensitive bugs, use the repository's bug report form and the troubleshooting section in the README.
