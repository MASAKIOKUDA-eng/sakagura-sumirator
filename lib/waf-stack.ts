import { CfnOutput, Stack, type StackProps, aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export const WAF_OUTPUT_NAME = 'WebAclArn';

export interface WafStackProps extends StackProps {
  /** 同一 IP から 5 分間に許可するリクエスト数 */
  readonly rateLimit?: number;
}

/**
 * CloudFront 用の WAF。CloudFront に付ける Web ACL は us-east-1 にしか作れないため、
 * 本体スタックとは別スタックにする。
 *
 * 費用の目安：Web ACL 5 USD/月 ＋ ルール 3 つ × 1 USD/月 ＋ 100 万リクエストあたり 0.6 USD
 */
export class WafStack extends Stack {
  constructor(scope: Construct, id: string, props: WafStackProps = {}) {
    super(scope, id, props);

    const visibility = (name: string): wafv2.CfnWebACL.VisibilityConfigProperty => ({
      metricName: name,
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
    });

    const managed = (priority: number, name: string): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
      visibilityConfig: visibility(name),
    });

    const acl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: visibility('sakagura-web-acl'),
      rules: [
        {
          // 大量アクセス（DoS・総当たり・API の乱用）を IP 単位で遮断
          name: 'RateLimitPerIp',
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: props.rateLimit ?? 300,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: visibility('RateLimitPerIp'),
        },
        // OWASP Top 10 相当の一般的な攻撃（XSS、パストラバーサル、過大なリクエスト等）
        managed(1, 'AWSManagedRulesCommonRuleSet'),
        // Log4j などの既知の脆弱性を狙う不正な入力
        managed(2, 'AWSManagedRulesKnownBadInputsRuleSet'),
      ],
    });

    new CfnOutput(this, WAF_OUTPUT_NAME, { value: acl.attrArn });
  }
}
