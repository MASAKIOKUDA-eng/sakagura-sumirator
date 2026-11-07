#!/usr/bin/env node
import { App, Fn } from 'aws-cdk-lib';
import { SakaguraStack } from '../lib/sakagura-stack';
import { WAF_OUTPUT_NAME, WafStack } from '../lib/waf-stack';

const app = new App();
const ctx = (key: string) => app.node.tryGetContext(key);
const flag = (key: string, fallback: boolean) => {
  const v = ctx(key);
  return v === undefined ? fallback : v === true || v === 'true';
};

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';
const stackName: string = ctx('stackName') ?? 'SakaguraSumirator';

// WAF は月額固定費（約 8 USD）がかかるため、-c waf=false で無効にできる
let webAclArn: string | undefined;
let waf: WafStack | undefined;
if (flag('waf', true)) {
  const wafStackName = `${stackName}-Waf`;
  waf = new WafStack(app, wafStackName, { env: { account, region: 'us-east-1' } });
  // リージョンをまたぐ参照（Fn::GetStackOutput）。cdkd・CloudFormation の両方で解決できる
  webAclArn = Fn.getStackOutput(wafStackName, WAF_OUTPUT_NAME, 'us-east-1');
}

const main = new SakaguraStack(app, stackName, {
  env: { account, region },
  destroyData: flag('destroyData', false),
  webAclArn,
  devOrigins: flag('allowLocalhost', false) ? ['http://localhost:8000'] : [],
});
if (waf) main.addStackDependency(waf, 'CloudFront に WAF の Web ACL を関連付けるため');
