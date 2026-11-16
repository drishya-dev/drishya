# Contributor decisions

These decisions summarize the product and engineering rules that contributors need when changing Drishya. The implementation and contracts supply the details.

The [decisions log](log.md) holds every individual decision with its reason, newest first. Read the matching entry before changing an area, and add a new entry (do not edit an old one) when you change a decision.

## Local capture and explicit control

The supported product runs on a desktop and observes local harness recordings. The capture path opens native journals read-only and redacts content before it enters the store. The collector and the presentation run independently so that reading a session cannot interrupt observation. Drishya serves its UI on loopback and has no telemetry.

An opt-in controller can send a prompt to a selected native session after workspace consent and confirmation that the session is idle in other clients. The native harness owns its normal writes and applies its policy. See the [codebase map](../CODEBASE.md) and [privacy description](../../README.md#privacy).

## Evidence, provenance and replay

Keep the distinction between recorded content and derived presentation. Label derived claims and support them with recorded evidence. Keep an unresolved file location or operation relationship explicit when the harness has insufficient evidence to resolve it. In particular, temporal adjacency alone does not prove causation.

The composer uses injected time so the same inputs can reproduce the same scene. The desktop UI keeps captured text in the DOM for reading and selection. Motion explains the source or destination of a real surface and stays interruptible. See the [event schema](../reference/03-event-schema.md) and [canvas contract](../reference/04-continuous-canvas.md).

## Reproducible builds and representative verification

Node 24 and the frozen pnpm lockfile define the development build. Each worktree uses its own install so workspace package resolution stays inside that checkout. The CLI bundles internal packages into an installable tarball without runtime npm dependencies.

Use synthetic fixtures to make regressions repeatable. For changes to the display or projection of captured content, exercise real sessions in a scratch Drishya home and record only approved metadata. Keep personal recordings and screenshots out of commits. See the [contribution guide](../../CONTRIBUTING.md) and [release checklist](../release-checklist.md).
