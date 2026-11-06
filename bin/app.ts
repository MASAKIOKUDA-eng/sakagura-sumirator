#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SakaguraStack } from '../lib/sakagura-stack';

const app = new App();

new SakaguraStack(app, app.node.tryGetContext('stackName') ?? 'SakaguraSumirator', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  destroyData: app.node.tryGetContext('destroyData') === 'true' || app.node.tryGetContext('destroyData') === true,
});
