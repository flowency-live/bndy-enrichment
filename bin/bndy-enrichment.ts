#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BndyEnrichmentStack } from '../lib/bndy-enrichment-stack.js';

const app = new cdk.App();
new BndyEnrichmentStack(app, 'BndyEnrichmentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'eu-west-2',
  },
});
