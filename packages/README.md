# Workspace libraries

Library directories and npm names both use the `orcabot-xxx` convention. Applications
remain under `apps/`; library dependencies use pnpm `workspace:*` links.

| Package                                                  | Responsibility                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `orcabot-contracts`                                      | Validated application contracts and event projections           |
| `orcabot-store`                                          | SQLite state and durable execution history                      |
| `orcabot-runtime`                                        | OctoRuntime client and cross-machine execution bridge transport |
| `orcabot-workflows`                                      | Versioned workflow definition and transition validation         |
| [orcabot-cross-service](orcabot-cross-service/README.md) | Native current-user service lifecycle management                |

`orcabot-cross-service` manages persistent processes on the host OS. It is separate
from the cross-machine execution bridge in `orcabot-runtime`. Importing it does not
install a service, and the application CLI does not yet expose its lifecycle verbs.

`orcabot-client` provides the headless Board client used by the worker CLI and
external trusted-operator scripts. Callers retain command IDs for uncertain retries.
