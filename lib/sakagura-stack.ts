import * as path from 'node:path';
import {
  Aws,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export interface SakaguraStackProps extends StackProps {
  /** true のとき、スタック削除で記録（DynamoDB）も削除する */
  readonly destroyData?: boolean;
  /** CloudFront に関連付ける WAF Web ACL の ARN（us-east-1）。未指定なら WAF なし */
  readonly webAclArn?: string;
  /** ローカル開発用に Cognito のコールバックを許可するオリジン */
  readonly devOrigins?: string[];
}

export class SakaguraStack extends Stack {
  constructor(scope: Construct, id: string, props: SakaguraStackProps = {}) {
    super(scope, id, props);

    const root = path.join(__dirname, '..');

    // 蔵の記録帳：オンデマンド課金・GSI なし・TTL で古い記録を自動削除
    const table = new dynamodb.Table(this, 'BrewRecords', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: props.destroyData ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // 利用者認証：メールで自己登録。1 万 MAU までは無料枠内
    const userPool = new cognito.UserPool(this, 'Users', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 10, requireLowercase: true, requireDigits: true, requireUppercase: false, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // 日本語に対応したマネージドログイン画面を使うため Essentials（1 万 MAU まで無料）
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      userVerification: {
        emailSubject: '【杜氏の一季】メールアドレスの確認',
        emailBody: '杜氏の一季へのご登録ありがとうございます。確認コード: {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      removalPolicy: props.destroyData ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
    const loginDomain = userPool.addDomain('LoginDomain', {
      // 全世界で一意にするため、アカウント ID とコンストラクトのハッシュを含める
      cognitoDomain: { domainPrefix: `sakagura-${Aws.ACCOUNT_ID}-${this.node.addr.slice(0, 8)}` },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // API：arm64 / 256MB。AWS SDK v3 はランタイム同梱のためバンドルしない
    const api = new nodejs.NodejsFunction(this, 'ApiFunction', {
      entry: path.join(root, 'api', 'handler.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      environment: { TABLE_NAME: table.tableName, USER_POOL_ID: userPool.userPoolId },
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'node22',
        externalModules: ['@aws-sdk/*'],
      },
    });
    table.grantReadWriteData(api);

    // Function URL は IAM 認証。CloudFront（OAC）からの署名付きリクエストのみ受け付ける
    const apiUrl = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'sakagura-sumirator',
      webAclId: props.webAclArn,
      defaultRootObject: 'index.html',
      // 日本のエッジを含む最小の価格クラス
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: origins.FunctionUrlOrigin.withOriginAccessControl(apiUrl),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          // API の Cache-Control（数秒〜1 分）に従ってキャッシュし、Lambda 呼び出しを減らす
          cachePolicy: new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
            defaultTtl: Duration.seconds(0),
            minTtl: Duration.seconds(0),
            maxTtl: Duration.minutes(5),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('limit'),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
    });

    // ログイン画面（Cognito マネージドログイン）用のアプリクライアント。認可コード + PKCE
    const siteOrigin = `https://${distribution.distributionDomainName}`;
    const redirectUrls = [`${siteOrigin}/`, ...(props.devOrigins ?? []).map((o) => `${o.replace(/\/$/, '')}/`)];
    const webClient = userPool.addClient('WebClient', {
      generateSecret: false,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: redirectUrls,
        logoutUrls: redirectUrls,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });
    new cognito.CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: userPool.userPoolId,
      clientId: webClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    // ビルド済みフロントエンド（npm run build:web で web/dist に出力）を 2 回に分けて配置する。
    // 1) JS・CSS・画像：ファイル名に内容のハッシュが付くため、1 年間キャッシュしてよい（immutable）。
    //    古いファイルも残す（prune: false）。配信中の古い index.html が参照している間に消さないため
    const siteDir = path.join(root, 'web', 'dist');
    const assetsDeployment = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset(siteDir)],
      destinationBucket: siteBucket,
      exclude: ['index.html', 'config.json'],
      prune: false,
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
      memoryLimit: 256,
    });
    // 2) index.html と、デプロイ時に決まる認証設定（config.json）：名前が変わらないので毎回確認させる（no-cache）
    const siteDeployment = new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [
        s3deploy.Source.asset(siteDir),
        s3deploy.Source.jsonData('config.json', {
          authDomain: loginDomain.baseUrl(),
          clientId: webClient.userPoolClientId,
        }),
      ],
      destinationBucket: siteBucket,
      exclude: ['*'],
      include: ['index.html', 'config.json'],
      prune: false,
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 256,
    });
    // 新しい JS・CSS・画像を置いてから index.html を差し替える
    siteDeployment.node.addDependency(assetsDeployment);

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
  }
}
