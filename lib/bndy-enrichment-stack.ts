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

export class BndyEnrichmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'StateTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
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
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(sourceDispatcher)],
    });

    const sourceWorkerEnvironment = {
      STATE_TABLE: table.tableName,
      EVIDENCE_BUCKET: evidenceBucket.bucketName,
      PROJECTION_QUEUE_URL: projectionQueue.queueUrl,
    };

    const sourceWorker = new lambdaNode.NodejsFunction(this, 'SourceWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/source-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(14),
      memorySize: 1024,
      environment: sourceWorkerEnvironment,
      bundling: { minify: true, sourceMap: true },
    });
    sourceWorker.addEventSource(new sources.SqsEventSource(sourceScanQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
    table.grantReadWriteData(sourceWorker);
    evidenceBucket.grantReadWrite(sourceWorker);
    projectionQueue.grantSendMessages(sourceWorker);

    const browserSourceWorker = new lambdaNode.NodejsFunction(this, 'BrowserSourceWorker', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/browser-source-worker.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(14),
      memorySize: 3072,
      environment: sourceWorkerEnvironment,
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

    // Import existing bndy tables for enrichment write-back
    const artistsTable = dynamodb.Table.fromTableArn(this, 'ArtistsTable',
      `arn:aws:dynamodb:${this.region}:${this.account}:table/bndy-artists`);
    const venuesTable = dynamodb.Table.fromTableArn(this, 'VenuesTable',
      `arn:aws:dynamodb:${this.region}:${this.account}:table/bndy-venues`);

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
        ARTISTS_TABLE: artistsTable.tableName,
        VENUES_TABLE: venuesTable.tableName,
      },
      bundling: { minify: true, sourceMap: true },
    });
    worker.addEventSource(new sources.SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: true }));
    table.grantWriteData(worker);
    artistsTable.grantWriteData(worker);
    venuesTable.grantWriteData(worker);
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

    // Legacy enrichment planner remains until its migration package retires it.
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
    new cdk.CfnOutput(this, 'CaptureQueueUrl', { value: captureQueue.queueUrl });
    new cdk.CfnOutput(this, 'CaptureScannerFunctionName', { value: captureScanner.functionName });
    new cdk.CfnOutput(this, 'CaptureProcessorFunctionName', { value: captureProcessor.functionName });
    new cdk.CfnOutput(this, 'SourceScanQueueUrl', { value: sourceScanQueue.queueUrl });
    new cdk.CfnOutput(this, 'BrowserScanQueueUrl', { value: browserScanQueue.queueUrl });
    new cdk.CfnOutput(this, 'ProjectionQueueUrl', { value: projectionQueue.queueUrl });
    new cdk.CfnOutput(this, 'SourceDispatcherFunctionName', { value: sourceDispatcher.functionName });
    new cdk.CfnOutput(this, 'SourceWorkerFunctionName', { value: sourceWorker.functionName });
    new cdk.CfnOutput(this, 'BrowserSourceWorkerFunctionName', { value: browserSourceWorker.functionName });
  }
}
