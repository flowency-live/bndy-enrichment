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

    const dlq = new sqs.Queue(this, 'GoogleDiscoveryDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    const queue = new sqs.Queue(this, 'GoogleDiscoveryQueue', {
      visibilityTimeout: cdk.Duration.minutes(6),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    const captureDlq = new sqs.Queue(this, 'CaptureProcessingDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    const captureQueue = new sqs.Queue(this, 'CaptureProcessingQueue', {
      visibilityTimeout: cdk.Duration.minutes(7),
      deadLetterQueue: { queue: captureDlq, maxReceiveCount: 3 },
    });

    const geminiSecret = new secretsmanager.Secret(this, 'GeminiApiKey', {
      description: 'Set JSON value to {"apiKey":"..."} after deployment.',
      generateSecretString: {
        secretStringTemplate: '{}',
        generateStringKey: 'placeholder',
        excludePunctuation: true,
      },
    });

    const bndyServiceSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'BndyMcpServiceSecret',
      'bndy/mcp-service',
    );
    const captureServiceSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'BndyCaptureServiceSecret',
      'bndy/capture-service',
    );

    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    };

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

    worker.addEventSource(new sources.SqsEventSource(queue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
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
      environment: {
        GOOGLE_QUEUE_URL: queue.queueUrl,
        STATE_TABLE: table.tableName,
      },
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
    captureProcessor.addEventSource(new sources.SqsEventSource(captureQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
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
  }
}
