import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowDirectory = new URL('../.github/workflows/', import.meta.url);
const deploymentWorkflows = new Map([
  ['deploy.yml', {
    confirmation: "inputs.confirm_deploy == 'deploy-enrichment'",
    enableVariable: "vars.BNDY_ENRICHMENT_DEPLOY_ENABLED == 'true'",
  }],
  ['deploy-capture-pipeline.yml', {
    confirmation: "inputs.confirm_deploy == 'deploy-capture-and-enrichment'",
    enableVariable: "vars.BNDY_CAPTURE_PIPELINE_DEPLOY_ENABLED == 'true'",
  }],
]);

function workflowFiles(): URL[] {
  return readdirSync(workflowDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => new URL(entry.name, workflowDirectory));
}

describe('production deployment workflow boundary', () => {
  it('allows full-stack CDK deployment only in the two reviewed entry points', () => {
    const deployers = workflowFiles()
      .filter((file) => /\bcdk deploy\b/.test(readFileSync(file, 'utf8')))
      .map((file) => basename(file.pathname))
      .sort();

    expect(deployers).toEqual([...deploymentWorkflows.keys()].sort());
  });

  it.each([...deploymentWorkflows])('%s is manual, explicitly enabled and uses the deploy role', (name, gate) => {
    const workflow = readFileSync(new URL(name, workflowDirectory), 'utf8');
    const triggerBlock = workflow.slice(workflow.indexOf('on:'), workflow.indexOf('permissions:'));

    expect(triggerBlock).toContain('workflow_dispatch:');
    expect(triggerBlock).not.toContain('push:');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain(gate.confirmation);
    expect(workflow).toContain(gate.enableVariable);
    expect(workflow).toContain('secrets.AWS_DEPLOY_ROLE_ARN');
    expect(workflow).not.toContain('secrets.AWS_ROLE_ARN');
    expect(workflow).not.toMatch(/\bcdk bootstrap\b/);
  });
});
