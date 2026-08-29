import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class BndyEnrichmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'StateTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'SourceScheduleIndex',
      partitionKey: { name: 'GSI_SCHEDULE_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI_SCHEDULE_SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'ObservationClaimsIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'SubjectClaimsIndex',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const captureImagesBucket = s3.Bucket.fromBucketName(
      this,
      'CaptureImagesBucket',
      `bndy-capture-images-${this.account}-${this.region}`,
    );

    const dlq = new sqs.Queue(this, 'GoogleDiscoveryDLQ', { retentionPeriod: cdk.Duration.days(14) });
    const queue = new sqs.Queue(this, 'GoogleDiscoveryQueue', {
      visibilityTimeout: cdk.Duration.minutes(6),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    const captureDlq = new sqs.Queue(this, 'CaptureProcessingDLQ', { retentionPeriod: cdk.Duration.days(14) });
    const captureQueue = new sqs.Queue(this, 'CaptureProcessingQueue', {
      visibilityTimeout: cdk.Duration.minutes(7),
      deadLetterQueue: { queue: captureDlq, maxReceiveCount: 3 },
    });

    const sourceScanDlq = new sqs.Queue(this, 'SourceScanDLQ', { retentionPeriod: cdk.Duration.days(14) });
    // Failed delivery copies from superseded source reconciliations can be moved
    // here for short-lived forensic retention. Keeping them off the active DLQ
    // lets a fresh owned reconciliation prove current completeness without
    // deleting evidence or blindly replaying stale requests.
    const historicalSourceFailureQuarantine = new sqs.Queue(this, 'HistoricalSourceFailureQuarantine', {
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const sourceScanQueue = new sqs.Queue(this, 'SourceScanQueue', {
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: { queue: sourceScanDlq, maxReceiveCount: 3 },
    });

    const browserScanDlq = new sqs.Queue(this, 'BrowserScanDLQ', { retentionPeriod: cdk.Duration.days(14) });
    const browserScanQueue = new sqs.Queue(this, 'BrowserScanQueue', {
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: { queue: browserScanDlq, maxReceiveCount: 3 },
    });

    const projectionDlq = new sqs.Queue(this, 'ProjectionDLQ', { retentionPeriod: cdk.Duration.days(14) });
    const projectionQueue = new sqs.Queue(this, 'ProjectionQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: { queue: projectionDlq, maxReceiveCount: 3 },
    });

    const entityEnrichmentDlq = new sqs.Queue(this, 'EntityEnrichmentDLQ', { retentionPeriod: cdk.Duration.days(14) });
    const entityEnrichmentQueue = new sqs.Queue(this, 'EntityEnrichmentQueue', {
      visibilityTimeout: cdk.Duration.minutes(6),
      deadLetterQueue: { queue: entityEnrichmentDlq, maxReceiveCount: 3 },
    });

    const geminiSecret = new secretsmanager.Secret(this, 'GeminiApiKey', {
      description: 'Set JSON value to {"apiKey":"..."} after deployment.',
      generateSecretString: {
        secretStringTemplate: '{}',
        generateStringKey: 'placeholder',
        excludePunctuation: true,
      },
    });

    const bndyServiceSecret = secretsmanager.Secret.fromSecretNameV2(this, 'BndyMcpServiceSecret', 'bndy/mcp-service');
    const captureServiceSecret = secretsmanager.Secret.fromSecretNameV2(this, 'BndyCaptureServiceSecret', 'bndy/capture-service');

    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    };

    // Claim V2 authority is consumed asynchronously from the canonical BNDY
    // claims table. Raw claimant evidence is transient only; the worker stores
    // the privacy-minimised AuthorityAssertion defined by ADR-111.
    const claimStreamArn = ssm.StringParameter.valueForStringParameter(this, '/bndy/claims/stream-arn');
    const entityClaimsTable = dynamodb.Table.fromTableAttributes(this, 'EntityClaimsTable', {
      tableName: 'bndy-entity-claims',
      tableStreamArn: claimStreamArn,
    });
    const claimAuthorityStreamWorker = new lambdaNode.NodejsFunction(this, 'ClaimAuthorityStreamWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/claim-authority-stream-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: { STATE_TABLE: table.tableName },
      bundling: { minify: true, sourceMap: true },
    });
    claimAuthorityStreamWorker.addEventSource(new sources.DynamoEventSource(entityClaimsTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 10,
      retryAttempts: 3,
      bisectBatchOnError: true,
    }));
    entityClaimsTable.grantStreamRead(claimAuthorityStreamWorker);
    table.grantReadWriteData(claimAuthorityStreamWorker);

    const sourceDispatcher = new lambdaNode.NodejsFunction(this, 'SourceDispatcher', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/source-dispatcher.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        STATE_TABLE: table.tableName,
        SOURCE_SCAN_QUEUE_URL: sourceScanQueue.queueUrl,
        BROWSER_SCAN_QUEUE_URL: browserScanQueue.queueUrl,
        PROJECTION_QUEUE_URL: projectionQueue.queueUrl,
      },
      bundling: { minify: true, sourceMap: true },
    });
    table.grantReadWriteData(sourceDispatcher);
    sourceScanQueue.grantSendMessages(sourceDispatcher);
    browserScanQueue.grantSendMessages(sourceDispatcher);

    new events.Rule(this, 'SourceDispatchTick', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(sourceDispatcher)],
    });

    const sourceWorkerEnvironment = {
      STATE_TABLE: table.tableName,
      EVIDENCE_BUCKET: evidenceBucket.bucketName,
      PROJECTION_QUEUE_URL: projectionQueue.queueUrl,
      SOURCE_SCAN_QUEUE_URL: sourceScanQueue.queueUrl,
    };

    const sourceWorker = new lambdaNode.NodejsFunction(this, 'SourceWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/source-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(14),
      memorySize: 1024,
      // Lemonrock intermittently resets bursty AWS-origin traffic. Keep this
      // worker deliberately small so recovery makes steady progress without
      // amplifying retries against the source.
      reservedConcurrentExecutions: 2,
      environment: sourceWorkerEnvironment,
      bundling: { minify: true, sourceMap: true },
    });
    sourceWorker.addEventSource(new sources.SqsEventSource(sourceScanQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 2,
    }));
    table.grantReadWriteData(sourceWorker);
    evidenceBucket.grantReadWrite(sourceWorker);
    projectionQueue.grantSendMessages(sourceWorker);
    sourceScanQueue.grantSendMessages(sourceWorker);

    const browserSourceWorker = new lambdaNode.NodejsFunction(this, 'BrowserSourceWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/browser-source-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(14),
      memorySize: 3072,
      environment: {
        STATE_TABLE: table.tableName,
        EVIDENCE_BUCKET: evidenceBucket.bucketName,
        PROJECTION_QUEUE_URL: projectionQueue.queueUrl,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        nodeModules: ['@sparticuz/chromium', 'puppeteer-core'],
      },
    });
    browserSourceWorker.addEventSource(new sources.SqsEventSource(browserScanQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
    table.grantReadWriteData(browserSourceWorker);
    evidenceBucket.grantReadWrite(browserSourceWorker);
    projectionQueue.grantSendMessages(browserSourceWorker);

    const projectionWorker = new lambdaNode.NodejsFunction(this, 'ProjectionWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/projection-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(4),
      memorySize: 1024,
      environment: {
        STATE_TABLE: table.tableName,
        ENTITY_ENRICHMENT_QUEUE_URL: entityEnrichmentQueue.queueUrl,
        BNDY_API_BASE: 'https://api.bndy.co.uk',
        BNDY_SERVICE_SECRET_NAME: 'bndy/mcp-service',
      },
      bundling: { minify: true, sourceMap: true },
    });
    projectionWorker.addEventSource(new sources.SqsEventSource(projectionQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
    table.grantReadWriteData(projectionWorker);
    entityEnrichmentQueue.grantSendMessages(projectionWorker);
    bndyServiceSecret.grantRead(projectionWorker);

    // Backline Evidence Explorer admin read API. Read-only bounded graph
    // traversal over the knowledge substrate for the Godmode explorer.
    // Bearer-authenticated in-handler with the BNDY service token; the
    // Function URL itself is open so the explorer page can call it directly.
    const backlineAdminApi = new lambdaNode.NodejsFunction(this, 'BacklineAdminApi', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/backline-admin-api.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        STATE_TABLE: table.tableName,
        BNDY_SERVICE_SECRET_NAME: 'bndy/mcp-service',
      },
      bundling: { minify: true, sourceMap: true },
    });
    table.grantReadData(backlineAdminApi);
    bndyServiceSecret.grantRead(backlineAdminApi);
    const backlineAdminApiUrl = backlineAdminApi.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ['authorization', 'content-type'],
      },
    });
    new cdk.CfnOutput(this, 'BacklineAdminApiUrl', { value: backlineAdminApiUrl.url });

    const trustLoop = new lambdaNode.NodejsFunction(this, 'TrustLoop', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/trust-loop.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      environment: { STATE_TABLE: table.tableName },
      bundling: { minify: true, sourceMap: true },
    });
    table.grantReadWriteData(trustLoop);
    new events.Rule(this, 'TrustLoopDailyClassification', {
      schedule: events.Schedule.cron({ minute: '35', hour: '3' }),
      targets: [new targets.LambdaFunction(trustLoop)],
    });

    // Lemonrock fast-change surfaces are scheduled directly into the durable source queue.
    // The source family remains registry-backed and shadow/no-write; these rules only create observations/claims.
    new events.Rule(this, 'LemonrockFastGigTick', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [
        new targets.SqsQueue(sourceScanQueue, {
          message: events.RuleTargetInput.fromObject({ sourceId: 'lemonrock-new-gigs', reason: 'scheduled' }),
        }),
        new targets.SqsQueue(sourceScanQueue, {
          message: events.RuleTargetInput.fromObject({ sourceId: 'lemonrock-cancellations', reason: 'scheduled' }),
        }),
      ],
    });

    // On The Case steady state is gig-led. The hourly complete /gigs snapshot
    // is the only scheduled root; venue and band profiles are child hydration only.
    new events.Rule(this, 'OnTheCaseHourlyGigTick', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [
        new targets.SqsQueue(sourceScanQueue, {
          message: events.RuleTargetInput.fromObject({ sourceId: 'onthecase-gig-index', reason: 'scheduled' }),
        }),
      ],
    });

    // One cheap root-page acquisition proves the future-gig surface is reachable
    // and structurally recognisable without starting national child-task fan-out.
    new events.Rule(this, 'LemonrockDailyHealthCheck', {
      schedule: events.Schedule.cron({ minute: '10', hour: '2' }),
      targets: [
        new targets.SqsQueue(sourceScanQueue, {
          message: events.RuleTargetInput.fromObject({
            sourceId: 'lemonrock-future-reconcile',
            reason: 'scheduled',
            task: { kind: 'future-health', url: 'https://www.lemonrock.com/gigsbycounty.php' },
          }),
        }),
      ],
    });

    // A monthly future-gig sweep repairs gaps economically. Artist and venue
    // profiles are hydrated only when a discovered gig references them.
    new events.Rule(this, 'LemonrockMonthlyFutureReconcile', {
      schedule: events.Schedule.cron({ minute: '20', hour: '2', day: '1' }),
      targets: [
        new targets.SqsQueue(sourceScanQueue, {
          message: events.RuleTargetInput.fromObject({
            sourceId: 'lemonrock-future-reconcile',
            reason: 'scheduled',
            task: { kind: 'future-index', url: 'https://www.lemonrock.com/gigsbycounty.php' },
          }),
        }),
      ],
    });

    const worker = new lambdaNode.NodejsFunction(this, 'GoogleDiscoveryWorker', {
      ...common,
      entry: 'src/handlers/google-discovery.ts',
      handler: 'handler',
      environment: {
        STATE_TABLE: table.tableName,
        GEMINI_SECRET_ARN: geminiSecret.secretArn,
        GEMINI_MODEL: 'gemini-3.6-flash',
        SEARCH_HORIZON_DAYS: '90',
        EVIDENCE_BUCKET: evidenceBucket.bucketName,
      },
      bundling: { minify: true, sourceMap: true },
    });
    worker.addEventSource(new sources.SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: true }));
    table.grantWriteData(worker);
    geminiSecret.grantRead(worker);
    evidenceBucket.grantReadWrite(worker);

    const planner = new lambdaNode.NodejsFunction(this, 'ScanPlanner', {
      ...common,
      entry: 'src/handlers/scan-planner.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      environment: { GOOGLE_QUEUE_URL: queue.queueUrl, STATE_TABLE: table.tableName },
      bundling: { minify: true, sourceMap: true },
    });
    queue.grantSendMessages(planner);
    table.grantReadData(planner);

    new events.Rule(this, 'DailyScanRule', {
      schedule: events.Schedule.cron({ minute: '15', hour: '3' }),
      targets: [new targets.LambdaFunction(planner, {
        event: events.RuleTargetInput.fromObject({ entities: [] }),
      })],
    });

    const captureProcessor = new lambdaNode.NodejsFunction(this, 'CaptureProcessor', {
      ...common,
      functionName: 'bndy-capture-processor',
      entry: 'src/handlers/capture-processor.ts',
      handler: 'handler',
      environment: {
        GEMINI_SECRET_ARN: geminiSecret.secretArn,
        GEMINI_MODEL: 'gemini-3.6-flash',
        SEARCH_HORIZON_DAYS: '90',
        CAPTURE_API_BASE: 'https://capture.bndy.co.uk',
        CAPTURE_SECRET_NAME: 'bndy/capture-service',
        BNDY_API_BASE: 'https://api.bndy.co.uk',
        BNDY_SERVICE_SECRET_NAME: 'bndy/mcp-service',
      },
      bundling: { minify: true, sourceMap: true },
    });
    captureProcessor.addEventSource(new sources.SqsEventSource(captureQueue, { batchSize: 1, reportBatchItemFailures: true }));
    geminiSecret.grantRead(captureProcessor);
    captureServiceSecret.grantRead(captureProcessor);
    bndyServiceSecret.grantRead(captureProcessor);
    captureImagesBucket.grantRead(captureProcessor);

    const captureScanner = new lambdaNode.NodejsFunction(this, 'CaptureScanner', {
      runtime: lambda.Runtime.NODEJS_22_X,
      functionName: 'bndy-capture-scan',
      entry: 'src/handlers/capture-scan.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        CAPTURE_QUEUE_URL: captureQueue.queueUrl,
        CAPTURE_SCAN_LIMIT: '25',
        CAPTURE_API_BASE: 'https://capture.bndy.co.uk',
        CAPTURE_SECRET_NAME: 'bndy/capture-service',
      },
      bundling: { minify: true, sourceMap: true },
    });
    captureQueue.grantSendMessages(captureScanner);
    captureServiceSecret.grantRead(captureScanner);

    new events.Rule(this, 'CaptureScanRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(captureScanner)],
    });

    new cdk.CfnOutput(this, 'GeminiSecretArn', { value: geminiSecret.secretArn });
    new cdk.CfnOutput(this, 'GoogleDiscoveryQueueUrl', { value: queue.queueUrl });
    new cdk.CfnOutput(this, 'ScanPlannerFunctionName', { value: planner.functionName });
    new cdk.CfnOutput(this, 'StateTableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'EvidenceBucketName', { value: evidenceBucket.bucketName });
    new cdk.CfnOutput(this, 'CaptureQueueUrl', { value: captureQueue.queueUrl });
    new cdk.CfnOutput(this, 'CaptureScannerFunctionName', { value: captureScanner.functionName });
    new cdk.CfnOutput(this, 'CaptureProcessorFunctionName', { value: captureProcessor.functionName });
    new cdk.CfnOutput(this, 'SourceScanQueueUrl', { value: sourceScanQueue.queueUrl });
    new cdk.CfnOutput(this, 'HistoricalSourceFailureQuarantineUrl', { value: historicalSourceFailureQuarantine.queueUrl });
    new cdk.CfnOutput(this, 'HistoricalSourceFailureQuarantineArn', { value: historicalSourceFailureQuarantine.queueArn });
    new cdk.CfnOutput(this, 'BrowserScanQueueUrl', { value: browserScanQueue.queueUrl });
    new cdk.CfnOutput(this, 'ProjectionQueueUrl', { value: projectionQueue.queueUrl });
    new cdk.CfnOutput(this, 'EntityEnrichmentQueueUrl', { value: entityEnrichmentQueue.queueUrl });
    new cdk.CfnOutput(this, 'SourceDispatcherFunctionName', { value: sourceDispatcher.functionName });
    new cdk.CfnOutput(this, 'SourceWorkerFunctionName', { value: sourceWorker.functionName });
    new cdk.CfnOutput(this, 'BrowserSourceWorkerFunctionName', { value: browserSourceWorker.functionName });
    new cdk.CfnOutput(this, 'ProjectionWorkerFunctionName', { value: projectionWorker.functionName });
    new cdk.CfnOutput(this, 'TrustLoopFunctionName', { value: trustLoop.functionName });
  }
}
