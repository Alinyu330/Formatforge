# Debug: QQ Music conversion failure

- Session: `qqmusic-conversion-failure`
- Status: [OPEN]
- Symptom: Pasting QQ Music Cookie still cannot decrypt and convert musicex files.

## Hypotheses

1. The GetEVkey request is rejected because the pasted Cookie is expired or lacks required authentication values.
2. Browser restrictions prevent the request from sending the manually supplied Cookie header.
3. Parsed musicex metadata does not match the GetEVkey API parameters.
4. An ekey is acquired but decryption output is invalid, causing the subsequent conversion to fail.
5. The active conversion adapter differs from the path updated for Cookie-only credentials.

## Evidence

- Runtime request completed: HTTP `200`, top-level API code `0`, subrequest code `0`.
- File metadata was parsed and echoed by the API: `songMid=002MLS0D3zqTdU`, `filename=O4M0000JNQmL2QgNl4.mgg`.
- The API returned `result=104003` and no `ekey`.
- The account can play the same track in the official QQ Music client, so an entitlement shortage is unlikely.
- The request used fixed `guid=10000` and `songtype=1`; public GetEVkey implementations generally use a session-associated guid and `songtype=0` for normal tracks.

## Applied fix awaiting verification

- Read `guid` from the pasted Cookie's `pgv_pvid` value when available.
- Change the GetEVkey request `songtype` from `1` to `0`.
- Preserve development-only, redacted diagnostics until the user confirms the outcome.
