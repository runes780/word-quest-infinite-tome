# Release Checklist

Use this checklist before publishing a GitHub release or claiming a stable milestone.

## Scope

- [ ] Release scope is described in `CHANGELOG.md`.
- [ ] Known limitations are current and do not overclaim production use.
- [ ] Public screenshots use synthetic or generic data only.
- [ ] README feature status matches implemented behavior.
- [ ] ROADMAP and TODO are updated if priorities changed.

## Verification

Use Node 24 LTS from `.nvmrc`.

Run the full check sequence:

```bash
npm run lint
npm test
npm run test:eval
npm run build
npm run test:e2e
```

Record the command output summary in the release notes or PR.

## Privacy and AI Safety

- [ ] No real student data, classroom records, school IDs, private reports, or API keys are included.
- [ ] Any new AI prompt or provider data flow is documented.
- [ ] Generated educational content remains human-reviewable.
- [ ] The generated-content seven-axis baseline passes on synthetic fixtures.
- [ ] Fallback behavior is described for API failure, rate limits, malformed output, and empty output.
- [ ] Report exports and screenshots are reviewed for privacy risk.
- [ ] Image and print/PDF report exports show the privacy contract and require a fresh acknowledgement.

## Maintenance Evidence

- [ ] Relevant issue templates or public issues exist for follow-up work.
- [ ] High-risk changes have focused tests.
- [ ] Security-sensitive changes have review notes.
- [ ] Release notes separate shipped behavior from planned work.

## Release Notes Template

```markdown
## Summary

Short description of the release.

## Added

- 

## Changed

- 

## Fixed

- 

## Tests

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

## Privacy and AI Safety

- 

## Known Limits

- 
```
