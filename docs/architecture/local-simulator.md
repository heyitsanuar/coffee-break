# EP-03 deterministic local simulator (US-015)

`npm run dev` starts the desktop with ingress dormant. `npm run dev:simulated` starts the same development app with one main-owned simulator child per Electron process. Main enables the mode only for the exact development launch flag, a development renderer URL, and an unpackaged app. There is no renderer switch or production simulator packaging.

Main starts `LocalIngress`, receives its private `{host, port, token}` launch callback, and starts the separately bundled simulator entry using the Electron executable in run-as-Node mode. One JSON launch message goes over the child's private stdin pipe. The token is not placed in argv, environment, logs, preload, or renderer. The child validates the message and uses `net.Socket` to authenticate with protocol v1, send one complete snapshot, await `snapshot-accepted`, and then run the following sequence. Main uses the same pipe to request shutdown; EOF from parent loss also stops the child. Main bounds shutdown before stopping ingress. Unexpected child exit is diagnosed without automatic restart.

| Initial agent | State | Activity |
| --- | --- | --- |
| `mock-agent-ari` / Ari | `idle` | `Ready for a task` |
| `mock-agent-mina` / Mina | `waiting` | `Waiting for changes` |
| `mock-agent-sol` / Sol | `working` | `Finishing a task` |

The run clock starts only after `snapshot-accepted`. Each event timestamp is the run-start UTC time plus its fixed offset. `source.instanceId` is a fresh secure UUID per child process, prefixed `sim-`; event IDs repeat deterministically within each run.

| Offset | Event | Agent | State | Activity |
| --- | --- | --- | --- | --- |
| +1,000 ms | `sim-001` | Ari | `working` | `Implementing the change` |
| +2,000 ms | `sim-002` | Mina | `working` | `Reviewing the change` |
| +3,000 ms | `sim-003` | Sol | `waiting` | `Taking a coffee break in the simulated office` |
| +4,000 ms | `sim-004` | Ari | `completed` | `Change implemented` |
| +5,000 ms | `sim-005` | Mina | `completed` | `Review complete` |

The sequence runs once. After `sim-005`, the child and authenticated socket stay alive but produce no further scripted events. Shutdown cancels remaining timers and closes the socket. No real provider is contacted and no provider credentials are read.

For US-016, the exact simulation-only coffee presentation fixture is the combination `mock-agent-sol` + `waiting` + `Taking a coffee break in the simulated office`. Generic `waiting` and `idle` are not coffee. US-015 sends provider-neutral lifecycle and activity only; React/Phaser mapping, visible connection recovery, and user controls remain out of scope.


## US-017 recovery validation mode

`npm run dev:simulated:recovery` opts into a bounded two-session development scenario. Main requires both exact simulation and recovery flags, a development renderer URL, and an unpackaged application. Neither ordinary `npm run dev` nor the existing `npm run dev:simulated` scenario changes. This is not production automatic restart or a retry/backoff policy.

Session 1 uses the unchanged initial snapshot and all five events above. Two seconds after accepting `sim-005`, main requests graceful child shutdown. It waits for confirmed child termination and ingress disconnection, then waits two seconds and launches exactly one replacement. Credentials remain private main/child stdin data; no renderer control, argv token, environment token, or debug listener is introduced. The running ingress retains its token and monotonic revision. The new child has a fresh `source.instanceId` and authenticates into a new main-owned session.

Only the replacement receives a private `snapshotDelayMs: 1000` launch option. It delays its complete initial snapshot for one second after hello acknowledgment, within the existing protocol deadline. During that interval the renderer retains Session-1 Ari/Mina completed state and Sol's exact coffee activity, but is not synchronized to Session 2. React announces synchronization with last-known state. The complete snapshot atomically restores Ari idle / `Ready for a task`, Mina waiting / `Waiting for changes`, and Sol working / `Finishing a task`. Selection survives, Sol's coffee presentation ends, and the same five events run once again. Session 2 remains connected/idle after its final event; no third process is scheduled.

Main owns only this controlled process replacement; the client owns socket connection/authentication, ingress owns session validity, and the renderer store owns its independent bounded watch recovery. Unexpected exits do not create an additional restart loop. Shutdown cancels pending recovery waits, prevents future launch, requests child shutdown with bounded SIGTERM/SIGKILL fallback, and stops ingress. A replacement is never launched unless the previous process is confirmed terminated and its session disconnected.
