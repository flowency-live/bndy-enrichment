# Deployment

## Local

1. Configure AWS credentials.
2. Obtain a Gemini Developer API key.
3. `npm install`
4. `npx cdk bootstrap`
5. `npm run deploy`
6. Set the CloudFormation output `GeminiSecretArn` to JSON `{"apiKey":"..."}`.
7. Invoke `ScanPlanner` with an `entities` array.

Example payload:

```json
{
  "entities": [
    {
      "type": "artist",
      "bndyId": "artist-example",
      "name": "Example Band",
      "town": "Northwich",
      "region": "Cheshire"
    }
  ]
}
```

## GitHub Actions

Set GitHub environment/repository secrets:

- `AWS_ROLE_ARN`
- `GEMINI_API_KEY`

Then manually run `deploy-aws`.

Prefer GitHub OIDC over long-lived AWS access keys. Restrict the role trust policy to `flowency-live/bndy-enrichment` and, ideally, the `production` GitHub environment.

## Deliberate gaps

- The planner is not yet wired to bndy's real entity API because that contract has not been supplied.
- Production writes to bndy are deliberately absent until recall/precision are measured.
- Facebook remains an isolated experiment and does not run in the AWS stack yet.
